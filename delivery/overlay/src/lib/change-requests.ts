// change-requests.ts (مشروعك الخاص) — لا نظام طلبات تعديل داخل مشروعك (طلب التعديل من الوكالة عبر الرابط في اللوحة).
// بقيت هنا دالة واحدة تحتاجها تقارير اللوحة: بداية الشهر الحالي بتوقيت القاهرة.
import { cairoOffsetMinutes } from "@/lib/cairo-time";

/** بداية الشهر الحالي بتوقيت القاهرة (منتصف ليل اليوم الأول بالإزاحة الفعلية صيفاً أو شتاءً). */
export function cairoMonthStart(now = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit" }).formatToParts(now);
  const y = Number(parts.find((p) => p.type === "year")!.value);
  const m = Number(parts.find((p) => p.type === "month")!.value);
  const utcMidnight = Date.UTC(y, m - 1, 1);
  for (const off of [cairoOffsetMinutes(new Date(utcMidnight)), cairoOffsetMinutes(new Date(utcMidnight - 3 * 3_600_000))]) {
    const t = utcMidnight - off * 60_000;
    if (cairoOffsetMinutes(new Date(t)) === off) return new Date(t);
  }
  return new Date(utcMidnight - 120 * 60_000);
}
