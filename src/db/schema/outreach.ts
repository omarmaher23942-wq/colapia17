// outreach.ts — بريد المالك لتجار المنصة: الحملات المرسلة، ومن طلب إيقاف رسائل التسويق.
// جداول المنصة وحدها (لا تدخل مشروع التاجر).
import { pgTable, uuid, text, timestamp, integer, index, uniqueIndex } from "drizzle-orm/pg-core";
import { conversations } from "./ai";

export const outreachCampaigns = pgTable(
  "outreach_campaigns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    subject: text("subject").notNull(),
    headline: text("headline"),
    body: text("body").notNull(),
    buttonTitle: text("button_title"),
    buttonUrl: text("button_url"),
    /** الشريحة المختارة (all, owned, paid, trial, lapsed, signed_up...) أو "custom" لقائمة مختارة. */
    segment: text("segment").notNull(),
    recipients: integer("recipients").notNull().default(0),
    sent: integer("sent").notNull().default(0),
    failed: integer("failed").notNull().default(0),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [index("outreach_campaigns_created_idx").on(t.createdAt)]
);

export const emailOptouts = pgTable("email_optouts", {
  email: text("email").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * قائمة تواصل Colapia مع البراندات على إنستجرام (/admin/outreach، PLAN 14): حساب يضيفه المالك ← رسالة افتتاحية
 * مخصصة ← موعد إرسال في جدول يومي محدود (لا رسائل متتالية تعرّض الحساب للحظر) ← إرسال بيد المالك ← رد ← الوكيل.
 */
export const igLeads = pgTable(
  "ig_leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** اسم الحساب بلا @ وبحروف صغيرة. */
    handle: text("handle").notNull(),
    brandName: text("brand_name"),
    category: text("category"),
    /** ملاحظة المالك عن الحساب (ما أعجبه، نوع المنتجات): تُستخدم في تخصيص الرسالة. */
    note: text("note"),
    /** queued | ready | sent | replied | owner | form | won | declined | skipped */
    status: text("status").notNull().default("queued"),
    message: text("message"),
    messageSource: text("message_source"),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    repliedAt: timestamp("replied_at", { withTimezone: true }),
    conversationId: uuid("conversation_id").references(() => conversations.id, { onDelete: "set null" }),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("ig_leads_handle_uq").on(t.handle),
    index("ig_leads_status_sched_idx").on(t.status, t.scheduledFor),
    index("ig_leads_conv_idx").on(t.conversationId),
  ]
);
