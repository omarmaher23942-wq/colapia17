import "server-only";
// usage.ts — حدود الاستخدام الشهرية لكل متجر: عمليات الذكاء الاصطناعي، ورفع الصور (عدداً وحجماً)، والفيديو (عدداً وحجماً أقصى).
// العدّادات في Redis بمفتاح للمتجر والنوع والشهر (بتوقيت القاهرة). تعذر Redis لا يمنع التاجر: الذكاء الاصطناعي يرجع لعدّ
// ai_calls من القاعدة، والرفع يمرّ (الحد حماية من الإساءة لا بوابة للعمل). الحدود الافتراضية حسب الخطة (تجربة/مدفوع) في
// lib/usage-limits.ts ويضبطها المالك من الإعداد «usage» في لوحته.
// الرسائل للتاجر هادئة: ماذا استُخدم، ومتى يتجدد الحد.
import { and, count, eq, gte } from "drizzle-orm";
import { db } from "@/db/client";
import { aiCalls, stores } from "@/db/schema";
import { redis } from "@/lib/redis";
import { getFlag } from "@/lib/flags";
import { cairoMonthStart } from "@/lib/change-requests";
import { fmtBytes, limitMessage, limitsFor, meter, usageMonth, type Meter, type UsageLimits } from "@/lib/usage-limits";

export type AiKind = "import" | "describe" | "design" | "content" | "image";
export type UploadKind = "image" | "video";

const TTL = 40 * 86_400;
const aiKey = (storeId: string, kind: AiKind | "total") => `usage:ai:${storeId}:${kind}:${usageMonth()}`;
const upKey = (storeId: string, kind: UploadKind, what: "bytes" | "count") => `usage:up:${storeId}:${kind}:${what}:${usageMonth()}`;

export const AI_KIND_NAME: Record<AiKind, string> = { import: "استيراد المنتجات", describe: "كتابة الأوصاف", design: "تعديل الشكل بالوصف", content: "استوديو المحتوى", image: "تحسين الصور" };

export type QuotaResult = { ok: true; used: number; limit: number; remaining: number } | { ok: false; used: number; limit: number; remaining: 0; message: string };

/** الحدود الفعلية للمتجر: التجربة أو المدفوع، مع تجاوز المالك. */
export async function limitsForStore(storeId: string): Promise<UsageLimits> {
  const [row] = await db.select({ status: stores.status }).from(stores).where(eq(stores.id, storeId)).limit(1).catch(() => []);
  const flag = await getFlag("usage").catch(() => ({ enabled: true, config: null }));
  return limitsFor(row?.status !== "active", flag.config);
}

const num = async (key: string): Promise<number | null> => {
  try {
    return Number((await redis.get<number>(key)) ?? 0) || 0;
  } catch {
    return null;
  }
};

/** استخدام الذكاء الاصطناعي هذا الشهر: العدّاد، وإن تعذّر Redis فعدّ استدعاءات ai_calls الناجحة. */
async function aiUsed(storeId: string): Promise<number> {
  const v = await num(aiKey(storeId, "total"));
  if (v !== null) return v;
  const [r] = await db
    .select({ n: count() })
    .from(aiCalls)
    .where(and(eq(aiCalls.storeId, storeId), eq(aiCalls.ok, true), gte(aiCalls.createdAt, cairoMonthStart())))
    .catch(() => []);
  return Number(r?.n ?? 0);
}

export async function checkAiQuota(storeId: string, kind: AiKind, units = 1): Promise<QuotaResult> {
  const { aiPerMonth: limit } = await limitsForStore(storeId);
  const used = await aiUsed(storeId);
  if (used + units > limit) return { ok: false, used, limit, remaining: 0, message: limitMessage(`العمليات الذكية (${AI_KIND_NAME[kind]})`, limit) };
  return { ok: true, used, limit, remaining: limit - used };
}

export async function recordAi(storeId: string, kind: AiKind, units = 1): Promise<void> {
  try {
    for (const k of [aiKey(storeId, kind), aiKey(storeId, "total")]) {
      await redis.incrby(k, units);
      await redis.expire(k, TTL);
    }
  } catch {
    /* العدّاد حماية فقط */
  }
}

export async function checkUploadQuota(storeId: string, bytes: number, kind: UploadKind, files = 1): Promise<QuotaResult> {
  const l = await limitsForStore(storeId);
  const [n, b] = await Promise.all([num(upKey(storeId, kind, "count")), num(upKey(storeId, kind, "bytes"))]);
  if (n === null || b === null) return { ok: true, used: 0, limit: 0, remaining: 0 };
  if (kind === "video") {
    if (bytes > l.videoMaxBytes) return { ok: false, used: n, limit: l.videoMaxBytes, remaining: 0, message: `حجم الفيديو أكبر من الحد المسموح (${fmtBytes(l.videoMaxBytes)}). اضغطوه أو اختاروا مقطعاً أقصر.` };
    if (n + files > l.videosPerMonth) return { ok: false, used: n, limit: l.videosPerMonth, remaining: 0, message: limitMessage("رفع الفيديو", l.videosPerMonth) };
    return { ok: true, used: n, limit: l.videosPerMonth, remaining: l.videosPerMonth - n };
  }
  if (n + files > l.imagesPerMonth) return { ok: false, used: n, limit: l.imagesPerMonth, remaining: 0, message: limitMessage("رفع الصور", l.imagesPerMonth) };
  if (b + bytes > l.imageBytesPerMonth) return { ok: false, used: b, limit: l.imageBytesPerMonth, remaining: 0, message: `وصلتم إلى حد مساحة الصور هذا الشهر (${fmtBytes(l.imageBytesPerMonth)}). يتجدد الحد مطلع الشهر القادم.` };
  return { ok: true, used: n, limit: l.imagesPerMonth, remaining: l.imagesPerMonth - n };
}

export async function recordUpload(storeId: string, bytes: number, kind: UploadKind, files = 1): Promise<void> {
  try {
    const pairs: [string, number][] = [
      [upKey(storeId, kind, "bytes"), Math.max(0, Math.round(bytes))],
      [upKey(storeId, kind, "count"), Math.max(1, files)],
    ];
    for (const [k, v] of pairs) {
      await redis.incrby(k, v);
      await redis.expire(k, TTL);
    }
  } catch {
    /* ignore */
  }
}

export type UsageSummary = {
  isTrial: boolean;
  ai: Meter;
  aiByKind: { kind: AiKind; name: string; used: number }[];
  images: Meter;
  imageBytes: Meter;
  videos: Meter;
  videoMaxBytes: number;
};

/** كل عدّادات الشهر لصفحة «الاستخدام». */
export async function usageSummary(storeId: string): Promise<UsageSummary> {
  const [row] = await db.select({ status: stores.status }).from(stores).where(eq(stores.id, storeId)).limit(1).catch(() => []);
  const l = await limitsForStore(storeId);
  const kinds = Object.keys(AI_KIND_NAME) as AiKind[];
  const [aiTotal, imgN, imgB, vidN, ...byKind] = await Promise.all([aiUsed(storeId), num(upKey(storeId, "image", "count")), num(upKey(storeId, "image", "bytes")), num(upKey(storeId, "video", "count")), ...kinds.map((k) => num(aiKey(storeId, k)))]);
  return {
    isTrial: row?.status !== "active",
    ai: meter(aiTotal, l.aiPerMonth),
    aiByKind: kinds.map((k, i) => ({ kind: k, name: AI_KIND_NAME[k], used: byKind[i] ?? 0 })).filter((x) => x.used > 0),
    images: meter(imgN ?? 0, l.imagesPerMonth),
    imageBytes: meter(imgB ?? 0, l.imageBytesPerMonth),
    videos: meter(vidN ?? 0, l.videosPerMonth),
    videoMaxBytes: l.videoMaxBytes,
  };
}
