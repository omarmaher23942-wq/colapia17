"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { authButton, authGhost, authInput } from "@/components/owner/AuthShell";
import { RecoveryCodeCard } from "@/components/owner/RecoveryCodeCard";
import { recoverAction, type RecoverState } from "../actions";

export function RecoverForm() {
  const [state, action, pending] = useActionState<RecoverState, FormData>(recoverAction, { error: null });
  if (state.recoveryCode) {
    return (
      <div className="space-y-4">
        <p className="text-center text-[14px] font-bold text-emerald-200">تم تعيين كلمة المرور الجديدة وأنتم الآن داخل اللوحة.</p>
        <RecoveryCodeCard code={state.recoveryCode} />
        <Link href="/dashboard" className={authGhost}>
          فتح لوحة التحكم
        </Link>
      </div>
    );
  }
  return (
    <form action={action} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <label htmlFor="code" className="block text-[13px] font-bold text-[#c3cdf0]">
          رمز الاسترجاع
        </label>
        <input id="code" name="code" dir="ltr" autoComplete="off" placeholder="XXXX-XXXX-XXXX-XXXX" required className={`${authInput} font-mono tracking-wider`} />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="password" className="block text-[13px] font-bold text-[#c3cdf0]">
          كلمة المرور الجديدة <span className="font-normal text-[#c3cdf0]/60">(10 أحرف على الأقل)</span>
        </label>
        <input id="password" name="password" type="password" autoComplete="new-password" dir="ltr" minLength={10} required className={authInput} />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="confirm" className="block text-[13px] font-bold text-[#c3cdf0]">
          تأكيد كلمة المرور
        </label>
        <input id="confirm" name="confirm" type="password" autoComplete="new-password" dir="ltr" minLength={10} required className={authInput} />
      </div>
      {state.error ? (
        <p role="alert" className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-[13px] font-bold text-rose-200">
          {state.error}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className={authButton}>
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
        تعيين كلمة المرور
      </button>
    </form>
  );
}
