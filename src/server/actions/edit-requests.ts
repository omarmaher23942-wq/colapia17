"use server";
// edit-requests.ts — إجراءات المالك على صندوق طلبات التعديل: بدء التنفيذ، الإنجاز (يُبلغ العميل ورابط متجره)، الاعتذار بسبب،
// وتعليم الدفع يدوياً. المالك ينفّذ التعديل بنفسه على مستودع العميل خارج المنصة، وهنا يسجّل النتيجة فقط.
import { revalidatePath } from "next/cache";
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { editRequests, platformPayments, storeRequests } from "@/db/schema";
import { getPlatformSession } from "@/server/auth";
import { can } from "@/agency/roles";
import { logActivity } from "@/agency/activity";
import { accountUrl, deliverToClient } from "@/agency/client-notify";
import { editDeclinedMessage, editDoneMessage } from "@/agent/handoff-messages";
import { confirmEditPayment } from "@/lifecycle/payments";

type Result = { ok: true } | { ok: false; error: string };

async function owner() {
  const u = await getPlatformSession();
  return u && can(u.role, "requests.assign") ? u : null;
}

const statusSchema = z.object({ id: z.string().uuid(), status: z.enum(["in_progress", "done", "declined"]), note: z.string().trim().max(2000).optional() });

function refresh(id: string) {
  revalidatePath("/admin/edits");
  revalidatePath(`/admin/edits/${id}`);
  revalidatePath("/dashboard", "layout");
}

export async function setEditStatusAction(raw: z.input<typeof statusSchema>): Promise<Result> {
  const u = await owner();
  if (!u) return { ok: false, error: "غير مصرح لهذا الدور." };
  const p = statusSchema.safeParse(raw);
  if (!p.success) return { ok: false, error: "بيانات غير صالحة." };
  const note = p.data.note || null;
  if (p.data.status === "declined" && !note) return { ok: false, error: "اكتبوا سبب الاعتذار ليصل للعميل." };

  const [edit] = await db.select().from(editRequests).where(eq(editRequests.id, p.data.id)).limit(1);
  if (!edit) return { ok: false, error: "الطلب غير موجود." };
  // التنفيذ لا يبدأ قبل الدفع في التعديل برسوم؛ والاعتذار مسموح دائماً (فيرد المالك المال خارج النظام).
  if (edit.status === "awaiting_payment" && p.data.status !== "declined") return { ok: false, error: "هذا التعديل بانتظار تأكيد الدفع. أكِّدوا التحويل أولاً." };
  if (edit.status === "done" || edit.status === "declined") return { ok: false, error: "أُغلق هذا الطلب بالفعل." };

  const now = new Date();
  const [done] = await db
    .update(editRequests)
    .set({ status: p.data.status, teamNote: note ?? edit.teamNote, doneAt: p.data.status === "in_progress" ? null : now, assignedTo: edit.assignedTo ?? u.id, updatedAt: now })
    .where(and(eq(editRequests.id, edit.id), eq(editRequests.status, edit.status)))
    .returning();
  if (!done) return { ok: false, error: "تغيّر الطلب للتو. حدّثوا الصفحة." };
  await logActivity(u.id, `edit.${p.data.status}`, `edit:${edit.id}`);

  if (p.data.status !== "in_progress") {
    const [req] = await db.select({ conversationId: storeRequests.conversationId, storeUrl: storeRequests.storeUrl }).from(storeRequests).where(eq(storeRequests.id, edit.requestId)).limit(1);
    const text =
      p.data.status === "done"
        ? editDoneMessage({ code: edit.code, note, storeUrl: req?.storeUrl ?? null, accountUrl: accountUrl() })
        : editDeclinedMessage({ code: edit.code, note, accountUrl: accountUrl() });
    await deliverToClient(
      { email: edit.clientEmail, conversationId: req?.conversationId ?? null },
      { key: `edit.${p.data.status}:${edit.id}`, text, subject: p.data.status === "done" ? `تم تنفيذ التعديل ${edit.code}` : `بخصوص التعديل ${edit.code}`, buttons: [{ title: "فتح حسابكم", url: accountUrl() }] }
    ).catch((e) => console.error("[edits] client notice failed", e));
  }
  refresh(edit.id);
  return { ok: true };
}

/**
 * تعليم رسوم تعديل مدفوعة يدوياً (تأكد المالك من التحويل خارج الصفحة): إن وُجد إيصال قيد المراجعة يُؤكَّد بمساره الكامل،
 * وإلا يُعلَّم الطلب مدفوعاً مباشرة ويبدأ التنفيذ.
 */
export async function markEditPaidAction(id: string): Promise<Result> {
  const u = await owner();
  if (!u) return { ok: false, error: "غير مصرح لهذا الدور." };
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, error: "بيانات غير صالحة." };
  const [edit] = await db.select().from(editRequests).where(eq(editRequests.id, id)).limit(1);
  if (!edit || edit.status !== "awaiting_payment") return { ok: false, error: "الطلب ليس بانتظار الدفع." };
  const [pay] = await db
    .select({ id: platformPayments.id })
    .from(platformPayments)
    .where(and(eq(platformPayments.editRequestId, id), inArray(platformPayments.status, ["under_review"])))
    .orderBy(desc(platformPayments.createdAt))
    .limit(1);
  try {
    if (pay) await confirmEditPayment(pay.id, u.id, "عُلِّم مدفوعاً من صندوق التعديلات");
    else {
      const now = new Date();
      const [done] = await db.update(editRequests).set({ status: "new", paidAt: now, updatedAt: now }).where(and(eq(editRequests.id, id), eq(editRequests.status, "awaiting_payment"))).returning({ id: editRequests.id });
      if (!done) return { ok: false, error: "تغيّر الطلب للتو. حدّثوا الصفحة." };
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "تعذر التعليم." };
  }
  await logActivity(u.id, "edit.marked_paid", `edit:${id}`);
  refresh(id);
  revalidatePath("/admin/payments");
  return { ok: true };
}
