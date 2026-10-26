import { pgTable, uuid, text, timestamp, integer, jsonb, index } from "drizzle-orm/pg-core";
import { stores } from "./stores";

/** توجيه بيانات المتجر إلى قاعدة العميل بعد «نقل البيانات». غياب الصف = قاعدة المنصة. الرابط مشفّر دائماً. */
export const storeDatabases = pgTable("store_databases", {
  storeId: uuid("store_id").primaryKey().references(() => stores.id, { onDelete: "cascade" }),
  urlEnc: text("url_enc").notNull(),
  /** اسم المضيف المختصر للعرض فقط (لا يكشف الرابط). */
  hostHint: text("host_hint").notNull().default(""),
  switchedAt: timestamp("switched_at", { withTimezone: true }).notNull().defaultNow(),
  /** بعد هذا الموعد تُحذف نسخة المنصة (لا رجوع بعدها). */
  platformPurgeAt: timestamp("platform_purge_at", { withTimezone: true }).notNull(),
  platformPurgedAt: timestamp("platform_purged_at", { withTimezone: true }),
});

/** مهمة نقل: حالتها وتقدمها محفوظان لتُستأنف عبر طلبات متتالية. رابط الهدف مشفّر ويُمسح عند النجاح. */
export const storeDbTransfers = pgTable(
  "store_db_transfers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("queued"),
    progress: jsonb("progress").$type<Record<string, unknown>>().notNull().default({}),
    targetUrlEnc: text("target_url_enc"),
    error: text("error"),
    attempts: integer("attempts").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("store_db_transfers_store_idx").on(t.storeId, t.createdAt)]
);
