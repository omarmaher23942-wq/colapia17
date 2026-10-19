"use server";

import { db } from "@/db/client";
import { platformPayments, systemEvents } from "@/db/schema";
import { ownerStore } from "@/server/merchant-guard";
import { allow } from "@/lib/ratelimit";
import { isTrustedUploadUrl } from "@/lib/upload-hosts";
import { normalizeEgyptianPhone } from "@/lib/phone";
import { isPlanId, monthsLabel, quote, type PaymentKind, type PaymentPlan } from "@/lib/platform-pricing";
import { currentPricing, resolveCoupon } from "@/server/pricing";
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

/** يتحقق من كود «الدائرة الذهبية» قبل الدفع ويعيد رسوم التجهيز بعده (للعرض؛ الخادم يعيد التحقق عند الإرسال). */
export async function checkCouponAction(raw: string): Promise<{ ok: true; code: string; buildPrice: number; regularBuildPrice: number } | { ok: false; error: string }> {
  const session = await ownerStore({ allowLocked: true });
  if (!session?.store) return { ok: false, error: "الدفع لصاحب المتجر فقط." };
  if (!PAYABLE.has(session.store.status)) return { ok: false, error: "الكود للدفعة الأولى فقط." };
  if (!(await allow("platformPayment", `coupon:${session.merchantId}`))) return { ok: false, error: "محاولات كثيرة، يمكن المحاولة بعد قليل." };
  const r = await resolveCoupon(raw, session.store.id);
  return r.ok ? { ok: true, code: r.code, buildPrice: r.buildPrice, regularBuildPrice: r.regularBuildPrice } : r;
}

export async function submitPlatformPaymentAction(input: {
  method: "vodafone_cash" | "instapay";
  senderPhone: string;
  screenshotUrl: string;
  /** باقة الاستضافة (basic | growth | pro). */
  planId: string;
  /** عدد الأشهر من المدد المسموح بها. */
  months: number;
  /** كود «الدائرة الذهبية» (رسوم تجهيز مخفّضة، للدفعة الأولى فقط). */
  coupon?: string;
}) {
  try {
    // الإيصال يُرفع من صاحب المتجر نفسه، وعلى متجره النشط في الجلسة (لا لعضو في فريقه).
    const session = await ownerStore({ allowLocked: true });
    const store = session?.store;
    if (!session || !store) {
      return { ok: false as const, error: "الدفع لصاحب المتجر فقط. يلزم الدخول بحسابه." };
    }
    // متجر مفعّل = تجديد (قبل الانتهاء بشهرين، أو في السماح أو الإيقاف). غير ذلك = الدفعة الأولى (التجهيز + الباقة).
    let kind: PaymentKind = "setup";
    if (store.status === "active") {
      if (!canRenewNow(hostingState(store, new Date(), await hostingGraceDays().catch(() => undefined)))) {
        return { ok: false as const, error: "الاشتراك سارٍ، والتجديد يُفتح قبل انتهائه بشهرين." };
      }
      kind = "renewal";
    } else if (!PAYABLE.has(store.status)) {
      return { ok: false as const, error: "المتجر ليس في مرحلة الدفع الآن." };
    }
    if (!(await allow("platformPayment", session.merchantId))) {
      return { ok: false as const, error: "محاولات كثيرة، يمكن المحاولة بعد قليل." };
    }
    if (input.method !== "vodafone_cash" && input.method !== "instapay") {
      return { ok: false as const, error: "وسيلة دفع غير مدعومة." };
    }

    const phone = normalizeEgyptianPhone(input.senderPhone);
    if (!phone) {
      return { ok: false as const, error: "الرقم الذي تم التحويل منه غير صحيح (11 رقماً يبدأ بـ 01)." };
    }

    if (!isTrustedUploadUrl(input.screenshotUrl)) {
      return { ok: false as const, error: "صورة الإيصال تُرفع من الصفحة نفسها." };
    }
    const url = new URL(input.screenshotUrl);
    if (!isPlanId(input.planId)) return { ok: false as const, error: "اختاروا الباقة أولاً." };

    // كود «الدائرة الذهبية» للدفعة الأولى فقط، ويُعاد التحقق منه هنا (المقاعد قد تكتمل بعد فحصه في الصفحة).
    let coupon: string | null = null;
    let plan: PaymentPlan = "standard";
    if (input.coupon?.trim()) {
      if (kind !== "setup") return { ok: false as const, error: "الكود للدفعة الأولى فقط." };
      const c = await resolveCoupon(input.coupon, store.id);
      if (!c.ok) return { ok: false as const, error: c.error };
      coupon = c.code;
      plan = "golden";
    }
    // المبلغ يُحسب على الخادم وحده من الأسعار الحالية (التجهيز + الباقة × الأشهر، أو الباقة × الأشهر للتجديد).
    const q = quote(await currentPricing(), { planId: input.planId, months: input.months, golden: plan === "golden", kind });
    if (!q.ok) return { ok: false as const, error: q.error };
    const months = q.months;
    const tier = q.planId;
    const requiredAmountEgp = q.total;
    const requiredAmountPiasters = requiredAmountEgp * 100;

    const [paymentRecord] = await db
      .insert(platformPayments)
      .values({
        storeId: store.id,
        method: input.method,
        kind,
        plan,
        months,
        tier,
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
      message: `${kind === "renewal" ? "تجديد استضافة" : plan === "golden" ? "تحويل الدائرة الذهبية" : "تحويل جديد للمنصة"} (باقة ${q.planName}، ${monthsLabel(months)}) بقيمة ${requiredAmountEgp} ج.م من متجر ${store.subdomain}`,
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
          tierName: q.planName,
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
        error: "يوجد إيصال قيد المراجعة بالفعل، وسنبلغكم فور قبوله.",
      };
    }
    // eslint-disable-next-line no-console
    console.error("[submitPlatformPaymentAction] Error:", e);
    return {
      ok: false as const,
      error: "حدث خطأ أثناء تسجيل التحويل، يمكن المحاولة مجدداً.",
    };
  }
}