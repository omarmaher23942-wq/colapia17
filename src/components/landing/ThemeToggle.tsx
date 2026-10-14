"use client";

// مبدّل الوضع الفاتح/الداكن للهبوط: يضبط class على جذر .land ويحفظ الاختيار في المتصفح.
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

const KEY = "clp-land-theme";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const [light, setLight] = useState(false);

  useEffect(() => {
    setLight(Boolean(document.querySelector(".land.land-light")));
  }, []);

  function toggle() {
    const next = !light;
    document.querySelector(".land")?.classList.toggle("land-light", next);
    setLight(next);
    try {
      localStorage.setItem(KEY, next ? "light" : "dark");
    } catch {
      /* التخزين غير متاح: يبقى الاختيار للجلسة فقط */
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={light ? "الوضع الداكن" : "الوضع الفاتح"}
      className={`inline-flex size-10 items-center justify-center rounded-xl border border-white/10 text-[#eaf0ff] transition-colors hover:bg-white/5 ${className}`}
    >
      {light ? <Moon className="size-[18px]" aria-hidden="true" /> : <Sun className="size-[18px]" aria-hidden="true" />}
    </button>
  );
}
