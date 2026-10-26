import "server-only";
// payments.ts — قرارات المالك على تحويلات العملاء (V4): حجز مشروع (الدائرة الذهبية أو العادي) ورسوم تعديل بعد التسليم.
// لا قبول آلي: كل إيصال يراجعه المالك. كل كتابة مشروطة بالحالة الحالية (لا معاملات تفاعلية في neon-http)، وأي فشل بعد
// «حجز» الدفعة يعيدها قيد المراجعة فلا تبقى معلقة بين حالتين.
import { and, count, eq, ne } from "drizzle-orm";
import { db } from "@/db/client";
import { conversations, editRequests, platformPayments, storeRequestEvents, storeRequests, stores } from "@/db/schema";
import { transition } from "@/lifecycle/machine";
import { freeEditDeadline } from "@/lib/platform-pricing";
import { goldenAvailability } from "@/lib/platform-pricing";
import { currentPricing } from "@/server/pricing";
import { accountUrl, deliverToClient, platformOrigin } from "@/agency/client-notify";
import { ensureClientMerchant } from "@/agency/client-account";
import { emailMembers, managerIds } from "@/agency/notify";
import { logActivity } from "@/agency/activity";
import { derivedToken } from "@/golden/tokens";
import { activationConfirmedMessage, bookingRejectedMessage, editPaidMessage, paymentConfirmedMessage } from "@/agent/handoff-messages";

type Payment = typeof platformPayments.$inferSelect;

async function revert(paymentId: string) {
  await db.update(platformPayments).set({ status: "under_review", reviewedBy: null, reviewedAt: null, reviewNote: null }).where(eq(platformPayments.id, paymentId));
}

/** يحجز الدفعة للقرار: ينجح لقرار واحد فقط ولو ضغط مراجعان معاً. */
async function claim(paymentId: string, to: "confirmed" | "rejected", reviewerId: string, note?: string): Promise<Payment> {
  const [pay] = await db
    .update(platformPayments)
    .set({ status: to, reviewedBy: reviewerId, reviewedAt: new Date(), reviewNote: note?.trim() || null })
    .where(and(eq(platformPayments.id, paymentId), eq(platformPayments.status, "under_review")))
    .returning();
  if (!pay) throw new Error("الدفعة رُوجعت من قبل أو غير موجودة");
  return pay;
}

const event = (requestId: string, v: Partial<typeof storeRequestEvents.$inferInsert>) =>
  db.insert(storeRequestEvents).values({ requestId, type: "payment", actor: "system", ...v }).catch((e) => console.error("[payments] event failed", e));

/** عدد الحجوزات الذهبية المؤكَّدة غير هذه الدفعة. */
async function otherGoldenConfirmed(paymentId: string): Promise<number> {
  const [r] = await db
    .select({ n: count() })
    .from(platformPayments)
    .where(and(eq(platformPayments.kind, "project"), eq(platformPayments.plan, "golden"), eq(platformPayments.status, "confirmed"), ne(platformPayments.id, paymentId)));
  return Number(r?.n ?? 0);
}

/**
 * تأكيد حجز مشروع: ينقل الطلب إلى الإنتاج («جديد») ويُنقص عدّاد الدائرة الذهبية (المقعد يُحسب بالتأكيد وحده)، وينشئ
 * حساب العميل ببريد الحجز، ويرسل له «تم التأكيد وحجز المقعد، والتجهيز خلال 48 ساعة» بالبريد وبرسالة ميتا إن عُرفت المحادثة.
 */
export async function confirmProjectPayment(paymentId: string, reviewerId: string, note?: string): Promise<{ ok: true }> {
  const pay = await claim(paymentId, "confirmed", reviewerId, note);
  const fail = async (msg: string): Promise<never> => {
    await revert(paymentId);
    throw new Error(msg);
  };
  if (pay.kind !== "project" || !pay.requestId) return fail("هذه ليست دفعة حجز مشروع");
  const [req] = await db.select().from(storeRequests).where(eq(storeRequests.id, pay.requestId)).limit(1);
  if (!req) return fail("الحجز غير موجود");
  if (req.status !== "awaiting_payment") return fail(`حالة الحجز (${req.status}) لا تسمح بالتأكيد`);
  const email = req.email;
  if (!email) return fail("لا بريد على الحجز");

  if (pay.plan === "golden") {
    const g = (await currentPricing()).golden;
    const taken = await otherGoldenConfirmed(paymentId);
    if (!goldenAvailability(g, taken).available) {
      return fail(`اكتملت مقاعد الدائرة الذهبية (${g.seats}). ارفضوا الدفعة أو زيدوا المقاعد من صفحة الأسعار`);
    }
  }

  // V5: الدفع من لوحة المتجر المعاينة («تفعيل الموقع»): المتجر يعود/يبقى فعّالاً كما كان تماماً (قبل التجميد أو بعده)،
  // ويدخل المشروع حالة التسليم وتبدأ نافذة التعديل المجاني من لحظة التأكيد.
  if (pay.storeId) {
    const now = new Date();
    const [store] = await db.select().from(stores).where(eq(stores.id, pay.storeId)).limit(1);
    if (!store) return fail("المتجر غير موجود");
    let cur = store.status;
    if (cur === "deleted") {
      const r = await transition({ storeId: store.id, to: "frozen", from: ["deleted"], actor: `owner:${reviewerId}`, set: { deletedAt: null }, reason: "payment_after_delete", data: { paymentId } });
      if (!r.ok) return fail("تعذّر استرجاع المتجر المحذوف");
      cur = "frozen";
    }
    if (cur !== "active") {
      const r = await transition({
        storeId: store.id,
        to: "active",
        from: ["trial", "frozen"],
        actor: `owner:${reviewerId}`,
        set: { activatedAt: store.activatedAt ?? now, plan: pay.plan === "golden" ? "golden" : "standard", hostingExpiresAt: null, frozenAt: null, purgeAt: null, doomAt: null },
        reason: "payment_confirmed",
        data: { paymentId },
      });
      if (!r.ok) return fail(`حالة المتجر الحالية (${r.current ?? cur}) لا تسمح بالتفعيل`);
    }
    const until = freeEditDeadline(now, (await currentPricing()).edit.freeDays);
    const [moved] = await db
      .update(storeRequests)
      .set({ status: "submitted", production: "delivered", productionChangedAt: now, confirmedAt: now, deliveredAt: now, freeEditUntil: until, merchantId: store.merchantId, updatedAt: now })
      .where(and(eq(storeRequests.id, req.id), eq(storeRequests.status, "awaiting_payment")))
      .returning({ id: storeRequests.id });
    if (!moved) return fail("تغيّرت حالة الحجز قبل قليل");
    await event(req.id, { actor: `platform:${reviewerId}`, internalNote: `أُكِّد التحويل (${Math.round(pay.amountPiasters / 100)} ج): المتجر فعّال والمشروع في التسليم` });
    await logActivity(reviewerId, "payment.confirmed", `request:${req.id}`, { paymentId, offer: pay.plan, storeId: store.id });
    await db.update(conversations).set({ stage: "activated", updatedAt: now }).where(eq(conversations.storeId, store.id)).catch(() => {});
    await deliverToClient(
      { email, conversationId: req.conversationId ?? store.sourceConversationId ?? null },
      { key: `payment.confirmed:${paymentId}`, text: activationConfirmedMessage({ storeName: store.name, offer: pay.plan === "golden" ? "golden" : "standard", accountUrl: accountUrl() }), subject: "تم تأكيد الدفع وتفعيل موقعكم", buttons: [{ title: "فتح لوحة التحكم", url: accountUrl() }] }
    ).catch((e) => console.error("[payments] activation notice failed", e));
    return { ok: true };
  }

  const now = new Date();
  const merchantId = await ensureClientMerchant({ email, name: req.storeName ?? "", phone: req.whatsapp });
  const [moved] = await db
    .update(storeRequests)
    .set({ status: "submitted", production: "new", productionChangedAt: now, confirmedAt: now, merchantId, slaAlertedAt: null, seenAt: null, updatedAt: now })
    .where(and(eq(storeRequests.id, req.id), eq(storeRequests.status, "awaiting_payment")))
    .returning({ id: storeRequests.id });
  if (!moved) return fail("تغيّرت حالة الحجز قبل قليل");

  await event(req.id, { actor: `platform:${reviewerId}`, internalNote: `أُكِّد التحويل (${Math.round(pay.amountPiasters / 100)} ج) ودخل الحجز الإنتاج` });
  await logActivity(reviewerId, "payment.confirmed", `request:${req.id}`, { paymentId, offer: pay.plan });
  if (req.conversationId) await db.update(conversations).set({ stage: "activated", updatedAt: now }).where(eq(conversations.id, req.conversationId)).catch(() => {});

  const text = paymentConfirmedMessage({ storeName: req.storeName ?? "", offer: pay.plan === "golden" ? "golden" : "standard", accountUrl: accountUrl() });
  await deliverToClient(
    { email, conversationId: req.conversationId },
    { key: `payment.confirmed:${paymentId}`, text, subject: "تم تأكيد طلبكم وحجز مقعدكم", buttons: [{ title: "متابعة المشروع", url: accountUrl() }] }
  ).catch((e) => console.error("[payments] client notice failed", e));

  // الفريق: مشروع جديد في الإنتاج.
  await emailMembers(await managerIds(), {
    subject: `حجز مؤكد: ${req.code}`,
    headline: "مشروع جديد في الإنتاج",
    lines: [`أُكِّد دفع «${req.storeName ?? req.code}» (${req.code}). أسندوه لمنفّذ ليبدأ خلال 48 ساعة.`],
    requestId: req.id,
  }).catch(() => 0);
  return { ok: true };
}

/** تأكيد رسوم تعديل: يبدأ التنفيذ ويصل العميل بريد التأكيد. */
export async function confirmEditPayment(paymentId: string, reviewerId: string, note?: string): Promise<{ ok: true }> {
  const pay = await claim(paymentId, "confirmed", reviewerId, note);
  const fail = async (msg: string): Promise<never> => {
    await revert(paymentId);
    throw new Error(msg);
  };
  if (pay.kind !== "edit" || !pay.editRequestId) return fail("هذه ليست دفعة تعديل");
  const now = new Date();
  const [edit] = await db
    .update(editRequests)
    .set({ status: "new", paidAt: now, updatedAt: now })
    .where(and(eq(editRequests.id, pay.editRequestId), eq(editRequests.status, "awaiting_payment")))
    .returning();
  if (!edit) return fail("طلب التعديل ليس بانتظار الدفع");
  await logActivity(reviewerId, "payment.edit_confirmed", `edit:${edit.id}`, { paymentId });
  const [req] = await db.select({ conversationId: storeRequests.conversationId }).from(storeRequests).where(eq(storeRequests.id, edit.requestId)).limit(1);
  await deliverToClient(
    { email: edit.clientEmail, conversationId: req?.conversationId ?? null },
    { key: `edit.paid:${paymentId}`, text: editPaidMessage({ code: edit.code, accountUrl: accountUrl() }), subject: `تأكيد رسوم التعديل ${edit.code}`, buttons: [{ title: "متابعة المشروع", url: accountUrl() }] }
  ).catch((e) => console.error("[payments] edit notice failed", e));
  return { ok: true };
}

/** يقرر حسب نوع الدفعة (الصفحة تنادي واحدة). */
export async function confirmPayment(paymentId: string, reviewerId: string, note?: string): Promise<{ ok: true }> {
  const [p] = await db.select({ kind: platformPayments.kind }).from(platformPayments).where(eq(platformPayments.id, paymentId)).limit(1);
  if (!p) throw new Error("الدفعة غير موجودة");
  if (p.kind === "project") return confirmProjectPayment(paymentId, reviewerId, note);
  if (p.kind === "edit") return confirmEditPayment(paymentId, reviewerId, note);
  throw new Error("دفعة قديمة من نموذج الاستضافة؛ لا تُؤكَّد من هنا");
}

/**
 * رفض الإيصال بسبب يصل للعميل. الحجز يبقى بانتظار الدفع، ويفتح له زر «أرسلوا إيصالاً جديداً» في صفحة المتابعة.
 * رفض رسوم تعديل يعيده «بانتظار الدفع» ليرسل إيصالاً آخر من حسابه.
 */
export async function rejectPayment(paymentId: string, reviewerId: string, note?: string): Promise<{ ok: true }> {
  const reason = note?.trim() || "لم نتمكن من التحقق من التحويل";
  const pay = await claim(paymentId, "rejected", reviewerId, reason);
  await logActivity(reviewerId, "payment.rejected", pay.requestId ? `request:${pay.requestId}` : null, { paymentId, kind: pay.kind });
  if (pay.kind === "project" && pay.requestId) {
    const [req] = await db.select().from(storeRequests).where(eq(storeRequests.id, pay.requestId)).limit(1);
    if (req?.email) {
      await event(req.id, { actor: `platform:${reviewerId}`, internalNote: `رُفض الإيصال: ${reason}`, clientNote: reason });
      await deliverToClient(
        { email: req.email, conversationId: req.conversationId },
        { key: `payment.rejected:${paymentId}`, text: bookingRejectedMessage({ storeName: req.storeName ?? "", reason }), subject: "بخصوص إيصال التحويل", buttons: [{ title: "إرسال إيصال جديد", url: pay.storeId ? `${platformOrigin()}/dashboard/billing` : `${platformOrigin()}/golden/done/${derivedToken("track", req.id)}` }] }
      ).catch(() => {});
    }
  } else if (pay.kind === "edit" && pay.editRequestId) {
    const [edit] = await db.select().from(editRequests).where(eq(editRequests.id, pay.editRequestId)).limit(1);
    if (edit) {
      await deliverToClient(
        { email: edit.clientEmail, conversationId: null },
        { key: `edit.rejected:${paymentId}`, text: bookingRejectedMessage({ storeName: edit.title, reason }), subject: "بخصوص إيصال رسوم التعديل", buttons: [{ title: "فتح حسابكم", url: accountUrl() }] }
      ).catch(() => {});
    }
  }
  return { ok: true };
}

/**
 * إلغاء دفعة قُبلت ثم تبيّن أن التحويل لم يصل. للحجز: ممكن ما دام الطلب لم يُسند بعد («جديد»)؛ يعود بانتظار الدفع
 * وينقص العدّاد تلقائياً (لأنه يُحسب من الدفعات المؤكدة). بعد بدء التنفيذ يُحسم مع العميل خارج النظام.
 */
export async function revokePayment(paymentId: string, reviewerId: string, note: string): Promise<{ ok: true }> {
  const [pay] = await db.select().from(platformPayments).where(eq(platformPayments.id, paymentId)).limit(1);
  if (!pay || pay.status !== "confirmed") throw new Error("الدفعة ليست مؤكدة");
  if (pay.kind === "project" && pay.requestId) {
    const [req] = await db.select().from(storeRequests).where(eq(storeRequests.id, pay.requestId)).limit(1);
    if (!req) throw new Error("الحجز غير موجود");
    if (req.production !== "new" || req.builderId) throw new Error("بدأ العمل على المشروع؛ تواصلوا مع العميل بدل الإلغاء");
    const [back] = await db
      .update(storeRequests)
      .set({ status: "awaiting_payment", updatedAt: new Date() })
      .where(and(eq(storeRequests.id, req.id), eq(storeRequests.status, "submitted"), eq(storeRequests.production, "new")))
      .returning({ id: storeRequests.id });
    if (!back) throw new Error("تغيّرت حالة الحجز قبل قليل");
    await event(req.id, { actor: `platform:${reviewerId}`, internalNote: `أُلغي التأكيد: ${note}`, clientNote: note });
  } else if (pay.kind === "edit" && pay.editRequestId) {
    const [back] = await db
      .update(editRequests)
      .set({ status: "awaiting_payment", paidAt: null, updatedAt: new Date() })
      .where(and(eq(editRequests.id, pay.editRequestId), eq(editRequests.status, "new")))
      .returning({ id: editRequests.id });
    if (!back) throw new Error("بدأ تنفيذ التعديل أو تغيّرت حالته");
  } else {
    throw new Error("دفعة قديمة من نموذج الاستضافة؛ لا تُلغى من هنا");
  }
  await db
    .update(platformPayments)
    .set({ status: "rejected", reviewedBy: reviewerId, reviewedAt: new Date(), reviewNote: note })
    .where(and(eq(platformPayments.id, paymentId), eq(platformPayments.status, "confirmed")));
  await logActivity(reviewerId, "payment.revoked", pay.requestId ? `request:${pay.requestId}` : null, { paymentId, note });
  return { ok: true };
}
