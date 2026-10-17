"use client";

// SetupCodeLogin — الدخول برمز من 6 أرقام يصل إلى بريد المتجر المسجّل (بديل Google). البريد لا يظهر ولا يُكتب هنا:
// الخادم يعرفه من الرمز الموقّع في الرابط.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Mail } from "lucide-react";
import { requestSetupCodeAction, verifySetupCodeAction } from "./actions";

const input = "h-12 w-full rounded-2xl border border-white/15 bg-white/[0.04] px-4 text-center text-[18px] tracking-[0.5em] text-[#eaf0ff] outline-none placeholder:text-[#c3cdf0]/40 focus:border-[#8fa8ff]";

export function SetupCodeLogin({ token, maskedEmail }: { token: string; maskedEmail: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setMsg(null);
          start(async () => {
            const r = await requestSetupCodeAction(token);
            if (!r.ok) return setMsg(r.error);
            setSent(true);
            setMsg(`أرسلنا رمزاً من 6 أرقام إلى ${maskedEmail}. راجعوا الرسائل غير المرغوبة إن لم يصل.`);
          });
        }}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-white/15 text-[14.5px] font-bold text-[#eaf0ff] transition hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8fa8ff]"
      >
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
          const r = await verifySetupCodeAction(token, code);
          if (!r.ok) return setMsg(r.error);
          router.replace(r.redirect ?? "/onboarding");
          router.refresh();
        });
      }}
    >
      {msg ? (
        <p role="status" aria-live="polite" className="text-center text-[13px] leading-6 text-[#c3cdf0]">
          {msg}
        </p>
      ) : null}
      {sent ? (
        <>
          <label className="block text-[13px] font-bold text-[#c3cdf0]/80">
            الرمز
            <input className={`${input} mt-1.5`} inputMode="numeric" autoComplete="one-time-code" maxLength={6} required autoFocus value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
          </label>
          <button type="submit" disabled={pending || code.length !== 6} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#8fa8ff] text-[15px] font-black text-[#07091a] disabled:opacity-60">
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null} دخول
          </button>
        </>
      ) : pending ? (
        <p className="flex items-center justify-center gap-2 text-[13px] text-[#c3cdf0]">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" /> جارٍ إرسال الرمز
        </p>
      ) : (
        <button type="button" onClick={() => setOpen(false)} className="w-full text-center text-[12.5px] text-[#c3cdf0]/60 underline underline-offset-4">
          رجوع
        </button>
      )}
    </form>
  );
}
