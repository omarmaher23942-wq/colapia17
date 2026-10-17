// usage-limits.ts — حدود الاستخدام الشهرية لكل متجر: القيم الافتراضية حسب الخطة، ودمج إعداد المالك، والعدّادات (منطق خالص مختبَر).
export type UsageLimits = {
  /** عمليات الذكاء الاصطناعي في الشهر (كل الأنواع معاً). */
  aiPerMonth: number;
  imagesPerMonth: number;
  imageBytesPerMonth: number;
  videosPerMonth: number;
  videoMaxBytes: number;
};

const MB = 1024 * 1024;
export const PAID_LIMITS: UsageLimits = { aiPerMonth: 300, imagesPerMonth: 1500, imageBytesPerMonth: 2048 * MB, videosPerMonth: 10, videoMaxBytes: 50 * MB };
export const TRIAL_LIMITS: UsageLimits = { aiPerMonth: 40, imagesPerMonth: 300, imageBytesPerMonth: 512 * MB, videosPerMonth: 2, videoMaxBytes: 50 * MB };

const pos = (v: unknown, fallback: number, max: number) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.min(Math.floor(v), max) : fallback);

/** الحدود الفعلية: افتراضي الخطة، وإعداد المالك (flag «usage») يتجاوز حسب الخطة { paid:{…}, trial:{…} }. */
export function limitsFor(isTrial: boolean, config: unknown): UsageLimits {
  const base = isTrial ? TRIAL_LIMITS : PAID_LIMITS;
  const c = (config && typeof config === "object" ? (config as Record<string, unknown>)[isTrial ? "trial" : "paid"] : null) as Record<string, unknown> | null;
  if (!c || typeof c !== "object") return base;
  return {
    aiPerMonth: pos(c.aiPerMonth, base.aiPerMonth, 100_000),
    imagesPerMonth: pos(c.imagesPerMonth, base.imagesPerMonth, 1_000_000),
    imageBytesPerMonth: pos(c.imageBytesPerMonth, base.imageBytesPerMonth, 1024 ** 4),
    videosPerMonth: pos(c.videosPerMonth, base.videosPerMonth, 100_000),
    videoMaxBytes: pos(c.videoMaxBytes, base.videoMaxBytes, 2 * 1024 ** 3),
  };
}

export type MeterTone = "ok" | "warn" | "bad";
export type Meter = { used: number; limit: number; pct: number; remaining: number; tone: MeterTone };

export function meter(used: number, limit: number): Meter {
  const u = Math.max(0, used);
  const pct = limit <= 0 ? 100 : Math.min(100, Math.round((u / limit) * 100));
  return { used: u, limit, pct, remaining: Math.max(0, limit - u), tone: pct >= 100 ? "bad" : pct >= 80 ? "warn" : "ok" };
}

const MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

/** مفتاح الشهر الحالي بتوقيت القاهرة (YYYY-MM). */
export function usageMonth(now = new Date()): string {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit" }).formatToParts(now);
  return `${p.find((x) => x.type === "year")!.value}-${p.find((x) => x.type === "month")!.value}`;
}

/** تاريخ التجدد بالعربية: «1 نوفمبر». */
export function nextResetLabel(now = new Date()): string {
  const m = Number(usageMonth(now).split("-")[1]);
  return `1 ${MONTHS[m % 12]}`;
}

export function limitMessage(what: string, limit: number, now = new Date()): string {
  return `وصلتم إلى حد ${what} هذا الشهر (${limit.toLocaleString("en-US")}). يتجدد الحد في ${nextResetLabel(now)}، ويمكنكم متابعة العمل يدوياً في الأثناء.`;
}

export const fmtBytes = (b: number): string => (b >= 1024 ** 3 ? `${(b / 1024 ** 3).toFixed(1)} غيغابايت` : `${Math.round(b / MB)} ميغابايت`);
