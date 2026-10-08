// outreach.ts — بريد المالك لتجار المنصة: الحملات المرسلة، ومن طلب إيقاف رسائل التسويق.
// جداول المنصة وحدها (لا تدخل مشروع التاجر).
import { pgTable, uuid, text, timestamp, integer, index } from "drizzle-orm/pg-core";

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
