// returns-list.ts — طابور الاستبدال والاسترجاع وطلبات الإلغاء في لوحة التاجر. بيانات المتجر نفسه فقط.
import "server-only";
import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { getTenantDb } from "@/db/tenant";
import { orderItems, orders, productVariants, returnRequests } from "@/db/schema";
import type { ReturnStatusKey } from "@/lib/returns";

export type ReturnRow = {
  id: string;
  orderId: string;
  orderCode: string;
  customerName: string;
  customerPhone: string;
  kind: "exchange" | "refund";
  status: ReturnStatusKey;
  reason: string | null;
  photos: string[];
  merchantNote: string | null;
  createdAt: string;
  lines: { orderItemId: string; productId: string | null; variantId: string | null; name: string; variant: string | null; qty: number; unitPiasters: number }[];
  variantsByProduct: Record<string, { id: string; label: string; stock: number | null; available: boolean }[]>;
  exchangeOrderCode: string | null;
};

export type CancelRow = { id: string; code: string; customerName: string; customerPhone: string; status: string; totalPiasters: number; requestedAt: string };

export async function returnsData(storeId: string, tab: "open" | "closed"): Promise<{ returns: ReturnRow[]; cancels: CancelRow[]; counts: { open: number; cancel: number } }> {
  const db = await getTenantDb(storeId);
  const openStatuses = ["new", "approved", "received"] as const;
  const [rows, cancelRows, openCount] = await Promise.all([
    db
      .select({ r: returnRequests, code: orders.code, name: orders.customerName, phone: orders.customerPhone, tags: orders.tags })
      .from(returnRequests)
      .innerJoin(orders, and(eq(orders.id, returnRequests.orderId), eq(orders.storeId, storeId)))
      .where(and(eq(returnRequests.storeId, storeId), tab === "open" ? inArray(returnRequests.status, [...openStatuses]) : inArray(returnRequests.status, ["rejected", "completed"])))
      .orderBy(desc(returnRequests.createdAt))
      .limit(100),
    db
      .select({ id: orders.id, code: orders.code, name: orders.customerName, phone: orders.customerPhone, status: orders.status, total: orders.totalPiasters, at: orders.cancelRequestedAt })
      .from(orders)
      .where(and(eq(orders.storeId, storeId), eq(orders.isTest, false), isNotNull(orders.cancelRequestedAt), inArray(orders.status, ["new", "confirmed", "preparing"])))
      .orderBy(desc(orders.cancelRequestedAt))
      .limit(50),
    db
      .select({ id: returnRequests.id })
      .from(returnRequests)
      .where(and(eq(returnRequests.storeId, storeId), inArray(returnRequests.status, [...openStatuses]))),
  ]);

  const orderIds = [...new Set(rows.map((x) => x.r.orderId))];
  const items = orderIds.length
    ? await db
        .select({ id: orderItems.id, orderId: orderItems.orderId, productId: orderItems.productId, variantId: orderItems.variantId, name: orderItems.name, variant: orderItems.variantLabel, qty: orderItems.quantity, unit: orderItems.unitPiasters })
        .from(orderItems)
        .where(and(eq(orderItems.storeId, storeId), inArray(orderItems.orderId, orderIds)))
    : [];
  const productIds = [...new Set(items.map((i) => i.productId).filter((p): p is string => Boolean(p)))];
  const variants = productIds.length
    ? await db
        .select({ id: productVariants.id, productId: productVariants.productId, values: productVariants.optionValues, stock: productVariants.stock, available: productVariants.isAvailable })
        .from(productVariants)
        .where(and(eq(productVariants.storeId, storeId), inArray(productVariants.productId, productIds)))
    : [];

  const returns: ReturnRow[] = rows.map(({ r, code, name, phone, tags }) => {
    const mine = items.filter((i) => i.orderId === r.orderId);
    const lines = r.items
      .map((ri) => {
        const it = mine.find((m) => m.id === ri.orderItemId);
        return it ? { orderItemId: it.id, productId: it.productId, variantId: it.variantId, name: it.name, variant: it.variant, qty: Math.min(ri.qty, it.qty), unitPiasters: it.unit } : null;
      })
      .filter((l): l is NonNullable<typeof l> => Boolean(l));
    const vb: ReturnRow["variantsByProduct"] = {};
    for (const l of lines) if (l.productId && !vb[l.productId]) vb[l.productId] = variants.filter((v) => v.productId === l.productId).map((v) => ({ id: v.id, label: v.values.join(" / "), stock: v.stock, available: v.available }));
    const ex = (tags ?? []).find((t) => t.startsWith(`exchange:${r.id}:`));
    return {
      id: r.id,
      orderId: r.orderId,
      orderCode: code,
      customerName: name,
      customerPhone: phone,
      kind: r.kind,
      status: r.status as ReturnStatusKey,
      reason: r.reason,
      photos: r.photos ?? [],
      merchantNote: r.merchantNote,
      createdAt: r.createdAt.toISOString(),
      lines,
      variantsByProduct: vb,
      exchangeOrderCode: ex ? ex.split(":")[2] ?? null : null,
    };
  });

  return {
    returns,
    cancels: cancelRows.map((c) => ({ id: c.id, code: c.code, customerName: c.name, customerPhone: c.phone, status: c.status, totalPiasters: c.total, requestedAt: c.at!.toISOString() })),
    counts: { open: openCount.length, cancel: cancelRows.length },
  };
}
