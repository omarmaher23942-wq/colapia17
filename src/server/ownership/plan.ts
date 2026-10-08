// plan.ts — ما ينتقل من المنصة إلى مشروع التاجر الخاص عند "امتلك متجرك"، وبأي ترتيب.
//
// وحدة نقية بلا اتصال بقاعدة: يختبرها tests/unit/planes.test.ts لتضمن ألا يُنسى أي جدول بيانات متجر
// وأن الترتيب يحترم المفاتيح الأجنبية (نسخة التاجر تُدرج الصفوف بنفس الترتيب).
import { eq, type SQL } from "drizzle-orm";
import { getTableConfig, type PgTable } from "drizzle-orm/pg-core";
import * as s from "@/db/schema";

/** `scope` يحدد صفوف المتجر، و`override` يفرغ ما يشير لجداول تحكم لا توجد في مشروع التاجر. */
export type TransferSpec = {
  table: PgTable;
  scope: (storeId: string, merchantId: string) => SQL;
  override?: Record<string, unknown>;
};

export const PLAN: TransferSpec[] = [
  { table: s.merchants, scope: (_, m) => eq(s.merchants.id, m) },
  {
    table: s.stores,
    scope: (id) => eq(s.stores.id, id),
    // في مشروع التاجر المتجر نشط دائماً وملك صاحبه، ولا وجود لفريق المنصة ولا لحقول الامتلاك.
    override: {
      status: "active",
      reviewedBy: null,
      ownedUrl: null,
      ownedAt: null,
      purgeAfter: null,
      purgedAt: null,
      trialEndsAt: null,
      frozenAt: null,
      purgeAt: null,
      doomAt: null,
      demoExpiresAt: null,
    },
  },
  { table: s.storeBlueprints, scope: (id) => eq(s.storeBlueprints.storeId, id) },
  { table: s.storeSnapshots, scope: (id) => eq(s.storeSnapshots.storeId, id) },
  { table: s.categories, scope: (id) => eq(s.categories.storeId, id) },
  { table: s.products, scope: (id) => eq(s.products.storeId, id) },
  { table: s.productVariants, scope: (id) => eq(s.productVariants.storeId, id) },
  { table: s.customers, scope: (id) => eq(s.customers.storeId, id) },
  { table: s.shippingZones, scope: (id) => eq(s.shippingZones.storeId, id) },
  { table: s.discounts, scope: (id) => eq(s.discounts.storeId, id) },
  { table: s.orders, scope: (id) => eq(s.orders.storeId, id) },
  { table: s.orderItems, scope: (id) => eq(s.orderItems.storeId, id) },
  { table: s.payments, scope: (id) => eq(s.payments.storeId, id) },
  { table: s.reviews, scope: (id) => eq(s.reviews.storeId, id) },
  { table: s.abandonedCarts, scope: (id) => eq(s.abandonedCarts.storeId, id) },
  { table: s.analyticsEvents, scope: (id) => eq(s.analyticsEvents.storeId, id) },
  { table: s.analyticsDaily, scope: (id) => eq(s.analyticsDaily.storeId, id) },
  { table: s.supportThreads, scope: (id) => eq(s.supportThreads.storeId, id), override: { assignedTo: null } },
  { table: s.supportMessages, scope: (id) => eq(s.supportMessages.storeId, id) },
  { table: s.marketingCampaigns, scope: (id) => eq(s.marketingCampaigns.storeId, id) },
];

export const TRANSFER_TABLES = PLAN.map((p) => getTableConfig(p.table).name);

// الخطة والترتيب المشترك مع مشروع التاجر يجب أن يتطابقا حرفياً (يفرضه اختبار planes).
export { TRANSFER_TABLE_NAMES } from "@/db/transfer-tables";

export function specFor(table: string): TransferSpec | undefined {
  return PLAN.find((p) => getTableConfig(p.table).name === table);
}
