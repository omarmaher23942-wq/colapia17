// AuthShell — غلاف صفحات الدخول والإعداد الأول لصاحب المتجر. هوية المتجر نفسه (اسمه) بلا أي علامة أخرى.
import { STORE } from "@/store.config";

export const authCard = "relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.01] p-6 shadow-[0_40px_120px_-40px_rgba(111,134,255,0.35)] backdrop-blur-2xl sm:p-9";
export const authInput =
  "block min-h-12 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-[15px] text-[#eaf0ff] placeholder:text-[#c3cdf0]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8fa8ff]/60";
export const authButton =
  "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white px-5 text-[15px] font-black text-[#0b0f1e] transition hover:bg-[#eaf0ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8fa8ff]/60 disabled:opacity-60";
export const authGhost =
  "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-white/15 px-5 text-[14.5px] font-bold text-[#eaf0ff] transition hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8fa8ff]/60";

export function AuthShell({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <main dir="rtl" lang="ar" className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[#07091a] px-4 py-10 text-[#eaf0ff] sm:px-5 sm:py-16">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(111,134,255,0.22),transparent_70%),radial-gradient(50%_40%_at_80%_100%,rgba(143,168,255,0.12),transparent_70%)]" />
      <div className={wide ? "w-full max-w-2xl" : "w-full max-w-md"}>
        <p className="mb-6 text-center text-[22px] font-black tracking-tight">{STORE.name}</p>
        {children}
      </div>
    </main>
  );
}
