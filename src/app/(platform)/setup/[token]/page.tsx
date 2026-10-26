// /setup/<رمز> — رابط الإعداد الذي يرسله فريق Colapia لصاحب المتجر: يضع كلمة المرور لأول مرة ثم يدخل الإعداد المخصص.
// الرمز موقّع وصالح 14 يوماً ويُستعمل لوضع كلمة المرور مرة واحدة. بعدها يدخل صاحب المتجر من /login ببريده وكلمة مروره.
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveSetupToken } from "@/agent/setup-access";
import { AuthNotice, AuthShell, AUTH_BTN, AUTH_CARD } from "@/components/auth/AuthShell";
import { getMerchantSession } from "@/server/auth";
import { lifecycleTimings } from "@/lifecycle/timings";
import { SetupForm } from "./SetupForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "إعداد متجركم", description: "اختاروا كلمة مرور لوحة متجركم وأكملوا الإعداد في دقائق.", robots: { index: false, follow: false } };

const toLogin = (to: string) => (
  <Link href={`/login?redirect=${encodeURIComponent(to)}`} className={AUTH_BTN}>
    صفحة الدخول
  </Link>
);

export default async function SetupPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const r = await resolveSetupToken(token);

  if (!r.ok) {
    return (
      <AuthShell>
        <AuthNotice title={r.reason === "expired" ? "انتهت صلاحية رابط الإعداد" : "رابط الإعداد غير صالح"} action={toLogin("/dashboard")}>
          <p>اطلبوا رابطاً جديداً من الفريق في المحادثة نفسها، ويصلكم خلال دقائق. وإن سبق وأنشأتم كلمة المرور فادخلوا من صفحة الدخول.</p>
        </AuthNotice>
      </AuthShell>
    );
  }
  const t = r.target;

  if (t.hasPassword || t.status !== "setup") {
    const session = await getMerchantSession().catch(() => null);
    if (session && session.merchantId === t.merchantId) redirect(t.status === "setup" ? "/onboarding" : "/dashboard");
    return (
      <AuthShell>
        <AuthNotice title={`متجر «${t.storeName}»`} action={toLogin(t.status === "setup" ? "/onboarding" : "/dashboard")}>
          <p>سبق وضع كلمة المرور لهذا المتجر. ادخلوا ببريدكم وكلمة المرور، ولو نسيتموها فاختاروا «نسيت كلمة المرور» من صفحة الدخول.</p>
        </AuthNotice>
      </AuthShell>
    );
  }

  const { trialHours } = await lifecycleTimings();
  return (
    <AuthShell
      footer={
        <p className="mt-5 text-center text-xs leading-relaxed text-[#c3cdf0]/45">
          بالمتابعة تتم الموافقة على{" "}
          <Link href="/terms" className="underline-offset-4 hover:underline">
            شروط الاستخدام
          </Link>{" "}
          و{" "}
          <Link href="/privacy" className="underline-offset-4 hover:underline">
            سياسة الخصوصية
          </Link>
          .
        </p>
      }
    >
      <div className={AUTH_CARD}>
        <div className="text-center">
          <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-[#c3cdf0]/80">أهلاً بكم</span>
          <h1 className="mt-3 text-[24px] font-black leading-snug sm:text-3xl">متجر «{t.storeName}» جاهز للإعداد</h1>
          <p className="mx-auto mt-2 max-w-sm text-[14px] leading-7 text-[#c3cdf0]/75">
            اختاروا كلمة مرور للوحة التحكم، ثم أكملوا إعداداً مخصصاً لمتجركم لا يسأل إلا عما ينقص.
          </p>
        </div>
        <div className="mt-6">
          <SetupForm token={token} email={t.email} trialHours={trialHours} />
        </div>
      </div>
    </AuthShell>
  );
}
