import "server-only";
// usage.ts (مشروعك الخاص) — لا باقات ولا حدود استخدام: المشروع مشروعك ومفاتيحك أنت. هذا الملف يبقي واجهة الحصص المشتركة
// تعمل كما هي (كلها «مسموح»)، فتبقى صفحات اللوحة والرفع والميزات الذكية على حالها بلا منطق باقات.
export type AiKind = "import" | "describe" | "design" | "content" | "image";
export type UploadKind = "image" | "video";

export const AI_KIND_NAME: Record<AiKind, string> = { import: "استيراد المنتجات", describe: "كتابة الأوصاف", design: "تعديل الشكل بالوصف", content: "استوديو المحتوى", image: "قراءة الصور" };

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
/** حد «البحث بالصورة» الشهري لزوار المتجر (يكلّف من مفتاح Groq الخاص بك). */
export async function visualSearchLimit(_storeId: string): Promise<number> {
  return Number(process.env.VISUAL_SEARCH_PER_MONTH) > 0 ? Number(process.env.VISUAL_SEARCH_PER_MONTH) : 2000;
}
