"use client";

// Header.tsx — رأس المتجر (Core).
// - ذكي: يختفي عند النزول ويظهر عند الصعود (ويبقى ظاهراً أثناء البحث والقائمة).
// - بحث فوري مضمّن على الحاسوب (اقتراحات من /api/storefront/suggest)، وعلى الموبايل صف بحث يُفتح بالأيقونة.
// - أقسام: حتى 5 روابط مباشرة، وأكثر من ذلك قائمة منسدلة بالأقسام الفرعية متداخلة.
// - الموبايل: قائمة، الشعار، بحث، سلة (المفضلة والطلبات في الشريط السفلي أو القائمة). الدرج على <dialog> أصلي.
import { BrandIcon } from "./brand-icons";
import { waLink } from "@/lib/whatsapp";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Menu, Search, ShoppingBag, Heart, X, Package } from "lucide-react";
import { useCart } from "@/store/cart";
import { useWishlist } from "@/store/wishlist";
import { useHydrated } from "./CartView";
import { arCount, NOUN } from "@/lib/format";
import { hrefFor } from "@/lib/links";
import { formatEgp } from "@/lib/money";
import { cn } from "@/lib/utils";
import { VisualSearch } from "./VisualSearch";
import { SearchBox } from "./SearchBox";
import { SheetDialog } from "./SheetDialog";
import { useCopy, useStore } from "./StoreProvider";
import { StoreLogo } from "./StoreLogo";
import type { StoreBlueprint } from "@/blueprint/schema";

const SW = 1.75;
export type HeaderCat = { id: string; name: string; slug: string; parentId?: string | null };

/** أقسام المستوى الأعلى مع أبنائها (قسم لقسم غير ظاهر يُعامل كأعلى مستوى). */
export function groupCategories(cats: HeaderCat[]) {
  const ids = new Set(cats.map((c) => c.id));
  const top = cats.filter((c) => !c.parentId || !ids.has(c.parentId));
  return top.map((t) => ({ ...t, children: cats.filter((c) => c.parentId === t.id) }));
}

export function Header({
  header,
  brand,
  categories,
  channels = {},
}: {
  header: StoreBlueprint["header"];
  brand: StoreBlueprint["brand"];
  categories: HeaderCat[];
  channels?: StoreBlueprint["channels"];
}) {
  const hydrated = useHydrated();
  const cartCount = useCart((s) => s.count());
  const count = hydrated ? cartCount : 0;
  const openCart = useCart((s) => s.open);
  const wishSaved = useWishlist((s) => s.slugs.length);
  const wishCount = hydrated ? wishSaved : 0;
  const { design, scheme } = useStore();
  const t = useCopy();
  const surface = design.header.surface;
  const layout = header.variant;
  const hasBottomBar = header.bottomBar;

  const [deskFocus, setDeskFocus] = useState(false);
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [drop, setDrop] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);
  const [myOrders, setMyOrders] = useState<{ total: number; active: number }>({ total: 0, active: 0 });

  useEffect(() => {
    let alive = true;
    fetch("/api/storefront/my-orders", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { total?: number; active?: number } | null) => alive && j && setMyOrders({ total: Number(j.total) || 0, active: Number(j.active) || 0 }))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // رأس ذكي: يختفي عند النزول بعد 120px ويظهر فور أي صعود.
  useEffect(() => {
    let last = window.scrollY;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const y = window.scrollY;
        setScrolled(y > 12);
        if (y < 120) setHidden(false);
        else if (Math.abs(y - last) > 6) setHidden(y > last);
        last = y;
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!drop) return;
    const onDoc = (e: MouseEvent) => dropRef.current && !dropRef.current.contains(e.target as Node) && setDrop(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDrop(false);
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [drop]);

  const tree = useMemo(() => groupCategories(categories), [categories]);
  const navLinks = header.nav.length ? header.nav : [{ label: t("allProducts"), target: { type: "all_products" as const } }];
  // أكثر من 5 أقسام أو أقسام فرعية: قائمة «الأقسام» المنسدلة بدل شريط طويل.
  const useDropdown = header.showCategoriesMenu && (tree.length > 5 || tree.some((c) => c.children.length > 0));
  const inlineCats = header.showCategoriesMenu && !useDropdown ? tree.slice(0, 5) : [];

  // كل شعار مرفوع يظهر كما هو (كان يُستبعد أي رابط فيه «colapia» فيختفي كل شعار على مساحة الصور).
  const logo = (compact = false) => (
    <Link href="/" className="flex min-w-0 shrink-0 items-center gap-2 leading-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] rounded-lg" aria-label={`${brand.name}: الرئيسية`}>
      <StoreLogo brand={brand} size={compact ? "sm" : design.header.logoSize} priority={!compact} scheme={scheme} />
    </Link>
  );

  const keepOpen = search || menu || drop || deskFocus;
  const showHeader = !hidden || keepOpen;

  return (
    <>
      <header
        className={cn(
          "s-header sticky top-0 z-40 border-b transition-[transform,box-shadow,background] duration-300",
          !showHeader && "-translate-y-full",
          surface === "glass" && (scrolled ? "shadow-sm backdrop-blur-xl" : "backdrop-blur-md"),
          surface === "solid" && scrolled && "shadow-sm"
        )}
        style={{
          background:
            surface === "solid" || surface === "bordered"
              ? "var(--background)"
              : surface === "transparent" && !scrolled
                ? "transparent"
                : `color-mix(in srgb, var(--background) ${scrolled ? 92 : 70}%, transparent)`,
          borderColor: scrolled || surface === "bordered" ? "var(--border)" : "transparent",
          color: "var(--foreground)",
        }}
        dir="rtl"
      >
        <div className="container-x flex h-16 items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setMenu(true)} className="-ms-2 grid size-11 place-items-center rounded-xl opacity-85 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 lg:hidden" aria-label={t("menu")} aria-haspopup="dialog">
              <Menu className="size-5" strokeWidth={SW} aria-hidden="true" />
            </button>
            {logo()}
          </div>

          <nav className="hidden items-center gap-5 text-[14px] font-bold lg:flex" aria-label="التنقل الرئيسي">
            {navLinks.map((n) => (
              <Link key={n.label} href={hrefFor(n.target)} className="py-2 transition-opacity hover:opacity-75 focus-visible:outline-none focus-visible:underline">
                {n.label}
              </Link>
            ))}
            {inlineCats.map((c) => (
              <Link key={c.id} href={`/c/${encodeURIComponent(c.slug)}`} className="py-2 transition-opacity hover:opacity-75 focus-visible:outline-none focus-visible:underline">
                {c.name}
              </Link>
            ))}
            {useDropdown ? (
              <div ref={dropRef} className="relative">
                <button type="button" onClick={() => setDrop((v) => !v)} aria-expanded={drop} aria-haspopup="true" className="inline-flex items-center gap-1 py-2 focus-visible:outline-none focus-visible:underline">
                  الأقسام <ChevronDown className={cn("size-4 transition-transform", drop && "rotate-180")} aria-hidden="true" />
                </button>
                {drop ? (
                  <div className="absolute start-0 top-full z-50 mt-2 max-h-[70vh] w-[min(46rem,90vw)] overflow-y-auto rounded-2xl border p-5 shadow-2xl" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
                    <ul className="grid grid-cols-2 gap-x-6 gap-y-4 xl:grid-cols-3">
                      {tree.map((c) => (
                        <li key={c.id}>
                          <Link href={`/c/${encodeURIComponent(c.slug)}`} onClick={() => setDrop(false)} className="block py-1 text-[14px] font-black hover:underline">
                            {c.name}
                          </Link>
                          {c.children.length ? (
                            <ul className="mt-1 space-y-0.5">
                              {c.children.map((k) => (
                                <li key={k.id}>
                                  <Link href={`/c/${encodeURIComponent(k.slug)}`} onClick={() => setDrop(false)} className="block py-1 text-[13px] font-medium opacity-80 hover:opacity-100 hover:underline">
                                    {k.name}
                                  </Link>
                                </li>
                              ))}
                            </ul>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}
          </nav>

          {header.showSearch ? (
            <SearchBox variant="desktop" categories={categories} onFocusChange={setDeskFocus} className="mx-2 hidden max-w-sm flex-1 lg:block" />
          ) : null}

          <div className="flex items-center gap-1">
            {channels.whatsappNumber ? (
              <a href={waLink(channels.whatsappNumber) ?? "#"} target="_blank" rel="noopener noreferrer" className="hidden size-11 items-center justify-center rounded-xl text-emerald-600 transition-colors hover:bg-emerald-500/10 sm:inline-flex" aria-label="واتساب">
                <BrandIcon brand="whatsapp" className="size-[18px]" />
              </a>
            ) : null}

            {header.showSearch ? (
              <button type="button" onClick={() => setSearch((v) => !v)} className="grid size-11 place-items-center rounded-xl opacity-85 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 lg:hidden" aria-label="بحث" aria-expanded={search}>
                <Search className="size-5" strokeWidth={SW} aria-hidden="true" />
              </button>
            ) : null}

            <VisualSearch whatsapp={channels.whatsappNumber} storeName={brand.name} />

            {myOrders.total > 0 ? (
              <Link href="/track" className="relative hidden size-11 place-items-center rounded-xl opacity-85 transition-opacity hover:opacity-100 sm:grid" aria-label={myOrders.active ? `طلباتي (${myOrders.active} جارية)` : "طلباتي"} title="طلباتي">
                <Package className="size-5" strokeWidth={SW} aria-hidden="true" />
                {myOrders.active ? <span className="absolute end-2 top-2 size-2.5 rounded-full ring-2 ring-[var(--background)]" style={{ background: "var(--primary)" }} aria-hidden="true" /> : null}
              </Link>
            ) : null}

            <Link href="/wishlist" className={cn("relative size-11 place-items-center rounded-xl transition-transform active:scale-95", hasBottomBar ? "hidden md:grid" : "grid")} aria-label={wishCount > 0 ? `المفضلة، ${wishCount}` : "المفضلة"}>
              <Heart className="size-5" strokeWidth={SW} aria-hidden="true" />
              {wishCount > 0 ? (
                <span className="absolute end-1 top-1 grid min-w-4 place-items-center rounded-full px-1 text-[11px] font-black leading-4 tabular-nums" style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}>
                  {wishCount}
                </span>
              ) : null}
            </Link>

            <button type="button" onClick={openCart} data-cart-icon className={cn("relative size-11 place-items-center rounded-xl transition-transform active:scale-95", hasBottomBar ? "hidden md:grid" : "grid")} aria-label={`السلة${count > 0 ? `، ${arCount(count, NOUN.piece)}` : ""}`}>
              <ShoppingBag className="size-5" strokeWidth={SW} aria-hidden="true" />
              {count > 0 ? (
                <span className="absolute end-1 top-1 grid min-w-4 place-items-center rounded-full px-1 text-[11px] font-black leading-4 tabular-nums" style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}>
                  {count}
                </span>
              ) : null}
            </button>
          </div>
        </div>

        {search ? (
          <div className="border-t p-3 lg:hidden" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
            <div className="container-x relative">
              <SearchBox variant="mobile" categories={categories} autoFocus onDone={() => setSearch(false)} />
            </div>
          </div>
        ) : null}
      </header>

      <SheetDialog open={menu} onClose={() => setMenu(false)} title={brand.name} side="end">
        <nav className="space-y-1" aria-label="روابط المتجر">
          <Link href="/track" onClick={() => setMenu(false)} className="flex items-center gap-2 rounded-xl px-3 py-3 text-sm font-black transition-colors hover:bg-[var(--muted)]">
            <Package className="size-4" strokeWidth={SW} aria-hidden="true" />
            {myOrders.total > 0 ? "طلباتي" : "تتبع طلبك"}
            {myOrders.active ? (
              <span className="ms-auto rounded-full px-2 py-0.5 text-[12px]" style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}>
                {myOrders.active} جارية
              </span>
            ) : null}
          </Link>
          {navLinks.map((n) => (
            <Link key={n.label} href={hrefFor(n.target)} onClick={() => setMenu(false)} className="block rounded-xl px-3 py-3 text-sm font-bold transition-colors hover:bg-[var(--muted)]">
              {n.label}
            </Link>
          ))}
          {tree.length ? (
            <div className="border-t pt-3" style={{ borderColor: "var(--border)" }}>
              <span className="mb-1 block px-3 text-[12px] font-bold opacity-70">الأقسام</span>
              {tree.map((c) => (
                <div key={c.id}>
                  <Link href={`/c/${encodeURIComponent(c.slug)}`} onClick={() => setMenu(false)} className="block rounded-xl px-3 py-2.5 text-sm font-bold hover:bg-[var(--muted)]">
                    {c.name}
                  </Link>
                  {c.children.map((k) => (
                    <Link key={k.id} href={`/c/${encodeURIComponent(k.slug)}`} onClick={() => setMenu(false)} className="block rounded-xl py-2 ps-8 pe-3 text-[13px] font-medium opacity-80 hover:bg-[var(--muted)] hover:opacity-100">
                      {k.name}
                    </Link>
                  ))}
                </div>
              ))}
            </div>
          ) : null}
        </nav>
        {channels.whatsappNumber ? (
          <a href={waLink(channels.whatsappNumber) ?? "#"} target="_blank" rel="noopener noreferrer" className="s-btn mt-5 w-full">
            <BrandIcon brand="whatsapp" className="size-4" />
            واتساب المتجر
          </a>
        ) : null}
      </SheetDialog>
    </>
  );
}
