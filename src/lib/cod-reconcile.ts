// cod-reconcile.ts — تسوية التحصيل عند الاستلام لكل شركة شحن: ما سُلِّم ولم يُسدَّد مقابل ما سُدِّد (منطق خالص مختبَر).
// التسوية تُحفظ وسماً على الطلب نفسه (orders.tags) فلا جداول جديدة: «تمت التسوية» = وصل المبلغ من الشركة.
export const SETTLED_TAG = "cod-settled";

export type CodOrder = { id: string; code: string; courierName: string | null; status: string; collectPiasters: number; tags: string[]; deliveredAt: string | null };
export type CodGroup = { courier: string; deliveredCount: number; deliveredPiasters: number; settledPiasters: number; pendingPiasters: number; pending: CodOrder[] };

export const isSettled = (tags: string[] | null | undefined) => (tags ?? []).includes(SETTLED_TAG);

/** يجمع طلبات الاستلام المسلَّمة (التي لها مبلغ تحصيل) حسب الشركة؛ المعلّق = غير المسدّد. */
export function reconcileCod(orders: CodOrder[]): CodGroup[] {
  const groups = new Map<string, CodGroup>();
  for (const o of orders) {
    if (o.status !== "delivered" || o.collectPiasters <= 0) continue;
    const courier = o.courierName?.trim() || "بدون شركة";
    const g = groups.get(courier) ?? { courier, deliveredCount: 0, deliveredPiasters: 0, settledPiasters: 0, pendingPiasters: 0, pending: [] };
    g.deliveredCount++;
    g.deliveredPiasters += o.collectPiasters;
    if (isSettled(o.tags)) g.settledPiasters += o.collectPiasters;
    else {
      g.pendingPiasters += o.collectPiasters;
      g.pending.push(o);
    }
    groups.set(courier, g);
  }
  return [...groups.values()].sort((a, b) => b.pendingPiasters - a.pendingPiasters);
}
