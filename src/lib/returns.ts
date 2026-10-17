// returns.ts — طابور الاستبدال والاسترجاع والإلغاء: الحالات المسموحة ورسائل واتساب الجاهزة (منطق خالص مختبَر).
export type ReturnStatusKey = "new" | "approved" | "rejected" | "received" | "completed";
export type ReturnKindKey = "exchange" | "refund";

export const STATUS_LABEL: Record<ReturnStatusKey, string> = {
  new: "جديد",
  approved: "تمت الموافقة",
  rejected: "مرفوض",
  received: "استُلمت القطع",
  completed: "مكتمل",
};
export const KIND_LABEL: Record<ReturnKindKey, string> = { exchange: "استبدال", refund: "استرجاع" };

const NEXT: Record<ReturnStatusKey, ReturnStatusKey[]> = {
  new: ["approved", "rejected"],
  approved: ["received", "rejected"],
  received: ["completed"],
  rejected: [],
  completed: [],
};

export const canMoveReturn = (from: ReturnStatusKey, to: ReturnStatusKey): boolean => NEXT[from].includes(to);
export const nextReturnStatuses = (from: ReturnStatusKey): ReturnStatusKey[] => NEXT[from];

export type ReturnMsgCtx = { name: string; code: string; storeName: string; kind: ReturnKindKey; note?: string | null };
const first = (n: string) => n.trim().split(/\s+/)[0] ?? n;

/** رسالة واتساب للعميل عند كل انتقال. */
export function returnMessage(to: ReturnStatusKey, c: ReturnMsgCtx): string {
  const hi = `مرحباً ${first(c.name)}،`;
  const what = c.kind === "exchange" ? "طلب الاستبدال" : "طلب الاسترجاع";
  const note = c.note?.trim() ? `\n${c.note.trim()}` : "";
  switch (to) {
    case "approved":
      return `${hi} وافقنا على ${what} للطلب ${c.code} من ${c.storeName}.${note}\nيرجى تجهيز القطع بحالتها الأصلية وسنرتب الاستلام معكم.`;
    case "rejected":
      return `${hi} نعتذر، تعذّر قبول ${what} للطلب ${c.code}.${note}\nيسعدنا مساعدتكم في أي استفسار.`;
    case "received":
      return `${hi} استلمنا القطع الراجعة من الطلب ${c.code}.${note}\nسنُكمل ${c.kind === "exchange" ? "ترتيب القطعة البديلة" : "إجراءات الاسترداد"} ونوافيكم قريباً.`;
    case "completed":
      return c.kind === "exchange"
        ? `${hi} أُنجز استبدال الطلب ${c.code}.${note}\nشكراً لثقتكم في ${c.storeName}.`
        : `${hi} أُنجز استرجاع الطلب ${c.code}.${note}\nشكراً لثقتكم في ${c.storeName}.`;
    default:
      return `${hi} بخصوص ${what} للطلب ${c.code}.${note}`;
  }
}

export function cancelMessage(decision: "approved" | "declined", c: { name: string; code: string; storeName: string; note?: string | null }): string {
  const hi = `مرحباً ${first(c.name)}،`;
  const note = c.note?.trim() ? `\n${c.note.trim()}` : "";
  return decision === "approved"
    ? `${hi} تم إلغاء الطلب ${c.code} من ${c.storeName} بناءً على طلبكم.${note}`
    : `${hi} نعتذر، لم نتمكن من إلغاء الطلب ${c.code} لأنه خرج للتجهيز أو الشحن.${note}\nيمكنكم التواصل معنا لأي ترتيب.`;
}

/** قيمة السلعة الراجعة التي تُخصم من طلب الاستبدال الجديد (سعر الوحدة × الكمية الراجعة، ولا تتجاوز الكمية المطلوبة أصلاً). */
export function creditFor(lines: { unitPiasters: number; quantity: number }[], returned: { index: number; qty: number }[]): number {
  return returned.reduce((sum, r) => {
    const l = lines[r.index];
    if (!l) return sum;
    return sum + l.unitPiasters * Math.min(Math.max(0, r.qty), l.quantity);
  }, 0);
}
