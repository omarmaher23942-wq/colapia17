// /golden — صفحة الحجز والدفع العامة (V4): ملخص العرض والعدّاد الحي، بيانات المتجر (البريد إلزامي)، وسائل التحويل، رفع
// الإيصال، إرسال. تفتح برابط المحادثة (?c=…) فتجد ما قاله العميل للوكيل مملوءاً مسبقاً. حين تكتمل مقاعد الدائرة الذهبية
// تعرض السعر العادي بالتدفق نفسه (بلا ذكر للعرض ولا عدّاد).
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ColapiaLogo } from "@/components/brand/ColapiaLogo";
import { BookingForm } from "@/components/golden/BookingForm";
import { GLD_CSS } from "@/components/golden/gld-css";
import { bookingEnabled, issueFillTicket } from "@/golden/guard";
import { draftIsOpen, findByDraftToken, initialFields } from "@/golden/repo";
import { derivedToken } from "@/golden/tokens";
import { currentProjectQuote } from "@/server/pricing";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "حجز مشروعكم",
  description: "احجزوا مشروعكم مع Colapia: بيانات سريعة، تحويل، ثم نؤكد الحجز ونبدأ خلال 48 ساعة.",
  robots: { index: false, follow: false },
};

export default async function GoldenPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const sp = await searchParams;
  const token = typeof sp.c === "string" ? sp.c : null;
  const row = token ? await findByDraftToken(token) : null;
  // حجز أُرسل من هذا الرابط: نعرض حالته بدل نموذج جديد.
  if (row && row.status !== "draft") redirect(`/golden/done/${derivedToken("track", row.id)}`);
  const open = row && draftIsOpen(row) ? row : null;

  const enabled = await bookingEnabled();
  const quote = await currentProjectQuote();
  const { model: _model, ...q } = quote;
  void _model;

  return (
    <main dir="rtl" lang="ar" className="gld min-h-dvh px-4 pb-24 pt-6 sm:pt-10">
      <style>{GLD_CSS}</style>
      <div className="mx-auto w-full max-w-xl">
        <header className="mb-6 flex items-center justify-between">
          <ColapiaLogo size={30} />
        </header>
        {enabled ? (
          <BookingForm
            initial={initialFields(open)}
            token={open && token ? token : null}
            ticket={issueFillTicket()}
            quote={q}
            pay={{ vodafone: env.VODAFONE_CASH_NUMBER, instapay: env.INSTAPAY_NUMBER }}
          />
        ) : (
          <section className="rounded-3xl border border-[var(--g-line)] bg-[var(--g-card)] p-6 text-center">
            <h1 className="text-xl font-black">استقبال الحجوزات متوقف مؤقتاً</h1>
            <p className="mt-2 text-[14px] leading-7 text-[var(--g-muted)]">نعود قريباً. راسلونا على إنستجرام وسنخبركم فور فتح الحجز.</p>
          </section>
        )}
      </div>
    </main>
  );
}
