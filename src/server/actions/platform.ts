"use server";

import { db } from "@/db/client";
import { platformPayments, systemEvents } from "@/db/schema";
import { getMerchantSession } from "@/server/auth";
import { allow } from "@/lib/ratelimit";
import { isTrustedUploadUrl } from "@/lib/upload-hosts";
import { normalizeEgyptianPhone } from "@/lib/phone";
import { amountFor, type PaymentKind } from "@/lib/platform-pricing";
import { canRenewNow, hostingState } from "@/lib/hosting";
import { verifyPlatformPayment } from "@/ai/verify-payment";
import { emitPaymentSubmitted } from "@/server/realtime/emitters";
import { assessReceipt } from "@/lifecycle/payment-policy";
import { notifyOwnerOfPayment } from "@/lifecycle/owner-alerts";
import { revalidatePath } from "next/cache";
import { after } from "next/server";


/** حالات المتجر التي يُقبل فيها إيصال الباقة الأولى: التجربة (ومنها مهلة ما بعد الرفض) والتجميد. */
const PAYABLE = new Set(["trial", "frozen"]);

export async function submitPlatformPaymentAction(input: {
  method: "vodafone_cash" | "instapay";
  senderPhone: string;
  screenshotUrl: string;
}) {
  try {
    // الإيصال يُرفع من صاحب المتجر نفسه، وعلى متجره النشط في الجلسة.
    const session = await getMerchantSession();
    const store = session?.store;
    if (!session || !store) {
      return { ok: false as const, error: "سجّل الدخول بحساب صاحب المتجر أولاً" };
    }
    // متجر مفعّل = تجديد سنة استضافة (قبل الانتهاء بشهرين، أو في السماح أو الإيقاف). غير ذلك = الباقة الأولى.
    let kind: PaymentKind = "setup";
    if (store.status === "active") {
      if (!canRenewNow(hostingState(store))) {
        return { ok: false as const, error: "اشتراكك سارٍ، والتجديد يُفتح قبل انتهائه بشهرين" };
      }
      kind = "renewal";
    } else if (!PAYABLE.has(store.status)) {
      return { ok: false as const, error: "متجرك ليس في مرحلة الدفع الآن" };
    }
    if (!(await allow("platformPayment", session.merchantId))) {
      return { ok: false as const, error: "محاولات كثيرة، حاول بعد قليل" };
    }
    if (input.method !== "vodafone_cash" && input.method !== "instapay") {
      return { ok: false as const, error: "وسيلة دفع غير مدعومة" };
    }

    const phone = normalizeEgyptianPhone(input.senderPhone);
    if (!phone) {
      return {
        ok: false as const,
        error: "اكتب الرقم الذي حوّلت منه صحيحاً (11 رقماً يبدأ بـ 01)",
      };
    }

    if (!isTrustedUploadUrl(input.screenshotUrl)) {
      return { ok: false as const, error: "ارفع صورة الإيصال من الصفحة نفسها" };
    }
    const url = new URL(input.screenshotUrl);

    const requiredAmountEgp = amountFor(kind);
    const requiredAmountPiasters = requiredAmountEgp * 100;

    const [paymentRecord] = await db
      .insert(platformPayments)
      .values({
        storeId: store.id,
        method: input.method,
        kind,
        amountPiasters: requiredAmountPiasters,
        senderPhone: phone,
        screenshotUrl: url.toString(),
      })
      .returning({ id: platformPayments.id });

    await db.insert(systemEvents).values({
      scope: "payment",
      storeId: store.id,
      actor: `merchant:${session.merchantId}`,
      message: `${kind === "renewal" ? "تجديد استضافة" : "تحويل جديد للمنصة"} بقيمة ${requiredAmountEgp} ج.م من متجر ${store.subdomain}`,
    });

    if (paymentRecord?.id) {
      // حدث Pusher: إيصال جديد بانتظار المراجعة.
      void emitPaymentSubmitted({
        paymentId: paymentRecord.id,
        storeId: store.id,
        amountPiasters: requiredAmountPiasters,
        method: input.method,
        senderPhone: phone,
        screenshotUrl: url.toString(),
        submittedAt: new Date().toISOString(),
      });

      // قرار المالك: لا قبول آلي. الفحص الآلي يجري في الخلفية ليكتب للمالك خلاصة، ويصله بريد فوري
      // برابط المراجعة؛ وبمجرد أن يقبل يُفعَّل المتجر ويصل التاجر بريد التفعيل (confirmStorePayment).
      const paymentId = paymentRecord.id;
      after(async () => {
        const verification = await verifyPlatformPayment(paymentId).catch(() => null);
        await notifyOwnerOfPayment({
          paymentId,
          storeName: store.name,
          subdomain: store.subdomain,
          method: input.method,
          senderPhone: phone,
          amountEgp: requiredAmountEgp,
          kind,
          screenshotUrl: url.toString(),
          assessment: assessReceipt(verification, requiredAmountEgp),
        }).catch((e) => console.error("[submitPlatformPaymentAction] owner alert failed:", e));
      });
      revalidatePath("/dashboard", "layout");
    }
    return { ok: true as const };
  } catch (e) {
    const err = e as { code?: string; cause?: { code?: string } };
    if (err?.code === "23505" || err?.cause?.code === "23505") {
      return {
        ok: false as const,
        error: "لديك إيصال قيد المراجعة بالفعل، وسنبلغك فور قبوله.",
      };
    }
    // eslint-disable-next-line no-console
    console.error("[submitPlatformPaymentAction] Error:", e);
    return {
      ok: false as const,
      error: "حدث خطأ أثناء تسجيل التحويل، حاول مجدداً",
    };
  }
}