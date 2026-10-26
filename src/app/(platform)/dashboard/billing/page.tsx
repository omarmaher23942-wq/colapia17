// /dashboard/billing — «تفعيل الموقع» (V5): الدفع بعد أن يعجبكم المتجر المعاين. المبلغ 999 (الدائرة الذهبية) ما دام فيها مقاعد
// بعدّاد حي، وإلا 4,999. الدفع قبل أو بعد التجميد يعيد المتجر كما كان. بعد التأكيد: التسليم وجلسة الربط.
import { desc, eq } from "drizzle-orm";
import { CheckCircle2, Crown, Hourglass } from "lucide-react";
import { db } from "@/db/client";
import { platformPayments } from "@/db/schema";
import { requireStoreArea } from "@/server/merchant-guard";
import { currentProjectQuote } from "@/server/pricing";
import { PayForm } from "@/components/dashboard/billing/PayForm";
import { env } from "@/lib/env";
import { fmtNum } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "تفعيل الموقع" };

export default async function ActivationPage() {
  const s = await requireStoreArea("billing");
  const [last] = await db.select({ status: platformPayments.status, note: platformPayments.reviewNote }).from(platformPayments).where(eq(platformPayments.storeId, s.storeId)).orderBy(desc(platformPayments.createdAt)).limit(1);
  const quote = await currentProjectQuote();
  const golden = quote.offer === "golden";

  if (s.store.status === "active" || last?.status === "confirmed") {
    return (
      <section className="dash-card mx-auto max-w-xl space-y-3 p-6 text-center">
        <CheckCircle2 className="mx-auto size-10 text-ok" aria-hidden="true" />
        <h1 className="text-xl font-black">موقعكم مفعّل</h1>
        <p className="text-[14px] leading-7 text-ink-2">تم تأكيد دفعكم. الخطوة القادمة جلسة تسليم مباشرة نربط فيها حساباتكم ونسلّمكم الكود كاملاً، وسنراسلكم لتحديد موعدها.</p>
      </section>
    );
  }
  if (last?.status === "under_review") {
    return (
      <section className="dash-card mx-auto max-w-xl space-y-3 p-6 text-center">
        <Hourglass className="mx-auto size-10 text-nova" aria-hidden="true" />
        <h1 className="text-xl font-black">إيصالكم قيد المراجعة</h1>
        <p className="text-[14px] leading-7 text-ink-2">نراجع التحويل ونبلغكم بالبريد فور تأكيده، وغالباً خلال ساعات. يبقى موقعكم كما هو في هذه الأثناء.</p>
      </section>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <section className="dash-card space-y-3 p-5">
        {golden ? (
          <p className="inline-flex items-center gap-1.5 rounded-full bg-warn/15 px-3 py-1 text-[12px] font-black text-warn">
            <Crown className="size-3.5" aria-hidden="true" /> الدائرة الذهبية
          </p>
        ) : null}
        <h1 className="text-2xl font-black">تفعيل الموقع</h1>
        <p className="flex items-baseline gap-3">
          <span className="text-4xl font-black">{fmtNum(quote.price)}</span>
          <span className="text-[15px] font-bold">جنيه</span>
          {golden ? <span className="text-[15px] text-ink-3 line-through">{fmtNum(quote.regularPrice)}</span> : null}
        </p>
        {golden ? (
          <div role="group" aria-label="المقاعد المتبقية">
            <p className="text-[13px] font-bold">باقٍ {fmtNum(quote.seatsLeft)} من {fmtNum(quote.seats)} مقاعد</p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-edge/10" aria-hidden="true">
              <div className="h-full rounded-full bg-warn" style={{ width: `${Math.round(((quote.seats - quote.seatsLeft) / Math.max(1, quote.seats)) * 100)}%` }} />
            </div>
            <p className="mt-2 text-[13px] leading-7 text-ink-2">مقابل تعاون بسيط بعد التسليم (فيديو Collab أو شهادة) بموافقتكم على النسخة النهائية قبل النشر.</p>
          </div>
        ) : null}
        <p className="text-[14px] leading-7 text-ink-2">بعد تأكيد الدفع نسلّمكم الكود والمشروع كاملاً ملكاً لكم في جلسة مباشرة، ولكم تعديل مجاني واحد بعد التسليم.</p>
        {last?.status === "rejected" ? <p role="alert" className="rounded-xl bg-bad/10 p-3 text-[13.5px] font-bold text-bad">لم نتمكن من اعتماد الإيصال السابق{last.note ? `: ${last.note}` : ""}. أرسلوا إيصالاً واضحاً.</p> : null}
      </section>
      <section className="dash-card p-5">
        <PayForm offer={quote.offer} price={quote.price} vodafone={env.VODAFONE_CASH_NUMBER} instapay={env.INSTAPAY_NUMBER} />
      </section>
    </div>
  );
}
