// dashboard/billing/page.tsx — صفحة التفعيل والفوترة.
//
// التعديلات الجذرية (موجة 3):
//  1) عرض Trial Countdown مع تفاصيل دقيقة.
//  2) نموذج دفع كامل (Vodafone/InstaPay) مع رفع صورة التحويل.
//  3) تتبع حالة الدفعة في الوقت الحقيقي (Pusher).
//  4) Price breakdown واضح (899 ج مقابل 8,999 ج).
//  5) عرض تاريخ الدفعات والتفعيل.
import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { eq, desc, and } from "drizzle-orm";
import {
  CheckCircle2,
  CreditCard,
  Crown,
  ShieldCheck,
  Sparkles,
  Clock,
  XCircle,
  AlertTriangle,
  Zap,
  ArrowLeft,
  Download,
} from "lucide-react";
import { getMerchantSession } from "@/server/auth";
import { db } from "@/db/client";
import { platformPayments, stores } from "@/db/schema";
import { formatEgp } from "@/lib/money";
import { PlatformPaymentForm } from "@/components/dashboard/PlatformPaymentForm";
import { AutoRefresh } from "@/components/platform/AutoRefresh";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "التفعيل والفوترة",
  description: "امتلك متجرك للأبد — دفعة واحدة، بلا اشتراكات",
};

export default async function BillingPage() {
  const session = await getMerchantSession();
  if (!session) redirect("/login?redirect=/dashboard/billing");
  if (!session.store) redirect("/dashboard/onboarding");

  const store = session.store;
  const isActive = store.status === "active";
  const demoExpiresAt = store.demoExpiresAt;
  const now = Date.now();
  const msLeft = demoExpiresAt ? demoExpiresAt.getTime() - now : 0;
  const isTrialActive = !isActive && demoExpiresAt && msLeft > 0;

  const [payments] = await Promise.all([
    db
      .select()
      .from(platformPayments)
      .where(eq(platformPayments.storeId, store.id))
      .orderBy(desc(platformPayments.createdAt))
      .limit(10),
  ]);

  const pendingPayment = payments.find((p) => p.status === "under_review");
  const confirmedPayment = payments.find((p) => p.status === "confirmed");
  const rejectedPayment = payments.find((p) => p.status === "rejected");

  const basePrice = env.PLATFORM_BASE_PRICE_EGP || 8999;
  const discountPrice = env.PLATFORM_PRICE_EGP || 899;
  const savingsEgp = basePrice - discountPrice;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {pendingPayment ? <AutoRefresh everyMs={8000} /> : null}

      <header>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-[11px] font-bold text-ink-3 transition-colors hover:text-ink"
        >
          <ArrowLeft className="size-3" strokeWidth={2.5} aria-hidden="true" />
          رجوع للداشبورد
        </Link>
        <h1 className="mt-3 text-2xl font-black tracking-tight text-ink sm:text-3xl">
          التفعيل والفوترة
        </h1>
        <p className="mt-1.5 text-xs text-ink-3">
          امتلك متجرك مدى الحياة — دفعة واحدة، بلا اشتراكات، بلا عمولة.
        </p>
      </header>

      {/* Active state */}
      {isActive ? (
        <section className="relative overflow-hidden rounded-3xl border border-emerald-400/30 bg-gradient-to-b from-emerald-500/[0.08] to-transparent p-6 sm:p-8">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-24 start-1/2 size-64 -translate-x-1/2 rounded-full bg-emerald-500/15 blur-3xl"
          />
          <div className="relative flex flex-col items-center text-center">
            <div className="grid size-16 place-items-center rounded-3xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/30">
              <Crown className="size-8" strokeWidth={1.75} aria-hidden="true" />
            </div>
            <h2 className="mt-5 text-xl font-black text-ink">
              متجرك مفعّل مدى الحياة
            </h2>
            <p className="mt-2 max-w-md text-xs leading-relaxed text-ink-2">
              مبروك! ملكية كاملة لمتجر {store.name}، بلا اشتراكات شهرية، بلا
              عمولة على المبيعات.
            </p>
            {confirmedPayment ? (
              <div className="mt-5 inline-flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-3.5 py-1.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-300">
                <CheckCircle2 className="size-3.5" strokeWidth={2.5} aria-hidden="true" />
                تاريخ التفعيل:{" "}
                {confirmedPayment.reviewedAt
                  ? new Date(confirmedPayment.reviewedAt).toLocaleDateString("ar-EG", {
                      timeZone: "Africa/Cairo",
                    })
                  : "—"}
              </div>
            ) : null}

            <div className="mt-6 grid w-full grid-cols-1 gap-3 sm:grid-cols-3">
              <FeaturePill icon={Zap} label="0% عمولة" />
              <FeaturePill icon={ShieldCheck} label="ملكية أبدية" />
              <FeaturePill icon={Sparkles} label="تحديثات دائمة" />
            </div>
          </div>
        </section>
      ) : null}

      {/* Trial active */}
      {isTrialActive ? (
        <section className="relative overflow-hidden rounded-3xl border border-amber-400/30 bg-gradient-to-b from-amber-500/[0.08] to-transparent p-6 sm:p-8">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-24 start-1/2 size-64 -translate-x-1/2 rounded-full bg-amber-500/15 blur-3xl"
          />
          <div className="relative">
            <div className="flex items-center gap-3">
              <span className="grid size-12 place-items-center rounded-2xl bg-amber-500/20 text-amber-700 dark:text-amber-300">
                <Clock className="size-6" strokeWidth={1.75} aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-base font-black text-ink">
                  تجربتك النشطة جارية
                </h2>
                <p className="mt-0.5 text-[11px] text-ink-3">
                  باقي لك {formatTimeLeft(msLeft)}
                </p>
              </div>
            </div>

            {/* Offer */}
            <div className="mt-6 rounded-2xl border border-nova-2/25 bg-space-2/60 p-5 backdrop-blur">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1 text-[10.5px] font-black text-amber-700 dark:text-amber-300">
                  <Sparkles className="size-3" strokeWidth={2.5} aria-hidden="true" />
                  عرض الـ 30 متجر الأوائل
                </span>
                <span className="font-mono text-[10.5px] text-ink-3">
                  خصم {Math.round((savingsEgp / basePrice) * 100)}%
                </span>
              </div>

              <div className="mt-4 flex flex-wrap items-baseline gap-3">
                <span className="font-mono text-4xl font-black text-ink">
                  {discountPrice}
                </span>
                <span className="text-base font-bold text-ink">ج.م</span>
                <span className="font-mono text-base text-ink-3 line-through">
                  {basePrice.toLocaleString("en-US")} ج.م
                </span>
                <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-black text-emerald-600 dark:text-emerald-300">
                  وفر {savingsEgp.toLocaleString("en-US")} ج.م
                </span>
              </div>

              <p className="mt-2 text-[11.5px] leading-relaxed text-ink-2">
                دفعة واحدة مدى الحياة — بدون اشتراكات، بدون عمولة، وبدون أي
                رسوم تجديد.
              </p>
            </div>
          </div>
        </section>
      ) : null}

      {/* Pending payment status */}
      {pendingPayment ? (
        <section className="rounded-3xl border border-nova/30 bg-nova/[0.06] p-6 sm:p-8">
          <div className="flex items-start gap-3">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-nova/20 text-nova-2">
              <Clock className="size-6 animate-pulse" strokeWidth={1.75} aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-black text-ink">
                طلب تفعيلك تحت المراجعة
              </h2>
              <p className="mt-1 text-[11.5px] leading-relaxed text-ink-2">
                وصلنا إيصال التحويل بمبلغ {formatEgp(pendingPayment.amountPiasters)}.
                فريقنا يراجع الآن — عادة أقل من 5 دقائق. ستصلك رسالة تأكيد
                فور التفعيل.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3 text-[11px]">
                <span className="text-ink-3">
                  مرسل:{" "}
                  {new Date(pendingPayment.createdAt).toLocaleString("ar-EG", {
                    timeZone: "Africa/Cairo",
                  })}
                </span>
                <span className="text-ink-3">
                  الطريقة:{" "}
                  {pendingPayment.method === "vodafone_cash"
                    ? "فودافون كاش"
                    : "إنستاباي"}
                </span>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {/* Rejected payment alert */}
      {rejectedPayment && !pendingPayment && !isActive ? (
        <section className="rounded-3xl border border-rose-500/30 bg-rose-500/[0.06] p-6 sm:p-8">
          <div className="flex items-start gap-3">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-rose-500/20 text-rose-600 dark:text-rose-300">
              <XCircle className="size-6" strokeWidth={1.75} aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-black text-ink">
                تم رفض التحويل السابق
              </h2>
              <p className="mt-1 text-[11.5px] leading-relaxed text-ink-2">
                {rejectedPayment.reviewNote ||
                  "لم نتمكن من تأكيد الدفع. جرّب رفع إيصال صحيح مرة أخرى."}
              </p>
            </div>
          </div>
        </section>
      ) : null}

      {/* Payment form (only if not active and no pending) */}
      {!isActive && !pendingPayment ? (
        <section className="rounded-3xl border border-edge/10 bg-edge/[0.02] p-6 sm:p-8">
          <header className="mb-5 flex items-center gap-3 border-b border-edge/10 pb-5">
            <span className="grid size-10 place-items-center rounded-2xl bg-nova/15 text-nova-2">
              <CreditCard className="size-4" strokeWidth={2.25} aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-base font-black text-ink">
                خطوات التفعيل
              </h2>
              <p className="mt-0.5 text-[11px] text-ink-3">
                حوّل مبلغ {discountPrice} ج.م ثم ارفع صورة الإيصال
              </p>
            </div>
          </header>

          <PlatformPaymentForm
            subdomain={store.subdomain}
            amount={discountPrice}
            vodafoneCashNumber={env.VODAFONE_CASH_NUMBER}
            instapayNumber={env.INSTAPAY_NUMBER}
          />
        </section>
      ) : null}

      {/* Payment history */}
      {payments.length > 0 ? (
        <section className="rounded-3xl border border-edge/10 bg-edge/[0.02] p-6">
          <header className="mb-4 flex items-center justify-between border-b border-edge/10 pb-3">
            <h2 className="text-sm font-black text-ink">
              سجل المدفوعات
            </h2>
            <span className="font-mono text-[11px] text-ink-3">
              {payments.length} عملية
            </span>
          </header>

          <ul className="divide-y divide-edge/5">
            {payments.map((p) => {
              const status = {
                confirmed: {
                  label: "مؤكد",
                  icon: CheckCircle2,
                  color: "text-emerald-600 dark:text-emerald-300",
                  bg: "bg-emerald-500/10",
                },
                rejected: {
                  label: "مرفوض",
                  icon: XCircle,
                  color: "text-rose-600 dark:text-rose-300",
                  bg: "bg-rose-500/10",
                },
                under_review: {
                  label: "قيد المراجعة",
                  icon: Clock,
                  color: "text-amber-700 dark:text-amber-300",
                  bg: "bg-amber-500/10",
                },
                pending: {
                  label: "معلّق",
                  icon: Clock,
                  color: "text-ink-3",
                  bg: "bg-edge/5",
                },
                refunded: {
                  label: "مُسترد",
                  icon: AlertTriangle,
                  color: "text-ink-3",
                  bg: "bg-edge/5",
                },
              }[p.status] ?? {
                label: p.status,
                icon: Clock,
                color: "text-ink-3",
                bg: "bg-edge/5",
              };
              const StatusIcon = status.icon;

              return (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <span
                      className={`grid size-9 shrink-0 place-items-center rounded-xl ${status.bg} ${status.color}`}
                    >
                      <StatusIcon className="size-4" strokeWidth={2.25} aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-ink">
                        {p.method === "vodafone_cash"
                          ? "فودافون كاش"
                          : "إنستاباي"}
                      </p>
                      <p className="mt-0.5 font-mono text-[10.5px] text-ink-3">
                        {new Date(p.createdAt).toLocaleString("ar-EG", {
                          timeZone: "Africa/Cairo",
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="text-end">
                    <p className="font-mono text-sm font-black text-ink">
                      {formatEgp(p.amountPiasters)}
                    </p>
                    <p className={`mt-0.5 text-[10.5px] font-bold ${status.color}`}>
                      {status.label}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {/* Help */}
      <section className="rounded-2xl border border-edge/10 bg-edge/[0.02] p-5">
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-nova/15 text-nova-2">
            <ShieldCheck className="size-4" strokeWidth={2.25} aria-hidden="true" />
          </span>
          <div>
            <p className="text-xs font-bold text-ink">
              هل تحتاج مساعدة في التحويل؟
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-ink-3">
              فريقنا متاح على مدار اليوم. تواصل معنا مباشرة على واتساب:{" "}
              <a
                href={`https://wa.me/2${env.VODAFONE_CASH_NUMBER}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-nova-2 underline-offset-4 hover:underline"
              >
                {env.VODAFONE_CASH_NUMBER}
              </a>
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function FeaturePill({
  icon: Icon,
  label,
}: {
  icon: typeof Zap;
  label: string;
}) {
  return (
    <div className="flex items-center justify-center gap-2 rounded-xl border border-emerald-400/25 bg-emerald-500/[0.06] px-3 py-2.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-200">
      <Icon className="size-3.5" strokeWidth={2.25} aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

function formatTimeLeft(ms: number): string {
  if (ms <= 0) return "انتهت التجربة";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h > 0) return `${h} ساعة و ${m} دقيقة`;
  return `${m} دقيقة`;
}