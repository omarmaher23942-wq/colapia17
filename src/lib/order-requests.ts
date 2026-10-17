// order-requests.ts — قواعد ما بعد الشراء بلا حسابات (خالصة): متى يطلب العميل الإلغاء، ومتى الاستبدال أو الاسترجاع، والخط الزمني
// لحالة الطلب. القرار النهائي دائماً للتاجر؛ الطلب مجرد إشعار منظّم له.
export type OrderLike = {
  status: string;
  deliveredAt?: Date | string | null;
  cancelRequestedAt?: Date | string | null;
};

const DAY = 86_400_000;

/** الإلغاء يُطلب ما دام الطلب جديداً أو مؤكداً (قبل التجهيز)، ولمرة واحدة. */
export function canRequestCancel(o: OrderLike): boolean {
  return (o.status === "new" || o.status === "confirmed") && !o.cancelRequestedAt;
}

export type ReturnWindow = { open: boolean; daysLeft: number; reason?: "not_delivered" | "disabled" | "expired" };

/** نافذة الاستبدال/الاسترجاع: من تاريخ التسليم ولعدد الأيام في سياسة المتجر (0 = لا استبدال ولا استرجاع). */
export function returnWindow(o: OrderLike, windowDays: number, now = Date.now()): ReturnWindow {
  if (windowDays <= 0) return { open: false, daysLeft: 0, reason: "disabled" };
  if (o.status !== "delivered" || !o.deliveredAt) return { open: false, daysLeft: 0, reason: "not_delivered" };
  const at = new Date(o.deliveredAt).getTime();
  if (!Number.isFinite(at)) return { open: false, daysLeft: 0, reason: "not_delivered" };
  const left = Math.ceil((at + windowDays * DAY - now) / DAY);
  return left > 0 ? { open: true, daysLeft: left } : { open: false, daysLeft: 0, reason: "expired" };
}

export type ReturnKindChoice = "exchange" | "refund";
export function returnKindsAllowed(policy: { allowExchange: boolean; allowRefund: boolean }): ReturnKindChoice[] {
  return [...(policy.allowExchange ? (["exchange"] as const) : []), ...(policy.allowRefund ? (["refund"] as const) : [])];
}

export type ReturnLineInput = { orderItemId: string; qty: number; reason?: string };

/** يتحقق من أسطر الطلب: تنتمي للطلب، بكمية صحيحة لا تتجاوز المطلوب، بلا تكرار. يعيد رسالة خطأ أو null. */
export function validateReturnLines(lines: ReturnLineInput[], orderItems: { id: string; quantity: number; unitPiasters: number }[]): string | null {
  if (!lines.length) return "اختاروا منتجاً واحداً على الأقل";
  const seen = new Set<string>();
  for (const l of lines) {
    const it = orderItems.find((x) => x.id === l.orderItemId);
    if (!it) return "منتج غير موجود في هذا الطلب";
    if (it.unitPiasters === 0) return "الهدايا المجانية لا تُستبدل";
    if (seen.has(l.orderItemId)) return "منتج مكرر في الطلب";
    seen.add(l.orderItemId);
    if (!Number.isInteger(l.qty) || l.qty < 1 || l.qty > it.quantity) return "الكمية غير صحيحة";
  }
  return null;
}

export type TimelineStep = { key: string; label: string; at: string | null; state: "done" | "current" | "todo" };

const FLOW: [string, string][] = [
  ["new", "تم استلام الطلب"],
  ["confirmed", "تم التأكيد"],
  ["preparing", "قيد التجهيز"],
  ["shipped", "مع شركة الشحن"],
  ["delivered", "تم التسليم"],
];

/** الخط الزمني: الخطوات المنتهية بوقتها من سجل الحالات، والحالية، والمتبقية. الملغي/المرتجع يقطع المسار بنهاية واضحة. */
export function buildTimeline(status: string, history: { status: string; at: string }[] = [], createdAt?: string | Date): TimelineStep[] {
  const at = (k: string) => history.find((h) => h.status === k)?.at ?? (k === "new" && createdAt ? new Date(createdAt).toISOString() : null);
  if (status === "cancelled" || status === "returned") {
    const reached = FLOW.filter(([k]) => history.some((h) => h.status === k) || k === "new");
    return [
      ...reached.map(([k, label]) => ({ key: k, label, at: at(k), state: "done" as const })),
      { key: status, label: status === "cancelled" ? "تم إلغاء الطلب" : "تم إرجاع الطلب", at: at(status), state: "current" as const },
    ];
  }
  const idx = Math.max(0, FLOW.findIndex(([k]) => k === status));
  return FLOW.map(([k, label], i) => ({ key: k, label, at: at(k), state: i < idx || (i === idx && k === "delivered") ? "done" : i === idx ? "current" : "todo" }));
}
