"use server";
// agency-production.ts — إجراءات خط الإنتاج الداخلي على طلب المتجر: الإسناد، نقل حالة الإنتاج، قائمة فحص الجودة،
// «بانتظار العميل»، النطاق الفرعي، وتعديل بيانات الاستمارة. كل إجراء: جلسة ← صلاحية الدور ← رؤية الطلب ← قاعدة
// الانتقال (src/agency/production.ts) ← كتابة مشروطة بالحالة الحالية (لا يكتب فوق تعديل متزامن) ← سجل.
import { revalidatePath } from "next/cache";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { platformUsers, stores } from "@/db/schema";
import { storeRequestEvents, storeRequests } from "@/db/schema/agency";
import { getPlatformSession } from "@/server/auth";
import { can, isPlatformRole, type PlatformRole } from "@/agency/roles";
import {
  PRODUCTION_INFO,
  PRODUCTION_STATES,
  QA_ITEMS,
  canMove,
  canTickQa,
  canViewRequest,
  clientStageFor,
  readQa,
  type ProductionActor,
  type ProductionState,
} from "@/agency/production";
import { isValidSubdomain } from "@/lib/subdomains";
import { intakeDataSchema, normalizeEmail, normalizeIntake, referencedKeys } from "@/intake/schema";
import { normalizeEgyptianPhone } from "@/lib/phone";
import { requestAssets } from "@/intake/repo";
import { notifyStageChange } from "@/intake/notify";
import { STAGE_INFO } from "@/intake/stages";
import { logActivity } from "@/agency/activity";
import { emailMembers } from "@/agency/notify";
import { dbErrorInfo, PG_UNIQUE } from "@/lib/db-errors";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };
type Row = typeof storeRequests.$inferSelect;

const DENIED = { ok: false as const, error: "غير مصرح لهذا الدور." };
const STALE = { ok: false as const, error: "غيّر أحد من الفريق الطلب للتو. حدّث الصفحة." };

async function actor(): Promise<(ProductionActor & { name: string }) | null> {
  const u = await getPlatformSession();
  if (!u || !isPlatformRole(u.role)) return null;
  return { id: u.id, role: u.role as PlatformRole, name: u.name };
}

/** الطلب إن كان مُرسلاً ويحق للعضو رؤيته. */
async function load(id: string, a: ProductionActor): Promise<Row | null> {
  const [row] = await db.select().from(storeRequests).where(eq(storeRequests.id, id)).limit(1);
  if (!row || row.status !== "submitted") return null;
  return canViewRequest(row, a) ? row : null;
}

const asRow = (r: Row) => ({ production: r.production as ProductionState, builderId: r.builderId, reviewerId: r.reviewerId, qa: readQa(r.qa) });

function refresh(id: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/requests");
  revalidatePath(`/admin/requests/${id}`);
}

const event = (requestId: string, a: ProductionActor, v: Partial<typeof storeRequestEvents.$inferInsert> & { type: typeof storeRequestEvents.$inferInsert.type }) =>
  db.insert(storeRequestEvents).values({ requestId, actor: `platform:${a.id}`, ...v }).catch((e) => console.error("[agency] event failed", e));

// ─── الإسناد ────────────────────────────────────────────────────────────────

const assignSchema = z.object({ id: z.string().uuid(), builderId: z.string().uuid().nullable(), reviewerId: z.string().uuid().nullable() });

export async function assignRequestAction(raw: z.input<typeof assignSchema>): Promise<Result> {
  const a = await actor();
  if (!a || !can(a.role, "requests.assign")) return DENIED;
  const p = assignSchema.safeParse(raw);
  if (!p.success) return { ok: false, error: "بيانات غير صالحة." };
  const row = await load(p.data.id, a);
  if (!row) return { ok: false, error: "الطلب غير موجود أو ليس نشطاً." };
  if (row.production === "delivered") return { ok: false, error: "سُلِّم المتجر؛ لا إسناد بعد التسليم." };
  const { builderId, reviewerId } = p.data;
  if (builderId && builderId === reviewerId) return { ok: false, error: "المنفّذ والمراجع شخصان مختلفان." };

  const ids = [builderId, reviewerId].filter((x): x is string => Boolean(x));
  const members = ids.length ? await db.select().from(platformUsers).where(and(inArray(platformUsers.id, ids), eq(platformUsers.isActive, true))) : [];
  const byId = new Map(members.map((m) => [m.id, m]));
  if (builderId) {
    const b = byId.get(builderId);
    if (!b || !can(b.role, "requests.work")) return { ok: false, error: "المنفّذ يجب أن يكون عضواً نشطاً بدور منفّذ أو مدير." };
  }
  if (reviewerId) {
    const r = byId.get(reviewerId);
    if (!r || !can(r.role, "requests.approve")) return { ok: false, error: "المراجع يجب أن يكون عضواً نشطاً بدور مراجع أو مدير." };
  }

  const production: ProductionState = builderId ? (row.production === "new" ? "assigned" : (row.production as ProductionState)) : row.production === "assigned" ? "new" : (row.production as ProductionState);
  const changed = production !== row.production;
  const [done] = await db
    .update(storeRequests)
    .set({
      builderId,
      reviewerId,
      production,
      ...(changed ? { productionChangedAt: new Date(), slaAlertedAt: null } : {}),
      seenAt: row.seenAt ?? new Date(),
      seenBy: row.seenBy ?? a.id,
      updatedAt: new Date(),
    })
    .where(and(eq(storeRequests.id, row.id), eq(storeRequests.production, row.production), eq(storeRequests.status, "submitted")))
    .returning({ id: storeRequests.id });
  if (!done) return STALE;

  const names = (id: string | null) => (id ? (byId.get(id)?.name ?? "—") : "بلا");
  await event(row.id, a, { type: "assign", internalNote: `المنفّذ: ${names(builderId)} · المراجع: ${names(reviewerId)}` });
  await logActivity(a.id, "request.assign", `request:${row.id}`, { builderId, reviewerId });
  const label = `«${row.storeName ?? row.code}» (${row.code})`;
  if (builderId && builderId !== row.builderId) {
    await emailMembers([builderId], { subject: `أُسند إليك متجر ${row.code}`, headline: "متجر جديد لك", lines: [`أسند إليك ${a.name} بناء متجر ${label}.`, "افتح الطلب، راجع البيانات والنطاق، ثم انسخ البرومبت وابدأ."], requestId: row.id });
  }
  if (reviewerId && reviewerId !== row.reviewerId) {
    await emailMembers([reviewerId], { subject: `ستراجع متجر ${row.code}`, headline: "مراجعة قادمة", lines: [`أنت مراجع متجر ${label}. سيصلك بريد حين يرسله المنفّذ للمراجعة.`], requestId: row.id });
  }
  refresh(row.id);
  return { ok: true };
}

// ─── نقل حالة الإنتاج ───────────────────────────────────────────────────────

const moveSchema = z.object({
  id: z.string().uuid(),
  to: z.enum(PRODUCTION_STATES),
  note: z.string().trim().max(3000).optional(),
  notifyClient: z.boolean().default(false),
});

export async function moveProductionAction(raw: z.input<typeof moveSchema>): Promise<Result<{ clientStage: string }>> {
  const a = await actor();
  if (!a) return DENIED;
  const p = moveSchema.safeParse(raw);
  if (!p.success) return { ok: false, error: "بيانات غير صالحة (الملاحظة حتى 3000 حرف)." };
  const row = await load(p.data.id, a);
  if (!row) return { ok: false, error: "الطلب غير موجود أو ليس لك." };
  const { to } = p.data;
  const note = p.data.note || null;
  const check = canMove(asRow(row), to, a, note);
  if (!check.ok) return check;

  const from = row.production as ProductionState;
  const returning = to === "building" && (from === "review" || from === "ready");
  const stage = clientStageFor(to, row.stage);
  const qa = readQa(row.qa);
  // إعادة للبناء: بنود المراجع تُمسح (تُراجع من جديد على الجولة التالية) وتزيد الجولة (فرع جديد).
  const nextQa = returning ? Object.fromEntries(Object.entries(qa).filter(([k]) => QA_ITEMS.find((i) => i.key === k)?.by === "builder")) : qa;

  const [done] = await db
    .update(storeRequests)
    .set({
      production: to,
      productionChangedAt: new Date(),
      slaAlertedAt: null,
      qa: nextQa,
      ...(returning ? { round: sql`${storeRequests.round} + 1`, approvedAt: null, approvedBy: null } : {}),
      ...(to === "ready" ? { approvedAt: new Date(), approvedBy: a.id } : {}),
      ...(stage !== row.stage ? { stage, stageChangedAt: new Date(), stageNote: null } : {}),
      waitingReason: null,
      waitingSince: null,
      updatedAt: new Date(),
    })
    .where(and(eq(storeRequests.id, row.id), eq(storeRequests.production, from), eq(storeRequests.status, "submitted")))
    .returning();
  if (!done) return STALE;

  await event(row.id, a, { type: "production", internalNote: `${PRODUCTION_INFO[from].label} ← ${PRODUCTION_INFO[to].label}${note ? `: ${note}` : ""}` });
  if (stage !== row.stage) {
    let notified = false;
    if (p.data.notifyClient) notified = await notifyStageChange(done, stage, null).catch(() => false);
    await event(row.id, a, { type: "stage", fromStage: row.stage, toStage: stage, internalNote: "تلقائياً مع حالة الإنتاج", clientNotifiedAt: notified ? new Date() : null });
  }
  await logActivity(a.id, "request.production", `request:${row.id}`, { from, to });

  const label = `«${row.storeName ?? row.code}» (${row.code})`;
  if (to === "review") {
    await emailMembers([row.reviewerId], { subject: `متجر ${row.code} جاهز للمراجعة`, headline: "مراجعة مطلوبة", lines: [`${a.name} أرسل متجر ${label} للمراجعة.`, "راجعه بقائمة الفحص، ثم اعتمده أو أعده بملاحظات واضحة."], requestId: row.id });
  } else if (returning) {
    await emailMembers([row.builderId], { subject: `ملاحظات على متجر ${row.code}`, headline: "أُعيد المتجر للبناء", lines: [`${a.name} أعاد متجر ${label} بهذه الملاحظات:`, note ?? "", "البرومبت في صفحة الطلب صار يتضمنها."], requestId: row.id });
  }
  refresh(row.id);
  return { ok: true, clientStage: STAGE_INFO[stage].label };
}

// ─── قائمة فحص الجودة ───────────────────────────────────────────────────────

const qaSchema = z.object({ id: z.string().uuid(), key: z.string().max(40), done: z.boolean() });

export async function tickQaAction(raw: z.input<typeof qaSchema>): Promise<Result> {
  const a = await actor();
  if (!a) return DENIED;
  const p = qaSchema.safeParse(raw);
  if (!p.success) return { ok: false, error: "بيانات غير صالحة." };
  const item = QA_ITEMS.find((i) => i.key === p.data.key);
  if (!item) return { ok: false, error: "بند غير معروف." };
  const row = await load(p.data.id, a);
  if (!row) return { ok: false, error: "الطلب غير موجود أو ليس لك." };
  if (!canTickQa(asRow(row), item, a)) return { ok: false, error: item.by === "builder" ? "هذا البند للمنفّذ المسند." : "هذا البند للمراجع." };
  // تعديل ذري لمفتاح واحد في jsonb: ضغطتان متزامنتان على بندين مختلفين لا تمحو إحداهما الأخرى.
  const value = JSON.stringify({ by: a.id, at: new Date().toISOString() });
  const [done] = await db
    .update(storeRequests)
    .set({
      qa: p.data.done ? sql`${storeRequests.qa} || jsonb_build_object(${item.key}::text, ${value}::jsonb)` : sql`${storeRequests.qa} - ${item.key}::text`,
      updatedAt: new Date(),
    })
    .where(and(eq(storeRequests.id, row.id), ne(storeRequests.production, "delivered")))
    .returning({ id: storeRequests.id });
  if (!done) return STALE;
  await event(row.id, a, { type: "qa", internalNote: `${p.data.done ? "✓" : "✗"} ${item.label}` });
  refresh(row.id);
  return { ok: true };
}

// ─── بانتظار العميل ─────────────────────────────────────────────────────────

const waitSchema = z.object({ id: z.string().uuid(), reason: z.string().trim().max(300).nullable() });

export async function setWaitingAction(raw: z.input<typeof waitSchema>): Promise<Result> {
  const a = await actor();
  if (!a) return DENIED;
  const p = waitSchema.safeParse(raw);
  if (!p.success) return { ok: false, error: "بيانات غير صالحة." };
  const row = await load(p.data.id, a);
  if (!row) return { ok: false, error: "الطلب غير موجود أو ليس لك." };
  const mine = row.builderId === a.id && can(a.role, "requests.work");
  if (!(mine || can(a.role, "requests.assign") || can(a.role, "requests.client_stage"))) return DENIED;
  const reason = p.data.reason || null;
  await db
    .update(storeRequests)
    .set({ waitingReason: reason, waitingSince: reason ? (row.waitingSince ?? new Date()) : null, updatedAt: new Date() })
    .where(eq(storeRequests.id, row.id));
  await event(row.id, a, { type: "note", internalNote: reason ? `بانتظار العميل: ${reason}` : "انتهى انتظار العميل" });
  refresh(row.id);
  return { ok: true };
}

// ─── النطاق الفرعي ──────────────────────────────────────────────────────────

const slugSchema = z.object({ id: z.string().uuid(), slug: z.string().trim().toLowerCase().max(30) });

export async function setRequestSlugAction(raw: z.input<typeof slugSchema>): Promise<Result<{ slug: string }>> {
  const a = await actor();
  if (!a) return DENIED;
  const p = slugSchema.safeParse(raw);
  if (!p.success) return { ok: false, error: "بيانات غير صالحة." };
  const row = await load(p.data.id, a);
  if (!row) return { ok: false, error: "الطلب غير موجود أو ليس لك." };
  if (!(can(a.role, "requests.assign") || (row.builderId === a.id && can(a.role, "requests.work")))) return DENIED;
  if (row.storeId) return { ok: false, error: "جُهِّز المتجر بالفعل؛ النطاق ثابت الآن." };
  const slug = p.data.slug;
  if (!isValidSubdomain(slug)) return { ok: false, error: "3–30 حرفاً لاتينياً صغيراً وأرقاماً وشرطات، وليس اسماً محجوزاً." };
  const [taken] = await db.select({ id: stores.id }).from(stores).where(eq(stores.subdomain, slug)).limit(1);
  if (taken) return { ok: false, error: "هذا النطاق مستخدم لمتجر قائم." };
  try {
    await db.update(storeRequests).set({ slug, updatedAt: new Date() }).where(eq(storeRequests.id, row.id));
  } catch (e) {
    if (dbErrorInfo(e).code === PG_UNIQUE) return { ok: false, error: "طلب آخر يحجز هذا النطاق." };
    throw e;
  }
  await event(row.id, a, { type: "slug", internalNote: `النطاق: ${slug}.colapia.com` });
  refresh(row.id);
  return { ok: true, slug };
}

// ─── تعديل بيانات الاستمارة ─────────────────────────────────────────────────

const editSchema = z.object({ id: z.string().uuid(), data: z.unknown(), version: z.string().datetime() });

const SECTION_LABELS: Record<string, string> = {
  store: "المتجر",
  contact: "التواصل",
  social: "الصفحة",
  colors: "الألوان",
  logo: "الشعار",
  products: "المنتجات",
  payment: "الدفع",
  delivery: "التوصيل",
  inspiration: "الإلهام",
  voice: "تفريغ الصوت",
  notes: "الملاحظات",
};

/**
 * الفريق يصحح بيانات الاستمارة (اسم أدق، سطر منتج مفهوم، طريقة دفع اتفق عليها بالهاتف…). أول تعديل يحفظ نسخة
 * العميل الأصلية في client_data. الملفات لا تُضاف من هنا (مفاتيح من ملفات الطلب نفسه فقط، ويجوز حذفها من الاستمارة).
 * version = updatedAt الذي فُتحت عليه الصفحة: تعديل متزامن من عضو آخر يُرفض بدل أن يُكتب فوقه.
 */
export async function editRequestDataAction(raw: z.input<typeof editSchema>): Promise<Result<{ version: string }>> {
  const a = await actor();
  if (!a) return DENIED;
  const p = editSchema.safeParse(raw);
  if (!p.success) return { ok: false, error: "بيانات غير صالحة." };
  const row = await load(p.data.id, a);
  if (!row) return { ok: false, error: "الطلب غير موجود أو ليس لك." };
  if (!(can(a.role, "requests.assign") || (row.builderId === a.id && can(a.role, "requests.work")))) return DENIED;
  if (row.production === "delivered") return { ok: false, error: "سُلِّم المتجر؛ التعديل بعده من لوحة المتجر." };
  if (row.updatedAt.toISOString() !== p.data.version) return STALE;

  const parsed = intakeDataSchema.safeParse(p.data.data);
  if (!parsed.success) return { ok: false, error: "في بيانات مش مقبولة (تجاوز طول أو صيغة)." };
  const data = normalizeIntake(parsed.data);

  const owned = new Set((await requestAssets(row.id)).map((x) => x.key));
  const keys = referencedKeys(data);
  if (![...keys.images, keys.logo, keys.voice].every((k) => !k || owned.has(k))) return { ok: false, error: "ملف غير موجود في ملفات الطلب." };

  const before = row.data as Record<string, unknown>;
  const changed = Object.keys(SECTION_LABELS).filter((k) => JSON.stringify(before?.[k] ?? null) !== JSON.stringify((data as Record<string, unknown>)[k] ?? null));
  if (!changed.length) return { ok: true, version: row.updatedAt.toISOString() };

  const now = new Date();
  const [done] = await db
    .update(storeRequests)
    .set({
      data,
      clientData: row.clientData ?? (row.data as Record<string, unknown>),
      storeName: data.store.name?.trim() || null,
      email: normalizeEmail(data.contact.email),
      whatsapp: normalizeEgyptianPhone(data.contact.whatsapp ?? null),
      updatedAt: now,
    })
    // القاعدة تخزن الوقت بالميكروثانية وJavaScript بالمللي: المقارنة بعد التقريب للمللي.
    .where(and(eq(storeRequests.id, row.id), sql`date_trunc('milliseconds', ${storeRequests.updatedAt}) = ${row.updatedAt.toISOString()}::timestamptz`))
    .returning({ updatedAt: storeRequests.updatedAt });
  if (!done) return STALE;
  await event(row.id, a, { type: "edited", internalNote: `عدّل: ${changed.map((k) => SECTION_LABELS[k]).join("، ")}` });
  refresh(row.id);
  return { ok: true, version: done.updatedAt.toISOString() };
}
