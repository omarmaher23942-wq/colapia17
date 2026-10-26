import "server-only";
// repo.ts — قراءة وكتابة حجوزات المشاريع (store_requests في نموذج V4). لا معاملات تفاعلية في neon-http، فكل كتابة مشروطة
// بالحالة: الإرسال مرة واحدة فقط (status = 'draft' في شرط التحديث)، ودفعة واحدة قيد المراجعة لكل حجز (فهرس فريد).
import { and, desc, eq, gt, inArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { platformPayments, storeRequestAssets, storeRequestEvents, storeRequests, type RequestSource } from "@/db/schema";
import { dbErrorInfo, PG_UNIQUE } from "@/lib/db-errors";
import { newRequestCode } from "@/lib/ids";
import { canonicalEmail } from "@/lib/contact";
import type { PaymentPlan } from "@/lib/platform-pricing";
import { applyPrefill, EMPTY_FIELDS, readFields, type BookingData, type BookingFields } from "./schema";
import { derivedToken, hashToken, isWellFormedToken, randomToken } from "./tokens";

export const DRAFT_TTL_DAYS = 21;
export type RequestRow = typeof storeRequests.$inferSelect;

/** ما تحمله مسودة الحجز قبل الإرسال: الملء المسبق من الوكيل فقط (العميل لا تُحفظ حقوله إلا عند الإرسال). */
type DraftData = { v: 2; prefill?: Partial<BookingFields> };

const draftDataOf = (raw: unknown): DraftData => {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return { v: 2, prefill: r.prefill && typeof r.prefill === "object" ? (r.prefill as Partial<BookingFields>) : undefined };
};

/** حقول الصفحة الأولية: الملء المسبق من الوكيل (ما لا يمر في الرابط)، وإلا فارغة. */
export function initialFields(row: RequestRow | null): BookingFields {
  return applyPrefill(EMPTY_FIELDS, draftDataOf(row?.data).prefill);
}

export async function createDraft(input: {
  source: RequestSource;
  conversationId?: string | null;
  /** رابط مشتق (محادثة الوكيل) بدل العشوائي. */
  token?: string;
  prefill?: Partial<BookingFields>;
  ipHash?: string | null;
  userAgent?: string | null;
}): Promise<{ row: RequestRow; token: string }> {
  const token = input.token ?? randomToken();
  const data: DraftData = { v: 2, ...(input.prefill ? { prefill: readFields(input.prefill) } : {}) };
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const [row] = await db
        .insert(storeRequests)
        .values({
          code: newRequestCode(),
          draftTokenHash: hashToken(token),
          data: data as unknown as Record<string, unknown>,
          source: input.source,
          conversationId: input.conversationId ?? null,
          ipHash: input.ipHash ?? null,
          userAgent: input.userAgent?.slice(0, 300) ?? null,
          expiresAt: sql`now() + make_interval(days => ${DRAFT_TTL_DAYS})`,
          lastSeenAt: new Date(),
        })
        .returning();
      return { row: row!, token };
    } catch (e) {
      const info = dbErrorInfo(e);
      // تصادم كود REQ نادر جداً: نعيد المحاولة بكود آخر. تصادم الرابط المشتق = المسودة موجودة أصلاً (يعالجه المستدعي).
      if (info.code === PG_UNIQUE && info.constraint === "store_requests_code_uq") continue;
      throw e;
    }
  }
  throw new Error("request_code_exhausted");
}

/** الحجز برابط الحجز (أي حالة؛ المستدعي يقرر). */
export async function findByDraftToken(token: unknown): Promise<RequestRow | null> {
  if (!isWellFormedToken(token)) return null;
  const [row] = await db.select().from(storeRequests).where(eq(storeRequests.draftTokenHash, hashToken(token))).limit(1);
  return row ?? null;
}

export const draftIsOpen = (r: RequestRow, now = new Date()) => r.status === "draft" && r.expiresAt > now;

/** صفحة الشكر والمتابعة: الحجز برابط المتابعة المشتق، بعد الإرسال فقط. */
export async function findByTrackToken(token: unknown): Promise<RequestRow | null> {
  if (!isWellFormedToken(token)) return null;
  const [row] = await db
    .select()
    .from(storeRequests)
    .where(and(eq(storeRequests.trackTokenHash, hashToken(token)), inArray(storeRequests.status, ["awaiting_payment", "submitted"])))
    .limit(1);
  return row ?? null;
}

/**
 * مسودة محادثة الوكيل: نفس المحادثة = نفس الرابط دائماً. الملء المسبق للفارغ فقط ولا يمر في الرابط. مسودة منتهية تُجدَّد.
 * حجز أُرسل من هذه المحادثة يبقى كما هو (الرابط نفسه يعرض حالته).
 */
export async function ensureConversationDraft(conversationId: string, prefill?: Partial<BookingFields>): Promise<{ row: RequestRow; token: string }> {
  const token = derivedToken("conversation", conversationId);
  let row = await findByDraftToken(token);
  if (!row) {
    try {
      return await createDraft({ source: "agent", conversationId, token, prefill });
    } catch (e) {
      if (dbErrorInfo(e).code !== PG_UNIQUE) throw e;
      row = await findByDraftToken(token);
      if (!row) throw e;
    }
  }
  if (row.status === "draft") {
    const merged = applyPrefill(initialFields(row), prefill);
    const [fresh] = await db
      .update(storeRequests)
      .set({
        data: { v: 2, prefill: merged } as unknown as Record<string, unknown>,
        expiresAt: sql`now() + make_interval(days => ${DRAFT_TTL_DAYS})`,
        updatedAt: new Date(),
      })
      .where(and(eq(storeRequests.id, row.id), eq(storeRequests.status, "draft")))
      .returning();
    if (fresh) row = fresh;
  }
  return { row, token };
}

// ─── الإيصال ────────────────────────────────────────────────────────────────

export async function addReceiptAsset(requestId: string, f: { key: string; url: string; type: string; size: number }): Promise<void> {
  await db.insert(storeRequestAssets).values({ requestId, key: f.key, url: f.url, kind: "receipt", mime: f.type, sizeBytes: f.size });
}

/** آخر إيصال مرفوع لهذا الحجز بمفتاحه (يمنع تمرير رابط من خارج الحجز). */
export async function receiptByKey(requestId: string, key: string) {
  const [a] = await db
    .select()
    .from(storeRequestAssets)
    .where(and(eq(storeRequestAssets.requestId, requestId), eq(storeRequestAssets.key, key), eq(storeRequestAssets.kind, "receipt")))
    .limit(1);
  return a ?? null;
}

export async function receiptCount(requestId: string): Promise<number> {
  const [r] = await db
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(storeRequestAssets)
    .where(and(eq(storeRequestAssets.requestId, requestId), eq(storeRequestAssets.kind, "receipt")));
  return r?.n ?? 0;
}

export async function latestReceipt(requestId: string) {
  const [a] = await db
    .select()
    .from(storeRequestAssets)
    .where(and(eq(storeRequestAssets.requestId, requestId), eq(storeRequestAssets.kind, "receipt")))
    .orderBy(desc(storeRequestAssets.createdAt))
    .limit(1);
  return a ?? null;
}

// ─── الإرسال ────────────────────────────────────────────────────────────────

/** حجز مفتوح (بانتظار التأكيد) لنفس البريد القانوني خلال 14 يوماً: يمنع إرسال الحجز نفسه مرتين. */
export async function findOpenBooking(email: string, excludeId: string) {
  const canon = canonicalEmail(email);
  const rows = await db
    .select()
    .from(storeRequests)
    .where(and(eq(storeRequests.status, "awaiting_payment"), gt(storeRequests.submittedAt, sql`now() - interval '14 days'`)))
    .orderBy(desc(storeRequests.submittedAt))
    .limit(200)
    .catch(() => [] as RequestRow[]);
  return rows.find((r) => r.id !== excludeId && r.email && canonicalEmail(r.email) === canon) ?? null;
}

export type SubmitOutcome =
  | { ok: true; requestId: string; code: string; trackToken: string; paymentId: string }
  | { ok: false; reason: "closed" | "duplicate_payment" };

/**
 * يحوّل المسودة إلى حجز بانتظار تأكيد الدفع ويسجّل التحويل. الخطوة الأولى مشروطة بـ status = 'draft' فلا يمر إرسالان.
 * فشل تسجيل الدفعة (إيصال مسجّل قيد المراجعة) يُرجع الحجز مسودة.
 */
export async function submitBooking(input: {
  row: RequestRow;
  data: BookingData;
  offer: PaymentPlan;
  amountEgp: number;
  receiptUrl: string;
  ipHash: string | null;
}): Promise<SubmitOutcome> {
  const { row, data, offer, amountEgp } = input;
  const trackToken = derivedToken("track", row.id);
  const now = new Date();
  const [claimed] = await db
    .update(storeRequests)
    .set({
      status: "awaiting_payment",
      data: data as unknown as Record<string, unknown>,
      storeName: data.store.name,
      email: data.contact.email,
      whatsapp: data.contact.whatsapp,
      offer,
      trackTokenHash: hashToken(trackToken),
      submittedAt: now,
      ipHash: input.ipHash ?? row.ipHash,
      updatedAt: now,
    })
    .where(and(eq(storeRequests.id, row.id), eq(storeRequests.status, "draft"), gt(storeRequests.expiresAt, now)))
    .returning({ id: storeRequests.id });
  if (!claimed) return { ok: false, reason: "closed" };

  let paymentId: string;
  try {
    const [pay] = await db
      .insert(platformPayments)
      .values({
        kind: "project",
        plan: offer,
        requestId: row.id,
        method: data.payment.method,
        amountPiasters: amountEgp * 100,
        senderPhone: data.payment.senderPhone,
        screenshotUrl: input.receiptUrl,
      })
      .returning({ id: platformPayments.id });
    paymentId = pay!.id;
  } catch (e) {
    await db.update(storeRequests).set({ status: "draft", submittedAt: null, updatedAt: new Date() }).where(eq(storeRequests.id, row.id));
    if (dbErrorInfo(e).code === PG_UNIQUE) return { ok: false, reason: "duplicate_payment" };
    throw e;
  }
  await db
    .insert(storeRequestEvents)
    .values({ requestId: row.id, type: "submitted", actor: "client", internalNote: `حجز ${offer === "golden" ? "الدائرة الذهبية" : "عادي"} بمبلغ ${amountEgp} ج` })
    .catch((e) => console.error("[golden] event failed", e));
  return { ok: true, requestId: row.id, code: row.code, trackToken, paymentId };
}
