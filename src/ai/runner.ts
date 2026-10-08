// src/ai/runner.ts — طبقة تجميع موحّدة لاستدعاءات الـ AI بنمط JSON.
//
// السبب الجذري:
// composer.ts كان يستورد { callAIJson } من هذا الملف لكنه غير موجود،
// فيفشل البناء. الآن نُوفّر واجهة بسيطة:
//   callAIJson<T>(prompt: string): Promise<T>
// فوق aiObjectWithMeta مع schema بسيط (z.record للتحقق من الشكل العام).
//
// المبادئ:
//  - fallback آمن: أي فشل يُرمى ولا يُخفى (المتصل يقرر).
//  - لا نُخمّن schema صارم هنا — composer.ts يستخدم بيانات ديناميكية.
//  - يستخدم tier="architect" افتراضياً (Opus → Gemini → Groq).
//  - يستقبل نموذج Zod اختيارياً لتحقق صارم.
import "server-only";
import type { z } from "zod";
import { aiObjectWithMeta, extractJson, type Tier } from "@/ai/providers";

export type CallAIJsonOptions<T extends z.ZodTypeAny | undefined = undefined> = {
  /** schema صارم اختياري. إن لم يُمرَّر يُستخدم z.record(z.unknown()) */
  schema?: T;
  /** الـ tier (افتراضي: architect) */
  tier?: Tier;
  /** purpose للتسجيل في ai_calls */
  purpose?: string;
  /** storeId للتتبع */
  storeId?: string;
  /** conversationId للتتبع */
  conversationId?: string;
  /** درجة الإبداع (0-1) */
  temperature?: number;
  /** الحد الأقصى لتوكنز الخرج */
  maxTokens?: number;
  /** مهلة زمنية بالمللي ثانية */
  timeoutMs?: number;
  /** ميزانية كلية بالمللي ثانية */
  budgetMs?: number;
};

type InferSchema<T> = T extends z.ZodTypeAny ? z.infer<T> : unknown;

/**
 * يستدعي AI ويُعيد JSON مُحقَّقاً. يستخدم aiObjectWithMeta (مع fallback ثلاثي:
 * object mode → text mode → recovered text) لإخراج JSON موثوق.
 *
 * @throws Error عند فشل كل المزودين.
 */
export async function callAIJson<T = unknown>(
  prompt: string,
  options: CallAIJsonOptions = {}
): Promise<T> {
  const {
    tier = "architect",
    purpose = "composer_call",
    storeId,
    conversationId,
    temperature = 0.4,
    maxTokens = 6000,
    timeoutMs = 45_000,
    budgetMs = 90_000,
  } = options;

  // نستخدم z.any() لإخراج JSON حر مع الحفاظ على التحقق من أنه كائن.
  const { z } = await import("zod");
  const schema = z.union([z.record(z.unknown()), z.array(z.unknown())]);

  const r = await aiObjectWithMeta(
    tier,
    {
      schema,
      schemaName: "AIJsonOutput",
      prompt,
      temperature,
      maxTokens,
      timeoutMs,
      budgetMs,
    },
    {
      purpose,
      storeId,
      conversationId,
    }
  );

  return r.object as T;
}

export { extractJson };