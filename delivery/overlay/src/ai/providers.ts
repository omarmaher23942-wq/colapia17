import "server-only";
// providers.ts (مشروعك الخاص) — الميزات الذكية (قراءة صور المنتجات، كتابة الأوصاف، تعديل الشكل بالوصف، البحث بالصورة)
// تعمل بمفتاح Groq الخاص بك وحده: من متغير GROQ_API_KEY أو من «الربط والمفاتيح» في لوحة التحكم. بلا مفتاح تعطّل الميزة برسالة
// واضحة (AiNotConfiguredError) ويعمل المتجر واللوحة بقية الوقت كما هما. نفس واجهة نسخة المنصة (aiText / aiObject).
import { createGroq } from "@ai-sdk/groq";
import { generateText, generateObject, type LanguageModel, type ModelMessage, type ToolSet } from "ai";
import type { z } from "zod";
import { providerKey } from "@/server/settings";

export type Tier = "chat" | "compose" | "architect" | "fast" | "vision" | "visionFast";
export type Meta = { purpose: string; storeId?: string; conversationId?: string };

export class AiNotConfiguredError extends Error {
  constructor() {
    super("الميزات الذكية تحتاج مفتاح Groq. أضيفوه من لوحة التحكم ← الربط والمفاتيح.");
    this.name = "AiNotConfiguredError";
  }
}

const clean = (s: string | undefined, fallback: string) => (s ?? "").trim() || fallback;

export const MODELS = {
  groqOss120b: clean(process.env.GROQ_MODEL, "openai/gpt-oss-120b"),
  groqOss20b: "openai/gpt-oss-20b",
  groq8b: "llama-3.1-8b-instant",
  groqVision: clean(process.env.GROQ_VISION_MODEL, "meta-llama/llama-4-scout-17b-16e-instruct"),
  groqVisionAlt: "meta-llama/llama-4-maverick-17b-128e-instruct",
} as const;

/** سلسلة النماذج لكل مستوى (احتياط تلقائي عند فشل نموذج). */
const CHAINS: Record<Tier, string[]> = {
  chat: [MODELS.groqOss120b, MODELS.groqOss20b, MODELS.groq8b],
  fast: [MODELS.groq8b, MODELS.groqOss20b],
  architect: [MODELS.groqOss120b, MODELS.groqOss20b],
  compose: [MODELS.groqOss120b, MODELS.groqOss20b],
  vision: [MODELS.groqVision, MODELS.groqVisionAlt],
  visionFast: [MODELS.groqVision, MODELS.groqVisionAlt],
};

async function client() {
  const apiKey = await providerKey("groq");
  if (!apiKey) throw new AiNotConfiguredError();
  const groq = createGroq({ apiKey });
  return (id: string): LanguageModel => groq(id);
}

const withTimeout = <T>(p: Promise<T>, ms: number) => Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`timeout ${ms}ms`)), ms))]);
const failLine = (id: string, e: unknown) => `${id} → ${String((e as Error)?.message ?? e).replace(/\s+/g, " ").slice(0, 160)}`;

export function estimateTokens(text: string): number {
  let ascii = 0,
    other = 0;
  for (let i = 0; i < text.length; i++) text.charCodeAt(i) < 128 ? ascii++ : other++;
  return Math.ceil(ascii / 3.8 + other / 2.4) + 8;
}

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
    accept?: (text: string) => boolean;
  },
  _meta: Meta
) {
  const model = await client();
  const deadline = Date.now() + (args.budgetMs ?? Number.POSITIVE_INFINITY);
  const fails: string[] = [];
  for (const id of CHAINS[tier]) {
    const left = deadline - Date.now();
    if (left < 2_500) break;
    const ms = Math.min(args.timeoutMs ?? 25_000, left);
    try {
      const r = await withTimeout(
        generateText({
          model: model(id),
          system: args.system,
          messages: args.messages,
          tools: args.tools,
          temperature: args.temperature ?? 0.7,
          maxOutputTokens: args.maxTokens ?? 800,
          maxRetries: 0,
          abortSignal: AbortSignal.timeout(ms),
        }),
        ms
      );
      if (args.accept && !args.accept(r.text)) throw new Error(`unusable output: ${JSON.stringify(r.text.slice(0, 80))}`);
      return { text: r.text, toolCalls: r.toolCalls, usage: r.usage, provider: `groq:${id}` };
    } catch (e) {
      fails.push(failLine(id, e));
    }
  }
  throw new Error(`تعذّر الرد من Groq (${tier}):\n${fails.join("\n") || "انتهى الوقت"}`);
}

export function extractJson(text: string): unknown {
  let s = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start < 0 || end < 0) throw new Error("no json object");
  s = s.slice(start, end + 1).replace(/[“”]/g, '"').replace(/,\s*([}\]])/g, "$1");
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

export type AiObjectResult<T> = { object: T; provider: string; latencyMs: number; fallback: boolean; mode: "object" | "repair" | "text" | "recovered_text" };

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

export async function aiObjectWithMeta<T extends z.ZodTypeAny>(tier: Tier, args: ObjectArgs<T>, _meta: Meta): Promise<AiObjectResult<z.infer<T>>> {
  const model = await client();
  const started = Date.now();
  const deadline = started + (args.budgetMs ?? Number.POSITIVE_INFINITY);
  const jsonHint = `\n\nأخرج JSON فقط (بدون أي نص قبله أو بعده، بدون Markdown) مطابقاً تماماً لهذا الـ JSON Schema:\n${JSON.stringify(zodToJsonSchemaLite(args.schema))}`;
  const input = args.messages?.length ? { messages: args.messages } : { prompt: args.prompt ?? "" };
  const maxOut = args.maxTokens ?? 2_000;
  const fails: string[] = [];
  let fallback = false;
  for (const id of CHAINS[tier]) {
    const left = deadline - Date.now();
    if (left < 2_500) break;
    try {
      const r = await withTimeout(
        generateObject({ model: model(id), schema: args.schema, schemaName: args.schemaName, system: args.system, ...input, temperature: args.temperature ?? 0.4, maxOutputTokens: maxOut, maxRetries: 0, abortSignal: AbortSignal.timeout(Math.min(args.timeoutMs ?? 35_000, left)) }),
        Math.min(args.timeoutMs ?? 35_000, left)
      );
      return { object: r.object as z.infer<T>, provider: `groq:${id}`, latencyMs: Date.now() - started, fallback, mode: "object" };
    } catch (e1) {
      // النموذج أخرج نصاً لا يطابق المخطط: نحاول إصلاحه من النص نفسه، ثم نطلب JSON صريحاً.
      const raw = (e1 as { text?: unknown })?.text;
      if (typeof raw === "string" && raw.trim()) {
        try {
          const parsed = args.schema.safeParse(extractJson(raw));
          if (parsed.success) return { object: parsed.data as z.infer<T>, provider: `groq:${id}`, latencyMs: Date.now() - started, fallback, mode: "repair" };
        } catch {}
      }
      const left2 = deadline - Date.now();
      if (left2 < 2_500) {
        fails.push(failLine(id, e1));
        break;
      }
      try {
        const r = await withTimeout(
          generateText({ model: model(id), system: (args.system ?? "") + jsonHint, ...input, temperature: args.temperature ?? 0.4, maxOutputTokens: Math.max(maxOut, 1_500), maxRetries: 0, abortSignal: AbortSignal.timeout(Math.min(args.timeoutMs ?? 30_000, left2)) }),
          Math.min(args.timeoutMs ?? 30_000, left2)
        );
        const parsed = args.schema.safeParse(extractJson(r.text));
        if (parsed.success) return { object: parsed.data as z.infer<T>, provider: `groq:${id}`, latencyMs: Date.now() - started, fallback, mode: "text" };
        throw new Error("schema mismatch");
      } catch (e2) {
        fails.push(`${failLine(id, e1)} | ${String((e2 as Error)?.message ?? e2).replace(/\s+/g, " ").slice(0, 120)}`);
        fallback = true;
      }
    }
  }
  throw new Error(`تعذّر توليد المخرجات المنظمة من Groq (${tier}):\n${fails.join("\n") || "انتهى الوقت"}`);
}

export async function aiObject<T extends z.ZodTypeAny>(tier: Tier, args: ObjectArgs<T>, meta: Meta): Promise<z.infer<T>> {
  return (await aiObjectWithMeta(tier, args, meta)).object;
}

// ─── مخطط Zod ← JSON Schema مبسّط (للتلميح النصي عند فشل المخرجات المنظمة) ───

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
