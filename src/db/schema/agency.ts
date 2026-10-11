// agency.ts — طلبات المتاجر في نموذج الوكالة (المرحلة 2): استمارة المعلومات، ومراحل التنفيذ التي يحركها الفريق
// ويراها العميل في صفحة «متابعة متجرك»، وملفات الاستمارة (صور، شعار، رسالة صوتية).
//
// جداول تحكم خاصة بالمنصة (لا تدخل مشروع التاجر المستقل: لا تُصدَّر من template/src/db/schema). الحالات والمراحل
// نصوص بقيود CHECK لا pgEnum، فإضافة مرحلة لاحقاً لا تحتاج ALTER TYPE. الروابط السرية (التعديل والمتابعة) تُخزَّن
// تجزئتها فقط.
import { pgTable, uuid, text, timestamp, jsonb, integer, index, uniqueIndex, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { merchants, platformUsers } from "./platform";
import { stores } from "./stores";
import { conversations } from "./ai";

import {
  PRODUCTION_STATES,
  type ProductionStateValue,
  REQUEST_ASSET_KINDS,
  REQUEST_EVENT_TYPES,
  REQUEST_SOURCES,
  REQUEST_STAGES,
  REQUEST_STATUSES,
  TRANSCRIPT_STATUSES,
  type RequestAssetKind,
  type RequestEventType,
  type RequestSource,
  type RequestStage,
  type RequestStatus,
  type TranscriptStatus,
} from "../../intake/constants";

export * from "../../intake/constants";

const inList = (values: readonly string[]) => sql.raw(values.map((v) => `'${v}'`).join(", "));

export const storeRequests = pgTable(
  "store_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** مرجع مقروء للعميل والفريق (REQ-XXXXX)، يُذكر في البريد وواتساب. */
    code: text("code").notNull(),
    status: text("status").$type<RequestStatus>().notNull().default("draft"),
    /** null حتى الإرسال. */
    stage: text("stage").$type<RequestStage>(),
    /** ملاحظة الفريق الحالية الظاهرة للعميل في صفحة المتابعة. */
    stageNote: text("stage_note"),
    stageChangedAt: timestamp("stage_changed_at", { withTimezone: true }),

    /** رابط التعديل والاستكمال (والرفع): صالح ما دام الطلب مسودة. */
    draftTokenHash: text("draft_token_hash").notNull(),
    /** رابط المتابعة للقراءة فقط، يُصدر عند الإرسال. */
    trackTokenHash: text("track_token_hash"),

    /** بيانات الاستمارة (src/intake/schema.ts، الحقل v = الإصدار). */
    data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}),
    draftVersion: integer("draft_version").notNull().default(0),

    // نسخ للبحث ومنع التكرار والحدود (من data عند الحفظ والإرسال).
    storeName: text("store_name"),
    email: text("email"),
    emailConfirmedAt: timestamp("email_confirmed_at", { withTimezone: true }),
    whatsapp: text("whatsapp"),

    source: text("source").$type<RequestSource>().notNull().default("web"),
    conversationId: uuid("conversation_id").references(() => conversations.id, { onDelete: "set null" }),
    utm: jsonb("utm").$type<Record<string, string>>(),
    /** تجزئة عنوان IP بسر المنصة (لا يُخزَّن العنوان نفسه). */
    ipHash: text("ip_hash"),
    userAgent: text("user_agent"),

    /** الوعد الذي ظهر للعميل عند الإرسال (لا يتغير بعده). */
    etaFrom: timestamp("eta_from", { withTimezone: true }),
    etaTo: timestamp("eta_to", { withTimezone: true }),

    seenAt: timestamp("seen_at", { withTimezone: true }),
    seenBy: uuid("seen_by").references(() => platformUsers.id, { onDelete: "set null" }),

    /** تُملأ في التجهيز (المرحلة 4) ودخول التاجر (المرحلة 6). */
    storeId: uuid("store_id").references(() => stores.id, { onDelete: "set null" }),
    merchantId: uuid("merchant_id").references(() => merchants.id, { onDelete: "set null" }),

    clientEmailedAt: timestamp("client_emailed_at", { withTimezone: true }),
    teamNotifiedAt: timestamp("team_notified_at", { withTimezone: true }),

    // ─── الإنتاج الداخلي (المرحلة 3، migration 0007): يراه الفريق فقط ───
    /** src/agency/production.ts: new ← assigned ← building ← review ← ready ← delivered. */
    production: text("production").$type<ProductionStateValue>().notNull().default("new"),
    productionChangedAt: timestamp("production_changed_at", { withTimezone: true }),
    builderId: uuid("builder_id").references(() => platformUsers.id, { onDelete: "set null" }),
    reviewerId: uuid("reviewer_id").references(() => platformUsers.id, { onDelete: "set null" }),
    /** النطاق الفرعي المقترح/المعتمد للمتجر (يُثبَّت عند التجهيز). */
    slug: text("slug"),
    /** قائمة فحص الجودة: { بند: { by, at } } (QA_ITEMS). */
    qa: jsonb("qa").$type<Record<string, { by: string; at: string }>>().notNull().default({}),
    approvedBy: uuid("approved_by").references(() => platformUsers.id, { onDelete: "set null" }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    /** جولة البناء (تزيد كلما أعاده المراجع): اسم الفرع build/<slug>-<round>. */
    round: integer("round").notNull().default(1),
    /** بانتظار العميل (معلومة ناقصة): سبب ظاهر للفريق، والطلب لا يُحسب متأخراً داخلياً أثناءه. */
    waitingReason: text("waiting_reason"),
    waitingSince: timestamp("waiting_since", { withTimezone: true }),
    /** نسخة ما أرسله العميل قبل أول تعديل من الفريق (data يصبح نسخة الفريق المعتمدة). */
    clientData: jsonb("client_data").$type<Record<string, unknown>>(),
    /** آخر تنبيه تأخر داخلي أُرسل للفريق (لا يتكرر لنفس الحالة). */
    slaAlertedAt: timestamp("sla_alerted_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    /** مسودة لم تُرسل حتى هذا الوقت تُحذف مع ملفاتها (ops/tick). */
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("store_requests_code_uq").on(t.code),
    uniqueIndex("store_requests_draft_token_uq").on(t.draftTokenHash),
    uniqueIndex("store_requests_track_token_uq").on(t.trackTokenHash),
    index("store_requests_status_idx").on(t.status, t.submittedAt),
    index("store_requests_stage_idx").on(t.stage),
    index("store_requests_email_idx").on(t.email),
    index("store_requests_whatsapp_idx").on(t.whatsapp),
    index("store_requests_conversation_idx").on(t.conversationId),
    index("store_requests_expires_idx").on(t.expiresAt),
    index("store_requests_production_idx").on(t.production),
    index("store_requests_builder_idx").on(t.builderId),
    index("store_requests_reviewer_idx").on(t.reviewerId),
    uniqueIndex("store_requests_slug_uq").on(t.slug),
    check("store_requests_production_chk", sql`${t.production} IN (${inList(PRODUCTION_STATES)})`),
    check("store_requests_status_chk", sql`${t.status} IN (${inList(REQUEST_STATUSES)})`),
    check("store_requests_stage_chk", sql`${t.stage} IS NULL OR ${t.stage} IN (${inList(REQUEST_STAGES)})`),
    check("store_requests_source_chk", sql`${t.source} IN (${inList(REQUEST_SOURCES)})`),
  ]
);

export const storeRequestAssets = pgTable(
  "store_request_assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: uuid("request_id").notNull().references(() => storeRequests.id, { onDelete: "cascade" }),
    /** مفتاح UploadThing. الاستمارة ترسل المفاتيح فقط، والروابط تُقرأ من هنا (منع التزوير). */
    key: text("key").notNull(),
    url: text("url").notNull(),
    kind: text("kind").$type<RequestAssetKind>().notNull(),
    mime: text("mime"),
    sizeBytes: integer("size_bytes"),
    durationMs: integer("duration_ms"),
    transcript: text("transcript"),
    transcriptStatus: text("transcript_status").$type<TranscriptStatus>().notNull().default("none"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("store_request_assets_key_uq").on(t.key),
    index("store_request_assets_request_idx").on(t.requestId),
    check("store_request_assets_kind_chk", sql`${t.kind} IN (${inList(REQUEST_ASSET_KINDS)})`),
    check("store_request_assets_transcript_chk", sql`${t.transcriptStatus} IN (${inList(TRANSCRIPT_STATUSES)})`),
  ]
);

/** سجل الطلب: الإرسال وكل نقل مرحلة وملاحظة وبريد. ما في client_note يظهر للعميل في صفحة المتابعة. */
export const storeRequestEvents = pgTable(
  "store_request_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: uuid("request_id").notNull().references(() => storeRequests.id, { onDelete: "cascade" }),
    type: text("type").$type<RequestEventType>().notNull(),
    fromStage: text("from_stage").$type<RequestStage>(),
    toStage: text("to_stage").$type<RequestStage>(),
    clientNote: text("client_note"),
    internalNote: text("internal_note"),
    /** system | client | platform:<id> */
    actor: text("actor").notNull(),
    clientNotifiedAt: timestamp("client_notified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("store_request_events_request_idx").on(t.requestId, t.createdAt),
    check("store_request_events_type_chk", sql`${t.type} IN (${inList(REQUEST_EVENT_TYPES)})`),
  ]
);

/** سجل نشاط فريق الوكالة على مستوى اللوحة (إضافة عضو، تغيير دور، إسناد، تسليم...). سجل الطلب نفسه في store_request_events. */
export const platformActivity = pgTable(
  "platform_activity",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: uuid("actor_id").references(() => platformUsers.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    /** request:<id> | member:<id> | store:<id> */
    target: text("target"),
    meta: jsonb("meta").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("platform_activity_created_idx").on(t.createdAt), index("platform_activity_actor_idx").on(t.actorId, t.createdAt)]
);
