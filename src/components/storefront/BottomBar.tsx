"use client";

// BottomBar — شريط تبويب سفلي للموبايل (الرئيسية، الأقسام، البحث، المفضلة، السلة). يضبط --clp-bottom-offset على الصفحة
// فيرتفع فوقه زر واتساب وشريط الشراء الثابت وشريط إجمالي الدفع، ويُخفى في الدفع والسلة الكاملة.
import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Heart, Home, LayoutGrid, Search, ShoppingBag } from "lucide-react";
import { useCart } from "@/store/cart";
import { useWishlist } from "@/store/wishlist";
import { useHydrated } from "./CartView";
import { cn } from "@/lib/utils";

const HIDE_ON = ["/checkout", "/cart", "/order"];

export function BottomBar({ hasCategories }: { hasCategories: boolean }) {
  const path = usePathname() ?? "/";
  const hydrated = useHydrated();
  const count = useCart((s) => s.count());
  const openCart = useCart((s) => s.open);
  const wish = useWishlist((s) => s.slugs.length);
  const hidden = HIDE_ON.some((p) => path === p || path.startsWith(p + "/"));

  useEffect(() => {
    const el = document.documentElement;
    if (hidden) {
      el.style.setProperty("--clp-bottom-offset", "0px");
      return;
    }
    // ارتفاع الشريط + منطقة الأمان؛ السكربت يكتب القيمة الفعلية بعد القياس.
    const bar = document.getElementById("clp-bottom-bar");
    const set = () => el.style.setProperty("--clp-bottom-offset", `${bar ? bar.offsetHeight : 64}px`);
    set();
    window.addEventListener("resize", set);
    return () => {
      window.removeEventListener("resize", set);
      el.style.setProperty("--clp-bottom-offset", "0px");
    };
  }, [hidden]);

  if (hidden) return null;
  const items: { key: string; label: string; href?: string; icon: React.ReactNode; badge?: number; on?: () => void; active: boolean }[] = [
    { key: "home", label: "الرئيسية", href: "/", icon: <Home className="size-5" />, active: path === "/" },
    ...(hasCategories ? [{ key: "cats", label: "الأقسام", href: "/all", icon: <LayoutGrid className="size-5" />, active: path.startsWith("/c/") || path === "/all" }] : []),
    { key: "search", label: "البحث", href: "/search", icon: <Search className="size-5" />, active: path === "/search" },
    { key: "wish", label: "المفضلة", href: "/wishlist", icon: <Heart className="size-5" />, badge: hydrated ? wish : 0, active: path === "/wishlist" },
    { key: "cart", label: "السلة", icon: <ShoppingBag className="size-5" />, badge: hydrated ? count : 0, on: openCart, active: false },
  ];

  return (
    <nav
      id="clp-bottom-bar"
      aria-label="التنقل السريع"
      className="fixed inset-x-0 bottom-0 z-40 border-t backdrop-blur-xl md:hidden"
      style={{ background: "color-mix(in srgb, var(--background) 94%, transparent)", borderColor: "var(--border)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <ul className="grid" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map((it) => {
          const inner = (
            <>
              <span className="relative">
                {it.icon}
                {it.badge ? (
                  <span className="absolute -end-2 -top-1.5 grid min-w-4 place-items-center rounded-full px-1 text-[11px] font-black leading-4 tabular-nums" style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}>
                    {it.badge}
                  </span>
                ) : null}
              </span>
              <span className="text-[12px] font-bold">{it.label}</span>
            </>
          );
          const cls = cn("flex min-h-14 w-full flex-col items-center justify-center gap-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset", it.active ? "text-[var(--primary)]" : "opacity-75");
          return (
            <li key={it.key}>
              {it.href ? (
                <Link href={it.href} className={cls} aria-current={it.active ? "page" : undefined}>
                  {inner}
                </Link>
              ) : (
                <button type="button" onClick={it.on} className={cls} data-cart-icon-mobile>
                  {inner}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
