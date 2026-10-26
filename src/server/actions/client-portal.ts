"use server";
// client-portal.ts — إجراءات بوابة العميل: طلب تعديل بعد التسليم (مجاني واحد داخل النافذة وإلا برسوم بإيصال تحويل)،
// وإرسال إيصال جديد لتعديل رُفض إيصاله. كل إجراء: جلسة العميل ← ملكية المشروع من القاعدة (merchant_id) ← المبلغ والأهلية
// من الخادم وحده (editTerms) ← كتابة مشروطة. المبلغ لا يأتي من المتصفح أبداً.
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { editRequests, platformPayments, storeRequests } from "@/db/schema";
import { getMerchantSession } from "@/server/auth";
import { hit } from "@/lib/rate-hit";
import { dbErrorInfo, PG_UNIQUE } from "@/lib/db-errors";
import { newEditCode } from "@/lib/ids";
import { isTrustedUploadUrl } from "@/lib/upload-hosts";
import { normalizeEgyptianPhone } from "@/lib/phone";
import { editTerms, fmtEgp } from "@/lib/platform-pricing";
import { currentPricing } from "@/server/pricing";
import { freeEditUsed } from "@/server/repos/edit-requests";
import { verifyPlatformPayment } from "@/ai/verify-payment";
import { assessReceipt } from "@/lifecycle/payment-policy";
import { notifyOwnerOfPayment } from "@/lifecycle/owner-alerts";
import { accountUrl, deliverToClient, platformOrigin } from "@/agency/client-notify";
import { emailMembers, managerIds } from "@/agency/notify";
import { editReceivedMessage } from "@/agent/handoff-messages";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const fileSchema = z.object({ url: z.string().url().max(500), name: z.string().trim().max(120) });
const paySchema = z.object({ method: z.enum(["vodafone_cash", "instapay"]), senderPhone: z.string().max(30), receiptUrl: z.string().url().max(500) });
const submitSchema = z.object({
  requestId: z.string().uuid(),
  title: z.string().trim().min(3, "اكتبوا عنواناً قصيراً للتعديل.").max(120),
  details: z.string().trim().min(10, "اشرحوا المطلوب بالتفصيل (10 أحرف على الأقل).").max(6000),
  files: z.array(fileSchema).max(6).default([]),
  payment: paySchema.optional(),
});

async function mine(requestId: string) {
  const session = await getMerchantSession();
  if (!session) return null;
  const [req] = await db
    .select()
    .from(storeRequests)
    .where(and(eq(storeRequests.id, requestId), eq(storeRequests.merchantId, session.merchantId), eq(storeRequests.status, "submitted")))
    .limit(1);
  return req ? { session, req } : null;
}

function checkPayment(p: z.infer<typeof paySchema>): { ok: true; phone: string } | { ok: false; error: string } {
  const phone = normalizeEgyptianPhone(p.senderPhone);
  if (!phone) return { ok: false, error: "الرقم الذي تم التحويل منه غير صحيح (11 رقماً يبدأ بـ 01)." };
  if (!isTrustedUploadUrl(p.receiptUrl)) return { ok: false, error: "صورة الإيصال تُرفع من الصفحة نفسها." };
  return { ok: true, phone };
}

export async function submitEditRequestAction(raw: z.input<typeof submitSchema>): Promise<Result<{ id: string; free: boolean }>> {
  const p = submitSchema.safeParse(raw);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "بيانات غير صالحة." };
  const found = await mine(p.data.requestId);
  if (!found) return { ok: false, error: "المشروع غير موجود في حسابكم." };
  const { session, req } = found;
  if (!(await hit(`client:edit:${session.merchantId}`, 12, 86_400))) return { ok: false, error: "طلبات كثيرة اليوم. راسلونا إن كان الأمر عاجلاً." };
  if (p.data.files.some((f) => !isTrustedUploadUrl(f.url))) return { ok: false, error: "الملفات تُرفع من الصفحة نفسها." };

  const pricing = await currentPricing();
  const terms = editTerms(pricing, { deliveredAt: req.deliveredAt, freeEditUntil: req.freeEditUntil, freeUsed: await freeEditUsed(req.id) });
  if (!terms.ok) return terms;
  const free = terms.free;
  let pay: { phone: string; method: "vodafone_cash" | "instapay"; receiptUrl: string } | null = null;
  if (!free) {
    if (!p.data.payment) return { ok: false, error: `هذا التعديل برسوم ${fmtEgp(terms.fee)} ج. حوّلوا المبلغ وارفعوا الإيصال لنبدأ.` };
    const c = checkPayment(p.data.payment);
    if (!c.ok) return c;
    pay = { phone: c.phone, method: p.data.payment.method, receiptUrl: p.data.payment.receiptUrl };
  }

  const email = (req.email ?? session.merchant.email ?? "").toLowerCase();
  let editId: string | null = null;
  let code = "";
  for (let attempt = 0; attempt < 3 && !editId; attempt++) {
    code = newEditCode();
    try {
      const [row] = await db
        .insert(editRequests)
        .values({
          code,
          requestId: req.id,
          merchantId: session.merchantId,
          clientEmail: email,
          title: p.data.title,
          details: p.data.details,
          files: p.data.files,
          status: free ? "new" : "awaiting_payment",
          isFree: free,
          feePiasters: free ? 0 : terms.fee * 100,
        })
        .returning({ id: editRequests.id });
      editId = row!.id;
    } catch (e) {
      const info = dbErrorInfo(e);
      if (info.code === PG_UNIQUE && info.constraint === "edit_requests_one_free_uq") return { ok: false, error: "استُهلك التعديل المجاني لهذا المشروع. يمكنكم طلب تعديل برسوم." };
      if (info.code === PG_UNIQUE && info.constraint === "edit_requests_code_uq") continue;
      throw e;
    }
  }
  if (!editId) return { ok: false, error: "تعذر تسجيل الطلب. حاولوا مرة أخرى." };

  if (pay && !free) {
    const amountEgp = terms.fee;
    try {
      const [pr] = await db
        .insert(platformPayments)
        .values({ kind: "edit", plan: "standard", requestId: req.id, editRequestId: editId, method: pay.method, amountPiasters: amountEgp * 100, senderPhone: pay.phone, screenshotUrl: pay.receiptUrl })
        .returning({ id: platformPayments.id });
      const paymentId = pr!.id;
      after(async () => {
        const verification = await verifyPlatformPayment(paymentId).catch(() => null);
        await notifyOwnerOfPayment({ paymentId, kind: "edit", title: p.data.title, clientEmail: email, method: pay.method, senderPhone: pay.phone, amountEgp, screenshotUrl: pay.receiptUrl, assessment: assessReceipt(verification, amountEgp) }).catch((e) => console.error("[client-portal] owner alert failed", e));
      });
    } catch (e) {
      await db.delete(editRequests).where(eq(editRequests.id, editId));
      throw e;
    }
  } else {
    const id = editId;
    after(async () => {
      await emailMembers(await managerIds(), { subject: `طلب تعديل جديد ${code}`, headline: "طلب تعديل مجاني", lines: [`${req.storeName ?? req.code}: ${p.data.title}`], requestId: req.id, href: `${platformOrigin()}/admin/edits/${id}` }).catch(() => 0);
    });
  }

  after(() =>
    deliverToClient(
      { email, conversationId: req.conversationId },
      { key: `edit.received:${editId}`, text: editReceivedMessage({ code, free, feeEgp: terms.fee, accountUrl: accountUrl() }), subject: `استلمنا طلب التعديل ${code}`, buttons: [{ title: "متابعة الطلب", url: `${accountUrl()}/history` }] }
    ).catch(() => undefined)
  );
  revalidatePath("/dashboard", "layout");
  revalidatePath("/admin/edits");
  return { ok: true, id: editId, free };
}

const receiptSchema = z.object({ editId: z.string().uuid(), payment: paySchema });

/** إيصال جديد لتعديل رُفض إيصاله السابق (التعديل ما زال بانتظار الدفع). */
export async function resubmitEditReceiptAction(raw: z.input<typeof receiptSchema>): Promise<Result> {
  const p = receiptSchema.safeParse(raw);
  if (!p.success) return { ok: false, error: "بيانات غير صالحة." };
  const session = await getMerchantSession();
  if (!session) return { ok: false, error: "سجّلوا الدخول أولاً." };
  const [edit] = await db.select().from(editRequests).where(and(eq(editRequests.id, p.data.editId), eq(editRequests.merchantId, session.merchantId), eq(editRequests.status, "awaiting_payment"))).limit(1);
  if (!edit) return { ok: false, error: "الطلب غير موجود أو ليس بانتظار الدفع." };
  if (!(await hit(`client:receipt:${session.merchantId}`, 8, 86_400))) return { ok: false, error: "محاولات كثيرة اليوم." };
  const c = checkPayment(p.data.payment);
  if (!c.ok) return c;
  const amountEgp = Math.round(edit.feePiasters / 100);
  try {
    const [pr] = await db
      .insert(platformPayments)
      .values({ kind: "edit", plan: "standard", requestId: edit.requestId, editRequestId: edit.id, method: p.data.payment.method, amountPiasters: edit.feePiasters, senderPhone: c.phone, screenshotUrl: p.data.payment.receiptUrl })
      .returning({ id: platformPayments.id });
    const paymentId = pr!.id;
    after(async () => {
      const verification = await verifyPlatformPayment(paymentId).catch(() => null);
      await notifyOwnerOfPayment({ paymentId, kind: "edit", title: edit.title, clientEmail: edit.clientEmail, method: p.data.payment.method, senderPhone: c.phone, amountEgp, screenshotUrl: p.data.payment.receiptUrl, assessment: assessReceipt(verification, amountEgp) }).catch(() => {});
    });
  } catch (e) {
    if (dbErrorInfo(e).code === PG_UNIQUE) return { ok: false, error: "لديكم إيصال قيد المراجعة بالفعل." };
    throw e;
  }
  revalidatePath("/dashboard", "layout");
  revalidatePath("/admin/payments");
  return { ok: true };
}
