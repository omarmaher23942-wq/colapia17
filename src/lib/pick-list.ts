// pick-list.ts — تجميع قائمة التجهيز: كل قطعة بمقاسها وكميتها الإجمالية عبر الطلبات (منطق خالص مختبَر).
export type PickInput = { orderId: string; orderCode: string; productId: string | null; name: string; variant: string | null; image: string | null; qty: number };
export type PickLine = { key: string; productId: string | null; name: string; variant: string | null; image: string | null; qty: number; orders: { id: string; code: string }[] };

export function aggregatePick(items: PickInput[]): PickLine[] {
  const map = new Map<string, PickLine>();
  for (const i of items) {
    const variant = i.variant?.trim() || null;
    const key = `${i.productId ?? i.name}|${variant ?? ""}`;
    const line = map.get(key) ?? { key, productId: i.productId, name: i.name, variant, image: i.image, qty: 0, orders: [] };
    line.qty += Math.max(0, Math.floor(i.qty));
    if (!line.orders.some((o) => o.id === i.orderId)) line.orders.push({ id: i.orderId, code: i.orderCode });
    if (!line.image && i.image) line.image = i.image;
    map.set(key, line);
  }
  return [...map.values()].sort((a, b) => b.qty - a.qty || a.name.localeCompare(b.name, "ar"));
}
