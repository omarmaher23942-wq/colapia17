// preview-rules.ts — قواعد حماية المعاينة المجانية (منطق خالص مختبَر)؛ التنفيذ في preview-guard.ts.

export const MAX_OPEN_PREVIEWS = 2;
export const PER_IP = 3;
export const PER_PHONE = 2;
export const DEFAULT_DAILY_CAP = 80;

export type PreviewCounts = { openForMerchant: number; ip: number; phone: number; today: number };
export type PreviewLimits = { maxOpen: number; perIp: number; perPhone: number; dailyCap: number };
export type PreviewDecision = { ok: true } | { ok: false; reason: "merchant" | "ip" | "phone" | "daily"; message: string };

export const MESSAGES = {
  merchant: `عندك ${MAX_OPEN_PREVIEWS} متاجر قيد التجربة بالفعل. فعّل أحدها أو احذفه من الإعدادات، ثم ابنِ متجراً جديداً.`,
  ip: "وصلنا عدد كبير من طلبات بناء المتاجر من اتصالك خلال اليوم. حاول مرة أخرى غداً أو تواصل معنا.",
  phone: "هذا الرقم استُخدم لبناء متاجر كثيرة خلال الأيام الماضية. تواصل معنا إن كنت تحتاج متجراً إضافياً.",
  daily: "الطلبات كثيرة اليوم ونحرص على جودة كل متجر نبنيه. جرّب مرة أخرى غداً، أو تواصل معنا وسنجهّز لك دوراً.",
} as const;

/** القرار الخالص: الأولوية للأقرب للتاجر (مشكلته هو) ثم الأعم. */
export function decidePreview(c: PreviewCounts, l: PreviewLimits): PreviewDecision {
  if (c.openForMerchant >= l.maxOpen) return { ok: false, reason: "merchant", message: MESSAGES.merchant };
  if (c.phone >= l.perPhone) return { ok: false, reason: "phone", message: MESSAGES.phone };
  if (c.ip >= l.perIp) return { ok: false, reason: "ip", message: MESSAGES.ip };
  if (c.today >= l.dailyCap) return { ok: false, reason: "daily", message: MESSAGES.daily };
  return { ok: true };
}

