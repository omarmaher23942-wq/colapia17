"use client";

import { useActionState } from "react";
import { bootstrapOwnerAction } from "@/server/actions/platform-auth";

export default function BootstrapPage() {
  const [state, action, pending] = useActionState(
    bootstrapOwnerAction,
    null as { error?: string } | null
  );

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#0b0f14] p-4 text-slate-100" dir="rtl">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0f141b] p-6 shadow-2xl">
        <h1 className="text-xl font-black text-white">تهيئة مالك المنصة</h1>
        <p className="mt-1 text-xs text-slate-400">تُستخدم مرة واحدة فقط عند إنشاء المنصة</p>
        <form action={action} className="mt-5 space-y-3">
          <input
            name="secret"
            type="password"
            placeholder="BOOTSTRAP_OWNER_SECRET"
            dir="ltr"
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white focus:outline-none focus:border-teal-500"
            required
          />
          <input
            name="name"
            placeholder="اسم المالك"
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white focus:outline-none focus:border-teal-500"
            required
          />
          <input
            name="email"
            type="email"
            placeholder="البريد الإلكتروني"
            dir="ltr"
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white focus:outline-none focus:border-teal-500"
            required
          />
          <input
            name="password"
            type="password"
            placeholder="كلمة المرور (10 أحرف فأكثر)"
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white focus:outline-none focus:border-teal-500"
            required
            minLength={10}
          />
          {state?.error && <p className="text-xs text-red-400">{state.error}</p>}
          <button
            disabled={pending}
            className="w-full rounded-lg bg-teal-500 py-2.5 text-sm font-bold text-black hover:bg-teal-400 disabled:opacity-50"
          >
            {pending ? "جارٍ الإنشاء..." : "إنشاء حساب المالك"}
          </button>
        </form>
      </div>
    </div>
  );
}