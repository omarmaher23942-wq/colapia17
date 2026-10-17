// attention.ts — «ما يحتاج انتباهك» في لوحة التاجر: أعداد حقيقية من قاعدة المتجر في استعلام واحد،
// والطلبات التي وصلت منذ آخر فحص (لتنبيه الطلب الجديد في أي صفحة). يعمل
// بلا أي خدمة وقت فعلي (Pusher)؛ اللوحة تسأل دورياً، وPusher إن وُجد يسرّع السؤال فقط.
import "server-only";
import { and, desc, eq, gt, sql } from "drizzle-orm";
import { getTenantDb } from "@/db/tenant";
import { orders } from "@/db/schema";

/** حد «مخزون منخفض» في اللوحة (نفس حد صفحة المنتجات). */
export const LOW_STOCK_MAX = 3;

export type AttentionCounts = {
  /** طلبات بحالة «جديد» لم يؤكدها التاجر بعد. */
  newOrders: number;
  /** طلبات تحتاج إجراء في صفحة الطلبات: جديدة أو بإيصال تحويل قيد المراجعة (بلا تكرار). */
  ordersToHandle: number;
  /** إيصالات تحويل بانتظار مراجعة التاجر. */
  receipts: number;
  /** تقييمات العملاء بانتظار الاعتماد. */
  pendingReviews: number;
  /** منتجات منشورة نفد مخزونها بالكامل. */
  outOfStock: number;
  /** منتجات منشورة بقي منها 1 إلى LOW_STOCK_MAX. */
  lowStock: number;
  /** منتجات متاحة نفدت منها تركيبة مقاس/لون واحدة على الأقل. */
  variantsOut: number;
  /** سلات متروكة برقم موبايل خلال 7 أيام لم يُتواصل معها ولم تتحول لطلب. */
  abandoned: number;
  /** منتجات متاحة الآن وفيها من طلب «نبّهني عند التوفر» ولم يُبلَّغ بعد. */
  restockReady: number;
  /** طلبات طلب أصحابها إلغاءها ولم يُبتّ فيها. */
  cancelRequests: number;
  /** طلبات استبدال أو استرجاع جديدة أو قيد المعالجة. */
  returnsOpen: number;
  /** أسئلة الزوار عن المنتجات بانتظار إجابة. */
  questionsPending: number;
};

export type ArrivedOrder = {
  id: string;
  code: string;
  customerName: string;
  totalPiasters: number;
  governorate: string;
  createdAt: string;
};

export type AttentionSnapshot = {
  /** وقت الخادم عند بدء الفحص؛ يُرسل في الفحص التالي كـ since. */
  at: string;
  counts: AttentionCounts;
  /** الطلبات التي وصلت بعد since (الأحدث أولاً، حتى 5). فارغة في أول فحص. */
  arrived: ArrivedOrder[];
};

/** هامش يغطي طلباً كُتب أثناء الفحص السابق؛ التكرار يُصفّى في المتصفح بمعرّف الطلب. */
const OVERLAP_MS = 10_000;

export async function attentionCounts(storeId: string): Promise<AttentionCounts> {
  const db = await getTenantDb(storeId);
  const res = await db.execute(sql`
    select
      (select count(*) from orders o where o.store_id = ${storeId} and o.is_test = false and o.status = 'new') as new_orders,
      (select count(*) from orders o where o.store_id = ${storeId} and o.is_test = false
         and (o.status = 'new' or (o.payment_status = 'under_review' and o.status not in ('cancelled','returned')))) as orders_to_handle,
      (select count(*) from orders o where o.store_id = ${storeId} and o.payment_status = 'under_review'
         and o.status not in ('cancelled','returned')) as receipts,
      (select count(*) from reviews r where r.store_id = ${storeId} and r.is_approved = false) as pending_reviews,
      (select count(*) from products p where p.store_id = ${storeId} and p.deleted_at is null and p.status = 'active'
         and p.track_stock = true and p.stock <= 0) as out_of_stock,
      (select count(*) from products p where p.store_id = ${storeId} and p.deleted_at is null and p.status = 'active'
         and p.track_stock = true and p.stock between 1 and ${LOW_STOCK_MAX}) as low_stock,
      (select count(distinct v.product_id) from product_variants v
         join products p on p.id = v.product_id and p.store_id = ${storeId}
         where v.store_id = ${storeId} and p.deleted_at is null and p.status = 'active' and p.track_stock = true
           and (p.stock is null or p.stock > 0) and v.is_available = true and v.stock <= 0) as variants_out,
      (select count(*) from abandoned_carts c where c.store_id = ${storeId} and c.phone is not null
         and c.recovered_order_id is null and c.whatsapp_contacted_at is null
         and c.last_seen_at >= now() - interval '7 days') as abandoned
  `);
  // استعلام مستقل: قبل migration 0014 (جدول stock_alerts) يعيد 0 بدل أن يُسقط بقية الأعداد.
  const restock = await db
    .execute(sql`
      select count(distinct a.product_id) as n from stock_alerts a
      join products p on p.id = a.product_id and p.store_id = ${storeId}
      left join product_variants v on a.variant_key <> '' and v.id::text = a.variant_key
      where a.store_id = ${storeId} and a.notified_at is null and p.deleted_at is null and p.status = 'active'
        and case when a.variant_key = '' then (p.track_stock = false or p.stock is null or p.stock > 0)
                 else coalesce(v.is_available, false) and (p.track_stock = false or v.stock is null or v.stock > 0) end
    `)
    .then((r) => Number((r.rows?.[0] as { n?: unknown } | undefined)?.n ?? 0) || 0)
    .catch(() => 0);
  // استعلام مستقل: جداول V2 قد لا تكون موجودة قبل تطبيق migration 0016، فيعود 0 بدل إسقاط البقية.
  const v2 = await db
    .execute(sql`
      select
        (select count(*) from orders o where o.store_id = ${storeId} and o.is_test = false and o.cancel_requested_at is not null
           and o.status in ('new','confirmed','preparing')) as cancel_requests,
        (select count(*) from return_requests r where r.store_id = ${storeId} and r.status in ('new','approved','received')) as returns_open,
        (select count(*) from product_questions q where q.store_id = ${storeId} and q.status = 'pending') as questions_pending
    `)
    .then((r) => (r.rows?.[0] ?? {}) as Record<string, unknown>)
    .catch(() => ({}) as Record<string, unknown>);
  const row = (res.rows?.[0] ?? {}) as Record<string, unknown>;
  const n = (k: string) => {
    const v = Number(row[k] ?? 0);
    return Number.isFinite(v) ? v : 0;
  };
  return {
    newOrders: n("new_orders"),
    ordersToHandle: n("orders_to_handle"),
    receipts: n("receipts"),
    pendingReviews: n("pending_reviews"),
    outOfStock: n("out_of_stock"),
    lowStock: n("low_stock"),
    variantsOut: n("variants_out"),
    abandoned: n("abandoned"),
    restockReady: restock,
    cancelRequests: Number(v2.cancel_requests ?? 0) || 0,
    returnsOpen: Number(v2.returns_open ?? 0) || 0,
    questionsPending: Number(v2.questions_pending ?? 0) || 0,
  };
}

export async function attentionSnapshot(storeId: string, since: Date | null): Promise<AttentionSnapshot> {
  const at = new Date();
  const db = await getTenantDb(storeId);
  const [counts, arrived] = await Promise.all([
    attentionCounts(storeId),
    since
      ? db
          .select({
            id: orders.id,
            code: orders.code,
            customerName: orders.customerName,
            totalPiasters: orders.totalPiasters,
            governorate: orders.governorate,
            createdAt: orders.createdAt,
          })
          .from(orders)
          .where(
            and(
              eq(orders.storeId, storeId),
              eq(orders.isTest, false),
              // الطلب الذي سجّله التاجر بنفسه من الشات لا يستحق نغمة «طلب جديد».
              sql`${orders.source} not like 'chat:%'`,
              gt(orders.createdAt, new Date(since.getTime() - OVERLAP_MS))
            )
          )
          .orderBy(desc(orders.createdAt))
          .limit(5)
      : Promise.resolve([]),
  ]);
  return {
    at: at.toISOString(),
    counts,
    arrived: arrived.map((o) => ({ ...o, createdAt: o.createdAt.toISOString() })),
  };
}
