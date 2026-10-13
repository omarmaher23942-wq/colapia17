// trial-facts.ts — ما حدث فعلاً في متجر أثناء تجربته: منتجاته المنشورة، وطلباته التجريبية والحقيقية، وزواره منذ
// التسليم. تستخدمه رسائل التجربة (lifecycle/handlers.ts) وصفحة الدفع، فلا يُذكر رقم لم يحدث.
import "server-only";
import { and, count, eq, sql } from "drizzle-orm";
import { getTenantDb } from "@/db/tenant";
import { orders, products } from "@/db/schema";

export type TrialFacts = { products: number; orders: number; realOrders: number; visitors: number };

export async function trialFacts(store: { id: string; deliveredAt: Date | null }): Promise<TrialFacts> {
  const tdb = await getTenantDb(store.id);
  const since = store.deliveredAt ?? new Date(Date.now() - 3 * 864e5);
  const [[p], [o], visitors] = await Promise.all([
    tdb.select({ n: count() }).from(products).where(and(eq(products.storeId, store.id), eq(products.status, "active"))),
    tdb
      .select({ test: sql<number>`count(*) filter (where ${orders.isTest})`.mapWith(Number), real: sql<number>`count(*) filter (where not ${orders.isTest})`.mapWith(Number) })
      .from(orders)
      .where(eq(orders.storeId, store.id)),
    tdb
      .execute(sql`select count(distinct visitor_id) as n from analytics_events where store_id = ${store.id} and name = 'page_view' and created_at >= ${since.toISOString()}::timestamptz`)
      .then((r) => Number((r.rows?.[0] as { n?: unknown } | undefined)?.n ?? 0) || 0)
      .catch(() => 0),
  ]);
  return { products: Number(p?.n ?? 0), orders: Number(o?.test ?? 0), realOrders: Number(o?.real ?? 0), visitors };
}
