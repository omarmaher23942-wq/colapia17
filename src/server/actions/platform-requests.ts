"use server";
// platform-requests.ts — إجراءات الفريق على طلبات المتاجر: نقل المرحلة (مع ملاحظة للعميل وإبلاغه بالبريد
// اختيارياً)، وملاحظات داخلية أو للعميل، ووضع/رفع علامة «سبام». كل إجراء يتحقق من الصلاحية بنفسه (التخطيط لا
// يحمي الـ Server Actions)، ومُدخلاته بمخطط صريح، ونقل المرحلة مشروط بالمرحلة الحالية (لا يكتب فوق نقل متزامن).
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { storeRequestEvents, storeRequests } from "@/db/schema/agency";
import { platformUser } from "@/server/platform-guard";
import { REQUEST_STAGES } from "@/intake/constants";
import { notifyStageChange } from "@/intake/notify";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const DENIED = { ok: false as const, error: "غير مصرح: هذا الإجراء للمالك والمدير." };
const clientNote = z.string().trim().max(600).optional();
const internalNote = z.string().trim().max(2000).optional();

function refresh(id: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/requests");
  revalidatePath(`/admin/requests/${id}`);
}

const moveSchema = z.object({
  id: z.string().uuid(),
  stage: z.enum(REQUEST_STAGES),
  clientNote,
  internalNote,
  notifyClient: z.boolean().default(false),
});

export async function moveRequestStageAction(raw: z.input<typeof moveSchema>): Promise<Result<{ notified: boolean }>> {
  const u = await platformUser({ write: true });
  if (!u) return DENIED;
  const p = moveSchema.safeParse(raw);
  if (!p.success) return { ok: false, error: "بيانات غير صالحة (الملاحظة للعميل حتى 600 حرف)." };
  const { id, stage } = p.data;

  const [row] = await db.select().from(storeRequests).where(eq(storeRequests.id, id)).limit(1);
  if (!row || row.status !== "submitted") return { ok: false, error: "الطلب غير موجود أو ليس طلباً نشطاً." };
  if (row.stage === stage) return { ok: false, error: "الطلب في هذه المرحلة بالفعل. أضف ملاحظة بدل النقل." };

  const note = p.data.clientNote || null;
  const [moved] = await db
    .update(storeRequests)
    .set({ stage, stageNote: note, stageChangedAt: new Date(), updatedAt: new Date(), seenAt: row.seenAt ?? new Date(), seenBy: row.seenBy ?? u.id })
    .where(and(eq(storeRequests.id, id), row.stage ? eq(storeRequests.stage, row.stage) : eq(storeRequests.status, "submitted")))
    .returning();
  if (!moved) return { ok: false, error: "غيّر أحد من الفريق المرحلة للتو. حدّث الصفحة." };

  let notified = false;
  if (p.data.notifyClient) notified = await notifyStageChange(moved, stage, note).catch(() => false);
  await db.insert(storeRequestEvents).values({
    requestId: id,
    type: "stage",
    fromStage: row.stage,
    toStage: stage,
    clientNote: note,
    internalNote: p.data.internalNote || null,
    actor: `platform:${u.id}`,
    clientNotifiedAt: notified ? new Date() : null,
  });
  refresh(id);
  return { ok: true, notified };
}

const noteSchema = z.object({ id: z.string().uuid(), clientNote, internalNote });

/** ملاحظة داخلية للفريق، و/أو ملاحظة تظهر للعميل تحت المرحلة الحالية في صفحة المتابعة. */
export async function addRequestNoteAction(raw: z.input<typeof noteSchema>): Promise<Result> {
  const u = await platformUser({ write: true });
  if (!u) return DENIED;
  const p = noteSchema.safeParse(raw);
  if (!p.success) return { ok: false, error: "بيانات غير صالحة." };
  if (!p.data.clientNote && !p.data.internalNote) return { ok: false, error: "اكتب الملاحظة أولاً." };
  const [row] = await db.select().from(storeRequests).where(eq(storeRequests.id, p.data.id)).limit(1);
  if (!row || row.status === "draft") return { ok: false, error: "الطلب غير موجود." };
  if (p.data.clientNote) {
    await db.update(storeRequests).set({ stageNote: p.data.clientNote, updatedAt: new Date() }).where(eq(storeRequests.id, row.id));
  }
  await db.insert(storeRequestEvents).values({
    requestId: row.id,
    type: "note",
    toStage: p.data.clientNote ? row.stage : null,
    clientNote: p.data.clientNote || null,
    internalNote: p.data.internalNote || null,
    actor: `platform:${u.id}`,
  });
  refresh(row.id);
  return { ok: true };
}

const spamSchema = z.object({ id: z.string().uuid(), spam: z.boolean() });

/** «سبام»: يخرج الطلب من الطابور وحساب موعد التسليم وحد «طلب مفتوح». قابل للتراجع. */
export async function setRequestSpamAction(raw: z.input<typeof spamSchema>): Promise<Result> {
  const u = await platformUser({ write: true });
  if (!u) return DENIED;
  const p = spamSchema.safeParse(raw);
  if (!p.success) return { ok: false, error: "بيانات غير صالحة." };
  const from = p.data.spam ? "submitted" : "spam";
  const [row] = await db
    .update(storeRequests)
    .set({ status: p.data.spam ? "spam" : "submitted", updatedAt: new Date(), seenAt: new Date(), seenBy: u.id })
    .where(and(eq(storeRequests.id, p.data.id), eq(storeRequests.status, from)))
    .returning({ id: storeRequests.id });
  if (!row) return { ok: false, error: "حالة الطلب تغيّرت. حدّث الصفحة." };
  await db.insert(storeRequestEvents).values({ requestId: row.id, type: p.data.spam ? "spam" : "restored", actor: `platform:${u.id}` });
  refresh(row.id);
  return { ok: true };
}
