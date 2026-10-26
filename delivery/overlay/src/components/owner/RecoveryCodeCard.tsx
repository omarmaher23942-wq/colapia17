"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/** رمز الاسترجاع يظهر مرة واحدة: نسخ وتنبيه صريح لحفظه في مكان آمن. */
export function RecoveryCodeCard({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-2xl border border-amber-300/30 bg-amber-300/[0.07] p-4">
      <p className="text-[13px] font-black text-amber-100">رمز الاسترجاع (يظهر هذه المرة فقط)</p>
      <p dir="ltr" className="mt-2 select-all rounded-xl bg-black/30 px-3 py-3 text-center font-mono text-[18px] font-black tracking-widest text-white">
        {code}
      </p>
      <p className="mt-2 text-[12.5px] leading-6 text-amber-100/80">احفظوه في مدير كلمات المرور أو مكان آمن. بدونه لا يمكن استرجاع الدخول إن نُسيت كلمة المرور.</p>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard?.writeText(code).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          });
        }}
        className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 px-4 text-[13px] font-bold text-white hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8fa8ff]/60"
      >
        {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
        {copied ? "تم النسخ" : "نسخ الرمز"}
      </button>
    </div>
  );
}
