import "server-only";
// preview-guard.ts — حماية المعاينة المجانية من الإساءة (كل معاينة تكلف ذكاءً اصطناعياً حقيقياً).
// أربع طبقات عند إنشاء متجر جديد (لا عند إعادة بناء متجر قائم):
//  1) لكل تاجر: لا أكثر من MAX_OPEN_PREVIEWS متاجر غير مفعّلة في وقت واحد.
//  2) لكل IP: PER_IP متاجر في 24 ساعة.
//  3) لكل رقم موبايل: PER_PHONE متاجر في 7 أيام (يمنع تغيير الحساب والـ IP بنفس الرقم).
//  4) سقف يومي عام PREVIEW_DAILY_CAP (متغير بيئة) يحمي فاتورة الذكاء الاصطناعي من أي موجة، ويُنبَّه المالك عند بلوغه.
// القرار نفسه دالة خالصة مختبَرة (decidePreview)؛ الجزء الخارجي يجمع الأعداد من القاعدة وRedis.
import { and, eq, isNull, notInArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { stores } from "@/db/schema";
import { redis } from "@/lib/redis";
import { notifyAdmin } from "@/ai/lifecycle/notify";

import { DEFAULT_DAILY_CAP, decidePreview, MAX_OPEN_PREVIEWS, PER_IP, PER_PHONE, type PreviewCounts, type PreviewDecision, type PreviewLimits } from "./preview-rules";

const cairoDay = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(new Date());

function dailyCap(): number {
  const n = Number(process.env.PREVIEW_DAILY_CAP);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : DEFAULT_DAILY_CAP;
}

async function read(key: string): Promise<number> {
  try {
    return Number((await redis.get<number>(key)) ?? 0) || 0;
  } catch {
    return 0; // Redis متعطل: لا نمنع تاجراً حقيقياً (قاعدة البيانات تحمي سقف المتاجر المفتوحة)
  }
}

async function bump(key: string, ttlSeconds: number): Promise<void> {
  try {
    const p = redis.pipeline();
    p.incr(key);
    p.expire(key, ttlSeconds);
    await p.exec();
  } catch (e) {
    console.error("[preview-guard] counter failed", e);
  }
}

/** يفحص ثم (عند السماح) يحجز مقعداً. الحجز يسبق الإنشاء بقليل؛ فشل البناء لاحقاً لا يرجعه (مقصود: يمنع التكرار). */
export async function reservePreview(input: { merchantId: string | null; ip: string; phone: string | null }): Promise<PreviewDecision> {
  const phoneKey = input.phone ? `prev:phone:${input.phone.replace(/\D/g, "").slice(-10)}` : null;
  const ipKey = `prev:ip:${input.ip}`;
  const dayKey = `prev:day:${cairoDay()}`;

  const open = input.merchantId
    ? Number(
        (
          await db
            .select({ c: sql<number>`count(*)::int` })
            .from(stores)
            .where(and(eq(stores.merchantId, input.merchantId), isNull(stores.deletedAt), notInArray(stores.status, ["active", "deleted"])))
        )[0]?.c ?? 0
      )
    : 0;

  const counts: PreviewCounts = {
    openForMerchant: open,
    ip: input.ip === "0.0.0.0" || input.ip === "unknown" ? 0 : await read(ipKey),
    phone: phoneKey ? await read(phoneKey) : 0,
    today: await read(dayKey),
  };
  const limits: PreviewLimits = { maxOpen: MAX_OPEN_PREVIEWS, perIp: PER_IP, perPhone: PER_PHONE, dailyCap: dailyCap() };
  const d = decidePreview(counts, limits);

  if (!d.ok) {
    if (d.reason === "daily") {
      const first = await redis.set(`prev:daycap-alert:${cairoDay()}`, 1, { nx: true, ex: 86400 }).catch(() => null);
      if (first) await notifyAdmin(`بلغت المعاينات المجانية السقف اليومي (${limits.dailyCap}). ارفع PREVIEW_DAILY_CAP إن كان الإقبال حقيقياً، وراجع التسجيلات المشبوهة.`).catch(() => {});
    }
    return d;
  }
  await Promise.all([
    bump(dayKey, 36 * 3600),
    input.ip !== "0.0.0.0" && input.ip !== "unknown" ? bump(ipKey, 24 * 3600) : Promise.resolve(),
    phoneKey ? bump(phoneKey, 7 * 24 * 3600) : Promise.resolve(),
  ]);
  return d;
}
