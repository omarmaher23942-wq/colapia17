// members.ts — فريق التاجر (المرحلة 6): أعضاء يدعوهم صاحب المتجر بالبريد بدور جاهز أو صلاحيات مخصصة
// (src/lib/store-perms.ts). العضو يدخل بـ Google أو برمز على بريده، فيُربط merchant_id بهويته عند أول دخول. صاحب
// المتجر نفسه ليس هنا (stores.merchant_id). جدول تحكم للمنصة (لا يدخل مشروع التاجر المستقل: له مالك واحد).
import { pgTable, uuid, text, timestamp, jsonb, index, uniqueIndex, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { merchants } from "./platform";
import { stores } from "./stores";

export const storeMembers = pgTable(
  "store_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    /** هوية العضو بعد أول دخول (null = دُعي ولم يدخل بعد). */
    merchantId: uuid("merchant_id").references(() => merchants.id, { onDelete: "set null" }),
    name: text("name"),
    /** manager | orders | products | marketing | accountant | custom */
    role: text("role").notNull(),
    /** للدور custom فقط: { مجال: view | manage }. */
    perms: jsonb("perms").$type<Record<string, string>>(),
    status: text("status").$type<"active" | "removed">().notNull().default("active"),
    invitedBy: uuid("invited_by").references(() => merchants.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    lastActiveAt: timestamp("last_active_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("store_members_store_email_uq").on(t.storeId, t.email),
    index("store_members_merchant_idx").on(t.merchantId),
    index("store_members_email_idx").on(t.email),
    check("store_members_status_chk", sql`${t.status} IN ('active', 'removed')`),
  ]
);

/** سجل نشاط فريق المتجر (من فعل ماذا) لصاحب المتجر. */
export const storeActivity = pgTable(
  "store_activity",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
    merchantId: uuid("merchant_id").references(() => merchants.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    target: text("target"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("store_activity_store_idx").on(t.storeId, t.createdAt)]
);

/**
 * طلبات التعديل من صاحب المتجر أو فريقه للوكالة (المرحلة 9: «اطلب تعديل»، طلبان شهرياً افتراضياً). الفريق يسندها
 * وينفذها ويرد بملاحظة يراها العميل. تعديلات الفريق المبادِرة لا تمر من هنا ولا تُحسب.
 */
export const storeChangeRequests = pgTable(
  "store_change_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
    merchantId: uuid("merchant_id").references(() => merchants.id, { onDelete: "set null" }),
    /** design | products | content | other */
    area: text("area").notNull(),
    body: text("body").notNull(),
    /** open | in_progress | done | declined */
    status: text("status").notNull().default("open"),
    teamNote: text("team_note"),
    assignedTo: uuid("assigned_to"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    doneAt: timestamp("done_at", { withTimezone: true }),
  },
  (t) => [
    index("store_change_requests_store_idx").on(t.storeId, t.createdAt),
    index("store_change_requests_status_idx").on(t.status, t.createdAt),
    check("store_change_requests_status_chk", sql`${t.status} IN ('open', 'in_progress', 'done', 'declined')`),
    check("store_change_requests_area_chk", sql`${t.area} IN ('design', 'products', 'content', 'other')`),
  ]
);
