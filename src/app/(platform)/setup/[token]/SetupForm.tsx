"use client";

// SetupForm — وضع كلمة المرور لأول مرة من رابط الإعداد، ثم الدخول إلى الإعداد المخصص. عند فتح الصفحة يبدأ عدّاد المعاينة المجانية
// (مرة واحدة، من المتصفح لا من زاحف معاينة)، ويُخبَر صاحب المتجر بذلك قبل أن يكتب شيئاً.
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Clock3, Loader2 } from "lucide-react";
import { PasswordField } from "@/components/auth/PasswordField";
import { AUTH_BTN } from "@/components/auth/AuthShell";
import { passwordIssues } from "@/lib/password-rules";
import { completeSetupAction, openSetupLinkAction } from "./actions";

export function SetupForm({ token, email, trialHours }: { token: string; email: string | null; trialHours: number }) {
  const router = useRouter();
  const [pw, setPw] = useState("");
  const [again, setAgain] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    void openSetupLinkAction(token).catch(() => {});
  }, [token]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const issues = passwordIssues(pw, { email });
    if (issues.length) return setError(`كلمة المرور يجب أن ${issues[0]}`);
    if (pw !== again) return setError("كلمتا المرور غير متطابقتين.");
    start(async () => {
      const r = await completeSetupAction(token, pw).catch(() => ({ ok: false as const, error: "انقطع الاتصال، أعيدوا المحاولة." }));
      if (!r.ok) return setError(r.error);
      router.replace(r.redirect);
    });
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <p className="flex items-start gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-[12.5px] leading-6 text-[#c3cdf0]/85">
        <Clock3 className="mt-1 size-4 shrink-0 text-[#8fa8ff]" aria-hidden="true" />
        تبدأ معاينتكم المجانية ({trialHours} ساعة) من لحظة فتح هذا الرابط، ولا دفع قبل أن يعجبكم المتجر.
      </p>
      {email ? (
        <p className="text-[13px] text-[#c3cdf0]/80">
          بريد الدخول: <bdi dir="ltr" className="font-mono font-bold text-[#eaf0ff]">{email}</bdi>
        </p>
      ) : null}
      <PasswordField label="اختاروا كلمة مرور للوحة التحكم" value={pw} onChange={setPw} autoComplete="new-password" email={email} meter />
      <PasswordField label="أعيدوا كتابة كلمة المرور" value={again} onChange={setAgain} autoComplete="new-password" describedBy="setup-error" />
      {error ? (
        <p id="setup-error" role="alert" className="rounded-2xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-center text-[13px] text-red-200">
          {error}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className={AUTH_BTN} aria-busy={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
        حفظ والمتابعة إلى الإعداد
      </button>
      <p className="text-center text-[12px] leading-6 text-[#c3cdf0]/60">كلمة المرور لكم ولفريقكم فقط، ولا تظهر لأحد من فريق Colapia.</p>
    </form>
  );
}
