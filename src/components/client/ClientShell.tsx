import Link from "next/link";
import { LogOut } from "lucide-react";
import { ColapiaLogo } from "@/components/brand/ColapiaLogo";
import { merchantLogoutAction } from "@/server/actions/auth";

const TABS = [
  ["/dashboard", "مشروعي"],
  ["/dashboard/edit", "طلب تعديل"],
  ["/dashboard/history", "السجل"],
] as const;

/** إطار بوابة العميل (حساب بلا متجر مستضاف): رأس بسيط وتبويبات ثلاثة، بثيم اللوحة نفسه (فاتح/داكن). */
export function ClientShell({ name, email, theme, followSystem, children }: { name: string; email: string | null; theme: "light" | "dark"; followSystem: boolean; children: React.ReactNode }) {
  return (
    <div dir="rtl" suppressHydrationWarning className={`dash dash-cosmos min-h-dvh text-ink ${theme === "dark" ? "dark" : ""}`}>
      {followSystem ? <script dangerouslySetInnerHTML={{ __html: "try{if(matchMedia('(prefers-color-scheme: dark)').matches)document.currentScript.parentElement.classList.add('dark')}catch(e){}" }} /> : null}
      <header className="border-b border-edge/10">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <ColapiaLogo size={28} />
          <div className="flex items-center gap-3">
            <span className="hidden text-[12.5px] text-ink-3 sm:inline" dir="ltr">{email ?? name}</span>
            <form action={merchantLogoutAction}>
              <button type="submit" className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-[12.5px] font-bold text-ink-2 hover:bg-edge/5">
                <LogOut className="size-4" aria-hidden="true" /> خروج
              </button>
            </form>
          </div>
        </div>
        <nav aria-label="أقسام الحساب" className="mx-auto flex max-w-3xl gap-1 px-3">
          {TABS.map(([href, label]) => (
            <Link key={href} href={href} className="inline-flex min-h-11 items-center rounded-t-lg px-3.5 text-[13px] font-black text-ink-2 hover:text-ink">
              {label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-3xl px-4 py-6 pb-24">{children}</main>
    </div>
  );
}
