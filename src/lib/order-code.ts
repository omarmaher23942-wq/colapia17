// order-code.ts — رقم الطلب من تسلسل المتجر: بادئة اختيارية (الافتراضية #) ثم الرقم التالي. فريد لكل متجر.
export const DEFAULT_ORDER_PREFIX = "#";

/** بادئة نظيفة: حروف وأرقام وشرطة و# فقط، حتى 6 أحرف. */
export function cleanOrderPrefix(raw: unknown): string {
  if (typeof raw !== "string") return DEFAULT_ORDER_PREFIX;
  const s = raw.trim().toUpperCase().replace(/[^A-Z0-9#\-]/g, "").slice(0, 6);
  return s || DEFAULT_ORDER_PREFIX;
}

export function formatOrderCode(prefix: unknown, seq: number): string {
  return `${cleanOrderPrefix(prefix)}${Math.max(0, Math.floor(seq))}`;
}

/** يقبل ما يكتبه العميل («1042» أو «#1042» أو بالأرقام العربية) ويعيد الصيغ المحتملة للبحث. */
export function orderCodeCandidates(raw: string, prefix: unknown): string[] {
  const s = String(raw ?? "")
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .trim()
    .toUpperCase();
  if (!s) return [];
  const out = new Set<string>([s]);
  if (/^\d+$/.test(s)) out.add(formatOrderCode(prefix, Number(s)));
  return [...out];
}
