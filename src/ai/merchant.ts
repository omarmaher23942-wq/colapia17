// merchant.ts — الذكاء الاصطناعي داخل لوحة التاجر على المنصة.
//
// المنصة لا تحمل مفاتيح التجار: أثناء التجربة وبعد الدفع (حتى يستلم التاجر متجره) تعمل أدوات
// الذكاء الاصطناعي بمفتاح المنصة بحصة يومية لكل متجر. وفي مشروع التاجر الخاص تعمل بمفتاح Groq
// الذي يحفظه التاجر في قاعدته هو (نسخة هذا الملف في template/).
import "server-only";
import { createGroq } from "@ai-sdk/groq";
import { generateObject, generateText, type LanguageModel } from "ai";
import type { z } from "zod";
import { db } from "@/db/client";
import { aiCalls } from "@/db/schema";
import { env } from "@/lib/env";
import { redis } from "@/lib/redis";

export const GROQ_DEFAULT_MODEL = "llama-3.3-70b-versatile";
export const TRIAL_DAILY_AI_CALLS = 40;
export const PAID_DAILY_AI_CALLS = 150;

export class MerchantAiError extends Error {
  constructor(
    message: string,
    readonly code: "needs_key" | "key_rejected" | "quota" | "failed"
  ) {
    super(message);
    this.name = "MerchantAiError";
  }
}

type Resolved = { model: LanguageModel; modelId: string; mode: "own" | "trial"; apiKey: string };
const dailyLimit = (status: string) => (status === "active" ? PAID_DAILY_AI_CALLS : TRIAL_DAILY_AI_CALLS);

// إن رُفض نموذج (أُوقف، أو تعذّر عليه تنفيذ الطلب) نجرب التالي بنفس المفتاح.
const FALLBACK_MODELS = [GROQ_DEFAULT_MODEL, "openai/gpt-oss-120b", "llama-3.1-8b-instant"];

export type MerchantAiStatus =
  | { mode: "own" }
  | { mode: "trial"; remaining: number }
  | { mode: "needs_key" };

const quotaKey = (storeId: string) => `ai:trial:${storeId}:${new Date().toISOString().slice(0, 10)}`;

async function resolve(store: { id: string; status: string }): Promise<Resolved> {
  const used = await redis.incr(quotaKey(store.id));
  if (used === 1) await redis.expire(quotaKey(store.id), 86_400);
  if (used > dailyLimit(store.status))
    throw new MerchantAiError(
      store.status === "active"
        ? "وصلت لحد استخدام الذكاء الاصطناعي اليومي على المنصة. يتجدد غداً، ويصبح بلا حدود بمفتاحك بعد استلام متجرك."
        : "انتهت محاولات الذكاء الاصطناعي اليومية في التجربة. تتجدد غداً.",
      "quota"
    );
  return { model: createGroq({ apiKey: env.GROQ_API_KEY })(GROQ_DEFAULT_MODEL), modelId: GROQ_DEFAULT_MODEL, mode: "trial", apiKey: env.GROQ_API_KEY };
}

export async function merchantAiStatus(store: { id: string; status: string }): Promise<MerchantAiStatus> {
  const used = Number((await redis.get<number>(quotaKey(store.id))) ?? 0);
  return { mode: "trial", remaining: Math.max(0, dailyLimit(store.status) - used) };
}

async function record(storeId: string, purpose: string, r: Resolved, t0: number, usage?: { inputTokens?: number; outputTokens?: number }, err?: unknown) {
  await db
    .insert(aiCalls)
    .values({
      purpose: `merchant:${purpose}`,
      provider: r.mode === "own" ? "groq:merchant" : "groq",
      model: r.modelId,
      storeId,
      tokensIn: usage?.inputTokens ?? 0,
      tokensOut: usage?.outputTokens ?? 0,
      latencyMs: Date.now() - t0,
      ok: !err,
      error: err ? String(err).slice(0, 500) : undefined,
    })
    .catch(() => {});
}

const isAuth = (msg: string) => /401|invalid api key|unauthor/i.test(msg);
const isRate = (msg: string) => /429|rate limit/i.test(msg);

/** ينفذ الطلب على النموذج الافتراضي ثم البدائل، ولا ينتقل لبديل عند خطأ مفتاح أو حد معدل. */
async function withFallback<T>(r: Resolved, run: (model: LanguageModel, modelId: string) => Promise<T>): Promise<{ out: T; modelId: string }> {
  let last: unknown;
  for (const modelId of FALLBACK_MODELS) {
    try {
      const model = modelId === r.modelId ? r.model : createGroq({ apiKey: r.apiKey })(modelId);
      return { out: await run(model, modelId), modelId };
    } catch (e) {
      last = e;
      const msg = e instanceof Error ? e.message : String(e);
      if (isAuth(msg) || isRate(msg)) break;
    }
  }
  throw last;
}

function translate(e: unknown, mode: Resolved["mode"]): MerchantAiError {
  const msg = e instanceof Error ? e.message : String(e);
  if (mode === "own" && isAuth(msg))
    return new MerchantAiError("مفتاح Groq الخاص بك توقف عن العمل. حدّثه من صفحة الربط والمفاتيح.", "key_rejected");
  if (isRate(msg)) return new MerchantAiError("الطلبات كثيرة الآن. انتظر دقيقة ثم أعد المحاولة.", "quota");
  const err = new MerchantAiError("تعذّر توليد المحتوى الآن، أعد المحاولة.", "failed");
  err.cause = e;
  return err;
}

export async function merchantObject<T extends z.ZodTypeAny>(
  store: { id: string; status: string },
  purpose: string,
  args: { system: string; prompt: string; schema: T; temperature?: number }
): Promise<z.infer<T>> {
  const r = await resolve(store);
  const t0 = Date.now();
  try {
    const { out, modelId } = await withFallback(r, (model) =>
      generateObject({
        model,
        system: args.system,
        prompt: args.prompt,
        schema: args.schema,
        temperature: args.temperature ?? 0.7,
        maxRetries: 1,
        abortSignal: AbortSignal.timeout(30_000),
      })
    );
    await record(store.id, purpose, { ...r, modelId }, t0, out.usage);
    return out.object as z.infer<T>;
  } catch (e) {
    await record(store.id, purpose, r, t0, undefined, e);
    throw translate(e, r.mode);
  }
}

export async function merchantText(
  store: { id: string; status: string },
  purpose: string,
  args: { system: string; prompt: string; temperature?: number; maxTokens?: number }
): Promise<string> {
  const r = await resolve(store);
  const t0 = Date.now();
  try {
    const { out, modelId } = await withFallback(r, async (model) => {
      const res = await generateText({
        model,
        system: args.system,
        prompt: args.prompt,
        temperature: args.temperature ?? 0.7,
        maxOutputTokens: args.maxTokens ?? 700,
        maxRetries: 1,
        abortSignal: AbortSignal.timeout(30_000),
      });
      if (!res.text.trim()) throw new Error("empty completion");
      return res;
    });
    await record(store.id, purpose, { ...r, modelId }, t0, out.usage);
    return out.text.trim();
  } catch (e) {
    await record(store.id, purpose, r, t0, undefined, e);
    throw translate(e, r.mode);
  }
}
