import "server-only";
// order-risk.ts — يجمع إشارات المخاطرة لمجموعة طلبات من متجر واحد (سجل كل رقم، الطلبات المفتوحة الحديثة، متوسط
// المُسلَّم) باستعلامين، ثم يقيّمها بـ `orderRisk` الخالصة. لا يقرأ أي بيانات من متاجر أخرى.
import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { getTenantDb } from "@/db/tenant";
import { orders } from "@/db/schema";
import { orderRisk, type RiskResult } from "@/lib/order-risk";

type RiskRow = Pick<
  typeof orders.$inferSelect,
  "id" | "status" | "isTest" | "createdAt" | "paymentMethod" | "totalPiasters" | "customerName" | "customerPhone" | "address"
>;

export type RiskHistory = { total: number; delivered: number; returned: number; cancelled: number };
const OPEN = ["new", "confirmed", "preparing"];

export async function riskForOrders(storeId: string, rows: RiskRow[]): Promise<Map<string, { risk: RiskResult; history: RiskHistory }>> {
  const out = new Map<string, { risk: RiskResult; history: RiskHistory }>();
  if (!rows.length) return out;
  const db = await getTenantDb(storeId);
  const phones = [...new Set(rows.map((r) => r.customerPhone))];
  const since = new Date(Date.now() - 180 * 86400_000);
  const [hist, avg, recent] = await Promise.all([
    db
      .select({
        phone: orders.customerPhone,
        total: sql<number>`count(*)`.mapWith(Number),
        delivered: sql<number>`count(*) filter (where ${orders.status} = 'delivered')`.mapWith(Number),
        returned: sql<number>`count(*) filter (where ${orders.status} = 'returned')`.mapWith(Number),
        cancelled: sql<number>`count(*) filter (where ${orders.status} = 'cancelled')`.mapWith(Number),
      })
      .from(orders)
      .where(and(eq(orders.storeId, storeId), eq(orders.isTest, false), inArray(orders.customerPhone, phones)))
      .groupBy(orders.customerPhone),
    db
      .select({ avg: sql<number | null>`avg(${orders.totalPiasters})::int`, n: sql<number>`count(*)`.mapWith(Number) })
      .from(orders)
      .where(and(eq(orders.storeId, storeId), eq(orders.isTest, false), eq(orders.status, "delivered"), gte(orders.createdAt, since))),
    db
      .select({ id: orders.id, phone: orders.customerPhone, createdAt: orders.createdAt })
      .from(orders)
      .where(
        and(
          eq(orders.storeId, storeId),
          eq(orders.isTest, false),
          inArray(orders.customerPhone, phones),
          inArray(orders.status, OPEN as never),
          gte(orders.createdAt, new Date(Math.min(...rows.map((r) => r.createdAt.getTime())) - 86400_000))
        )
      ),
  ]);
  const hm = new Map(hist.map((h) => [h.phone, h]));
  const avgDelivered = avg[0] && avg[0].n >= 5 ? Number(avg[0].avg) || null : null;

  for (const r of rows) {
    const h = hm.get(r.customerPhone);
    const self = r.isTest ? 0 : 1;
    const minus = (n: number | undefined, st: string) => Math.max(0, (n ?? 0) - (self && r.status === st ? 1 : 0));
    const history: RiskHistory = {
      total: Math.max(0, (h?.total ?? 0) - self),
      delivered: minus(h?.delivered, "delivered"),
      returned: minus(h?.returned, "returned"),
      cancelled: minus(h?.cancelled, "cancelled"),
    };
    const t = r.createdAt.getTime();
    const recentOpen = recent.filter((x) => x.phone === r.customerPhone && x.id !== r.id && Math.abs(x.createdAt.getTime() - t) <= 86400_000).length;
    const risk = orderRisk({
      paymentMethod: r.paymentMethod,
      totalPiasters: r.totalPiasters,
      customerName: r.customerName,
      customerPhone: r.customerPhone,
      address: r.address,
      history,
      recentOpen,
      avgDeliveredPiasters: avgDelivered,
    });
    out.set(r.id, { risk, history });
  }
  return out;
}
