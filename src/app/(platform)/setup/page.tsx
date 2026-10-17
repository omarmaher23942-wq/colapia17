// /setup?t=<رمز موقّع> — صفحة ترحيب صاحب المتجر الذي أنشأه الوكيل من المحادثة. تتحقق من الرمز، وتشرح ما سيحدث (أربع خطوات
// قصيرة، نحو عشر دقائق)، وتدخله بحساب Google بالبريد الذي أعطاه للمساعد (login_hint) أو برمز على البريد نفسه، ثم تأخذه إلى /onboarding.
// البريد يُقرأ من القاعدة على الخادم ويظهر مخفياً فقط، ولا يوضع في أي رابط.
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, CreditCard, Link2, Package, Truck } from "lucide-react";
import { ColapiaLogo } from "@/components/brand/ColapiaLogo";
import { NoStoreNotice } from "@/components/auth/NoStoreNotice";
import { GoogleIcon } from "@/components/landing/shared";
import { resolveSetupToken } from "@/agent/setup-access";
import { maskEmail } from "@/lib/contact";
import { getMerchantSession } from "@/server/auth";
import { SetupCodeLogin } from "./SetupCodeLogin";
import { startSetupGoogleAction } from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "إعداد متجركم",
  description: "أكملوا إعداد متجركم في دقائق.",
  robots: { index: false, follow: false },
};

const STEPS = [
  { icon: Package, title: "المنتجات", text: "اكتبوها أو ارفعوا صورها أو ملفاً جاهزاً." },
  { icon: CreditCard, title: "وسائل الدفع", text: "اختاروا ما يناسب عملاءكم." },
  { icon: Truck, title: "الشحن والسياسات", text: "المناطق والأسعار والاستبدال." },
  { icon: Link2, title: "التواصل", text: "واتساب وحساباتكم على المنصات." },
];

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main dir="rtl" lang="ar" className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[#07091a] px-4 py-10 text-[#eaf0ff] sm:px-5 sm:py-16">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(111,134,255,0.22),transparent_70%),radial-gradient(50%_40%_at_80%_100%,rgba(143,168,255,0.12),transparent_70%)]" />
      <div className="w-full max-w-lg">
        <div className="mb-6 flex justify-center">
          <ColapiaLogo size={36} />
        </div>
        {children}
      </div>
    </main>
  );
}

const card = "relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.01] p-6 shadow-[0_40px_120px_-40px_rgba(111,134,255,0.35)] backdrop-blur-2xl sm:p-9";

export default async function SetupPage({ searchParams }: { searchParams: Promise<{ t?: string; error?: string }> }) {
  const { t, error } = await searchParams;
  const target = t ? await resolveSetupToken(t) : null;

  if (!target) {
    return (
      <Shell>
        <div className={`${card} text-center`}>
          <h1 className="text-xl font-black">الرابط غير صالح أو انتهت صلاحيته</h1>
          <p className="mx-auto mt-3 max-w-sm text-[14px] leading-7 text-[#c3cdf0]/80">
            إن كان لديكم متجر بالفعل فادخلوا من صفحة الدخول. وإن لم يصلكم رابط إعداد، اطلبوه من المساعد في المحادثة وسيعيد إرساله لكم هنا وعلى البريد.
          </p>
          <Link href="/login" className="mt-5 inline-flex min-h-12 items-center justify-center rounded-2xl border border-white/15 px-6 text-[14.5px] font-bold hover:bg-white/[0.05]">
            صفحة الدخول
          </Link>
        </div>
      </Shell>
    );
  }

  // المتجر أكمل إعداده: الدخول العادي للوحة.
  if (target.status !== "setup") {
    return (
      <Shell>
        <div className={`${card} text-center`}>
          <CheckCircle2 className="mx-auto size-10 text-emerald-300" aria-hidden="true" />
          <h1 className="mt-3 text-xl font-black">أكملتم إعداد متجر «{target.storeName}»</h1>
          <p className="mx-auto mt-3 max-w-sm text-[14px] leading-7 text-[#c3cdf0]/80">يمكنكم الدخول إلى لوحة التحكم من صفحة الدخول.</p>
          <Link href="/login?redirect=/dashboard" className="mt-5 inline-flex min-h-12 items-center justify-center rounded-2xl bg-white px-6 text-[14.5px] font-black text-[#0b0f1e]">
            دخول لوحة التحكم
          </Link>
        </div>
      </Shell>
    );
  }

  // دخل بالفعل بحساب صاحب هذا المتجر: مباشرة إلى الإعداد.
  const session = await getMerchantSession().catch(() => null);
  if (session && session.merchantId === target.merchantId) redirect("/onboarding");

  const masked = target.email ? maskEmail(target.email) : "";
  const google = startSetupGoogleAction.bind(null, t!, false);
  const switchAccount = startSetupGoogleAction.bind(null, t!, true);

  return (
    <Shell>
      <div className={card}>
        <div aria-hidden="true" className="pointer-events-none absolute -top-24 start-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-[#8fa8ff]/25 blur-3xl" />
        <div className="relative text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-[#c3cdf0]/80">أهلاً بكم</span>
          <h1 className="mt-3 text-[26px] font-black leading-snug sm:text-3xl">
            متجر «{target.storeName}» جاهز للإعداد
          </h1>
          <p className="mx-auto mt-2 max-w-sm text-[14px] leading-7 text-[#c3cdf0]/75">
            أربع خطوات قصيرة تستغرق نحو عشر دقائق، ويُحفظ تقدمكم بعد كل خطوة. بعدها تبدأ تجربة مجانية قبل أي دفع.
          </p>
        </div>

        <ol className="relative mt-6 grid gap-2.5 sm:grid-cols-2" aria-label="خطوات الإعداد">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3.5">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#6f86ff]/15 text-[#8fa8ff]">
                <s.icon className="size-[18px]" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-[13.5px] font-black">
                  {i + 1}. {s.title}
                </span>
                <span className="block text-[12.5px] leading-6 text-[#c3cdf0]/70">{s.text}</span>
              </span>
            </li>
          ))}
        </ol>

        {error === "wrong_account" ? <NoStoreNotice className="relative mt-6" maskedEmail={masked || null} switchAction={switchAccount} /> : null}

        <div className="relative mt-6 space-y-3">
          <form action={google}>
            <button
              type="submit"
              className="inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-2xl bg-white text-[15px] font-bold text-[#0b0f1e] transition hover:bg-[#eaf0ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8fa8ff]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#07091a]"
            >
              <GoogleIcon className="size-5" aria-hidden="true" />
              الدخول بحساب Google
            </button>
          </form>
          {masked ? (
            <p className="text-center text-[12.5px] leading-6 text-[#c3cdf0]/65">
              ادخلوا بالحساب المرتبط بالبريد <bdi dir="ltr" className="font-mono font-bold text-[#eaf0ff]">{masked}</bdi>
            </p>
          ) : null}
          {target.email ? <SetupCodeLogin token={t!} maskedEmail={masked} /> : null}
        </div>
      </div>
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
    </Shell>
  );
}
