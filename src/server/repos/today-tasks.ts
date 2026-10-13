// today-tasks.ts — بيانات «مهام اليوم» التي لا يحملها نبض اللوحة: الطلبات المتأخرة في الشحن والتسليم، وما أُنجز
// اليوم بتوقيت القاهرة، وطلبات التقييم الجاهزة (مُسلَّمة منذ 12 ساعة إلى 14 يوماً، بلا تقييم، ولم يُراسَل عميلها بعد
// التسليم). استعلامان على بيانات المتجر نفسه فقط.
import "server-only";
import { sql } from "drizzle-orm";
import { getTenantDb } from "@/db/tenant";
import { cairoDate, cairoWallTime } from "@/lib/cairo-time";
import { STALE_SHIPPED_DAYS, STUCK_PREP_HOURS, type TodayExtras } from "@/lib/today-tasks";

export type ReviewAskRow = {
  id: string;
  code: string;
  customerName: string;
  customerPhone: string;
  totalPiasters: number;
  paymentMethod: string;
  paymentStatus: string;
  governorate: string;
  address: string;
  deliveredAt: string;
};

export type TodayData = TodayExtras & { reviewAsks: ReviewAskRow[]; reviewAsksTotal: number };

const REVIEW_ASK_LIMIT = 5;

export async function todayData(storeId: string, now = new Date()): Promise<TodayData> {
  const db = await getTenantDb(storeId);
  const dayStart = cairoWallTime(cairoDate(now), 0).toISOString();
  const [stats, asks] = await Promise.all([
    db.execute(sql`
      select
        (select count(*) from orders o where o.store_id = ${storeId} and o.is_test = false
           and o.status in ('confirmed','preparing') and o.created_at < now() - make_interval(hours => ${STUCK_PREP_HOURS})) as stuck_prep,
        (select count(*) from orders o where o.store_id = ${storeId} and o.is_test = false and o.status = 'shipped'
           and coalesce(o.shipped_at, o.updated_at) < now() - make_interval(days => ${STALE_SHIPPED_DAYS})) as stale_shipped,
        (select count(*) from orders o where o.store_id = ${storeId} and o.is_test = false
           and exists (select 1 from jsonb_array_elements(o.status_history) e
                       where e->>'status' = 'confirmed' and (e->>'at')::timestamptz >= ${dayStart}::timestamptz)) as done_confirmed,
        (select count(*) from orders o where o.store_id = ${storeId} and o.is_test = false and o.shipped_at >= ${dayStart}::timestamptz) as done_shipped,
        (select count(*) from orders o where o.store_id = ${storeId} and o.is_test = false and o.delivered_at >= ${dayStart}::timestamptz) as done_delivered,
        (select count(*) from orders o where o.store_id = ${storeId} and o.is_test = false and o.status = 'delivered'
           and o.whatsapp_contacted_at >= ${dayStart}::timestamptz) as done_asked,
        (select floor(extract(epoch from now() - max(o.created_at)) / 86400) from orders o
           where o.store_id = ${storeId} and o.is_test = false) as quiet_days,
        (select count(*) from products p where p.store_id = ${storeId} and p.deleted_at is null and p.status = 'active') as active_products
    `),
    db.execute(sql`
      select o.id, o.code, o.customer_name, o.customer_phone, o.total_piasters, o.payment_method, o.payment_status,
             o.governorate, o.address, o.delivered_at, count(*) over () as total
      from orders o
      where o.store_id = ${storeId} and o.is_test = false and o.status = 'delivered'
        and o.delivered_at between now() - interval '14 days' and now() - interval '12 hours'
        and (o.whatsapp_contacted_at is null or o.whatsapp_contacted_at < o.delivered_at)
        and not exists (select 1 from reviews r where r.store_id = ${storeId} and r.order_id = o.id)
      order by o.delivered_at desc
      limit ${REVIEW_ASK_LIMIT}
    `),
  ]);
  const r = (stats.rows?.[0] ?? {}) as Record<string, unknown>;
  const n = (k: string) => {
    const v = Number(r[k] ?? 0);
    return Number.isFinite(v) ? v : 0;
  };
  const rows = (asks.rows ?? []) as Record<string, unknown>[];
  return {
    stuckPrep: n("stuck_prep"),
    staleShipped: n("stale_shipped"),
    done: { confirmed: n("done_confirmed"), shipped: n("done_shipped"), delivered: n("done_delivered"), asked: n("done_asked") },
    quietDays: r.quiet_days == null ? null : n("quiet_days"),
    activeProducts: n("active_products"),
    reviewAsksTotal: rows.length ? Number(rows[0]!.total) || rows.length : 0,
    reviewAsks: rows.map((x) => ({
      id: String(x.id),
      code: String(x.code),
      customerName: String(x.customer_name ?? ""),
      customerPhone: String(x.customer_phone ?? ""),
      totalPiasters: Number(x.total_piasters) || 0,
      paymentMethod: String(x.payment_method),
      paymentStatus: String(x.payment_status),
      governorate: String(x.governorate ?? ""),
      address: String(x.address ?? ""),
      deliveredAt: new Date(String(x.delivered_at)).toISOString(),
    })),
  };
}
