// cairo-time.ts — توقيت القاهرة بلا مكتبة: الإزاحة الفعلية (صيفاً/شتاءً) وتحويل ساعة الحائط إلى لحظة UTC.

/** إزاحة القاهرة عن UTC بالدقائق في لحظة معينة (120 شتاءً و180 صيفاً). */
export function cairoOffsetMinutes(at: Date): number {
  const name = new Intl.DateTimeFormat("en-US", { timeZone: "Africa/Cairo", timeZoneName: "longOffset" })
    .formatToParts(at)
    .find((p) => p.type === "timeZoneName")?.value;
  const m = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(name ?? "");
  if (!m) return 120;
  return (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] ?? 0));
}

/** تاريخ اليوم في القاهرة (سنة، شهر 1–12، يوم) للحظة معينة. */
export function cairoDate(at: Date): { y: number; m: number; d: number } {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(at);
  const v = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  return { y: v("year"), m: v("month"), d: v("day") };
}

/** اللحظة UTC التي تقابل ساعة حائط معينة في القاهرة (دقيقة من بداية اليوم). */
export function cairoWallTime(day: { y: number; m: number; d: number }, minuteOfDay: number): Date {
  const naive = Date.UTC(day.y, day.m - 1, day.d, 0, minuteOfDay);
  const first = naive - cairoOffsetMinutes(new Date(naive)) * 60_000;
  // تصحيح عند حدود تغيّر التوقيت.
  return new Date(naive - cairoOffsetMinutes(new Date(first)) * 60_000);
}

/** يوم القاهرة التالي. */
export function nextCairoDay(day: { y: number; m: number; d: number }): { y: number; m: number; d: number } {
  const t = new Date(Date.UTC(day.y, day.m - 1, day.d + 1));
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

/** بداية الشهر الحالي بتوقيت القاهرة (منتصف ليل اليوم الأول بالإزاحة الفعلية صيفاً أو شتاءً). */
export function cairoMonthStart(now = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit" }).formatToParts(now);
  const y = Number(parts.find((p) => p.type === "year")!.value);
  const m = Number(parts.find((p) => p.type === "month")!.value);
  const utcMidnight = Date.UTC(y, m - 1, 1);
  // نجرّب الإزاحتين (تغيّر التوقيت قد يقع داخل الشهر) ونختار ما يطابق منتصف الليل فعلاً.
  for (const off of [cairoOffsetMinutes(new Date(utcMidnight)), cairoOffsetMinutes(new Date(utcMidnight - 3 * 3_600_000))]) {
    const t = utcMidnight - off * 60_000;
    if (cairoOffsetMinutes(new Date(t)) === off) return new Date(t);
  }
  return new Date(utcMidnight - 120 * 60_000);
}
