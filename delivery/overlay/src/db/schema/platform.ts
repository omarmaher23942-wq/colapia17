// platform.ts (مشروع العميل) — جدولا صاحب المتجر وجلساته فقط. لا مستخدمو منصة ولا تقييمات منصة.
import { pgTable, uuid, text, timestamp, boolean, index, uniqueIndex } from "drizzle-orm/pg-core";

export const merchants = pgTable(
  "merchants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    displayName: text("display_name").notNull(),
    email: text("email"),
    /** البريد بصيغة موحّدة للمطابقة (حروف صغيرة، وبلا نقاط و+ في Gmail). */
    emailCanonical: text("email_canonical"),
    googleId: text("google_id"),
    avatarUrl: text("avatar_url"),
    phone: text("phone"),
    username: text("username"),
    passwordHash: text("password_hash"),
    isActivated: boolean("is_activated").notNull().default(false),
    messengerPsid: text("messenger_psid"),
    instagramIgsid: text("instagram_igsid"),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("merchants_username_uq").on(t.username),
    uniqueIndex("merchants_email_uq").on(t.email),
    uniqueIndex("merchants_google_id_uq").on(t.googleId),
    index("merchants_phone_idx").on(t.phone),
    index("merchants_email_canonical_idx").on(t.emailCanonical),
  ]
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tokenHash: text("token_hash").notNull(),
    subjectType: text("subject_type").notNull(), // 'merchant'
    subjectId: uuid("subject_id").notNull(),
    storeId: uuid("store_id"),
    userAgent: text("user_agent"),
    ip: text("ip"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("sessions_token_uq").on(t.tokenHash),
    index("sessions_subject_idx").on(t.subjectType, t.subjectId),
    index("sessions_store_idx").on(t.storeId),
  ]
);
