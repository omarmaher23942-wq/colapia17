// store-purge-plan.ts — جداول بيانات المتجر التي يحذفها purgeStore، بترتيب يحترم المفاتيح الأجنبية
// (الأب قبل الابن؛ الحذف يسير بالعكس). وحدة نقية بلا اتصال بقاعدة: يختبرها tests/unit/planes.test.ts
// لتضمن ألا يُنسى أي جدول بيانات متجر.
import { eq, type SQL } from "drizzle-orm";
import { getTableConfig, type PgTable } from "drizzle-orm/pg-core";
import * as s from "@/db/schema";

export type PurgeSpec = {
  table: PgTable;
  scope: (storeId: string) => SQL;
};

export const PURGE_PLAN: PurgeSpec[] = [
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
  { table: s.stockAlerts, scope: (id) => eq(s.stockAlerts.storeId, id) },
  { table: s.analyticsEvents, scope: (id) => eq(s.analyticsEvents.storeId, id) },
  { table: s.analyticsDaily, scope: (id) => eq(s.analyticsDaily.storeId, id) },
  { table: s.supportThreads, scope: (id) => eq(s.supportThreads.storeId, id) },
  { table: s.supportMessages, scope: (id) => eq(s.supportMessages.storeId, id) },
  { table: s.marketingCampaigns, scope: (id) => eq(s.marketingCampaigns.storeId, id) },
];

export const purgeTableName = (t: PgTable) => getTableConfig(t).name;

export const PURGE_TABLES = PURGE_PLAN.map((p) => purgeTableName(p.table));

/** جداول لا تحتوي صوراً (لا داعي لفحصها عند جمع الوسائط). */
export const MEDIA_FREE_TABLES = new Set<string>(["analytics_events", "analytics_daily", "shipping_zones", "discounts", "abandoned_carts", "stock_alerts"]);
