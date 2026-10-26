// other-service.ts — مسار «خدمة أخرى غير المتجر» (خالص ومختبَر): ملاحظة التسعير التي يضبطها المالك، وعلامة المحادثة في الذاكرة
// (تظهر شارة وفلتراً في /admin/conversations)، وملخص الطلب الذي يصل المالك. الوكيل لا يطلب دفعاً ولا يرسل رابط الحجز في هذا المسار.

/** قيمة العلامة في `conversations.memory.flag`. */
export const OTHER_SERVICE_FLAG = "other_service";

/** نص الملاحظة حين لا يضبط المالك شيئاً. */
export const OTHER_SERVICE_NO_NOTE = "لم يحدد المالك سعراً معلناً: قل إن الفريق يسعّر المشروع بعد فهم تفاصيله، ولا تذكر رقماً.";

const MAX_NOTE = 600;
const clean = (s: string) => s.replace(/\s+/g, " ").trim().slice(0, MAX_NOTE);

/**
 * ملاحظة المشاريع الأخرى من إعداد التسعير الخام. تقرأ بتسامح كل الأشكال المتوقعة (نص، أو كائن فيه note/text، أو حقل
 * `otherServicesNote`) لأن شكل الإعداد يملكه مسار الأسعار: غياب الملاحظة يعني نصاً فارغاً لا خطأ.
 */
export function otherServicesNoteFrom(raw: unknown): string {
  if (!raw || typeof raw !== "object") return "";
  const c = raw as Record<string, unknown>;
  const direct = c.otherServicesNote;
  if (typeof direct === "string") return clean(direct);
  const o = c.otherServices;
  if (typeof o === "string") return clean(o);
  if (o && typeof o === "object") {
    const r = o as Record<string, unknown>;
    for (const k of ["note", "text", "price", "pricing"]) if (typeof r[k] === "string" && (r[k] as string).trim()) return clean(r[k] as string);
  }
  return "";
}

/** هل المحادثة مصنفة «خدمة أخرى» في ذاكرتها؟ */
export const isOtherService = (memory: unknown): boolean => (memory as { flag?: unknown } | null)?.flag === OTHER_SERVICE_FLAG;

/** ملخص الطلب: ما كتبه النموذج في brief، وإلا ذاكرته عن المحاور، مقصوصاً. */
export function briefOf(brief: string | null | undefined, summary: string | null | undefined): string {
  const b = (brief ?? "").replace(/\s+/g, " ").trim();
  if (b) return b.slice(0, 500);
  return (summary ?? "").replace(/\s+/g, " ").trim().slice(0, 500);
}
