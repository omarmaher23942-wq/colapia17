"use client";

// هيدر لاصق. جلسة-واعي بالكامل:
// - guest  → "تسجيل الدخول" + "ابدأ بحساب Google"
// - merchant → زر واحد فقط "افتح الداشبورد"
// زر Google يستدعي Server Action مباشرة عبر GoogleAuthCta (لا رابط /api مكسور).
import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { Menu, X, LayoutDashboard } from "lucide-react";
import { ColapiaLogo } from "@/components/brand/ColapiaLogo";
import { CTA_PRIMARY } from "./shared";
import { GoogleAuthCta } from "./GoogleAuthCta";
import type { SessionState } from "./types";

const NAV = [
  { href: "#how", label: "كيف يعمل" },
  { href: "#designs", label: "أمثلة" },
  { href: "#features", label: "المميزات" },
  { href: "#ownership", label: "الملكية" },
  { href: "#pricing", label: "السعر" },
  { href: "#faq", label: "الأسئلة" },
];

const LOGIN_URL = "/login";
const DASHBOARD_URL = "/dashboard";

export function Header({ session }: { session: SessionState }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const isMerchant = session === "merchant";

  return (
    <header
      className={`sticky top-0 z-50 w-full transition-colors duration-300 ${
        scrolled
          ? "border-b border-white/10 bg-[#07091a]/80 backdrop-blur-xl"
          : "bg-transparent"
      }`}
    >
      <div className="container-x flex h-16 items-center justify-between sm:h-20">
        <Link href="/" aria-label="الصفحة الرئيسية - Colapia">
          <ColapiaLogo size={34} priority />
        </Link>

        <nav
          aria-label="التنقل الرئيسي"
          className="hidden items-center gap-8 lg:flex"
        >
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-[#c3cdf0]/80 transition-colors hover:text-[#eaf0ff]"
            >
              {item.label}
            </a>
          ))}
        </nav>

        {/* أزرار سطح المكتب */}
        <div className="hidden items-center gap-3 lg:flex">
          {isMerchant ? (
            <Link href={DASHBOARD_URL} className={CTA_PRIMARY}>
              <LayoutDashboard className="size-4" aria-hidden="true" />
              افتح الداشبورد
            </Link>
          ) : (
            <>
              <Link
                href={LOGIN_URL}
                className="text-sm font-semibold text-[#eaf0ff]/90 transition-colors hover:text-[#8fa8ff]"
              >
                تسجيل الدخول
              </Link>
              <GoogleAuthCta
                redirectTo={DASHBOARD_URL}
                label="ابدأ بحساب Google"
                className={CTA_PRIMARY}
              />
            </>
          )}
        </div>

        {/* زر الموبايل */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "إغلاق القائمة" : "فتح القائمة"}
          aria-expanded={open}
          aria-controls="mobile-nav"
          className="inline-flex size-10 items-center justify-center rounded-xl border border-white/10 text-[#eaf0ff] transition-colors hover:bg-white/5 lg:hidden"
        >
          {open ? (
            <X className="size-5" aria-hidden="true" />
          ) : (
            <Menu className="size-5" aria-hidden="true" />
          )}
        </button>
      </div>

      {/* قائمة الموبايل */}
      <AnimatePresence>
        {open && (
          <motion.div
            id="mobile-nav"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden border-b border-white/10 bg-[#07091a]/95 backdrop-blur-xl lg:hidden"
          >
            <nav
              aria-label="التنقل في الموبايل"
              className="container-x flex flex-col gap-1 py-4"
            >
              {NAV.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="rounded-xl px-3 py-3 text-base font-medium text-[#eaf0ff]/90 hover:bg-white/5"
                >
                  {item.label}
                </a>
              ))}

              <div className="mt-2 flex flex-col gap-3 border-t border-white/10 pt-4">
                {isMerchant ? (
                  <Link
                    href={DASHBOARD_URL}
                    className={CTA_PRIMARY}
                    onClick={() => setOpen(false)}
                  >
                    <LayoutDashboard className="size-4" aria-hidden="true" />
                    افتح الداشبورد
                  </Link>
                ) : (
                  <>
                    <Link
                      href={LOGIN_URL}
                      className="text-center text-sm font-semibold text-[#eaf0ff]/90"
                      onClick={() => setOpen(false)}
                    >
                      تسجيل الدخول
                    </Link>
                    <GoogleAuthCta
                      redirectTo={DASHBOARD_URL}
                      label="ابدأ بحساب Google"
                      className={`${CTA_PRIMARY} w-full`}
                    />
                  </>
                )}
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}