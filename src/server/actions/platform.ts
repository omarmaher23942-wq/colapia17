"use server";

import { db } from "@/db/client";
import { platformPayments, systemEvents } from "@/db/schema";
import { getMerchantSession } from "@/server/auth";
import { allow } from "@/lib/ratelimit";
import { isTrustedUploadUrl } from "@/lib/upload-hosts";
import { normalizeEgyptianPhone } from "@/lib/phone";
import { env } from "@/lib/env";
import { verifyPlatformPayment } from "@/ai/verify-payment";
import { emitPaymentSubmitted } from "@/server/realtime/emitters";
import { assessReceipt } from "@/lifecycle/payment-policy";
import { notifyOwnerOfPayment } from "@/lifecycle/owner-alerts";
import { revalidatePath } from "next/cache";
import { after } from "next/server";


export async function submitPlatformPaymentAction(
  subdomain: string,
  input: {
    method: "vodafone_cash" | "instapay";
    senderPhone: string;
    screenshotUrl: string;
  }
) {
  try {
    // الإيصال يُرفع فقط من صاحب المتجر نفسه، وعلى متجر يملكه.
    const session = await getMerchantSession();
    const store = session?.stores.find(
      (x) => x.subdomain.toLowerCase() === String(subdomain ?? "").toLowerCase()
    );
    if (!session || !store) {
      return { ok: false as const, error: "سجّل الدخول بحساب صاحب المتجر أولاً" };
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
        error: "رقم الموبايل المحول منه غير صحيح",
      };
    }

    if (!isTrustedUploadUrl(input.screenshotUrl)) {
      return { ok: false as const, error: "مصدر الصورة غير آمن أو غير صالح" };
    }
    const url = new URL(input.screenshotUrl);

    const requiredAmountEgp = env.PLATFORM_PRICE_EGP || 899;
    const requiredAmountPiasters = requiredAmountEgp * 100;

    const [paymentRecord] = await db
      .insert(platformPayments)
      .values({
        storeId: store.id,
        method: input.method,
        amountPiasters: requiredAmountPiasters,
        senderPhone: phone,
        screenshotUrl: url.toString(),
      })
      .returning({ id: platformPayments.id });

    await db.insert(systemEvents).values({
      scope: "payment",
      storeId: store.id,
      actor: `merchant:${session.merchantId}`,
      message: `تحويل جديد للمنصة بقيمة ${requiredAmountEgp} ج.م من متجر ${store.subdomain}`,
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
          screenshotUrl: url.toString(),
          assessment: assessReceipt(verification, requiredAmountEgp),
        }).catch((e) => console.error("[submitPlatformPaymentAction] owner alert failed:", e));
      });
      revalidatePath("/dashboard", "layout");
      return {
        ok: true as const,
        activated: false as const,
        message: "استلمنا إيصالك. نراجعه الآن يدوياً، وسيصلك بريد فور تفعيل متجرك.",
      };
    }

    return { ok: true as const };
  } catch (e) {
    const err = e as { code?: string; cause?: { code?: string } };
    if (err?.code === "23505" || err?.cause?.code === "23505") {
      return {
        ok: false as const,
        error: "لديك إيصال قيد المراجعة بالفعل. سنخبرك فور تأكيده.",
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