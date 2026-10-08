"use client";

// components/storefront/MagicLinkLoginForm.tsx — نموذج طلب رابط الدخول.
import { useState, useTransition } from "react";
import { Mail, Loader2, CheckCircle2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { requestMagicLinkAction } from "@/server/actions/customer-auth";
import { cn } from "@/lib/utils";

const SW = 1.75;

export function MagicLinkLoginForm({
  storeSubdomain,
  redirectAfter,
}: {
  storeSubdomain: string;
  redirectAfter: string;
}) {
  const [email, setEmail] = useState("");
  const [pending, start] = useTransition();
  const [sent, setSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes("@")) {
      toast.error("أدخل بريداً إلكترونياً صحيحاً");
      return;
    }

    start(async () => {
      const res = await requestMagicLinkAction(storeSubdomain, {
        email: email.trim().toLowerCase(),
        redirectAfter,
      });
      if (res.ok) {
        setSent(true);
        toast.success("وصلك الرابط على بريدك الإلكتروني");
      } else {
        toast.error(res.error ?? "تعذّر إرسال الرابط");
      }
    });
  };

  if (sent) {
    return (
      <div
        className="space-y-3 rounded-2xl border p-4 text-center"
        style={{
          background: "color-mix(in srgb, var(--primary) 6%, transparent)",
          borderColor: "color-mix(in srgb, var(--primary) 25%, transparent)",
        }}
      >
        <div
          className="mx-auto grid size-10 place-items-center rounded-full"
          style={{
            background: "color-mix(in srgb, var(--primary) 15%, transparent)",
            color: "var(--primary)",
          }}
        >
          <CheckCircle2 className="size-5" strokeWidth={2.25} aria-hidden="true" />
        </div>
        <div>
          <p className="text-sm font-black">وصلك الرابط</p>
          <p className="mt-1 text-[11px] leading-relaxed opacity-70">
            افتح بريدك <b dir="ltr">{email}</b> واضغط الرابط لتسجيل الدخول.
            الرابط صالح 15 دقيقة.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setSent(false)}
          className="text-[11px] font-bold underline-offset-4 hover:underline"
          style={{ color: "var(--primary)" }}
        >
          جرب بريد آخر
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 text-start">
      <label className="block">
        <span className="mb-1.5 block text-[11px] font-bold opacity-80">
          البريد الإلكتروني
        </span>
        <div className="relative">
          <Mail
            className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 opacity-50"
            strokeWidth={SW}
            aria-hidden="true"
          />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            dir="ltr"
            autoComplete="email"
            required
            maxLength={200}
            className={cn(
              "h-12 w-full rounded-xl border pe-10 ps-3.5 font-mono text-xs font-bold outline-none focus:ring-2"
            )}
            style={{
              background: "var(--background)",
              borderColor: "var(--border)",
              color: "var(--foreground)",
            }}
          />
        </div>
      </label>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-sm font-black shadow-md transition-all hover:brightness-110 active:scale-[0.98] disabled:cursor-wait disabled:opacity-70"
        style={{
          background: "var(--primary)",
          color: "var(--primary-foreground)",
        }}
      >
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" strokeWidth={2.25} aria-hidden="true" />
            <span>جاري الإرسال...</span>
          </>
        ) : (
          <>
            <span>أرسل لي رابط الدخول</span>
            <ArrowRight className="size-4" strokeWidth={2.5} aria-hidden="true" />
          </>
        )}
      </button>
    </form>
  );
}