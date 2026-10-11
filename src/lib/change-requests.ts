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

/** بداية الشهر الحالي بتوقيت القاهرة (UTC+2/+3 تقريباً بلا مكتبة: نأخذ تاريخ القاهرة ونحوّله لمنتصف ليله). */
export function cairoMonthStart(now = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit" }).formatToParts(now);
  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  // منتصف ليل أول الشهر في القاهرة ≈ 22:00 UTC من اليوم السابق (+2) أو 21:00 (+3 صيفاً). نأخذ الأبكر حتى لا نُسقط طلباً.
  return new Date(Date.UTC(Number(y), Number(m) - 1, 1) - 3 * 3_600_000);
}

/** ما بقي من حصة الشهر (الطلبات المرفوضة لا تُحسب). */
export function remainingQuota(usedThisMonth: number, perMonth: number): number {
  return Math.max(0, perMonth - usedThisMonth);
}
