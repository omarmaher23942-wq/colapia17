// ship.ts — بيانات صفحة «الشحن»: الطلبات الجاهزة للشحن (مؤكدة أو قيد التجهيز) والمشحونة حديثاً، وطلبات الاستلام المسلَّمة للتسوية.
// بيانات المتجر نفسه فقط عبر getTenantDb، وبلا الطلبات التجريبية.
import "server-only";
import { and, desc, eq, gte, inArray } from "drizzle-orm";
import { getTenantDb } from "@/db/tenant";
import { orderItems, orders } from "@/db/schema";
import { codAmountEgp, type ShipOrder } from "@/lib/courier-export";
import type { CodOrder } from "@/lib/cod-reconcile";

export type ShipRow = ShipOrder & {
  id: string;
  status: string;
  courierName: string | null;
  trackingNumber: string | null;
  shippedAt: string | null;
  createdAt: string;
  gift: boolean;
};

const DAY = 86_400_000;

export async function shipQueue(storeId: string): Promise<{ ready: ShipRow[]; shipped: ShipRow[] }> {
  const db = await getTenantDb(storeId);
  const rows = await db
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.storeId, storeId),
        eq(orders.isTest, false),
        inArray(orders.status, ["confirmed", "preparing", "shipped"]),
        gte(orders.createdAt, new Date(Date.now() - 45 * DAY))
      )
    )
    .orderBy(desc(orders.createdAt))
    .limit(300);
  const items = rows.length
    ? await db
        .select({ orderId: orderItems.orderId, name: orderItems.name, variant: orderItems.variantLabel, qty: orderItems.quantity })
        .from(orderItems)
        .where(and(eq(orderItems.storeId, storeId), inArray(orderItems.orderId, rows.map((r) => r.id))))
    : [];
  const out: ShipRow[] = rows.map((o) => ({
    id: o.id,
    status: o.status,
    code: o.code,
    customerName: o.customerName,
    customerPhone: o.customerPhone,
    customerAltPhone: o.customerAltPhone,
    governorate: o.governorate,
    city: o.city,
    address: o.address,
    landmark: o.landmark,
    customerNotes: o.customerNotes,
    paymentMethod: o.paymentMethod,
    paymentStatus: o.paymentStatus,
    totalPiasters: o.totalPiasters,
    paidPiasters: o.paidPiasters,
    courierName: o.courierName,
    trackingNumber: o.trackingNumber,
    shippedAt: o.shippedAt?.toISOString() ?? null,
    createdAt: o.createdAt.toISOString(),
    gift: Boolean(o.gift?.wrap),
    items: items.filter((i) => i.orderId === o.id).map((i) => ({ name: i.name, variant: i.variant, qty: i.qty })),
  }));
  return { ready: out.filter((o) => o.status !== "shipped"), shipped: out.filter((o) => o.status === "shipped") };
}

/** طلبات الدفع عند الاستلام المسلَّمة خلال 120 يوماً مع مبلغ التحصيل لكل منها. */
export async function codDelivered(storeId: string): Promise<CodOrder[]> {
  const db = await getTenantDb(storeId);
  const rows = await db
    .select({
      id: orders.id,
      code: orders.code,
      courierName: orders.courierName,
      status: orders.status,
      total: orders.totalPiasters,
      paid: orders.paidPiasters,
      tags: orders.tags,
      deliveredAt: orders.deliveredAt,
    })
    .from(orders)
    .where(and(eq(orders.storeId, storeId), eq(orders.isTest, false), eq(orders.paymentMethod, "cod"), eq(orders.status, "delivered"), gte(orders.deliveredAt, new Date(Date.now() - 120 * DAY))))
    .orderBy(desc(orders.deliveredAt))
    .limit(500);
  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    courierName: r.courierName,
    status: r.status,
    collectPiasters: Math.round(codAmountEgp({ paymentMethod: "cod", paymentStatus: "pending", totalPiasters: r.total, paidPiasters: r.paid }) * 100),
    tags: r.tags ?? [],
    deliveredAt: r.deliveredAt?.toISOString() ?? null,
  }));
}
