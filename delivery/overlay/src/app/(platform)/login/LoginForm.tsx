"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { authButton, authInput } from "@/components/owner/AuthShell";
import { signInAction, type LoginState } from "./actions";

export function LoginForm({ redirectTo, defaultEmail }: { redirectTo: string; defaultEmail: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(signInAction, { error: null });
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="redirect" value={redirectTo} />
      <div className="space-y-1.5">
        <label htmlFor="email" className="block text-[13px] font-bold text-[#c3cdf0]">
          البريد الإلكتروني
        </label>
        <input id="email" name="email" type="email" inputMode="email" autoComplete="username" dir="ltr" defaultValue={defaultEmail} required className={authInput} />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="password" className="block text-[13px] font-bold text-[#c3cdf0]">
          كلمة المرور
        </label>
        <input id="password" name="password" type="password" autoComplete="current-password" dir="ltr" required className={authInput} />
      </div>
      {state.error ? (
        <p role="alert" className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-[13px] font-bold text-rose-200">
          {state.error}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className={authButton}>
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
        تسجيل الدخول
      </button>
      <p className="text-center text-[13px]">
        <Link href="/login/recover" className="text-[#c3cdf0]/80 underline underline-offset-4 hover:text-white">
          نسيتم كلمة المرور؟ استرجاع برمز الاسترجاع
        </Link>
      </p>
    </form>
  );
}
