"use client";

// هيدر لاصق للهبوط: روابط أقسام، تبديل الوضع، زر البدء الرئيسي، وزر ثانوي يتبع الجلسة
// (لوحة التحكم لمن لديه جلسة، وإلا تسجيل الدخول). قائمة الموبايل <dialog> أصلي (إغلاق بـ Esc والنقر خارجها).
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Menu, X, LayoutDashboard, LogIn, Instagram } from "lucide-react";
import { ColapiaLogo } from "@/components/brand/ColapiaLogo";
import { CTA_GHOST, CTA_PRIMARY } from "./shared";
import { ThemeToggle } from "./ThemeToggle";
import type { SessionState } from "./types";

const NAV = [
  { href: "#how", label: "كيف يعمل" },
  { href: "#themes", label: "التصميمات" },
  { href: "#dashboard", label: "لوحة التحكم" },
  { href: "#features", label: "المميزات" },
  { href: "#pricing", label: "الباقات" },
  { href: "#faq", label: "الأسئلة" },
];

const LOGIN_URL = "/login";
const DASHBOARD_URL = "/dashboard";
// مقاسات موحدة لأزرار الهيدر (أصغر من أزرار الأقسام).
const BTN = "min-h-11 !px-5 !py-2.5 !text-sm";
const LINK =
  "rounded-lg px-2 py-1.5 text-sm font-medium text-[#c3cdf0]/80 transition-colors hover:text-[#eaf0ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8fa8ff]";

export function Header({ session, igUrl }: { session: SessionState; igUrl: string }) {
  const [scrolled, setScrolled] = useState(false);
  const dlg = useRef<HTMLDialogElement>(null);
  const isMerchant = session === "merchant";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const openMenu = () => dlg.current?.showModal();
  const closeMenu = () => dlg.current?.close();

  const Secondary = ({ onClick, full }: { onClick?: () => void; full?: boolean }) => (
    <Link href={isMerchant ? DASHBOARD_URL : LOGIN_URL} onClick={onClick} className={`${CTA_GHOST} ${BTN} ${full ? "w-full" : ""}`}>
      {isMerchant ? <LayoutDashboard className="size-4" aria-hidden="true" /> : <LogIn className="size-4" aria-hidden="true" />}
      {isMerchant ? "لوحة التحكم" : "تسجيل الدخول"}
    </Link>
  );
  const Primary = ({ onClick, full }: { onClick?: () => void; full?: boolean }) => (
    <a href={igUrl} target="_blank" rel="noopener noreferrer" onClick={onClick} className={`${CTA_PRIMARY} ${BTN} ${full ? "w-full" : ""}`}>
      <Instagram className="size-4" aria-hidden="true" /> ابدأوا متجركم
    </a>
  );

  return (
    <header className={`sticky top-0 z-50 w-full transition-colors duration-300 ${scrolled ? "border-b border-white/10 bg-[#07091a]/80 backdrop-blur-xl" : "bg-transparent"}`}>
      <div className="container-x flex h-16 items-center justify-between gap-3 sm:h-20">
        <Link href="/" aria-label="الصفحة الرئيسية - Colapia" className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8fa8ff]">
          <ColapiaLogo size={34} priority />
        </Link>

        <nav aria-label="التنقل الرئيسي" className="hidden items-center gap-3 lg:flex xl:gap-5">
          {NAV.map((item) => (
            <a key={item.href} href={item.href} className={LINK}>
              {item.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <ThemeToggle />
          <Secondary />
          <Primary />
        </div>

        <div className="flex items-center gap-2 lg:hidden">
          <ThemeToggle />
          <button
            type="button"
            onClick={openMenu}
            aria-label="فتح القائمة"
            aria-haspopup="dialog"
            className="inline-flex size-11 items-center justify-center rounded-xl border border-white/10 text-[#eaf0ff] transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8fa8ff]"
          >
            <Menu className="size-5" aria-hidden="true" />
          </button>
        </div>
      </div>

      <dialog
        ref={dlg}
        aria-label="القائمة"
        onClick={(e) => {
          if (e.target === e.currentTarget) closeMenu();
        }}
        className="m-0 ms-auto h-dvh max-h-dvh w-[min(22rem,88vw)] border-s border-white/10 bg-[#07091a] p-0 text-[#eaf0ff] backdrop:bg-black/60 backdrop:backdrop-blur-sm"
      >
        <div dir="rtl" className="flex h-full flex-col gap-1 overflow-y-auto p-4">
          <div className="mb-2 flex items-center justify-between">
            <ColapiaLogo size={30} />
            <button
              type="button"
              onClick={closeMenu}
              aria-label="إغلاق القائمة"
              className="inline-flex size-11 items-center justify-center rounded-xl border border-white/10 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8fa8ff]"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          </div>
          <nav aria-label="التنقل في الموبايل" className="flex flex-col gap-1">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={closeMenu}
                className="min-h-11 rounded-xl px-3 py-3 text-base font-medium text-[#eaf0ff]/90 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8fa8ff]"
              >
                {item.label}
              </a>
            ))}
          </nav>
          <div className="mt-auto flex flex-col gap-3 border-t border-white/10 pt-4">
            <Primary onClick={closeMenu} full />
            <Secondary onClick={closeMenu} full />
          </div>
        </div>
      </dialog>
    </header>
  );
}
