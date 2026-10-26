"use server";
// agency-production.ts — إجراءات خط الإنتاج الداخلي على طلب المشروع: الإسناد، نقل الحالة، قائمة فحص الجودة، «بانتظار العميل»،
// روابط المشروع (المستودع والمتجر)، والتسليم. كل إجراء: جلسة ← صلاحية الدور ← رؤية الطلب ← قاعدة الانتقال
// (src/agency/production.ts) ← كتابة مشروطة بالحالة الحالية (لا تكتب فوق تعديل متزامن) ← سجل.
import { revalidatePath } from "next/cache";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { platformUsers } from "@/db/schema";
import { storeRequestEvents, storeRequests } from "@/db/schema/agency";
import { getPlatformSession } from "@/server/auth";
import { can, isPlatformRole, type PlatformRole } from "@/agency/roles";
import { PRODUCTION_INFO, PRODUCTION_STATES, QA_ITEMS, canMove, canTickQa, canViewRequest, readQa, type ProductionActor, type ProductionState } from "@/agency/production";
import { logActivity } from "@/agency/activity";
import { emailMembers } from "@/agency/notify";
import { accountUrl } from "@/agency/client-notify";
import { deliveryMessage } from "@/agent/handoff-messages";
import { currentPricing } from "@/server/pricing";
import { freeEditDeadline } from "@/lib/platform-pricing";
import { safeUrl } from "@/lib/safe-url";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };
type Row = typeof storeRequests.$inferSelect;

const DENIED = { ok: false as const, error: "غير مصرح لهذا الدور." };
const STALE = { ok: false as const, error: "غيّر أحد من الفريق الطلب للتو. حدّث الصفحة." };

async function actor(): Promise<(ProductionActor & { name: string }) | null> {
  const u = await getPlatformSession();
  if (!u || !isPlatformRole(u.role)) return null;
  return { id: u.id, role: u.role as PlatformRole, name: u.name };
}

/** الطلب إن كان مؤكَّد الدفع (في الإنتاج أو مسلَّماً) ويحق للعضو رؤيته. */
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
  if (row.production === "delivered") return { ok: false, error: "سُلِّم المشروع؛ لا إسناد بعد التسليم." };
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
    await emailMembers([builderId], { subject: `أُسند إليك مشروع ${row.code}`, headline: "مشروع جديد لك", lines: [`أسند إليك ${a.name} تجهيز مشروع ${label}.`, "افتح الطلب وراجع بياناته ثم ابدأ."], requestId: row.id });
  }
  if (reviewerId && reviewerId !== row.reviewerId) {
    await emailMembers([reviewerId], { subject: `ستراجع مشروع ${row.code}`, headline: "مراجعة قادمة", lines: [`أنت مراجع مشروع ${label}. سيصلك بريد حين يرسله المنفّذ للمراجعة.`], requestId: row.id });
  }
  refresh(row.id);
  return { ok: true };
}

// ─── نقل حالة الإنتاج ───────────────────────────────────────────────────────

const moveSchema = z.object({ id: z.string().uuid(), to: z.enum(PRODUCTION_STATES), note: z.string().trim().max(3000).optional() });

export async function moveProductionAction(raw: z.input<typeof moveSchema>): Promise<Result> {
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
  const qa = readQa(row.qa);
  // إعادة للتجهيز: بنود المراجع تُمسح (تُراجع من جديد على الجولة التالية) وتزيد الجولة.
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
      waitingReason: null,
      waitingSince: null,
      updatedAt: new Date(),
    })
    .where(and(eq(storeRequests.id, row.id), eq(storeRequests.production, from), eq(storeRequests.status, "submitted")))
    .returning({ id: storeRequests.id });
  if (!done) return STALE;

  await event(row.id, a, { type: "production", internalNote: `${PRODUCTION_INFO[from].label} ← ${PRODUCTION_INFO[to].label}${note ? `: ${note}` : ""}` });
  await logActivity(a.id, "request.production", `request:${row.id}`, { from, to });

  const label = `«${row.storeName ?? row.code}» (${row.code})`;
  if (to === "review") {
    await emailMembers([row.reviewerId], { subject: `مشروع ${row.code} جاهز للمراجعة`, headline: "مراجعة مطلوبة", lines: [`${a.name} أرسل مشروع ${label} للمراجعة.`, "راجعه بقائمة الفحص، ثم اعتمده أو أعده بملاحظات واضحة."], requestId: row.id });
  } else if (returning) {
    await emailMembers([row.builderId], { subject: `ملاحظات على مشروع ${row.code}`, headline: "أُعيد المشروع للتجهيز", lines: [`${a.name} أعاد مشروع ${label} بهذه الملاحظات:`, note ?? ""], requestId: row.id });
  }
  refresh(row.id);
  return { ok: true };
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
  await event(row.id, a, { type: "qa", internalNote: `${p.data.done ? "تم" : "أُلغي"}: ${item.label}` });
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

// ─── ملاحظة داخلية ──────────────────────────────────────────────────────────

const noteSchema = z.object({ id: z.string().uuid(), note: z.string().trim().min(1).max(2000) });

export async function addRequestNoteAction(raw: z.input<typeof noteSchema>): Promise<Result> {
  const a = await actor();
  if (!a || !can(a.role, "requests.note")) return DENIED;
  const p = noteSchema.safeParse(raw);
  if (!p.success) return { ok: false, error: "اكتبوا الملاحظة (حتى 2000 حرف)." };
  const row = await load(p.data.id, a);
  if (!row) return { ok: false, error: "الطلب غير موجود أو ليس لك." };
  await event(row.id, a, { type: "note", internalNote: p.data.note });
  refresh(row.id);
  return { ok: true };
}

// ─── روابط المشروع (سجل التسليم) ────────────────────────────────────────────

const linksSchema = z.object({ id: z.string().uuid(), repoUrl: z.string().trim().max(300), storeUrl: z.string().trim().max(300) });

/**
 * رابطا مستودع العميل ومتجره المنشور: يملؤهما الفريق بعد جلسة التسليم (ويعدّلهما متى لزم، حتى بعد التسليم). يظهران للعميل في
 * بوابته وفي صندوق طلبات التعديل. https فقط، والفارغ يمسح.
 */
export async function saveProjectLinksAction(raw: z.input<typeof linksSchema>): Promise<Result<{ repoUrl: string | null; storeUrl: string | null }>> {
  const a = await actor();
  if (!a) return DENIED;
  const p = linksSchema.safeParse(raw);
  if (!p.success) return { ok: false, error: "بيانات غير صالحة." };
  const row = await load(p.data.id, a);
  if (!row) return { ok: false, error: "الطلب غير موجود أو ليس لك." };
  if (!(can(a.role, "requests.assign") || (row.builderId === a.id && can(a.role, "requests.work")))) return DENIED;
  const repoUrl = p.data.repoUrl ? safeUrl(p.data.repoUrl) : null;
  const storeUrl = p.data.storeUrl ? safeUrl(p.data.storeUrl) : null;
  if (p.data.repoUrl && !repoUrl) return { ok: false, error: "رابط المستودع غير صالح (https فقط)." };
  if (p.data.storeUrl && !storeUrl) return { ok: false, error: "رابط المتجر غير صالح (https فقط)." };
  await db.update(storeRequests).set({ repoUrl, storeUrl, updatedAt: new Date() }).where(eq(storeRequests.id, row.id));
  await event(row.id, a, { type: "link", internalNote: `المستودع: ${repoUrl ?? "—"} · المتجر: ${storeUrl ?? "—"}` });
  await logActivity(a.id, "request.links", `request:${row.id}`, { repoUrl, storeUrl });
  refresh(row.id);
  revalidatePath("/admin/edits");
  revalidatePath("/dashboard");
  return { ok: true, repoUrl, storeUrl };
}

// ─── التسليم ────────────────────────────────────────────────────────────────

const deliverSchema = z.object({ id: z.string().uuid() });

/**
 * «سلّم للعميل»: من «جاهز» فقط (اعتمده مراجع وقائمة الفحص كاملة). يقفل الطلب «سُلِّم» (لا تسليم مزدوج)، ويسجّل
 * delivered_at ويفتح نافذة التعديل المجاني (+7 أيام افتراضياً من إعداد الأسعار)، ويعيد رسالة التسليم الجاهزة للنسخ
 * ومسار تنزيل المشروع. لا تجربة ولا جدولة حذف ولا متجر مستضاف.
 */
export async function deliverRequestAction(raw: z.input<typeof deliverSchema>): Promise<Result<{ message: string; downloadUrl: string; freeEditUntil: string }>> {
  const a = await actor();
  if (!a || !can(a.role, "requests.deliver")) return DENIED;
  const p = deliverSchema.safeParse(raw);
  if (!p.success) return { ok: false, error: "بيانات غير صالحة." };
  const row = await load(p.data.id, a);
  if (!row) return { ok: false, error: "الطلب غير موجود." };
  if (row.production !== "ready") return { ok: false, error: "التسليم من «جاهز للتسليم» فقط (بعد اعتماد المراجع)." };
  const qa = readQa(row.qa);
  if (!QA_ITEMS.every((i) => qa[i.key])) return { ok: false, error: "قائمة الفحص غير مكتملة." };

  const pricing = await currentPricing();
  const now = new Date();
  const until = freeEditDeadline(now, pricing.edit.freeDays);
  const [locked] = await db
    .update(storeRequests)
    .set({ production: "delivered", productionChangedAt: now, deliveredAt: now, freeEditUntil: until, waitingReason: null, waitingSince: null, updatedAt: now })
    .where(and(eq(storeRequests.id, row.id), eq(storeRequests.production, "ready")))
    .returning();
  if (!locked) return STALE;

  await event(row.id, a, { type: "delivered", internalNote: `سُلِّم المشروع. التعديل المجاني حتى ${until.toISOString().slice(0, 10)}` });
  await logActivity(a.id, "request.deliver", `request:${row.id}`);
  refresh(row.id);
  revalidatePath("/dashboard");
  const message = deliveryMessage({ storeName: locked.storeName ?? "", repoUrl: locked.repoUrl, storeUrl: locked.storeUrl, accountUrl: accountUrl(), freeEditUntil: until, freeDays: pricing.edit.freeDays });
  return { ok: true, message, downloadUrl: `/admin/requests/${row.id}/project`, freeEditUntil: until.toISOString() };
}
