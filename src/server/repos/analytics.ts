// analytics.ts — تقرير «التحليلات» للتاجر: نفس تعريفات «نظرة عامة» (طلب محقق = غير ملغى ولا مرتجع ولا تجربة،
// والزيارة = جهاز في يوم، والأيام بتوقيت القاهرة)، مع ما لا تعرضه النظرة العامة: مصادر الزيارات والطلبات، وقمع
// الشراء بالزوار، وأوقات الطلب، والأجهزة، والمحافظات، والعملاء الجدد والعائدين.
import "server-only";
import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import { getTenantDb } from "@/db/tenant";
import { analyticsEvents, orderItems, orders } from "@/db/schema";
import { GOVERNORATES } from "@/lib/egypt";
import { daily, periodTotals, type DailyPoint, type PeriodTotals } from "./overview";

export type RangeDays = 7 | 30 | 90;
export const ANALYTICS_RANGES: RangeDays[] = [7, 30, 90];
export const parseRange = (v: string | undefined): RangeDays => (v === "7" ? 7 : v === "90" ? 90 : 30);

const DAY = 864e5;
const LIVE = sql`${orders.status} not in ('cancelled','returned')`;

/** مصادر الزيارات: من utm_source أو رابط الإعلان (fbclid…) أو الموقع الذي جاء منه الزائر. */
export const SOURCES = {
  meta: "فيسبوك وإنستاجرام",
  whatsapp: "واتساب",
  tiktok: "تيك توك",
  google: "جوجل",
  other: "مواقع أخرى",
  direct: "مباشر أو تطبيق لم يذكر المصدر",
} as const;
export type SourceKey = keyof typeof SOURCES;

/** تصنيف المصدر في SQL (أول صفحة للزائر في الفترة). المرجع الداخلي (من المتجر نفسه) يُعامل «مباشر». */
const SOURCE_SQL = sql`case
  when s like '%facebook%' or s like '%instagram%' or s = 'fb' or s = 'ig' or s = 'meta' or s like '%fb.com%' or s like '%fb.me%' then 'meta'
  when s like '%whatsapp%' or s = 'wa' or s like '%wa.me%' then 'whatsapp'
  when s like '%tiktok%' then 'tiktok'
  when s like '%google%' then 'google'
  when s = '' then 'direct'
  else 'other' end`;

/** مرجع من المنصة نفسها (بيانات قديمة: المتتبع صار يرسل المرجع الخارجي فقط). */
const INTERNAL_REFERRER = "^https?://([a-z0-9-]+\\.)*(colapia\\.com|localhost)(:[0-9]+)?(/|$)";

export type Report = {
  days: RangeDays;
  current: PeriodTotals;
  previous: PeriodTotals;
  daily: DailyPoint[];
  funnel: { visitors: number; viewers: number; carters: number; checkouts: number; buyers: number };
  sources: { key: SourceKey; label: string; visitors: number; orders: number; sales: number }[];
  devices: { mobile: number; desktop: number };
  hours: number[];
  weekdays: number[];
  products: { id: string | null; name: string; qty: number; sales: number }[];
  governorates: { code: string; name: string; orders: number; sales: number }[];
  buyers: { newBuyers: number; returning: number };
};

export async function analyticsReport(storeId: string, days: RangeDays, now = new Date()): Promise<Report> {
  const db = await getTenantDb(storeId);
  const from = new Date(now.getTime() - days * DAY);
  const prevFrom = new Date(now.getTime() - 2 * days * DAY);
  const inPeriod = and(eq(orders.storeId, storeId), eq(orders.isTest, false), gte(orders.createdAt, from), lt(orders.createdAt, now), LIVE);
  const events = and(eq(analyticsEvents.storeId, storeId), gte(analyticsEvents.createdAt, from), lt(analyticsEvents.createdAt, now));

  const [current, previous, series, [funnelEv], [orderVisitors], sourceRows, [devices], timeRows, products, govRows, [buyers]] = await Promise.all([
    periodTotals(storeId, from, now),
    periodTotals(storeId, prevFrom, from),
    daily(storeId, from, days),
    db
      .select({
        visitors: sql<number>`count(distinct ${analyticsEvents.visitorId}) filter (where ${analyticsEvents.name} = 'page_view')`.mapWith(Number),
        viewers: sql<number>`count(distinct ${analyticsEvents.visitorId}) filter (where ${analyticsEvents.name} = 'product_view')`.mapWith(Number),
        carters: sql<number>`count(distinct ${analyticsEvents.visitorId}) filter (where ${analyticsEvents.name} = 'add_to_cart')`.mapWith(Number),
        checkouts: sql<number>`count(distinct ${analyticsEvents.visitorId}) filter (where ${analyticsEvents.name} = 'begin_checkout')`.mapWith(Number),
        buyers: sql<number>`count(distinct ${analyticsEvents.visitorId}) filter (where ${analyticsEvents.name} = 'purchase')`.mapWith(Number),
      })
      .from(analyticsEvents)
      .where(events),
    // من طلب فعلاً (من الطلبات نفسها؛ حدث «purchase» قد لا يصل إن أُغلقت الصفحة سريعاً).
    db.select({ n: sql<number>`count(distinct ${orders.visitorId})`.mapWith(Number) }).from(orders).where(inPeriod),
    // أول صفحة لكل زائر في الفترة تحدد مصدره، وطلباته في الفترة تُنسب لذلك المصدر.
    db.execute(sql`
      with firsts as (
        select distinct on (visitor_id) visitor_id,
               lower(coalesce(nullif(utm_source, ''), case when referrer ~* ${INTERNAL_REFERRER} then '' else coalesce(referrer, '') end)) as s
        from analytics_events
        where store_id = ${storeId} and name = 'page_view' and created_at >= ${from.toISOString()} and created_at < ${now.toISOString()}
        order by visitor_id, created_at
      ),
      src as (select visitor_id, ${SOURCE_SQL} as source from firsts),
      o as (
        select visitor_id, count(*)::int as n, coalesce(sum(total_piasters), 0)::bigint as sales
        from orders
        where store_id = ${storeId} and is_test = false and status not in ('cancelled','returned')
          and created_at >= ${from.toISOString()} and created_at < ${now.toISOString()} and visitor_id is not null
        group by visitor_id
      )
      select src.source, count(*)::int as visitors, coalesce(sum(o.n), 0)::int as orders, coalesce(sum(o.sales), 0)::bigint as sales
      from src left join o on o.visitor_id = src.visitor_id
      group by src.source
    `),
    db
      .select({
        mobile: sql<number>`count(distinct ${analyticsEvents.visitorId}) filter (where ${analyticsEvents.device} = 'mobile' or ${analyticsEvents.device} = 'tablet')`.mapWith(Number),
        desktop: sql<number>`count(distinct ${analyticsEvents.visitorId}) filter (where ${analyticsEvents.device} = 'desktop')`.mapWith(Number),
      })
      .from(analyticsEvents)
      .where(and(events, eq(analyticsEvents.name, "page_view"))),
    db
      .select({
        hour: sql<number>`extract(hour from ${orders.createdAt} at time zone 'Africa/Cairo')`.mapWith(Number),
        dow: sql<number>`extract(dow from ${orders.createdAt} at time zone 'Africa/Cairo')`.mapWith(Number),
        n: sql<number>`count(*)`.mapWith(Number),
      })
      .from(orders)
      .where(inPeriod)
      .groupBy(sql`1`, sql`2`),
    db
      .select({
        id: orderItems.productId,
        name: orderItems.name,
        qty: sql<number>`sum(${orderItems.quantity})`.mapWith(Number),
        sales: sql<number>`sum(${orderItems.totalPiasters})`.mapWith(Number),
      })
      .from(orderItems)
      .innerJoin(orders, and(eq(orders.id, orderItems.orderId), eq(orders.storeId, storeId)))
      .where(and(eq(orderItems.storeId, storeId), inPeriod))
      .groupBy(orderItems.productId, orderItems.name)
      .orderBy(desc(sql`sum(${orderItems.totalPiasters})`))
      .limit(10),
    db
      .select({
        code: orders.governorate,
        orders: sql<number>`count(*)`.mapWith(Number),
        sales: sql<number>`coalesce(sum(${orders.totalPiasters}), 0)`.mapWith(Number),
      })
      .from(orders)
      .where(inPeriod)
      .groupBy(orders.governorate)
      .orderBy(desc(sql`count(*)`)),
    // العميل «عائد» إن كان له طلب محقق قبل بداية الفترة.
    db
      .select({
        returning: sql<number>`count(distinct ${orders.customerId}) filter (where exists (
          select 1 from orders p where p.store_id = ${storeId} and p.customer_id = ${orders.customerId} and p.is_test = false
            and p.status not in ('cancelled','returned') and p.created_at < ${from.toISOString()}))`.mapWith(Number),
        all: sql<number>`count(distinct ${orders.customerId})`.mapWith(Number),
      })
      .from(orders)
      .where(inPeriod),
  ]);

  const hours = Array.from({ length: 24 }, () => 0);
  const weekdays = Array.from({ length: 7 }, () => 0);
  for (const r of timeRows) {
    hours[r.hour] = (hours[r.hour] ?? 0) + r.n;
    weekdays[r.dow] = (weekdays[r.dow] ?? 0) + r.n;
  }

  const byKey = new Map((sourceRows.rows as { source: SourceKey; visitors: number; orders: number; sales: number | string }[]).map((r) => [r.source, r]));
  const sources = (Object.keys(SOURCES) as SourceKey[])
    .map((key) => {
      const r = byKey.get(key);
      return { key, label: SOURCES[key], visitors: Number(r?.visitors ?? 0), orders: Number(r?.orders ?? 0), sales: Number(r?.sales ?? 0) };
    })
    .filter((s) => s.visitors > 0)
    .sort((a, b) => b.orders - a.orders || b.visitors - a.visitors);

  const govName = new Map<string, string>(GOVERNORATES.map((g) => [g.code, g.name]));
  return {
    days,
    current,
    previous,
    daily: series,
    funnel: { ...(funnelEv ?? { visitors: 0, viewers: 0, carters: 0, checkouts: 0, buyers: 0 }), buyers: Math.max(funnelEv?.buyers ?? 0, orderVisitors?.n ?? 0) },
    sources,
    devices: devices ?? { mobile: 0, desktop: 0 },
    hours,
    weekdays,
    products: products.map((p) => ({ id: p.id, name: p.name, qty: p.qty, sales: p.sales })),
    governorates: govRows.map((g) => ({ code: g.code, name: govName.get(g.code) ?? g.code, orders: g.orders, sales: g.sales })),
    buyers: { newBuyers: Math.max(0, (buyers?.all ?? 0) - (buyers?.returning ?? 0)), returning: buyers?.returning ?? 0 },
  };
}
