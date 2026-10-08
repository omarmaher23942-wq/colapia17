"use client";

// بطاقة تسجيل دخول بنمط Linear/Cosmic (E3):
// - زجاجية، خلفية متوهجة، حواف ناعمة، أيقونة Google حقيقية.
// - زر واحد موحّد عبر Server Action (E4) — لا onClick يدوي.
// - حجم اللمس >= 48px (E6)، وaria-busy وقت التحميل.
// - بدون أي emoji، فقط Lucide Icons (E7).
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { GoogleAuthCta } from "@/components/landing/GoogleAuthCta";

type Variant = "login" | "signup";

const ERROR_MESSAGES: Record<string, string> = {
  oauth_failed: "تعذّر إتمام تسجيل الدخول. حاول مرة أخرى.",
  state_mismatch: "انتهت صلاحية الجلسة. أعد المحاولة.",
  email_unverified: "يرجى تأكيد بريدك الإلكتروني في Google أولاً.",
  access_denied: "رفضت الوصول. نحتاج بريدك واسمك للمتابعة.",
};

function errorMessage(code: string): string {
  return ERROR_MESSAGES[code] ?? "حدث خطأ غير متوقع. حاول مرة أخرى.";
}

export function LoginForm({
  redirectTo,
  variant = "login",
  error,
}: {
  redirectTo: string;
  variant?: Variant;
  error?: string;
}) {
  const isSignup = variant === "signup";

  return (
    <div className="w-full max-w-md">
      <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.01] p-8 shadow-[0_40px_120px_-40px_rgba(111,134,255,0.35)] backdrop-blur-2xl sm:p-10">
        {/* توهج علوي ناعم */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 start-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-[#8fa8ff]/25 blur-3xl"
        />

        {/* الترويسة */}
        <div className="relative flex flex-col items-center gap-2 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-[#c3cdf0]/80">
            {isSignup ? "إنشاء حساب جديد" : "تسجيل الدخول"}
          </span>
          <h1 className="mt-3 text-2xl font-black leading-snug text-[#eaf0ff] sm:text-3xl">
            {isSignup ? "أنشئ متجرك في دقيقتين" : "أهلاً بك من جديد"}
          </h1>
          <p className="max-w-sm text-sm leading-relaxed text-[#c3cdf0]/70">
            {isSignup
              ? "سجّل بحساب Google، وابدأ تجربتك المجانية 8 ساعات — بدون بطاقة بنكية."
              : "سجّل الدخول بحساب Google لمتابعة إدارة متجرك من لوحة التحكم."}
          </p>
        </div>

        {/* رسالة الخطأ */}
        {error ? (
          <div
            role="alert"
            aria-live="polite"
            className="relative mt-6 rounded-2xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-center text-sm text-red-200"
          >
            {errorMessage(error)}
          </div>
        ) : null}

        {/* زر Google عبر Server Action */}
        <div className="relative mt-8">
          <GoogleAuthCta
            redirectTo={redirectTo}
            label="متابعة بحساب Google"
            className="inline-flex h-12 w-full items-center justify-center gap-3 rounded-2xl bg-white text-[15px] font-bold text-[#0b0f1e] transition-all hover:bg-[#eaf0ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8fa8ff]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#07091a] disabled:cursor-not-allowed disabled:opacity-70"
          />
        </div>

        {/* ملاحظة الخصوصية */}
        <div className="relative mt-6 flex items-start justify-center gap-2 text-center text-xs leading-relaxed text-[#c3cdf0]/55">
          <ShieldCheck
            className="mt-0.5 size-3.5 shrink-0 text-[#8fa8ff]"
            aria-hidden="true"
          />
          <span>
            نستخدم بريدك واسمك وصورتك فقط. لا نصل إلى أي شيء آخر في حسابك.
          </span>
        </div>

        {/* تبديل بين login/signup */}
        <div className="relative mt-7 border-t border-white/10 pt-6 text-center text-sm text-[#c3cdf0]/70">
          {isSignup ? (
            <>
              لديك حساب بالفعل؟{" "}
              <Link
                href="/login"
                className="font-semibold text-[#8fa8ff] transition-colors hover:text-[#eaf0ff]"
              >
                سجّل الدخول
              </Link>
            </>
          ) : (
            <>
              جديد على Colapia؟{" "}
              <Link
                href="/signup"
                className="font-semibold text-[#8fa8ff] transition-colors hover:text-[#eaf0ff]"
              >
                ابدأ مجاناً
              </Link>
            </>
          )}
        </div>
      </div>

      <p className="mt-6 text-center text-xs leading-relaxed text-[#c3cdf0]/45">
        بمتابعتك أنت توافق على{" "}
        <Link href="/terms" className="underline-offset-4 hover:underline">
          شروط الاستخدام
        </Link>{" "}
        و{" "}
        <Link href="/privacy" className="underline-offset-4 hover:underline">
          سياسة الخصوصية
        </Link>
        .
      </p>
    </div>
  );
}