// reports.ts — استعلامات تقارير المتجر (ربحية المنتجات، الأقسام، القنوات، المخزون، العائدون) لفترة محددة.
// الطلبات المحققة فقط: بلا الملغاة والمرتجعة وطلبات التجربة. كل استعلام محصور في متجر الجلسة.
import "server-only";
import { and, eq, gte, isNull, lt, sql } from "drizzle-orm";
import { getTenantDb } from "@/db/tenant";
import { categories, orderItems, orders, products } from "@/db/schema";
import { channelOf, inventoryReport, profitByProduct, repeatStats, salesByCategory, salesByChannel, type Period, type SoldLine, type StockRow } from "@/lib/reports";

const LIVE = sql`${orders.status} not in ('cancelled','returned')`;

async function soldLines(storeId: string, p: Period): Promise<SoldLine[]> {
  const db = await getTenantDb(storeId);
  const rows = await db
    .select({
      productId: orderItems.productId,
      name: orderItems.name,
      qty: orderItems.quantity,
      total: orderItems.totalPiasters,
      disc: orderItems.discountPiasters,
      cost: products.costPiasters,
      category: categories.name,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .leftJoin(products, eq(products.id, orderItems.productId))
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .where(and(eq(orderItems.storeId, storeId), eq(orders.storeId, storeId), eq(orders.isTest, false), gte(orders.createdAt, p.from), lt(orders.createdAt, p.to), LIVE));
  return rows.map((r) => ({
    productId: r.productId,
    name: r.name,
    categoryName: r.category,
    qty: r.qty,
    revenuePiasters: Math.max(0, r.total - r.disc),
    costPiasters: r.cost,
  }));
}

export async function productsReport(storeId: string, p: Period) {
  const lines = await soldLines(storeId, p);
  const rows = profitByProduct(lines);
  const revenue = rows.reduce((s, r) => s + r.revenuePiasters, 0);
  const known = rows.filter((r) => r.profitPiasters !== null);
  return {
    rows,
    categories: salesByCategory(lines),
    revenue,
    units: rows.reduce((s, r) => s + r.qty, 0),
    profit: known.length === rows.length && rows.length > 0 ? known.reduce((s, r) => s + (r.profitPiasters ?? 0), 0) : null,
    costCoveragePct: rows.length ? Math.round((known.length / rows.length) * 100) : 0,
  };
}

export async function channelsReport(storeId: string, p: Period) {
  const db = await getTenantDb(storeId);
  const rows = await db
    .select({ source: orders.source, total: orders.totalPiasters })
    .from(orders)
    .where(and(eq(orders.storeId, storeId), eq(orders.isTest, false), gte(orders.createdAt, p.from), lt(orders.createdAt, p.to), LIVE));
  return salesByChannel(rows.map((r) => ({ source: r.source, totalPiasters: r.total })));
}

export async function repeatReport(storeId: string, p: Period) {
  const db = await getTenantDb(storeId);
  const rows = await db
    .select({ phone: orders.customerPhone, n: sql<number>`count(*)`.mapWith(Number), spent: sql<number>`coalesce(sum(${orders.totalPiasters}),0)`.mapWith(Number) })
    .from(orders)
    .where(and(eq(orders.storeId, storeId), eq(orders.isTest, false), lt(orders.createdAt, p.to), LIVE))
    .groupBy(orders.customerPhone);
  return repeatStats(rows.map((r) => ({ orders: r.n, spentPiasters: r.spent })));
}

export async function inventoryReportData(storeId: string, windowDays: number) {
  const db = await getTenantDb(storeId);
  const since = new Date(Date.now() - windowDays * 86_400_000);
  const [prod, sold] = await Promise.all([
    db
      .select({ id: products.id, name: products.name, stock: products.stock, track: products.trackStock, price: products.pricePiasters, cost: products.costPiasters, category: categories.name })
      .from(products)
      .leftJoin(categories, eq(categories.id, products.categoryId))
      .where(and(eq(products.storeId, storeId), isNull(products.deletedAt), sql`${products.status} <> 'archived'`)),
    db
      .select({ productId: orderItems.productId, qty: sql<number>`coalesce(sum(${orderItems.quantity}) filter (where ${orders.createdAt} >= ${since}),0)`.mapWith(Number), last: sql<Date | null>`max(${orders.createdAt})` })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .where(and(eq(orderItems.storeId, storeId), eq(orders.isTest, false), LIVE))
      .groupBy(orderItems.productId),
  ]);
  const soldBy = new Map(sold.map((s) => [s.productId, s]));
  const rows: StockRow[] = prod.map((r) => ({
    id: r.id,
    name: r.name,
    categoryName: r.category,
    stock: r.stock,
    trackStock: r.track,
    pricePiasters: r.price,
    costPiasters: r.cost,
    soldInWindow: soldBy.get(r.id)?.qty ?? 0,
    lastSoldAt: soldBy.get(r.id)?.last ? new Date(soldBy.get(r.id)!.last as unknown as string) : null,
  }));
  return inventoryReport(rows, windowDays);
}

export { channelOf };
