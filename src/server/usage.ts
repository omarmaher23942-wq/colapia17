import "server-only";
// usage.ts — حدود الاستخدام الشهرية لكل متجر (الذكاء الاصطناعي ورفع الصور والفيديو). نسخة أساسية: عدّادات شهرية في Redis
// بمفتاح للمتجر والنوع والشهر. تُسقط بلطف: تعذر Redis لا يمنع التاجر (الحد حماية من الإساءة لا بوابة للعمل).
// الرسائل للتاجر مهنية بلا هجوم ولا دفاع: ماذا استُخدم، وماذا بقي، ومتى يتجدد الحد.
import { redis } from "@/lib/redis";

export type AiKind = "import" | "describe" | "design" | "content" | "image";
export type UploadKind = "image" | "video";

/** الحدود الشهرية الافتراضية (أعداد الطلبات الذكية، وبايتات الرفع). تُستبدل بإعدادات المالك لاحقاً. */
export const AI_LIMITS: Record<AiKind, number> = { import: 120, describe: 400, design: 60, content: 200, image: 200 };
export const UPLOAD_LIMITS: Record<UploadKind, number> = { image: 2 * 1024 ** 3, video: 1 * 1024 ** 3 };

const month = () => new Date().toISOString().slice(0, 7);
const aiKey = (storeId: string, kind: AiKind) => `usage:ai:${storeId}:${kind}:${month()}`;
const upKey = (storeId: string, kind: UploadKind) => `usage:up:${storeId}:${kind}:${month()}`;

const NAMES: Record<AiKind, string> = { import: "استيراد المنتجات", describe: "كتابة الأوصاف", design: "تعديل الشكل بالكلام", content: "مساعد المحتوى", image: "تحسين الصور" };

export type QuotaResult = { ok: true; used: number; limit: number; remaining: number } | { ok: false; used: number; limit: number; remaining: 0; message: string };

export async function checkAiQuota(storeId: string, kind: AiKind, units = 1): Promise<QuotaResult> {
  const limit = AI_LIMITS[kind];
  let used = 0;
  try {
    used = Number((await redis.get<number>(aiKey(storeId, kind))) ?? 0) || 0;
  } catch {
    return { ok: true, used: 0, limit, remaining: limit };
  }
  if (used + units > limit) {
    return { ok: false, used, limit, remaining: 0, message: `وصلتم إلى الحد الشهري لـ«${NAMES[kind]}» (${limit} عملية). يتجدد الحد مع بداية الشهر القادم، ويمكنكم إكمال ما تبقى يدوياً من هنا.` };
  }
  return { ok: true, used, limit, remaining: limit - used };
}

export async function recordAi(storeId: string, kind: AiKind, units = 1): Promise<void> {
  try {
    const k = aiKey(storeId, kind);
    await redis.incrby(k, units);
    await redis.expire(k, 40 * 86_400);
  } catch {
    /* العدّاد حماية فقط */
  }
}

export async function checkUploadQuota(storeId: string, bytes: number, kind: UploadKind): Promise<QuotaResult> {
  const limit = UPLOAD_LIMITS[kind];
  let used = 0;
  try {
    used = Number((await redis.get<number>(upKey(storeId, kind))) ?? 0) || 0;
  } catch {
    return { ok: true, used: 0, limit, remaining: limit };
  }
  if (used + bytes > limit) {
    return { ok: false, used, limit, remaining: 0, message: `وصلتم إلى حد ${kind === "video" ? "الفيديو" : "الصور"} الشهري. يتجدد مع بداية الشهر القادم.` };
  }
  return { ok: true, used, limit, remaining: limit - used };
}

export async function recordUpload(storeId: string, bytes: number, kind: UploadKind): Promise<void> {
  try {
    const k = upKey(storeId, kind);
    await redis.incrby(k, Math.max(0, Math.round(bytes)));
    await redis.expire(k, 40 * 86_400);
  } catch {
    /* ignore */
  }
}
