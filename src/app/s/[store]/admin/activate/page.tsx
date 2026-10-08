import Link from "next/link";
import { requireStore } from "@/lib/tenant";
import { env } from "@/lib/env";
import { PlatformPaymentForm } from "@/components/dashboard/PlatformPaymentForm";
import {
  CheckCircle2,
  ArrowRight,
  MessageCircle,
  Sparkles,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ActivatePage({
  params,
}: {
  params: Promise<{ store: string }>;
}) {
  const { store: sub } = await params;
  const store = await requireStore(sub, { allowHidden: true });

  const basePrice = env.PLATFORM_BASE_PRICE_EGP || 8999;
  const discountPrice = env.PLATFORM_PRICE_EGP || 899;

  if (store.status === "active") {
    return (
      <div
        className="grid min-h-screen place-items-center p-6 text-center bg-[#f8fafc]"
        dir="rtl"
      >
        <div className="max-w-md w-full bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <div className="size-16 rounded-2xl bg-emerald-50 text-emerald-600 grid place-items-center mx-auto">
            <CheckCircle2 className="size-8" />
          </div>
          <h1 className="text-2xl font-black text-slate-900">
            متجرك مفعّل بالكامل للأبد!
          </h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            تم تأكيد دفعك بنجاح. متجر <b>{store.name}</b> ملكك الآن مدى
            الحياة بدون أي اشتراكات وبدون أي عمولة على مبيعاتك.
          </p>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 rounded-xl text-sm transition-all"
          >
            الذهاب للوحة التحكم
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-[#f8fafc] py-10 px-4 sm:px-6 font-sans text-slate-900"
      dir="rtl"
    >
      <div className="max-w-2xl mx-auto space-y-6">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ArrowRight className="size-4" />
          العودة للوحة التحكم
        </Link>

        {/* بطاقة العرض الحصري بخصم 90% */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-800 border border-amber-200 px-3 py-1 rounded-full text-xs font-black">
              <Sparkles className="size-3.5 text-amber-600" />
              عرض الـ 30 متجر الأوائل (خصم 90%)
            </span>
            <span className="text-xs font-bold text-slate-500">
              متجرك ولوحة تحكمك جاهزان ومحفوظان
            </span>
          </div>

          <div className="space-y-1">
            <div className="flex items-baseline gap-3">
              <span className="text-3xl sm:text-4xl font-black text-slate-900 font-mono">
                {discountPrice} جنيه
              </span>
              <span className="text-base sm:text-lg font-bold text-slate-400 line-through font-mono">
                {basePrice} جنيه
              </span>
              <span className="bg-red-50 text-red-700 text-xs font-black px-2 py-0.5 rounded-lg border border-red-200">
                وفرت {basePrice - discountPrice} ج
              </span>
            </div>
            <p className="text-xs text-slate-500">
              دفعة واحدة مدى الحياة بدون أي اشتراكات وبدون أي عمولة على
              أوردراتك.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-2.5 pt-2 border-t border-slate-100">
            {[
              "متجرك شغال ومملوك لك للأبد",
              "صفر عمولة على كل أوردراتك",
              "بدون مصاريف تجديد سنوية أو شهرية",
              "دعم فني وتحديثات مستمرة لمتجرك",
            ].map((feature, i) => (
              <div
                key={i}
                className="flex items-center gap-2 text-xs font-bold text-slate-700"
              >
                <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                <span>{feature}</span>
              </div>
            ))}
          </div>
        </div>

        {/* نموذج الدفع ورفع الإيصال */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-xs space-y-4">
          <h2 className="text-base font-black text-slate-900">
            خطوات التحويل وتأكيد التفعيل
          </h2>
          <p className="text-xs text-slate-500">
            حوّل مبلغ <b>{discountPrice} جنيه</b> عبر فودافون كاش أو إنستاباي،
            ثم ارفع صورة التحويل، ونفعّل متجرك فور مراجعتها.
          </p>

          <PlatformPaymentForm
            subdomain={sub}
            amount={discountPrice}
            vodafoneCashNumber={env.VODAFONE_CASH_NUMBER}
            instapayNumber={env.INSTAPAY_NUMBER}
          />

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>واجهتك أي مشكلة في التحويل؟</span>
            <a
              href="https://m.me/colapia"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-900 font-bold hover:underline flex items-center gap-1"
            >
              <MessageCircle className="size-3.5" />
              تواصل مع الدعم المباشر
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}