import "server-only";
// usage.ts — متقاعد في V4 (docs/V4-PLAN.md القسم 9): لا باقات شهرية ولا حدود استخدام ولا عدّادات ولا تلميحات ترقية. المتاجر
// المستضافة الباقية (متجر العرض والمعاينات) بلا حدود. تبقى هذه الدوال واجهة توافق لمن يستدعيها قبل إزالة استدعاءاتهم،
// وتجيب دائماً «مسموح». حماية تكلفة الذكاء الاصطناعي في المسارات العامة (حد الشبكة ومهلة النماذج) في مواضعها هناك لا هنا.
// لا تضف هنا منطق حدود.
export type AiKind = "import" | "describe" | "design" | "content" | "image";
export type UploadKind = "image" | "video";

export type QuotaResult = { ok: true; used: number; limit: number; remaining: number } | { ok: false; used: number; limit: number; remaining: 0; message: string };

const OPEN: QuotaResult = { ok: true, used: 0, limit: Number.MAX_SAFE_INTEGER, remaining: Number.MAX_SAFE_INTEGER };

export async function checkAiQuota(_storeId: string, _kind: AiKind, _units = 1): Promise<QuotaResult> {
  return OPEN;
}
export async function recordAi(_storeId: string, _kind: AiKind, _units = 1): Promise<void> {}

export async function checkUploadQuota(_storeId: string, _bytes: number, _kind: UploadKind, _files = 1): Promise<QuotaResult> {
  return OPEN;
}
export async function recordUpload(_storeId: string, _bytes: number, _kind: UploadKind, _files = 1): Promise<void> {}

export async function checkProductsQuota(_storeId: string, _adding = 1): Promise<QuotaResult> {
  return OPEN;
}
export async function checkTeamQuota(_storeId: string, _adding = 1): Promise<QuotaResult> {
  return OPEN;
}
export async function checkCustomDomain(_storeId: string): Promise<{ ok: true } | { ok: false; message: string }> {
  return { ok: true };
}

/** حد «البحث بالصورة» الشهري لزوار المتجر: من إعداد visual_search في server/visual-search.ts (افتراضي 400)، لا من باقة. */
export async function visualSearchLimit(_storeId: string): Promise<number> {
  const { getFlag } = await import("@/lib/flags");
  const f = await getFlag<{ perMonth?: number }>("visual_search").catch(() => ({ enabled: true, config: null }));
  const n = Number(f.config?.perMonth);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 400;
}
