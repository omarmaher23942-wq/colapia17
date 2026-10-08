import "server-only";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createGroq } from "@ai-sdk/groq";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText, generateObject, type LanguageModel, type ModelMessage, type ToolSet } from "ai";
import type { z } from "zod";
import { env } from "@/lib/env";
import { db } from "@/db/client";
import { aiCalls } from "@/db/schema";
import { getFlag } from "@/lib/flags";
import { redis } from "@/lib/redis";

const clean = (s: string | undefined, fallback: string) => (s ?? "").trim() || fallback;

const morpheus = createOpenAICompatible({
  name: "morpheus",
  baseURL: env.MORPHEUS_BASE_URL,
  apiKey: env.MORPHEUS_API_KEY,
});
const groq = createGroq({ apiKey: env.GROQ_API_KEY });
const google = createGoogleGenerativeAI({ apiKey: env.GEMINI_API_KEY });

export type Tier = "chat" | "compose" | "architect" | "fast" | "vision";
export type Provider = "morpheus" | "groq" | "google";
type Link = { provider: Provider; modelId: string; cap: number };

// نماذج أُوقفت نهائياً لدى مزوّديها: إن بقيت في متغيرات البيئة نتجاهلها بدل أن تُفشل كل استدعاء.
const RETIRED = /^gemini-(1\.|2\.0)/i;
const current = (s: string | undefined, fallback: string) => {
  const v = clean(s, fallback);
  return RETIRED.test(v) ? fallback : v;
};

export const MODELS = {
  groq70b: "llama-3.3-70b-versatile",
  groq8b: "llama-3.1-8b-instant",
  // يدعم المخرجات المنظمة الصارمة (JSON Schema) على Groq، فهو الأنسب لبناء المتجر.
  gptOss: "openai/gpt-oss-120b",
  gemini: current(env.GEMINI_MODEL, "gemini-3.8-flash"),
  geminiLite: "gemini-3.5-flash-lite",
  claude: clean(env.CLAUDE_MODEL, "claude-3-5-sonnet-20241022"),
  opus: clean(env.CLAUDE_OPUS_MODEL, "claude-3-opus-20240229"),
} as const;

const DEFAULT_CAPS: Record<string, number> = {
  [MODELS.groq70b]: 12_000,
  [MODELS.groq8b]: 6_000,
  [MODELS.gptOss]: 12_000,
  [MODELS.gemini]: 120_000,
  [MODELS.geminiLite]: 120_000,
  [MODELS.claude]: 120_000,
  [MODELS.opus]: 120_000,
};

const capOf = (provider: Provider, modelId: string) =>
  provider === "groq" ? DEFAULT_CAPS[modelId] ?? 8_000 : 120_000;

const L = (provider: Provider, modelId: string): Link => ({
  provider,
  modelId: modelId.trim(),
  cap: capOf(provider, modelId.trim()),
});

const dedupe = (links: Link[]) =>
  links.filter(
    (l, i) =>
      l.modelId &&
      links.findIndex((x) => x.provider === l.provider && x.modelId === l.modelId) === i
  );

// تم إزالة Morpheus من الخيارات الأساسية لمنع الانهيار ووضعه فقط كخيار أخير للطوارئ
const DEFAULT_CHAINS: Record<Tier, Link[]> = {
  chat: dedupe([
    L("google", MODELS.gemini),
    L("groq", MODELS.gptOss),
    L("groq", MODELS.groq70b),
    L("morpheus", MODELS.claude),
  ]),
  fast: dedupe([
    L("groq", MODELS.groq8b),
    L("google", MODELS.geminiLite),
  ]),
  architect: dedupe([
    L("google", MODELS.gemini),
    L("groq", MODELS.gptOss),
    L("groq", MODELS.groq70b),
    L("morpheus", MODELS.opus),
  ]),
  compose: dedupe([
    L("google", MODELS.gemini),
    L("groq", MODELS.gptOss),
    L("groq", MODELS.groq70b),
    L("morpheus", MODELS.claude),
  ]),
  vision: dedupe([
    L("google", MODELS.gemini),
  ]),
};

function make(l: Link): LanguageModel {
  return l.provider === "morpheus"
    ? morpheus(l.modelId)
    : l.provider === "groq"
    ? groq(l.modelId)
    : google(l.modelId);
}

export function estimateTokens(text: string): number {
  let ascii = 0,
    other = 0;
  for (let i = 0; i < text.length; i++) text.charCodeAt(i) < 128 ? ascii++ : other++;
  return Math.ceil(ascii / 3.8 + other / 2.4) + 8;
}

const msgText = (m: ModelMessage) => (typeof m.content === "string" ? m.content : JSON.stringify(m.content));
const requestTokens = (system?: string, prompt?: string, messages?: ModelMessage[], extra = "") =>
  estimateTokens((system ?? "") + (prompt ?? "") + (messages ?? []).map(msgText).join("\n") + extra);
const fits = (l: Link, need: number) => need <= l.cap * 0.92;

const cbKey = (l: Link) => `ai:cb:${l.provider}:${l.modelId}`;
const capKey = (modelId: string) => `ai:cap:${modelId}`;

async function trip(l: Link, seconds: number, reason: string) {
  try {
    await redis.set(cbKey(l), reason.slice(0, 100), { ex: Math.max(3, Math.round(seconds)) });
  } catch {}
}

async function learnCap(modelId: string, limit: number) {
  try {
    await redis.set(capKey(modelId), limit, { ex: 86_400 });
  } catch {}
}

type Kind = "too_large" | "rate" | "credits" | "timeout" | "schema" | "other";

function classify(e: unknown): { kind: Kind; cooldownS?: number; limit?: number } {
  const s = String((e as any)?.message ?? e);
  const status = Number((e as any)?.statusCode ?? (e as any)?.status ?? 0);

  if (status === 413 || /too large|tokens per minute|\bTPM\b/i.test(s)) {
    const limit = Number(/Limit\s+(\d+)/i.exec(s)?.[1]);
    return { kind: "too_large", limit: Number.isFinite(limit) && limit > 0 ? limit : undefined };
  }
  if (status === 429 || /rate.?limit|quota|exceeded/i.test(s)) {
    const m = /try again in\s*([\d.]+)\s*(ms|s|m)\b/i.exec(s);
    let cd = 60;
    if (m) {
      const v = parseFloat(m[1]!);
      cd = m[2] === "ms" ? v / 1000 : m[2] === "m" ? v * 60 : v;
      cd = Math.min(Math.max(cd + 1, 5), 120);
    }
    if (/per.?day|daily|PerDay|RPD|TPD/i.test(s)) cd = 1_800;
    return { kind: "rate", cooldownS: cd };
  }
  if (status === 402 || /insufficient credits|payment required|credit balance|bid is above/i.test(s)) {
    return { kind: "credits", cooldownS: 3600 }; // تجميد أطول لمشكلة الرصيد
  }
  if (/timeout|aborted/i.test(s)) return { kind: "timeout" };
  if (/schema|zod|json|no json object/i.test(s)) return { kind: "schema" };
  return { kind: "other" };
}

async function afterFailure(l: Link, e: unknown) {
  const c = classify(e);
  if (c.kind === "too_large" && c.limit) await learnCap(l.modelId, c.limit);
  if ((c.kind === "rate" || c.kind === "credits") && c.cooldownS) {
    await trip(l, c.cooldownS, `${c.kind}: ${String(e).slice(0, 60)}`);
  }
  return c;
}

async function chain(tier: Tier, need: number): Promise<Link[]> {
  let base = DEFAULT_CHAINS[tier];
  try {
    const { config } = await getFlag<Record<string, string | null>>("models");
    const o = config?.[tier];
    if (o && o.includes(":")) {
      const [provider, modelId] = o.split(":") as [Provider, string];
      if (["morpheus", "groq", "google"].includes(provider)) {
        base = dedupe([L(provider, modelId), ...base]);
      }
    }
  } catch {}

  let links = base;
  try {
    const keys = [...base.map(cbKey), ...base.map((l) => capKey(l.modelId))];
    const vals = (await redis.mget<(string | number | null)[]>(...keys)) ?? [];
    const n = base.length;
    links = base
      .map((l, i) => ({ ...l, cap: Number(vals[n + i]) > 0 ? Number(vals[n + i]) : l.cap, open: !!vals[i] }))
      .filter((l) => !l.open)
      .map(({ open: _o, ...l }) => l);
  } catch {}

  if (!links.length) links = base;
  const fit = links.filter((l) => fits(l, need));
  const unfit = links.filter((l) => !fits(l, need)).sort((a, b) => b.cap - a.cap);
  return [...fit, ...unfit];
}

export type Meta = { purpose: string; storeId?: string; conversationId?: string };
type Usage = { inputTokens?: number; outputTokens?: number } | undefined;

async function log(meta: Meta, l: Link, t0: number, usage: Usage, err?: unknown, fallbackFrom?: string) {
  try {
    await db.insert(aiCalls).values({
      purpose: meta.purpose,
      provider: l.provider,
      model: l.modelId,
      storeId: meta.storeId,
      conversationId: meta.conversationId,
      tokensIn: usage?.inputTokens ?? 0,
      tokensOut: usage?.outputTokens ?? 0,
      latencyMs: Date.now() - t0,
      ok: !err,
      error: err ? String(err).slice(0, 500) : undefined,
      fallbackFrom,
    });
  } catch {}
}

const MIN_ATTEMPT_MS = 2_500;
const withTimeout = <T>(p: Promise<T>, ms: number) =>
  Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`timeout ${ms}ms`)), ms)),
  ]);
const abortAfter = (ms: number) => AbortSignal.timeout(Math.max(1, Math.floor(ms)));

type PromptArgs = { prompt: string; messages?: undefined } | { messages: ModelMessage[]; prompt?: undefined };
const toPrompt = (prompt?: string, messages?: ModelMessage[]): PromptArgs =>
  messages?.length ? { messages } : { prompt: prompt ?? "" };

export async function aiText(
  tier: Tier,
  args: {
    system?: string;
    messages: ModelMessage[];
    tools?: ToolSet;
    temperature?: number;
    maxTokens?: number;
    timeoutMs?: number;
    budgetMs?: number;
  },
  meta: Meta
) {
  const deadline = Date.now() + (args.budgetMs ?? Number.POSITIVE_INFINITY);
  const maxOut = args.maxTokens ?? 800;
  const need = requestTokens(args.system, undefined, args.messages) + maxOut;
  let fallbackFrom: string | undefined;
  let lastErr: unknown;

  for (const l of await chain(tier, need)) {
    const left = deadline - Date.now();
    if (left < MIN_ATTEMPT_MS) {
      lastErr = lastErr ?? new Error("time budget exhausted");
      break;
    }
    const ms = Math.min(args.timeoutMs ?? 25_000, left);
    const t0 = Date.now();
    try {
      const r = await withTimeout(
        generateText({
          model: make(l),
          system: args.system,
          messages: args.messages,
          tools: args.tools,
          temperature: args.temperature ?? 0.7,
          maxOutputTokens: maxOut,
          maxRetries: 0,
          abortSignal: abortAfter(ms),
        }),
        ms
      );
      await log(meta, l, t0, r.usage, undefined, fallbackFrom);
      return { text: r.text, toolCalls: r.toolCalls, usage: r.usage, provider: `${l.provider}:${l.modelId}` };
    } catch (e) {
      lastErr = e;
      await afterFailure(l, e);
      await log(meta, l, t0, undefined, e, fallbackFrom);
      fallbackFrom = `${l.provider}:${l.modelId}`;
    }
  }
  throw new Error(`كل المزوّدين فشلوا (${tier}): ${String(lastErr)}`);
}

export function extractJson(text: string): unknown {
  let s = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start < 0 || end < 0) throw new Error("no json object");
  s = s.slice(start, end + 1).replace(/[\u201C\u201D]/g, '"').replace(/,\s*([}\]])/g, "$1");
  try {
    return JSON.parse(s);
  } catch {
    for (let i = s.length - 1; i > start; i--) {
      if (s[i] === "}") {
        try {
          return JSON.parse(s.slice(0, i + 1));
        } catch {}
      }
    }
    throw new Error("unparseable json");
  }
}

export type AiObjectResult<T> = {
  object: T;
  provider: string;
  latencyMs: number;
  fallback: boolean;
  mode: "object" | "repair" | "text" | "recovered_text";
};

type ObjectArgs<T extends z.ZodTypeAny> = {
  schema: T;
  schemaName?: string;
  system?: string;
  prompt?: string;
  messages?: ModelMessage[];
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  budgetMs?: number;
};

export async function aiObjectWithMeta<T extends z.ZodTypeAny>(
  tier: Tier,
  args: ObjectArgs<T>,
  meta: Meta
): Promise<AiObjectResult<z.infer<T>>> {
  const started = Date.now();
  const deadline = started + (args.budgetMs ?? Number.POSITIVE_INFINITY);
  const left = () => deadline - Date.now();
  const schemaJson = JSON.stringify(zodToJsonSchemaLite(args.schema));
  const jsonHint = `\n\nأخرج JSON فقط (بدون أي نص قبله أو بعده، بدون Markdown) مطابقًا تمامًا لهذا الـ JSON Schema:\n${schemaJson}`;
  const promptArgs = toPrompt(args.prompt, args.messages);
  const maxOut = args.maxTokens ?? 2_000;
  const need = requestTokens(args.system, args.prompt, args.messages, schemaJson) + maxOut;
  let fallbackFrom: string | undefined;
  let lastErr: unknown;

  const done = (
    object: z.infer<T>,
    l: Link,
    mode: AiObjectResult<unknown>["mode"]
  ): AiObjectResult<z.infer<T>> => ({
    object,
    provider: `${l.provider}:${l.modelId}`,
    latencyMs: Date.now() - started,
    fallback: !!fallbackFrom,
    mode,
  });

  for (const l of await chain(tier, need)) {
    if (left() < MIN_ATTEMPT_MS) {
      lastErr = lastErr ?? new Error("time budget exhausted");
      break;
    }
    const model = make(l);
    const t0 = Date.now();
    const ms = Math.min(args.timeoutMs ?? 35_000, left());

    try {
      const r = await withTimeout(
        generateObject({
          model,
          schema: args.schema,
          schemaName: args.schemaName,
          system: args.system,
          ...promptArgs,
          temperature: args.temperature ?? 0.4,
          maxOutputTokens: maxOut,
          maxRetries: 0,
          abortSignal: abortAfter(ms),
        }),
        ms
      );
      await log(meta, l, t0, r.usage, undefined, fallbackFrom);
      return done(r.object as z.infer<T>, l, "object");
    } catch (e1) {
      const c = await afterFailure(l, e1);

      const rawText = (e1 as { text?: unknown })?.text;
      if (typeof rawText === "string" && rawText.trim()) {
        try {
          const parsed = args.schema.safeParse(extractJson(rawText));
          if (parsed.success) {
            await log(meta, l, t0, (e1 as { usage?: Usage })?.usage, undefined, fallbackFrom ?? `${l.provider}:repair`);
            return done(parsed.data as z.infer<T>, l, "repair");
          }
        } catch {}
      }

      if (c.kind === "rate" || c.kind === "credits" || c.kind === "too_large" || left() < MIN_ATTEMPT_MS) {
        lastErr = e1;
        await log(meta, l, t0, undefined, e1, fallbackFrom);
        fallbackFrom = `${l.provider}:${l.modelId}`;
        continue;
      }

      const t1 = Date.now();
      const ms2 = Math.min(args.timeoutMs ?? 30_000, left());
      try {
        const r = await withTimeout(
          generateText({
            model,
            system: (args.system ?? "") + jsonHint,
            ...promptArgs,
            temperature: args.temperature ?? 0.4,
            maxOutputTokens: Math.max(maxOut, 1_500),
            maxRetries: 0,
            abortSignal: abortAfter(ms2),
          }),
          ms2
        );

        try {
          const parsed = args.schema.safeParse(extractJson(r.text));
          if (parsed.success) {
            await log(meta, l, t1, r.usage, undefined, fallbackFrom ?? `${l.provider}:object-mode`);
            return done(parsed.data as z.infer<T>, l, "text");
          }
        } catch (jsonErr) {
          if (tier === "chat" && r.text && r.text.trim().length > 10) {
            const fallbackTurn = {
              thinking: "Plain text response converted cleanly",
              reply: r.text.replace(/[\{\}\"]/g, "").trim(),
              issueLink: /(استمارة|رابط|لينك|ابدأ|سجل)/i.test(r.text),
              buttonTitle: "ابدأ استمارة متجرك الآن",
            };
            const parsedTurn = args.schema.safeParse(fallbackTurn);
            if (parsedTurn.success) {
              await log(meta, l, t1, r.usage, undefined, fallbackFrom ?? `${l.provider}:text-recovered`);
              return done(parsedTurn.data as z.infer<T>, l, "recovered_text");
            }
          }
          throw jsonErr;
        }
      } catch (e2) {
        lastErr = e2;
        await afterFailure(l, e2);
        await log(
          meta,
          l,
          t0,
          undefined,
          `${String(e1).slice(0, 200)} | ${String(e2).slice(0, 200)}`,
          fallbackFrom
        );
        fallbackFrom = `${l.provider}:${l.modelId}`;
      }
    }
  }

  throw new Error(`فشل توليد المخرجات المنظمة (${tier}): ${String(lastErr)}`);
}

export async function aiObject<T extends z.ZodTypeAny>(
  tier: Tier,
  args: ObjectArgs<T>,
  meta: Meta
): Promise<z.infer<T>> {
  return (await aiObjectWithMeta(tier, args, meta)).object;
}

function unwrap(s: z.ZodTypeAny): z.ZodTypeAny | undefined {
  const d: any = s._def;
  switch (d.typeName) {
    case "ZodOptional":
    case "ZodNullable":
    case "ZodDefault":
    case "ZodCatch":
      return d.innerType;
    case "ZodEffects":
      return d.schema;
    case "ZodBranded":
      return d.type;
    case "ZodPipeline":
      return d.out;
    default:
      return undefined;
  }
}

function describeOf(s: z.ZodTypeAny): string | undefined {
  if (s.description) return s.description;
  const inner = unwrap(s);
  return inner ? describeOf(inner) : undefined;
}

const WRAPPED_OPTIONAL = new Set(["ZodOptional", "ZodDefault", "ZodNullable"]);

export function zodToJsonSchemaLite(s: z.ZodTypeAny): unknown {
  const inner = unwrap(s);
  if (inner) return zodToJsonSchemaLite(inner);
  const d: any = s._def;
  const t = d.typeName;
  if (t === "ZodObject") {
    const shape = d.shape() as Record<string, z.ZodTypeAny>;
    return {
      type: "object",
      properties: Object.fromEntries(
        Object.entries(shape).map(([k, v]) => {
          const desc = describeOf(v);
          return [k, { ...(zodToJsonSchemaLite(v) as object), ...(desc ? { description: desc } : {}) }];
        })
      ),
      required: Object.entries(shape)
        .filter(([, v]) => !(WRAPPED_OPTIONAL.has((v as any)._def.typeName) || v.isOptional()))
        .map(([k]) => k),
    };
  }
  if (t === "ZodArray") return { type: "array", items: zodToJsonSchemaLite(d.type) };
  if (t === "ZodEnum") return { type: "string", enum: d.values };
  if (t === "ZodLiteral") return { const: d.value };
  if (t === "ZodString") return { type: "string" };
  if (t === "ZodNumber") return { type: "number" };
  if (t === "ZodBoolean") return { type: "boolean" };
  if (t === "ZodUnion" || t === "ZodDiscriminatedUnion") return { anyOf: (d.options as z.ZodTypeAny[]).map(zodToJsonSchemaLite) };
  if (t === "ZodRecord") return { type: "object" };
  return {};
}

export async function transcribe(audioUrl: string, meta: Meta): Promise<string> {
  const modelId = clean(env.GROQ_WHISPER_MODEL, "whisper-large-v3-turbo");
  const l: Link = { provider: "groq", modelId, cap: 0 };
  const t0 = Date.now();
  try {
    const audio = await fetch(audioUrl, { signal: abortAfter(15_000) }).then((r) => r.arrayBuffer());
    const fd = new FormData();
    fd.append("file", new Blob([audio], { type: "audio/mp4" }), "voice.m4a");
    fd.append("model", modelId);
    fd.append("language", "ar");
    fd.append("prompt", "محادثة بالعامية المصرية عن متجر إلكتروني ومنتجات وأسعار بالجنيه.");

    const r = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.GROQ_API_KEY}` },
      body: fd,
      signal: abortAfter(25_000),
    });
    if (!r.ok) throw new Error(await r.text());
    const j = await r.json();
    await log({ ...meta, purpose: "transcribe" }, l, t0, undefined);
    return String(j.text ?? "");
  } catch (e) {
    await afterFailure(l, e);
    await log({ ...meta, purpose: "transcribe" }, l, t0, undefined, e);
    return "";
  }
}