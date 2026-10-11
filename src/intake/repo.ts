import "server-only";
// repo.ts — قراءة وكتابة طلبات المتاجر. كل كتابة مشروطة بالحالة (لا معاملات تفاعلية في neon-http):
// الحفظ التلقائي بنسخة متفائلة (draft_version)، والإرسال مرة واحدة فقط (status = 'draft' في شرط التحديث).
import { and, asc, eq, gt, inArray, ne, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { storeRequestAssets, storeRequestEvents, storeRequests, type RequestSource, type RequestStage } from "@/db/schema/agency";
import { dbErrorInfo, PG_UNIQUE } from "@/lib/db-errors";
import { newRequestCode } from "@/lib/ids";
import { intakeDataSchema, normalizeEmail, normalizeIntake, type IntakeData } from "./schema";
import { normalizeEgyptianPhone } from "@/lib/phone";
import { derivedToken, hashToken, isWellFormedToken, randomToken } from "./tokens";

export const DRAFT_TTL_DAYS = 21;
export type RequestRow = typeof storeRequests.$inferSelect;
export type AssetRow = typeof storeRequestAssets.$inferSelect;

const PG_UNDEFINED_TABLE = "42P01";
/** الجداول لم تُنشأ بعد (الكود نُشر قبل أن يشغّل المالك migration 0006). */
export const isMissingTable = (e: unknown) => dbErrorInfo(e).code === PG_UNDEFINED_TABLE || /relation "store_request/.test(String((e as Error)?.message ?? ""));

/** نسخ البحث والحدود من البيانات (بريد بحروف صغيرة صحيح، واتساب قياسي صحيح، وإلا null). */
function copies(d: IntakeData) {
  return {
    storeName: d.store.name?.trim() || null,
    email: normalizeEmail(d.contact.email),
    whatsapp: normalizeEgyptianPhone(d.contact.whatsapp ?? null),
  };
}

/** يقرأ بيانات محفوظة (أي إصدار سابق) بأمان: ما لا يطابق المخطط الحالي يرجع لاستمارة فارغة بدل خطأ. */
export function readData(raw: unknown): IntakeData {
  const parsed = intakeDataSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : intakeDataSchema.parse({});
}

export async function createDraft(input: {
  data: IntakeData;
  source?: RequestSource;
  conversationId?: string | null;
  /** رابط مشتق (محادثة الوكيل) بدل العشوائي. */
  token?: string;
  utm?: Record<string, string> | null;
  ipHash?: string | null;
  userAgent?: string | null;
}): Promise<{ row: RequestRow; token: string }> {
  const token = input.token ?? randomToken();
  const data = normalizeIntake(input.data);
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const [row] = await db
        .insert(storeRequests)
        .values({
          code: newRequestCode(),
          draftTokenHash: hashToken(token),
          data,
          ...copies(data),
          source: input.source ?? "web",
          conversationId: input.conversationId ?? null,
          utm: input.utm && Object.keys(input.utm).length ? input.utm : null,
          ipHash: input.ipHash ?? null,
          userAgent: input.userAgent?.slice(0, 300) ?? null,
          expiresAt: sql`now() + make_interval(days => ${DRAFT_TTL_DAYS})`,
          lastSeenAt: new Date(),
        })
        .returning();
      return { row: row!, token };
    } catch (e) {
      const info = dbErrorInfo(e);
      // تصادم كود REQ نادر جداً: نعيد المحاولة بكود آخر. تصادم رابط مشتق = المسودة موجودة أصلاً (يعالجه المستدعي).
      if (info.code === PG_UNIQUE && info.constraint === "store_requests_code_uq") continue;
      throw e;
    }
  }
  throw new Error("request_code_exhausted");
}

/** المسودة برابط التعديل (أي حالة؛ المستدعي يقرر). */
export async function findByDraftToken(token: unknown): Promise<RequestRow | null> {
  if (!isWellFormedToken(token)) return null;
  const [row] = await db.select().from(storeRequests).where(eq(storeRequests.draftTokenHash, hashToken(token))).limit(1);
  return row ?? null;
}

export const draftIsOpen = (r: RequestRow, now = new Date()) => r.status === "draft" && r.expiresAt > now;

/** صفحة المتابعة: الطلب برابط المتابعة المشتق، بعد الإرسال فقط. */
export async function findByTrackToken(token: unknown): Promise<RequestRow | null> {
  if (!isWellFormedToken(token)) return null;
  const [row] = await db
    .select()
    .from(storeRequests)
    .where(and(eq(storeRequests.trackTokenHash, hashToken(token)), inArray(storeRequests.status, ["submitted", "converted"])))
    .limit(1);
  return row ?? null;
}

export type SaveResult = { ok: true; version: number } | { ok: false; reason: "conflict"; version: number; data: IntakeData } | { ok: false; reason: "closed" };

/** حفظ تلقائي بنسخة متفائلة: ينجح فقط إن لم يحفظ أحد غيره منذ قرأ (تبويبان مفتوحان مثلاً). */
export async function saveDraft(row: RequestRow, version: number, input: IntakeData): Promise<SaveResult> {
  const data = normalizeIntake(input);
  const [saved] = await db
    .update(storeRequests)
    // كل حفظ يمد مهلة المسودة (تُحذف بعد 21 يوماً من آخر تعديل، كما في سياسة الخصوصية).
    .set({
      data,
      ...copies(data),
      draftVersion: sql`${storeRequests.draftVersion} + 1`,
      expiresAt: sql`now() + make_interval(days => ${DRAFT_TTL_DAYS})`,
      updatedAt: new Date(),
      lastSeenAt: new Date(),
    })
    .where(and(eq(storeRequests.id, row.id), eq(storeRequests.draftVersion, version), eq(storeRequests.status, "draft"), gt(storeRequests.expiresAt, new Date())))
    .returning({ version: storeRequests.draftVersion });
  if (saved) return { ok: true, version: saved.version };
  const [now] = await db.select().from(storeRequests).where(eq(storeRequests.id, row.id)).limit(1);
  if (!now || !draftIsOpen(now)) return { ok: false, reason: "closed" };
  return { ok: false, reason: "conflict", version: now.draftVersion, data: readData(now.data) };
}

/** يعيد فتح مسودة انتهت مهلتها ولم تُحذف بعد (نفس الرابط المشتق لمحادثة الوكيل). */
export async function reopenDraft(id: string): Promise<void> {
  await db
    .update(storeRequests)
    .set({ expiresAt: sql`now() + make_interval(days => ${DRAFT_TTL_DAYS})`, updatedAt: new Date() })
    .where(and(eq(storeRequests.id, id), eq(storeRequests.status, "draft")));
}

export async function requestAssets(requestId: string): Promise<AssetRow[]> {
  return db.select().from(storeRequestAssets).where(eq(storeRequestAssets.requestId, requestId)).orderBy(asc(storeRequestAssets.createdAt));
}

/** طلبات مُرسلة لم تصل للتسليم بعد (طول الطابور لموعد التسليم). */
export async function openQueueLength(): Promise<number> {
  const [r] = await db
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(storeRequests)
    .where(and(eq(storeRequests.status, "submitted"), ne(storeRequests.stage, "delivery")));
  return r?.n ?? 0;
}

/** الإرسال: مرة واحدة فقط (شرط status = 'draft'). يُرجع null إن سبقه إرسال آخر أو أُغلقت المسودة. */
export async function submitRequest(
  row: RequestRow,
  input: { data: IntakeData; etaFrom: Date; etaTo: Date },
): Promise<RequestRow | null> {
  const data = normalizeIntake(input.data);
  const stage: RequestStage = "received";
  const [done] = await db
    .update(storeRequests)
    .set({
      status: "submitted",
      stage,
      stageChangedAt: new Date(),
      trackTokenHash: hashToken(derivedToken("track", row.id)),
      data,
      ...copies(data),
      etaFrom: input.etaFrom,
      etaTo: input.etaTo,
      submittedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(storeRequests.id, row.id), eq(storeRequests.status, "draft"), gt(storeRequests.expiresAt, new Date())))
    .returning();
  if (!done) return null;
  await db.insert(storeRequestEvents).values({ requestId: done.id, type: "submitted", toStage: stage, actor: "client" });
  return done;
}

export async function requestEvents(requestId: string) {
  return db.select().from(storeRequestEvents).where(eq(storeRequestEvents.requestId, requestId)).orderBy(asc(storeRequestEvents.createdAt));
}

/** تحديث «آخر ظهور» بحد أقصى مرة في الدقيقة (لا كتابة مع كل فتح صفحة). */
export async function touch(row: RequestRow): Promise<void> {
  if (row.lastSeenAt && Date.now() - row.lastSeenAt.getTime() < 60_000) return;
  await db.update(storeRequests).set({ lastSeenAt: new Date() }).where(eq(storeRequests.id, row.id)).catch(() => {});
}
