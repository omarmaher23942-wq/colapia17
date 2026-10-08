import { pgTable, uuid, text, timestamp, jsonb, boolean, index } from "drizzle-orm/pg-core";
import { stores } from "./stores";
import { conversations } from "./ai";
import { platformUsers } from "./platform";

/**
 * سجل تدقيق لدورة الحياة. storeId يصبح null عند الحذف النهائي للمتجر،
 * لذلك نحتفظ بـ storeRef (النطاق الفرعي) حتى يبقى أثر كل قرار حذف.
 */
export const lifecycleEvents = pgTable(
  "lifecycle_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id").references(() => stores.id, { onDelete: "set null" }),
    storeRef: text("store_ref"),
    conversationId: uuid("conversation_id").references(() => conversations.id, { onDelete: "set null" }),
    type: text("type").notNull(),                  // "store.transition" | "link.issued" | "message.outbound" ...
    fromStatus: text("from_status"),
    toStatus: text("to_status"),
    actor: text("actor").notNull().default("system"), // system | timer | owner:<id> | merchant:<id>
    data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("lifecycle_events_store_idx").on(t.storeId, t.createdAt), index("lifecycle_events_type_idx").on(t.type, t.createdAt)]
);

/** حقول "إضافة حقل للـ AI" التي يكتبها الأونر أثناء المراجعة (مع صور وتعليمات) */
export const aiDirectives = pgTable(
  "ai_directives",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
    scope: text("scope").$type<"store" | "product">().notNull().default("store"),
    /** products[].id داخل الاستمارة عند scope=product */
    productSourceId: text("product_source_id"),
    instruction: text("instruction").notNull(),
    imageUrls: jsonb("image_urls").$type<string[]>().notNull().default([]),
    enabled: boolean("enabled").notNull().default(true),
    createdBy: uuid("created_by").references(() => platformUsers.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("ai_directives_store_idx").on(t.storeId)]
);

/** نصوص الرسائل القابلة للتعديل من الأونر (الافتراضيات في src/lifecycle/templates.ts) */
export const messageTemplates = pgTable("message_templates", {
  key: text("key").primaryKey(),
  content: text("content").notNull(),
  updatedBy: text("updated_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});