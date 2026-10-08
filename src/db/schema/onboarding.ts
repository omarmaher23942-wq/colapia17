import { sql } from "drizzle-orm";
import { pgTable, uuid, text, timestamp, jsonb, integer, index, uniqueIndex } from "drizzle-orm/pg-core";
import { conversations } from "./ai";
import { stores } from "./stores";
import type { OnboardingSubmission } from "@/onboarding/schema";

export const ONBOARDING_STATUSES = ["issued", "draft", "submitted", "expired", "revoked"] as const;
export type OnboardingStatus = (typeof ONBOARDING_STATUSES)[number];

/** جلسة استمارة: الرابط الموقّع + المسودة + التسليم النهائي. التوكن يُخزَّن مُجزّأً فقط. */
export const onboardingSessions = pgTable(
  "onboarding_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    status: text("status").$type<OnboardingStatus>().notNull().default("issued"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    openedAt: timestamp("opened_at", { withTimezone: true }),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    /** المسودة غير صارمة (ناقصة بطبيعتها). التحقق الكامل عند الإرسال */
    draft: jsonb("draft").$type<Record<string, unknown>>().notNull().default({}),
    draftVersion: integer("draft_version").notNull().default(0),
    lastStep: text("last_step"),
    /** النسخة المُتحقق منها بـ Zod بعد الإرسال */
    submission: jsonb("submission").$type<OnboardingSubmission>(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    storeId: uuid("store_id").references(() => stores.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("onb_token_uq").on(t.tokenHash),
    // جلسة نشطة واحدة فقط لكل محادثة
    uniqueIndex("onb_active_conv_uq").on(t.conversationId).where(sql`${t.status} in ('issued','draft')`),
    index("onb_conv_idx").on(t.conversationId),
    index("onb_store_idx").on(t.storeId),
  ]
);

/** ملفات مرفوعة أثناء الاستمارة: للتحقق أن المفتاح المرسل رُفع فعلاً ضمن هذه المحادثة (منع التزوير) */
export const onboardingAssets = pgTable(
  "onboarding_assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
    key: text("key").notNull(),                    // مفتاح UploadThing
    url: text("url").notNull(),
    mime: text("mime"),
    sizeBytes: integer("size_bytes"),
    width: integer("width"),
    height: integer("height"),
    thumbhash: text("thumbhash"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("onb_asset_key_uq").on(t.key), index("onb_asset_conv_idx").on(t.conversationId)]
);