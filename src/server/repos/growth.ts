// growth.ts — بيانات بطاقة «هدف الشهر» في النظرة العامة: مبيعات الشهر الجاري بتوقيت القاهرة، ووتيرة الهدف، والإنفاق الإعلاني
// المدخل يدوياً، وصافي الربح والعائد الإعلاني، وتوصيات الأسبوع من بيانات المتجر. كل رقم محسوب من بيانات حقيقية، وما لا يُحسب يعود null.
import "server-only";
import { sql } from "drizzle-orm";
import { getTenantDb } from "@/db/tenant";
import { cairoMonthStart } from "@/lib/change-requests";
import { goalPace, monthKey, netProfit, readGoalPrefs, roas, weeklyRecommendations, type Pace, type Recommendation } from "@/lib/sales-goal";
import { periodTotals, profitEstimate } from "@/server/repos/overview";

export type GrowthData = {
  month: string;
  goalEgp: number | null;
  soldPiasters: number;
  orders: number;
  pace: Pace;
  adSpendEgp: number;
  profitPiasters: number | null;
  profitCoverage: number;
  netProfitPiasters: number | null;
  roas: number | null;
  recommendations: Recommendation[];
};

type Row = Record<string, unknown>;
const rows = (r: unknown): Row[] => ((r as { rows?: Row[] }).rows ?? (r as Row[])) as Row[];
const DAY = 86_400_000;

const sourceLabel = (src: string): string => {
  if (src === "storefront") return "زيارات المتجر المباشرة";
  if (src.startsWith("chat:")) return "طلبات الشات";
  if (src.startsWith("campaign:")) return `حملة «${src.slice(9)}»`;
  return src;
};

function cairoDayInfo(now: Date): { day: number; days: number } {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const g = (t: string) => Number(p.find((x) => x.type === t)!.value);
  return { day: g("day"), days: new Date(g("year"), g("month"), 0).getDate() };
}

export async function growthData(storeId: string, prefsRaw: unknown): Promise<GrowthData> {
  const now = new Date();
  const start = cairoMonthStart(now);
  const prefs = readGoalPrefs(prefsRaw);
  const month = monthKey(now);
  const db = await getTenantDb(storeId);
  const since7 = new Date(now.getTime() - 7 * DAY).toISOString();

  const [totals, profit, source, viewed, low, last] = await Promise.all([
    periodTotals(storeId, start, now),
    profitEstimate(storeId, start),
    db.execute(sql`select source, count(*)::int as n from orders where store_id = ${storeId} and is_test = false and status not in ('cancelled','returned') and created_at >= ${since7} group by source order by n desc limit 6`),
    db.execute(sql`
      select p.name, count(distinct e.visitor_id)::int as viewers
      from analytics_events e join products p on p.id = e.product_id and p.store_id = ${storeId}
      where e.store_id = ${storeId} and e.name = 'product_view' and e.created_at >= ${since7} and p.status = 'active' and p.deleted_at is null
        and not exists (select 1 from order_items oi join orders o on o.id = oi.order_id where oi.store_id = ${storeId} and oi.product_id = p.id and o.created_at >= ${since7} and o.is_test = false)
      group by p.id, p.name order by viewers desc limit 1`),
    db.execute(sql`
      select p.name as product, array_to_string(v.option_values, ' / ') as label, v.stock
      from product_variants v join products p on p.id = v.product_id and p.store_id = ${storeId}
      where v.store_id = ${storeId} and p.status = 'active' and p.deleted_at is null and p.track_stock = true and v.is_available = true and v.stock between 1 and 3
      order by v.stock asc limit 5`),
    db.execute(sql`select max(created_at) as at from orders where store_id = ${storeId} and is_test = false`),
  ]);

  const srcRows = rows(source);
  const total = srcRows.reduce((n, r) => n + Number(r.n ?? 0), 0);
  const top = srcRows[0];
  const v = rows(viewed)[0];
  const lastAt = rows(last)[0]?.at;
  const { day, days } = cairoDayInfo(now);
  const adSpend = prefs.adSpend[month] ?? 0;
  const net = netProfit(profit.profit, adSpend);

  return {
    month,
    goalEgp: prefs.monthlyGoalEgp,
    soldPiasters: totals.sales,
    orders: totals.orders,
    pace: goalPace({ goalEgp: prefs.monthlyGoalEgp, soldPiasters: totals.sales, dayOfMonth: day, daysInMonth: days }),
    adSpendEgp: adSpend,
    profitPiasters: profit.profit,
    profitCoverage: profit.coverage,
    netProfitPiasters: net,
    roas: roas(totals.sales, adSpend),
    recommendations: weeklyRecommendations({
      viewedNotBought: v ? { name: String(v.name), viewers: Number(v.viewers) } : null,
      lowSizes: rows(low).map((r) => ({ product: String(r.product), label: String(r.label), stock: Number(r.stock) })),
      topSource: top && total ? { source: sourceLabel(String(top.source)), orders: Number(top.n), share: Math.round((Number(top.n) / total) * 100) } : null,
      quietDays: lastAt ? Math.floor((now.getTime() - new Date(String(lastAt)).getTime()) / DAY) : null,
    }),
  };
}
