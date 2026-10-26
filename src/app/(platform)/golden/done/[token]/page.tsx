// /golden/done/<رابط المتابعة> — صفحة الشكر ومتابعة الحجز (عامة برابط سري مشتق من الطلب). تعرض الحالة بصدق: بانتظار
// تأكيد التحويل ← تم التأكيد (التجهيز خلال 48 ساعة) ← قيد التجهيز ← التسليم. رفض الإيصال يظهر بسببه مع زر إيصال جديد.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { CheckCircle2, Circle, CircleDot } from "lucide-react";
import { db } from "@/db/client";
import { platformPayments } from "@/db/schema";
import { ColapiaLogo } from "@/components/brand/ColapiaLogo";
import { GLD_CSS } from "@/components/golden/gld-css";
import { ReopenButton } from "@/components/golden/ReopenButton";
import { clientStatus, PROJECT_STEPS } from "@/agency/status";
import { findByTrackToken } from "@/golden/repo";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "متابعة حجزكم", robots: { index: false, follow: false } };

export default async function BookingDonePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const row = await findByTrackToken(token);
  if (!row) notFound();
  const st = clientStatus(row);
  const [pay] = await db
    .select({ status: platformPayments.status, note: platformPayments.reviewNote })
    .from(platformPayments)
    .where(eq(platformPayments.requestId, row.id))
    .orderBy(desc(platformPayments.createdAt))
    .limit(1);
  const rejected = st.key === "awaiting_payment" && pay?.status === "rejected";

  return (
    <main dir="rtl" lang="ar" className="gld min-h-dvh px-4 pb-24 pt-6 sm:pt-10">
      <style>{GLD_CSS}</style>
      <div className="mx-auto w-full max-w-xl space-y-5">
        <header>
          <ColapiaLogo size={30} />
        </header>

        <section className="rounded-3xl border border-[var(--g-line)] bg-[var(--g-card)] p-5 sm:p-6">
          <p className="font-mono text-[12.5px] text-[var(--g-muted)]">{row.code}</p>
          <h1 className="mt-1 text-2xl font-black leading-tight">{rejected ? "لم نتمكن من اعتماد الإيصال" : st.key === "awaiting_payment" ? "استلمنا طلبكم" : st.label}</h1>
          <p className="mt-1 text-[15px] font-bold text-[var(--g-muted)]">{row.storeName}</p>
          <p className="mt-3 text-[14.5px] leading-8">{rejected ? "راجعنا التحويل ولم يكتمل اعتماده. أرسلوا إيصالاً واضحاً بالمبلغ الصحيح وسنراجعه فوراً." : st.detail}</p>
          {rejected && pay?.note ? <p className="mt-2 rounded-xl bg-[var(--g-bad)]/10 p-3 text-[14px] font-bold leading-7 text-[var(--g-bad)]">السبب: {pay.note}</p> : null}
          {rejected ? <div className="mt-4"><ReopenButton token={token} /></div> : null}
        </section>

        {st.step > 0 ? (
          <ol className="space-y-1 rounded-3xl border border-[var(--g-line)] bg-[var(--g-card)] p-5 sm:p-6" aria-label="مراحل المشروع">
            {PROJECT_STEPS.map((label, i) => {
              const n = i + 1;
              const done = n < st.step || (n === st.step && st.key === "delivered");
              const current = n === st.step && !done;
              return (
                <li key={label} aria-current={current ? "step" : undefined} className={cn("flex items-center gap-3 rounded-xl px-2 py-2.5 text-[14.5px]", current ? "bg-[var(--g-accent)]/12 font-black" : done ? "font-bold" : "text-[var(--g-muted)]")}>
                  {done ? <CheckCircle2 className="size-5 shrink-0 text-[var(--g-ok)]" aria-hidden="true" /> : current ? <CircleDot className="size-5 shrink-0 text-[var(--g-accent)]" aria-hidden="true" /> : <Circle className="size-5 shrink-0" aria-hidden="true" />}
                  {label}
                </li>
              );
            })}
          </ol>
        ) : null}

        <section className="rounded-3xl border border-[var(--g-line)] bg-[var(--g-card)] p-5 text-[14px] leading-8 sm:p-6">
          <h2 className="text-lg font-black">الخطوات القادمة</h2>
          <ol className="mt-2 list-decimal space-y-1 ps-5">
            <li>نراجع إيصال التحويل ونؤكد الحجز بالبريد الذي سجلتموه.</li>
            <li>بعد التأكيد يبدأ الفريق تجهيز مشروعكم خلال 48 ساعة.</li>
            <li>عند الجاهزية نحدد معكم موعد جلسة تسليم مباشرة، نجلس فيها معكم حتى يفتح متجركم ويعمل.</li>
          </ol>
          <p className="mt-3 text-[var(--g-muted)]">بعد تأكيد الحجز تتابعون المشروع من حسابكم بالبريد نفسه الذي سجلتموه.</p>
          {st.key !== "awaiting_payment" ? (
            <Link href="/dashboard" className="mt-4 inline-flex min-h-12 items-center rounded-xl bg-[var(--g-accent)] px-5 text-[15px] font-black text-[var(--g-on-accent)]">
              فتح حسابكم
            </Link>
          ) : null}
        </section>
      </div>
    </main>
  );
}
