// change-requests.ts — قواعد «اطلب تعديل» (منطق خالص مختبَر): المجالات والحالات ونصوصها، وحصة سنة الاشتراك (قرار المالك 2026-10-17: طلبان لكل سنة اشتراك).
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

import { cairoOffsetMinutes } from "@/lib/cairo-time";

/** عدد طلبات التعديل لكل سنة اشتراك (يُضبط من إعداد «change_requests» ← perYear). */
export const DEFAULT_PER_YEAR = 2;

export function perYearFrom(config: unknown): number {
  const n = Number((config as Record<string, unknown> | null)?.perYear);
  return Number.isInteger(n) && n >= 0 && n <= 50 ? n : DEFAULT_PER_YEAR;
}

/**
 * بداية «سنة الاشتراك» الحالية: يوم التفعيل ثم كل سنة بعده (التاريخ نفسه). تُحسب الطلبات منذ هذه البداية، فالتجديد
 * أو الباقة الأقصر من سنة لا يمنحان حصة جديدة قبل مرور سنة كاملة على التفعيل. بلا تاريخ تفعيل (تجربة) تُعدّ كل الطلبات.
 */
export function quotaPeriodStart(activatedAt: Date | null | undefined, now = new Date()): Date {
  if (!activatedAt) return new Date(0);
  if (activatedAt.getTime() > now.getTime()) return activatedAt;
  let years = now.getUTCFullYear() - activatedAt.getUTCFullYear();
  const at = (y: number) => {
    const d = new Date(activatedAt.getTime());
    d.setUTCFullYear(activatedAt.getUTCFullYear() + y);
    // 29 فبراير في سنة غير كبيسة يتحول إلى 1 مارس: نرجعه لآخر فبراير.
    if (d.getUTCMonth() !== activatedAt.getUTCMonth()) d.setUTCDate(0);
    return d;
  };
  while (years > 0 && at(years).getTime() > now.getTime()) years--;
  return at(Math.max(0, years));
}

/** موعد تجدد الحصة (بداية السنة التالية من الاشتراك)، للعرض فقط. */
export function quotaPeriodEnd(activatedAt: Date | null | undefined, now = new Date()): Date | null {
  if (!activatedAt) return null;
  const start = quotaPeriodStart(activatedAt, now);
  const d = new Date(start.getTime());
  d.setUTCFullYear(start.getUTCFullYear() + 1);
  if (d.getUTCMonth() !== start.getUTCMonth()) d.setUTCDate(0);
  return d;
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

/** ما بقي من حصة سنة الاشتراك (الطلبات المرفوضة لا تُحسب). */
export function remainingQuota(used: number, perYear: number): number {
  return Math.max(0, perYear - used);
}
