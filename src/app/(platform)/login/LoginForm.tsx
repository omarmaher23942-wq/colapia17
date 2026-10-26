"use client";

// LoginForm — دخول صاحب المتجر وفريقه ببريد وكلمة مرور. «نسيت كلمة المرور»: رمز من 6 أرقام على البريد ثم كلمة جديدة؛
// وإن تعذّر البريد تُعرض خطوة طلب رابط إعادة التعيين من الفريق. لا Google هنا (يبقى لفريق المنصة في /admin/login).
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { AUTH_BTN, AUTH_CARD, AUTH_INPUT } from "@/components/auth/AuthShell";
import { PasswordField } from "@/components/auth/PasswordField";
import { passwordIssues } from "@/lib/password-rules";
import { passwordLoginAction, requestResetCodeAction, resetPasswordWithCodeAction } from "@/server/actions/merchant-login";

type Mode = "login" | "forgot" | "code";

const label = "mb-1.5 block text-[13px] font-bold text-[#c3cdf0]";

export function LoginForm({ redirectTo }: { redirectTo: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<{ tone: "bad" | "info"; text: string } | null>(null);
  const [pending, start] = useTransition();

  const fail = (text: string) => setMsg({ tone: "bad", text });
  const done = (to?: string) => router.replace(to ?? redirectTo);

  function login(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    start(async () => {
      const r = await passwordLoginAction(email, pw, redirectTo).catch(() => ({ ok: false as const, error: "انقطع الاتصال، أعيدوا المحاولة." }));
      if (!r.ok) return fail(r.error);
      done(r.redirect);
    });
  }

  function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    start(async () => {
      const r = await requestResetCodeAction(email).catch(() => ({ ok: false as const, error: "انقطع الاتصال، أعيدوا المحاولة." }));
      if (!r.ok) return fail(r.error);
      if (r.manual) return setMsg({ tone: "info", text: "الإرسال بالبريد غير متاح حالياً. راسلوا فريقنا في المحادثة نفسها وسيرسل لكم رابطاً لإعادة تعيين كلمة المرور خلال دقائق." });
      setMode("code");
      setMsg({ tone: "info", text: "إن كان البريد مسجلاً لدينا فقد أرسلنا رمزاً من 6 أرقام. تحققوا من صندوق الوارد." });
    });
  }

  function reset(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const issues = passwordIssues(pw, { email });
    if (issues.length) return fail(`كلمة المرور يجب أن ${issues[0]}`);
    start(async () => {
      const r = await resetPasswordWithCodeAction(email, code, pw, redirectTo).catch(() => ({ ok: false as const, error: "انقطع الاتصال، أعيدوا المحاولة." }));
      if (!r.ok) return fail(r.error);
      done(r.redirect);
    });
  }

  const emailField = (
    <div>
      <label htmlFor="login-email" className={label}>
        البريد الإلكتروني
      </label>
      <input id="login-email" type="email" dir="ltr" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} className={`${AUTH_INPUT} text-start`} />
    </div>
  );
  const btn = (text: string) => (
    <button type="submit" disabled={pending} aria-busy={pending} className={AUTH_BTN}>
      {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
      {text}
    </button>
  );

  return (
    <div className="w-full max-w-md">
      <div className={AUTH_CARD}>
        <div className="text-center">
          <h1 className="text-2xl font-black leading-snug sm:text-3xl">{mode === "login" ? "دخول لوحة متجركم" : "استعادة كلمة المرور"}</h1>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-[#c3cdf0]/70">
            {mode === "login" ? "ادخلوا بالبريد وكلمة المرور اللذين اخترتموهما عند إعداد المتجر." : mode === "forgot" ? "اكتبوا بريدكم ونرسل لكم رمزاً لاختيار كلمة مرور جديدة." : "اكتبوا الرمز الذي وصل بريدكم ثم اختاروا كلمة المرور الجديدة."}
          </p>
        </div>

        {msg ? (
          <p role={msg.tone === "bad" ? "alert" : "status"} className={`mt-5 rounded-2xl border px-4 py-3 text-center text-[13px] ${msg.tone === "bad" ? "border-red-400/30 bg-red-400/10 text-red-200" : "border-white/10 bg-white/[0.04] text-[#c3cdf0]"}`}>
            {msg.text}
          </p>
        ) : null}

        {mode === "login" ? (
          <form onSubmit={login} className="mt-6 space-y-4" noValidate>
            {emailField}
            <PasswordField label="كلمة المرور" value={pw} onChange={setPw} autoComplete="current-password" />
            {btn("دخول")}
            <button type="button" onClick={() => { setMsg(null); setMode("forgot"); }} className="mx-auto block min-h-11 text-[13.5px] font-bold text-[#8fa8ff] hover:text-[#eaf0ff]">
              نسيت كلمة المرور
            </button>
          </form>
        ) : null}

        {mode === "forgot" ? (
          <form onSubmit={sendCode} className="mt-6 space-y-4" noValidate>
            {emailField}
            {btn("إرسال الرمز")}
            <button type="button" onClick={() => { setMsg(null); setMode("login"); }} className="mx-auto block min-h-11 text-[13.5px] font-bold text-[#8fa8ff]">
              العودة للدخول
            </button>
          </form>
        ) : null}

        {mode === "code" ? (
          <form onSubmit={reset} className="mt-6 space-y-4" noValidate>
            <div>
              <label htmlFor="login-code" className={label}>
                الرمز (6 أرقام)
              </label>
              <input id="login-code" dir="ltr" inputMode="numeric" autoComplete="one-time-code" maxLength={8} value={code} onChange={(e) => setCode(e.target.value)} className={`${AUTH_INPUT} text-center tracking-[0.4em]`} />
            </div>
            <PasswordField label="كلمة المرور الجديدة" value={pw} onChange={setPw} autoComplete="new-password" email={email} meter />
            {btn("حفظ والدخول")}
            <button type="button" onClick={() => { setMsg(null); setMode("forgot"); }} className="mx-auto block min-h-11 text-[13.5px] font-bold text-[#8fa8ff]">
              إعادة إرسال الرمز
            </button>
          </form>
        ) : null}

        <p className="mt-6 border-t border-white/10 pt-5 text-center text-sm text-[#c3cdf0]/70">لا متجر لديكم بعد؟ راسلونا على إنستجرام وسنجهّز لكم متجراً مخصصاً.</p>
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
