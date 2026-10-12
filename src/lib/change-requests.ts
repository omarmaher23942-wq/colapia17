// change-requests.ts — قواعد «اطلب تعديل» (منطق خالص مختبَر): المجالات والحالات ونصوصها، وحصة الشهر.
export const CHANGE_AREAS = ["design", "products", "content", "other"] as const;
export type ChangeArea = (typeof CHANGE_AREAS)[number];
export const CHANGE_STATUSES = ["open", "in_progress", "done", "declined"] as const;
export type ChangeStatus = (typeof CHANGE_STATUSES)[number];

export const AREA_INFO: Record<ChangeArea, { label: string; hint: string }> = {
  design: { label: "التصميم والشكل", hint: "الألوان، الخطوط، ترتيب الصفحة، شكل البطاقات أو الواجهة" },
  products: { label: "المنتجات", hint: "إضافة منتجات كثيرة أو صورها، أو تنظيم الأقسام" },
  content: { label: "النصوص والصفحات", hint: "نصوص الصفحة الرئيسية، صفحة جديدة، أسئلة شائعة" },
  other: { label: "شيء آخر", hint: "أي تعديل لا تستطيع عمله من لوحتك" },
};

export const STATUS_INFO: Record<ChangeStatus, { label: string }> = {
  open: { label: "وصل للفريق" },
  in_progress: { label: "قيد التنفيذ" },
  done: { label: "تم" },
  declined: { label: "لم يُنفذ" },
};

export const DEFAULT_PER_MONTH = 2;

export function perMonthFrom(config: unknown): number {
  const n = Number((config as Record<string, unknown> | null)?.perMonth);
  return Number.isInteger(n) && n >= 0 && n <= 50 ? n : DEFAULT_PER_MONTH;
}

/** إزاحة القاهرة عن UTC بالدقائق في لحظة معينة (120 شتاءً و180 صيفاً). */
function cairoOffsetMinutes(at: Date): number {
  const name = new Intl.DateTimeFormat("en-US", { timeZone: "Africa/Cairo", timeZoneName: "longOffset" })
    .formatToParts(at)
    .find((p) => p.type === "timeZoneName")?.value;
  const m = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(name ?? "");
  if (!m) return 120;
  return (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] ?? 0));
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

/** ما بقي من حصة الشهر (الطلبات المرفوضة لا تُحسب). */
export function remainingQuota(usedThisMonth: number, perMonth: number): number {
  return Math.max(0, perMonth - usedThisMonth);
}
