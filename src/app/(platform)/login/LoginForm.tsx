"use client";

// بطاقة تسجيل دخول بنمط Linear/Cosmic (E3):
// - زجاجية، خلفية متوهجة، حواف ناعمة، أيقونة Google حقيقية.
// - زر واحد موحّد عبر Server Action (E4) — لا onClick يدوي.
// - حجم اللمس >= 48px (E6)، وaria-busy وقت التحميل.
// - بدون أي emoji، فقط Lucide Icons (E7).
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { NoStoreNotice } from "@/components/auth/NoStoreNotice";
import { switchMerchantAccountAction } from "./actions";
import { GoogleAuthCta } from "@/components/landing/GoogleAuthCta";
import { EmailCodeLogin } from "./EmailCodeLogin";

type Variant = "login" | "signup";

const ERROR_MESSAGES: Record<string, string> = {
  invalid_state: "انتهت صلاحية محاولة الدخول أو فُتحت من متصفح آخر. أعيدوا المحاولة من هنا.",
  missing_params: "لم يكتمل الدخول بحساب Google. أعيدوا المحاولة.",
  no_email: "لم يشارك Google بريد الحساب معنا. اختاروا حساباً يحتوي بريداً وأعيدوا المحاولة.",
  email_not_verified: "بريد حساب Google غير مؤكد. أكّدوه في Google أولاً ثم أعيدوا المحاولة.",
  provider_access_denied: "لم تسمحوا بالوصول إلى بريدكم واسمكم، ونحتاجهما لإكمال الدخول.",
  google_identity_mismatch: "هذا البريد مرتبط بحساب Google آخر. ادخلوا بالحساب الذي استخدمتموه سابقاً.",
  unsupported_provider: "تعذّر إتمام الدخول. أعيدوا المحاولة.",
  server_error: "حدث خطأ مؤقت أثناء الدخول. أعيدوا المحاولة بعد لحظات.",
  // رموز قديمة قد تصل من روابط محفوظة.
  google_auth_failed: "تعذّر إتمام الدخول بحساب Google. أعيدوا المحاولة.",
  oauth_failed: "تعذّر إتمام تسجيل الدخول. أعيدوا المحاولة.",
  state_mismatch: "انتهت صلاحية الجلسة. أعيدوا المحاولة.",
  email_unverified: "يرجى تأكيد بريدكم في Google أولاً.",
  access_denied: "لم تسمحوا بالوصول. نحتاج بريدكم واسمكم للمتابعة.",
};

export function errorMessage(code: string): string {
  return ERROR_MESSAGES[code] ?? (code.startsWith("provider_") ? "أوقف Google عملية الدخول. أعيدوا المحاولة." : "حدث خطأ غير متوقع. أعيدوا المحاولة.");
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
            {isSignup ? "لوحة متجرك" : "دخول لوحة متجرك"}
          </h1>
          <p className="max-w-sm text-sm leading-relaxed text-[#c3cdf0]/70">
            {isSignup
              ? "سجّلوا الدخول بحساب Google للوصول إلى لوحة المتجر."
              : "سجّلوا الدخول بحساب Google المرتبط بالبريد الذي كتبتموه في استمارة الطلب، أو برمز يصل إلى البريد نفسه."}
          </p>
        </div>

        {/* لا متجر مرتبط بالحساب: شاشة لطيفة بتبديل الحساب */}
        {error === "no_store" ? <NoStoreNotice className="relative mt-6" switchAction={switchMerchantAccountAction.bind(null, redirectTo)} /> : null}

        {/* رسالة الخطأ */}
        {error && error !== "no_store" ? (
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

        <div className="relative mt-3">
          <EmailCodeLogin redirectTo={redirectTo} />
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
              ليس لديكم متجر بعد؟ راسلونا على إنستجرام وسيجهّز لكم المساعد متجركم.
            </>
          )}
        </div>
      </div>

      <p className="mt-6 text-center text-xs leading-relaxed text-[#c3cdf0]/45">
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
    </div>
  );
}