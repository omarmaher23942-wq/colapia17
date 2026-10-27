import "server-only";
// ai-guard.ts — حارس تكلفة الميزات الذكية داخل الإعداد واللوحة: يتحقق من وجود مفتاح، ومن حدود يومية وشهرية قابلة للضبط
// (AI_CAP_DAILY وAI_CAP_MONTHLY) محسوبة من سجل الاستدعاءات الناجحة في القاعدة، فلا يحتاج Redis ولا باقات.
// عند المنع أو غياب المفتاح تعود الأداة للوضع اليدوي برسالة واضحة، ولا تفشل.
import { and, count, eq, gte } from "drizzle-orm";
import { db } from "@/db/client";
import { aiCalls } from "@/db/schema";
import { aiAvailable, aiCaps, checkCaps, NO_AI_NOTICE } from "@/lib/ai-status";

export type AiGate = { ok: true } | { ok: false; message: string; noKey: boolean };

const startOfDay = () => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
};
const startOfMonth = () => {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

export const aiConfigured = (): boolean => aiAvailable(process.env);

export async function aiGate(storeId: string, units = 1): Promise<AiGate> {
  if (!aiConfigured()) return { ok: false, message: NO_AI_NOTICE, noKey: true };
  try {
    const where = (since: Date) => and(eq(aiCalls.storeId, storeId), eq(aiCalls.ok, true), gte(aiCalls.createdAt, since));
    const [[d], [m]] = await Promise.all([db.select({ n: count() }).from(aiCalls).where(where(startOfDay())), db.select({ n: count() }).from(aiCalls).where(where(startOfMonth()))]);
    const v = checkCaps({ day: Number(d?.n ?? 0), month: Number(m?.n ?? 0) }, aiCaps(process.env), units);
    return v.ok ? { ok: true } : { ok: false, message: v.message, noKey: false };
  } catch {
    // العدّ حماية لا بوابة: تعذره لا يمنع التاجر.
    return { ok: true };
  }
}

/** واجهة متوافقة مع الاستدعاءات القائمة: المنع برسالة، والتسجيل يتم تلقائياً في سجل الاستدعاءات. */
export async function checkAiQuota(storeId: string, _kind: string, units = 1): Promise<{ ok: true } | { ok: false; message: string }> {
  const g = await aiGate(storeId, units);
  return g.ok ? { ok: true } : { ok: false, message: g.message };
}
export async function recordAi(_storeId: string, _kind: string, _units = 1): Promise<void> {}
