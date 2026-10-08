// ownership.ts — "امتلك متجرك": نقل المتجر من المنصة إلى نسخة التاجر الخاصة.
//
// المنصة لا تحمل أي مفتاح للتاجر. تصدر كود نقل لمرة واحدة، ونسخة التاجر (على Vercel الخاص به)
// تسحب بها بيانات متجرها من /api/ownership/export ثم تؤكد الاستلام. يُخزَّن هنا تجزئة الكود فقط.
import { pgTable, uuid, text, timestamp, jsonb, index, uniqueIndex, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { stores } from "./stores";

export const TRANSFER_STATUSES = ["issued", "importing", "completed", "revoked"] as const;
export type TransferStatus = (typeof TRANSFER_STATUSES)[number];

export const storeTransfers = pgTable(
  "store_transfers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    status: text("status").$type<TransferStatus>().notNull().default("issued"),
    // عنوان نسخة التاجر كما أبلغت به عند السحب والتأكيد.
    siteUrl: text("site_url"),
    // أعداد الصفوف التي أكدت نسخة التاجر استلامها، لكل جدول.
    stats: jsonb("stats").$type<Record<string, number>>().notNull().default({}),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("store_transfers_token_uq").on(t.tokenHash),
    index("store_transfers_store_idx").on(t.storeId),
    check("store_transfers_status_chk", sql`${t.status} IN ('issued', 'importing', 'completed', 'revoked')`),
  ]
);
