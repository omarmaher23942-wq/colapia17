import { pgTable, uuid, text, timestamp, jsonb, boolean, index, uniqueIndex } from "drizzle-orm/pg-core";

/**
 * استمارات العملاء (أولها الاستمارة العقارية colapia.com/realestate). جدول تحكم.
 * المعرّف يولّده متصفح العميل عند بدء الاستمارة، فإعادة الإرسال بعد انقطاع لا تكرر الصف (on conflict do nothing).
 * البيانات كاملة في data (مخطط src/briefs/realestate.ts)، ونسخ الاسم والتواصل للبحث والقائمة.
 */
export const clientBriefs = pgTable(
  "client_briefs",
  {
    id: uuid("id").primaryKey(),
    ref: text("ref").notNull(),
    kind: text("kind").notNull().default("realestate"),
    status: text("status").notNull().default("new"),
    businessName: text("business_name").notNull(),
    contactName: text("contact_name").notNull(),
    whatsapp: text("whatsapp").notNull(),
    email: text("email"),
    data: jsonb("data").$type<Record<string, unknown>>().notNull(),
    meta: jsonb("meta").$type<Record<string, unknown>>().notNull().default({}),
    note: text("note"),
    isTest: boolean("is_test").notNull().default(false),
    seenAt: timestamp("seen_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("client_briefs_ref_uq").on(t.ref),
    index("client_briefs_created_idx").on(t.createdAt),
    index("client_briefs_status_idx").on(t.status, t.createdAt),
  ]
);
