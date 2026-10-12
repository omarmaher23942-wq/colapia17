import "server-only";
// monthly-report.ts — يرسل التقرير الشهري لأصحاب المتاجر المدفوعة في الأيام الثلاثة الأولى من الشهر (ops/tick يومياً)،
// مرة واحدة لكل متجر لكل شهر (قفل Redis)، وعلى دفعات حتى لا تتجاوز الدالة وقتها. الأرقام من بيانات المتجر نفسه.
import { and, desc, eq, gte, isNotNull, isNull, lt, like, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { getTenantDb } from "@/db/tenant";
import { abandonedCarts, merchants, orderItems, orders, stores } from "@/db/schema";
import { periodTotals } from "@/server/repos/overview";
import { getBlueprintOrNull } from "@/lib/tenant";
import { quotaFor } from "@/server/change-quota";
import { hostingExpiry } from "@/lib/hosting";
import { reportMonth, reportParagraphs } from "@/lib/monthly-report";
import { sendEmail } from "@/lib/email";
import { redis } from "@/lib/redis";
import { clientEnv } from "@/lib/env";

const BATCH = 25;
const LIVE = sql`${orders.status} not in ('cancelled','returned')`;

export async function storeReport(store: typeof stores.$inferSelect, month: ReturnType<typeof reportMonth>) {
  const tdb = await getTenantDb(store.id);
  const [cur, prev, status, top, recovered, bp, quota] = await Promise.all([
    periodTotals(store.id, month.from, month.to),
    periodTotals(store.id, month.prevFrom, month.from),
    tdb
      .select({ delivered: sql<number>`count(*) filter (where ${orders.status} = 'delivered')`.mapWith(Number), returned: sql<number>`count(*) filter (where ${orders.status} = 'returned')`.mapWith(Number) })
      .from(orders)
      .where(and(eq(orders.storeId, store.id), eq(orders.isTest, false), gte(orders.createdAt, month.from), lt(orders.createdAt, month.to))),
    tdb
      .select({ name: orderItems.name, qty: sql<number>`sum(${orderItems.quantity})`.mapWith(Number) })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .where(and(eq(orderItems.storeId, store.id), eq(orders.storeId, store.id), eq(orders.isTest, false), LIVE, gte(orders.createdAt, month.from), lt(orders.createdAt, month.to)))
      .groupBy(orderItems.name)
      .orderBy(desc(sql`sum(${orderItems.quantity})`))
      .limit(3),
    tdb
      .select({ n: sql<number>`count(*)`.mapWith(Number) })
      .from(abandonedCarts)
      .where(and(eq(abandonedCarts.storeId, store.id), isNotNull(abandonedCarts.recoveredOrderId), isNotNull(abandonedCarts.whatsappContactedAt), gte(abandonedCarts.lastSeenAt, month.from), lt(abandonedCarts.lastSeenAt, month.to))),
    getBlueprintOrNull(store.id),
    quotaFor(store.id).catch(() => null),
  ]);
  const camp = await tdb
    .select({ source: orders.source, n: sql<number>`count(*)`.mapWith(Number) })
    .from(orders)
    .where(and(eq(orders.storeId, store.id), eq(orders.isTest, false), LIVE, like(orders.source, "campaign:%"), gte(orders.createdAt, month.from), lt(orders.createdAt, month.to)))
    .groupBy(orders.source)
    .orderBy(desc(sql`count(*)`))
    .limit(1);
  const best = camp[0] ? { name: bp?.campaigns.find((c) => `campaign:${c.slug}` === camp[0]!.source)?.name ?? camp[0].source.slice(9), orders: camp[0].n } : null;
  const expiry = hostingExpiry(store);
  const renewSoon = expiry && expiry.getTime() - Date.now() < 45 * 86400_000;
  const hadPrev = prev.orders > 0 || prev.visitors > 0;
  return reportParagraphs({
    storeName: bp?.brand.name ?? store.name,
    monthLabel: month.label,
    cur: { orders: cur.orders, sales: cur.sales, visitors: cur.visitors },
    prev: hadPrev ? { orders: prev.orders, sales: prev.sales, visitors: prev.visitors } : null,
    delivered: status[0]?.delivered ?? 0,
    returned: status[0]?.returned ?? 0,
    topProducts: top,
    bestCampaign: best,
    recoveredCarts: recovered[0]?.n ?? 0,
    requestsLeft: quota ? quota.perMonth : null,
    renewBy: renewSoon ? expiry!.toLocaleDateString("ar-EG", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Cairo" }) : null,
  });
}

/** يُستدعى يومياً؛ لا يرسل إلا في الأيام 1–3 من الشهر بتوقيت القاهرة. يعيد عدد التقارير المرسلة. */
export async function sendMonthlyReports(now = new Date()): Promise<number> {
  const day = Number(new Intl.DateTimeFormat("en-US", { timeZone: "Africa/Cairo", day: "numeric" }).format(now));
  if (day > 3) return 0;
  const month = reportMonth(now);
  const rows = await db
    .select({ store: stores, email: merchants.email })
    .from(stores)
    .innerJoin(merchants, eq(merchants.id, stores.merchantId))
    .where(and(eq(stores.status, "active"), isNull(stores.deletedAt), isNull(stores.purgedAt), lt(stores.activatedAt, month.to)));
  let sent = 0;
  for (const { store, email } of rows) {
    if (sent >= BATCH) break;
    if (!email) continue;
    const lock = await redis.set(`report:${store.id}:${month.key}`, "1", { nx: true, ex: 40 * 86400 }).catch(() => null);
    if (!lock) continue;
    try {
      const paragraphs = await storeReport(store, month);
      const ok = await sendEmail({
        to: email,
        subject: `تقرير ${month.label} لمتجر ${store.name}`,
        headline: `متجرك في ${month.label}`,
        paragraphs,
        buttons: [{ title: "افتح لوحة متجرك", url: `${clientEnv.NEXT_PUBLIC_APP_URL}/dashboard/analytics` }],
        storeName: store.name,
      });
      if (ok) sent++;
      else await redis.del(`report:${store.id}:${month.key}`).catch(() => {});
    } catch (e) {
      console.error("[monthly-report] failed", store.id, e);
      await redis.del(`report:${store.id}:${month.key}`).catch(() => {});
    }
  }
  return sent;
}
