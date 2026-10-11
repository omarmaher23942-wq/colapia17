// format.ts — تنسيق زمني لطلبات المتاجر في لوحة المالك (أرقام لاتينية، بتوقيت القاهرة).
export function ago(d: Date, now = new Date()): string {
  const m = Math.max(0, Math.round((now.getTime() - d.getTime()) / 60_000));
  if (m < 1) return "الآن";
  if (m < 60) return `منذ ${m} د`;
  const h = Math.round(m / 60);
  if (h < 24) return `منذ ${h} س`;
  return `منذ ${Math.round(h / 24)} يوم`;
}

export const at = (d: Date) =>
  new Intl.DateTimeFormat("ar-EG-u-nu-latn", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Africa/Cairo" }).format(d);

/** تأخر عن الوعد: الموعد الأقصى مرّ والطلب لم يصل للتسليم. */
export const isLate = (r: { etaTo: Date | null; stage: string | null }, now = new Date()) => Boolean(r.etaTo && r.stage !== "delivery" && r.etaTo < now);
