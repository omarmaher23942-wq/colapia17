// AuthShell — إطار صفحات الدخول والإعداد وإعادة التعيين لأصحاب المتاجر: خلفية داكنة مضيئة وبطاقة زجاجية وشعار. مكوّن خادم.
import type { ReactNode } from "react";
import { ColapiaLogo } from "@/components/brand/ColapiaLogo";

export const AUTH_CARD =
  "relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.01] p-6 shadow-[0_40px_120px_-40px_rgba(111,134,255,0.35)] backdrop-blur-2xl sm:p-9";

export function AuthShell({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  return (
    <main dir="rtl" lang="ar" className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[#07091a] px-4 py-10 text-[#eaf0ff] sm:px-5 sm:py-16">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(111,134,255,0.22),transparent_70%),radial-gradient(50%_40%_at_80%_100%,rgba(143,168,255,0.12),transparent_70%)]" />
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <ColapiaLogo size={36} />
        </div>
        {children}
        {footer}
      </div>
    </main>
  );
}

export function AuthNotice({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className={`${AUTH_CARD} text-center`}>
      <h1 className="text-xl font-black">{title}</h1>
      <div className="mx-auto mt-3 max-w-sm text-[14px] leading-7 text-[#c3cdf0]/80">{children}</div>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export const AUTH_BTN =
  "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white px-6 text-[15px] font-black text-[#0b0f1e] transition hover:bg-[#eaf0ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8fa8ff]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#07091a] disabled:cursor-not-allowed disabled:opacity-60";
export const AUTH_BTN_GHOST =
  "inline-flex min-h-12 items-center justify-center rounded-2xl border border-white/15 px-6 text-[14.5px] font-bold text-[#eaf0ff] hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8fa8ff]/60";
export const AUTH_INPUT =
  "min-h-12 w-full rounded-2xl border border-white/15 bg-white/[0.04] px-4 text-[15px] text-[#eaf0ff] placeholder:text-[#c3cdf0]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8fa8ff]/60";
