import "server-only";
// campaigns.ts — أداء كل حملة: النقرات (عدّاد مسار /go) والطلبات والمبيعات المنسوبة (orders.source = campaign:<slug>،
// بلا التجريبي والملغى والمرتجع). أرقام فعلية فقط.
import { and, eq, like, sql } from "drizzle-orm";
import { getTenantDb } from "@/db/tenant";
import { orders } from "@/db/schema";
import { redis } from "@/lib/redis";

export type CampaignStat = { clicks: number; orders: number; sales: number };

export async function campaignStats(storeId: string, slugs: string[]): Promise<Record<string, CampaignStat>> {
  const out: Record<string, CampaignStat> = Object.fromEntries(slugs.map((s) => [s, { clicks: 0, orders: 0, sales: 0 }]));
  if (!slugs.length) return out;
  const db = await getTenantDb(storeId);
  const [rows, clicks] = await Promise.all([
    db
      .select({ source: orders.source, n: sql<number>`count(*)`.mapWith(Number), sales: sql<number>`coalesce(sum(${orders.totalPiasters}), 0)`.mapWith(Number) })
      .from(orders)
      .where(and(eq(orders.storeId, storeId), eq(orders.isTest, false), like(orders.source, "campaign:%"), sql`${orders.status} not in ('cancelled','returned')`))
      .groupBy(orders.source),
    Promise.all(slugs.map((s) => redis.get<number | string>(`cmp:${storeId}:${s}:clicks`).catch(() => null))),
  ]);
  slugs.forEach((s, i) => (out[s]!.clicks = Number(clicks[i] ?? 0) || 0));
  for (const r of rows) {
    const slug = r.source.slice("campaign:".length);
    if (out[slug]) Object.assign(out[slug]!, { orders: r.n, sales: r.sales });
  }
  return out;
}
