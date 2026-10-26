"use server";
// activation.ts — «تفعيل الموقع» (V5): الدفع بعد أن يعجب العميلَ المتجرُ المعاين. من لوحة المتجر نفسها، لصاحب المتجر وحده.
// المبلغ من الخادم وحده (الدائرة الذهبية متى بقي مقعد وإلا السعر العادي)، ويُربط الدفع بطلب البناء الخاص بالمتجر
// (store_requests.store_id) فينشأ الطلب هنا إن لم يكن الوكيل قد أنشأه. التأكيد من المالك (lifecycle/payments.ts).
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { platformPayments, storeRequests } from "@/db/schema";
import { ownerStore } from "@/server/merchant-guard";
import { allow } from "@/lib/ratelimit";
import { isTrustedUploadUrl } from "@/lib/upload-hosts";
import { normalizeEgyptianPhone } from "@/lib/phone";
import { dbErrorInfo, PG_UNIQUE } from "@/lib/db-errors";
import { newRequestCode } from "@/lib/ids";
import { currentProjectQuote } from "@/server/pricing";
import { verifyPlatformPayment } from "@/ai/verify-payment";
import { assessReceipt } from "@/lifecycle/payment-policy";
import { notifyOwnerOfPayment } from "@/lifecycle/owner-alerts";
import { derivedToken, hashToken, randomToken } from "@/golden/tokens";

const PAYABLE = new Set(["trial", "frozen"]);

export async function submitActivationPaymentAction(input: { method: "vodafone_cash" | "instapay"; senderPhone: string; screenshotUrl: string; expectedOffer?: string }) {
  const session = await ownerStore({ allowLocked: true });
  const store = session?.store;
  if (!session || !store) return { ok: false as const, error: "الدفع لصاحب المتجر فقط. يلزم الدخول بحسابه." };
  if (!PAYABLE.has(store.status)) return { ok: false as const, error: "المتجر ليس في مرحلة الدفع الآن." };
  if (!(await allow("platformPayment", session.merchantId))) return { ok: false as const, error: "محاولات كثيرة، يمكن المحاولة بعد قليل." };
  if (input.method !== "vodafone_cash" && input.method !== "instapay") return { ok: false as const, error: "وسيلة دفع غير مدعومة." };
  const phone = normalizeEgyptianPhone(input.senderPhone);
  if (!phone) return { ok: false as const, error: "الرقم الذي تم التحويل منه غير صحيح (11 رقماً يبدأ بـ 01)." };
  if (!isTrustedUploadUrl(input.screenshotUrl)) return { ok: false as const, error: "صورة الإيصال تُرفع من الصفحة نفسها." };

  const quote = await currentProjectQuote();
  if (input.expectedOffer && input.expectedOffer !== quote.offer) return { ok: false as const, error: "تغيّر السعر المتاح. حدّثوا الصفحة قبل التحويل." };

  // طلب البناء الخاص بالمتجر (من الوكيل)، وإلا يُنشأ الآن.
  let [req] = await db.select().from(storeRequests).where(eq(storeRequests.storeId, store.id)).orderBy(desc(storeRequests.createdAt)).limit(1);
  if (!req) {
    const token = randomToken();
    [req] = await db
      .insert(storeRequests)
      .values({ code: newRequestCode(), draftTokenHash: hashToken(token), source: "agent", conversationId: store.sourceConversationId, storeId: store.id, merchantId: store.merchantId, storeName: store.name, email: session.merchant.email, status: "awaiting_payment", submittedAt: new Date(), expiresAt: new Date(Date.now() + 365 * 86_400_000) })
      .returning();
  }
  if (!req) return { ok: false as const, error: "تعذر تسجيل الطلب." };
  await db
    .update(storeRequests)
    .set({ offer: quote.offer, status: "awaiting_payment", email: req.email ?? session.merchant.email, storeName: req.storeName ?? store.name, trackTokenHash: hashToken(derivedToken("track", req.id)), updatedAt: new Date() })
    .where(and(eq(storeRequests.id, req.id), eq(storeRequests.status, "awaiting_payment")))
    .catch(() => {});

  try {
    const [pay] = await db
      .insert(platformPayments)
      .values({ kind: "project", plan: quote.offer, storeId: store.id, requestId: req.id, method: input.method, amountPiasters: quote.price * 100, senderPhone: phone, screenshotUrl: input.screenshotUrl })
      .returning({ id: platformPayments.id });
    const paymentId = pay!.id;
    after(async () => {
      const v = await verifyPlatformPayment(paymentId).catch(() => null);
      await notifyOwnerOfPayment({ paymentId, kind: "project", title: store.name, clientEmail: session.merchant.email ?? "", method: input.method, senderPhone: phone, amountEgp: quote.price, offer: quote.offer, screenshotUrl: input.screenshotUrl, assessment: assessReceipt(v, quote.price) }).catch(() => {});
    });
  } catch (e) {
    if (dbErrorInfo(e).code === PG_UNIQUE) return { ok: false as const, error: "لديكم إيصال قيد المراجعة بالفعل، وسنبلغكم فور قبوله." };
    throw e;
  }
  revalidatePath("/dashboard", "layout");
  return { ok: true as const };
}
