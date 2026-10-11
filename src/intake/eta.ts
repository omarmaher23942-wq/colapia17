// eta.ts — موعد تسليم صادق يُعرض للعميل عند الإرسال، محسوب من طول الطابور الحقيقي وطاقة الفريق اليومية.
// الوعد الأساسي «من 12 ساعة إلى 4 أيام». لو الطابور أطول من ذلك نقول الحقيقة (نطاق أبعد) بدل وعد لا نفي به.

export const ETA_MIN_HOURS = 12;
export const ETA_MAX_HOURS = 96;
export const DEFAULT_CAPACITY_PER_DAY = 3;

export type Eta = { fromHours: number; toHours: number; extended: boolean };

/**
 * ahead = طلبات مُرسلة قبل هذا الطلب ولم تُسلَّم بعد. كل `capacityPerDay` منها يؤخر بداية العمل يوماً.
 * نهاية النطاق لا تقل عن 4 أيام، ولا عن بدايته + يومين.
 */
export function estimateEta(ahead: number, capacityPerDay = DEFAULT_CAPACITY_PER_DAY): Eta {
  const whole = (n: number, min: number) => (Number.isFinite(n) ? Math.max(min, Math.floor(n)) : min);
  const queueDays = Math.floor(whole(ahead, 0) / whole(capacityPerDay, 1));
  const fromHours = ETA_MIN_HOURS + queueDays * 24;
  const toHours = Math.max(ETA_MAX_HOURS, fromHours + 48);
  return { fromHours, toHours, extended: toHours > ETA_MAX_HOURS };
}

function duration(hours: number, roundUp: boolean): string {
  if (hours < 24) return `${hours} ساعة`;
  const d = roundUp ? Math.ceil(hours / 24) : Math.max(1, Math.round(hours / 24));
  if (d === 1) return "يوم";
  if (d === 2) return "يومين";
  return d <= 10 ? `${d} أيام` : `${d} يوماً`;
}

/** «من 12 ساعة إلى 4 أيام» */
export const etaText = (eta: Pick<Eta, "fromHours" | "toHours">): string =>
  `من ${duration(eta.fromHours, false)} إلى ${duration(eta.toHours, true)}`;
