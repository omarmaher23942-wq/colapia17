"use client";

// EmailCodeLogin.tsx — الدخول برمز على البريد لمن لا يملك حساب Google (صاحب المتجر بالبريد الذي كتبه في الاستمارة،
// أو عضو فريق مدعو). الرد واحد دائماً عند طلب الرمز حتى لا تكشف الصفحة البُرد المسجّلة.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Mail } from "lucide-react";
import { requestLoginCodeAction, verifyLoginCodeAction } from "@/server/actions/merchant-login";

const input = "h-12 w-full rounded-2xl border border-white/15 bg-white/[0.04] px-4 text-[16px] text-[#eaf0ff] outline-none placeholder:text-[#c3cdf0]/40 focus:border-[#8fa8ff]";

export function EmailCodeLogin({ redirectTo }: { redirectTo: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-white/15 text-[14.5px] font-bold text-[#eaf0ff] hover:bg-white/[0.05]">
        <Mail className="size-4" aria-hidden="true" /> الدخول برمز على البريد
      </button>
    );
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        setMsg(null);
        start(async () => {
          if (!sent) {
            const r = await requestLoginCodeAction(email);
            if (!r.ok) return setMsg(r.error);
            setSent(true);
            setMsg("إن كان البريد مسجلاً لدينا فقد وصلكم رمز من 6 أرقام (راجعوا الرسائل غير المرغوبة).");
            return;
          }
          const r = await verifyLoginCodeAction(email, code, redirectTo);
          if (!r.ok) return setMsg(r.error);
          router.replace(r.redirect ?? "/dashboard");
          router.refresh();
        });
      }}
    >
      <label className="block text-[13px] font-bold text-[#c3cdf0]/80">
        البريد الذي كتبته في استمارة طلب متجرك (أو الذي دعاك عليه صاحب المتجر)
        <input className={`${input} mt-1.5`} type="email" dir="ltr" autoComplete="email" required value={email} disabled={sent} onChange={(e) => setEmail(e.target.value)} />
      </label>
      {sent ? (
        <label className="block text-[13px] font-bold text-[#c3cdf0]/80">
          الرمز
          <input className={`${input} mt-1.5 text-center tracking-[0.5em]`} inputMode="numeric" autoComplete="one-time-code" maxLength={6} required value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
        </label>
      ) : null}
      {msg ? (
        <p role="status" aria-live="polite" className="text-center text-[13px] leading-6 text-[#c3cdf0]">
          {msg}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#8fa8ff] text-[15px] font-black text-[#07091a] disabled:opacity-60">
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
        {sent ? "دخول" : "إرسال الرمز"}
      </button>
      {sent ? (
        <button type="button" onClick={() => (setSent(false), setCode(""), setMsg(null))} className="w-full text-center text-[12.5px] text-[#c3cdf0]/60 underline underline-offset-4">
          تغيير البريد أو طلب رمز جديد
        </button>
      ) : null}
    </form>
  );
}
