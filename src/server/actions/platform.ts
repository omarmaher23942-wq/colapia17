"use server";

import { db } from "@/db/client";
import { platformPayments, systemEvents } from "@/db/schema";
import { ownerStore } from "@/server/merchant-guard";
import { allow } from "@/lib/ratelimit";
import { isTrustedUploadUrl } from "@/lib/upload-hosts";
import { normalizeEgyptianPhone } from "@/lib/phone";
import { isPlanMonths, type PaymentKind, type PaymentPlan } from "@/lib/platform-pricing";
import { amountFor, resolveCoupon } from "@/server/pricing";
import { canRenewNow, hostingState } from "@/lib/hosting";
import { verifyPlatformPayment } from "@/ai/verify-payment";
import { emitPaymentSubmitted } from "@/server/realtime/emitters";
import { assessReceipt } from "@/lifecycle/payment-policy";
import { notifyOwnerOfPayment } from "@/lifecycle/owner-alerts";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { hostingGraceDays } from "@/server/hosting-grace";


/** حالات المتجر التي يُقبل فيها إيصال الباقة الأولى: التجربة (ومنها مهلة ما بعد الرفض) والتجميد. */
const PAYABLE = new Set(["trial", "frozen"]);

/** يتحقق من كود عرض قبل الدفع ويعيد السعر بعده (للعرض في صفحة الدفع؛ الخادم يعيد التحقق عند الإرسال). */
export async function checkCouponAction(raw: string): Promise<{ ok: true; code: string; price: number; months: number } | { ok: false; error: string }> {
  const session = await ownerStore();
  if (!session?.store) return { ok: false, error: "الدفع لصاحب المتجر فقط." };
  if (!PAYABLE.has(session.store.status)) return { ok: false, error: "الكود للباقة الأولى فقط." };
  if (!(await allow("platformPayment", `coupon:${session.merchantId}`))) return { ok: false, error: "محاولات كثيرة، حاولوا بعد قليل." };
  const r = await resolveCoupon(raw, session.store.id);
  return r.ok ? { ok: true, code: r.code, price: r.price, months: r.months } : r;
}

export async function submitPlatformPaymentAction(input: {
  method: "vodafone_cash" | "instapay";
  senderPhone: string;
  screenshotUrl: string;
  /** مدة الباقة المختارة (3 أو 6 أو 12). تُتجاهل مع كود الدائرة الذهبية (مدته من العرض). */
  months?: number;
  coupon?: string;
}) {
  try {
    // الإيصال يُرفع من صاحب المتجر نفسه، وعلى متجره النشط في الجلسة.
    // الدفع لصاحب المتجر وحده (لا لعضو في فريقه).
    const session = await ownerStore();
    const store = session?.store;
    if (!session || !store) {
      return { ok: false as const, error: "الدفع لصاحب المتجر فقط. ادخل بحسابه." };
    }
    // متجر مفعّل = تجديد بمدة يختارها التاجر (قبل الانتهاء بشهرين، أو في السماح أو الإيقاف). غير ذلك = الباقة الأولى.
    let kind: PaymentKind = "setup";
    if (store.status === "active") {
      if (!canRenewNow(hostingState(store, new Date(), undefined, await hostingGraceDays().catch(() => undefined)))) {
        return { ok: false as const, error: "الاشتراك سارٍ، والتجديد يُفتح قبل انتهائه بشهرين." };
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

    // كود «الدائرة الذهبية» للباقة الأولى فقط، ويُعاد التحقق منه هنا (المقاعد قد تكتمل بعد فحصه في الصفحة).
    let coupon: string | null = null;
    let plan: PaymentPlan = "standard";
    let months: number;
    let requiredAmountEgp: number;
    if (input.coupon?.trim()) {
      if (kind !== "setup") return { ok: false as const, error: "الكود للباقة الأولى فقط." };
      const c = await resolveCoupon(input.coupon, store.id);
      if (!c.ok) return { ok: false as const, error: c.error };
      coupon = c.code;
      plan = "golden";
      months = c.months;
      requiredAmountEgp = c.price;
    } else {
      if (!isPlanMonths(input.months)) return { ok: false as const, error: "اختاروا مدة الباقة أولاً." };
      const amount = await amountFor(input.months, kind);
      if (!amount) return { ok: false as const, error: "هذه الباقة غير متاحة الآن." };
      months = Number(input.months);
      requiredAmountEgp = amount;
    }
    const requiredAmountPiasters = requiredAmountEgp * 100;

    const [paymentRecord] = await db
      .insert(platformPayments)
      .values({
        storeId: store.id,
        method: input.method,
        kind,
        plan,
        months,
        coupon,
        amountPiasters: requiredAmountPiasters,
        senderPhone: phone,
        screenshotUrl: url.toString(),
      })
      .returning({ id: platformPayments.id });

    await db.insert(systemEvents).values({
      scope: "payment",
      storeId: store.id,
      actor: `merchant:${session.merchantId}`,
      message: `${kind === "renewal" ? "تجديد استضافة" : plan === "golden" ? "تحويل الدائرة الذهبية" : "تحويل جديد للمنصة"} (${months} أشهر) بقيمة ${requiredAmountEgp} ج.م من متجر ${store.subdomain}`,
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
          plan,
          months,
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