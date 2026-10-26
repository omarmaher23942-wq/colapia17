"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { AUTH_BTN } from "@/components/auth/AuthShell";
import { PasswordField } from "@/components/auth/PasswordField";
import { passwordIssues } from "@/lib/password-rules";
import { resetPasswordWithLinkAction } from "@/server/actions/merchant-login";

export function ResetForm({ token, email }: { token: string; email: string | null }) {
  const router = useRouter();
  const [pw, setPw] = useState("");
  const [again, setAgain] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const issues = passwordIssues(pw, { email });
    if (issues.length) return setError(`كلمة المرور يجب أن ${issues[0]}`);
    if (pw !== again) return setError("كلمتا المرور غير متطابقتين.");
    start(async () => {
      const r = await resetPasswordWithLinkAction(token, pw).catch(() => ({ ok: false as const, error: "انقطع الاتصال، أعيدوا المحاولة." }));
      if (!r.ok) return setError(r.error);
      router.replace(r.redirect ?? "/dashboard");
    });
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <PasswordField label="كلمة المرور الجديدة" value={pw} onChange={setPw} autoComplete="new-password" email={email} meter />
      <PasswordField label="أعيدوا كتابتها" value={again} onChange={setAgain} autoComplete="new-password" />
      {error ? (
        <p role="alert" className="rounded-2xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-center text-[13px] text-red-200">
          {error}
        </p>
      ) : null}
      <button type="submit" disabled={pending} aria-busy={pending} className={AUTH_BTN}>
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
        حفظ والدخول
      </button>
    </form>
  );
}
