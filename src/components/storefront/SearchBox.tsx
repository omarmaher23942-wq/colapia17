"use client";

// SearchBox — صندوق البحث الموحّد في رأس المتجر (حاسوب وموبايل):
// - عند التركيز والحقل فارغ: عمليات البحث الأخيرة على هذا الجهاز (حذف واحدة أو مسح الكل) وأقسام المتجر.
// - عند الكتابة: اقتراحات منتجات وأقسام مطابقة مع إبراز الكلمة، وتنقل بالأسهم وEnter وEsc (combobox بمعايير ARIA).
// - اختصار «/» يركّز البحث على الحاسوب، والحقل يعرض كلمة الصفحة الحالية في /search، وزر مسح.
import Link from "next/link";
import Image from "next/image";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Clock, Search, Tag, X } from "lucide-react";
import { formatEgp } from "@/lib/money";
import { addRecent, highlightParts, parseRecent } from "@/lib/search-ui";
import { cn } from "@/lib/utils";
import { useCopy, useStore } from "./StoreProvider";

const SW = 1.75;
type Sugg = { slug: string; name: string; price: number; image: string | null };
type CatSugg = { slug: string; name: string; count: number };
export type SearchCat = { id: string; name: string; slug: string };

function useSuggestions(q: string) {
  const [data, setData] = useState<{ items: Sugg[]; categories: CatSugg[] }>({ items: [], categories: [] });
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setData({ items: [], categories: [] });
      return;
    }
    const ac = new AbortController();
    const t = window.setTimeout(() => {
      fetch(`/api/storefront/suggest?q=${encodeURIComponent(term)}`, { signal: ac.signal, cache: "no-store" })
        .then((r) => (r.ok ? r.json() : { items: [] }))
        .then((j: { items?: Sugg[]; categories?: CatSugg[] }) => setData({ items: j.items ?? [], categories: j.categories ?? [] }))
        .catch(() => undefined);
    }, 220);
    return () => {
      window.clearTimeout(t);
      ac.abort();
    };
  }, [q]);
  return data;
}

function Marked({ text, q }: { text: string; q: string }) {
  return (
    <>
      {highlightParts(text, q).map((p, i) =>
        p.hit ? (
          <mark key={i} className="rounded-sm bg-transparent font-black" style={{ color: "var(--primary)" }}>
            {p.text}
          </mark>
        ) : (
          <span key={i}>{p.text}</span>
        )
      )}
    </>
  );
}

export function SearchBox({
  variant,
  categories = [],
  onDone,
  autoFocus,
  className,
  onFocusChange,
}: {
  variant: "desktop" | "mobile";
  categories?: SearchCat[];
  onDone?: () => void;
  autoFocus?: boolean;
  className?: string;
  onFocusChange?: (focused: boolean) => void;
}) {
  const { storeId } = useStore();
  const t = useCopy();
  const pathname = usePathname();
  const sp = useSearchParams();
  const urlQ = pathname === "/search" ? (sp.get("q") ?? "") : "";
  const [q, setQ] = useState(urlQ);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [recent, setRecent] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const uid = useId();
  const key = `clp-recent-search:${storeId}`;
  const { items, categories: catHits } = useSuggestions(q);

  useEffect(() => setQ(urlQ), [urlQ]);
  useEffect(() => {
    try {
      setRecent(parseRecent(localStorage.getItem(key)));
    } catch {
      /* التخزين غير متاح: الميزة تتعطل بهدوء */
    }
  }, [key, open]);

  const save = (next: string[]) => {
    setRecent(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      /* no-op */
    }
  };
  const remember = (term: string) => save(addRecent(recent, term));

  // اختصار «/» (حاسوب): يركّز البحث ما لم يكن المستخدم يكتب في حقل.
  useEffect(() => {
    if (variant !== "desktop") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable)) return;
      e.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [variant]);

  const term = q.trim();
  const typing = term.length >= 2;
  type Opt = { id: string; href?: string; run?: () => void; label: string };
  const options: Opt[] = useMemo(() => {
    if (typing) {
      return [
        ...catHits.map((c) => ({ id: `c-${c.slug}`, href: `/c/${encodeURIComponent(c.slug)}`, label: c.name })),
        ...items.map((p) => ({ id: `p-${p.slug}`, href: `/p/${encodeURIComponent(p.slug)}`, label: p.name })),
      ];
    }
    return recent.map((r) => ({ id: `r-${r}`, href: `/search?q=${encodeURIComponent(r)}`, label: r }));
  }, [typing, catHits, items, recent]);
  useEffect(() => setActive(-1), [q, open]);

  const close = () => {
    setOpen(false);
    setActive(-1);
  };
  const go = (o: Opt) => {
    if (o.href && !o.href.startsWith("/search")) {
      /* منتج أو قسم: الرابط نفسه يتولى التنقل */
    }
    if (o.id.startsWith("r-")) remember(o.label);
    close();
    onDone?.();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      if (q) setQ("");
      else {
        close();
        inputRef.current?.blur();
      }
      return;
    }
    if (!options.length) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => (e.key === "ArrowDown" ? (a + 1) % options.length : (a - 1 + options.length) % options.length));
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      const o = options[active]!;
      go(o);
      if (o.href) window.location.assign(o.href); // تنقل كامل مضمون من لوحة المفاتيح
    }
  };

  const showPanel = open && (typing ? options.length > 0 || term.length >= 2 : recent.length > 0 || categories.length > 0);
  const listId = `${uid}-list`;

  return (
    <form
      ref={formRef}
      action="/search"
      role="search"
      className={cn("relative", className)}
      onSubmit={() => {
        if (term.length >= 2) remember(term);
        close();
        onDone?.();
      }}
      onFocus={() => {
        setOpen(true);
        onFocusChange?.(true);
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) {
          close();
          onFocusChange?.(false);
        }
      }}
    >
      <div className={cn("flex items-center gap-2 border px-3.5", variant === "desktop" ? "rounded-full" : "rounded-xl")} style={{ background: variant === "desktop" ? "var(--card)" : "var(--background)", borderColor: "var(--border)" }}>
        <Search className="size-4 shrink-0 opacity-60" strokeWidth={SW} aria-hidden="true" />
        <input
          ref={inputRef}
          name="q"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
          placeholder={variant === "desktop" ? `${t("searchPlaceholder")}  ( / )` : t("searchPlaceholder")}
          aria-label="البحث"
          role="combobox"
          aria-expanded={showPanel}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 && options[active] ? `${uid}-${options[active]!.id}` : undefined}
          autoComplete="off"
          enterKeyHint="search"
          autoFocus={autoFocus}
          maxLength={100}
          className={cn("w-full bg-transparent text-base outline-none", variant === "desktop" ? "h-10" : "h-11")}
        />
        {q ? (
          <button
            type="button"
            onClick={() => {
              setQ("");
              inputRef.current?.focus();
            }}
            className="grid size-8 shrink-0 place-items-center rounded-md opacity-60 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2"
            aria-label="مسح البحث"
          >
            <X className="size-4" strokeWidth={SW} aria-hidden="true" />
          </button>
        ) : null}
      </div>

      {showPanel ? (
        <div className="absolute inset-x-0 top-full z-50 mt-2 max-h-[70vh] overflow-y-auto rounded-2xl border shadow-2xl" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
          {typing ? (
            <ul id={listId} role="listbox" aria-label="اقتراحات البحث">
              {catHits.map((c) => {
                const o = options.find((x) => x.id === `c-${c.slug}`)!;
                const on = options[active]?.id === o.id;
                return (
                  <li key={o.id} id={`${uid}-${o.id}`} role="option" aria-selected={on}>
                    <Link href={o.href!} onClick={() => go(o)} className={cn("flex items-center gap-3 px-3 py-2.5 text-[13px] hover:bg-[var(--muted)] focus-visible:outline-none", on && "bg-[var(--muted)]")}>
                      <span className="grid size-11 shrink-0 place-items-center rounded-lg" style={{ background: "var(--muted)" }}>
                        <Tag className="size-4 opacity-70" strokeWidth={SW} aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1 truncate font-bold">
                        <Marked text={c.name} q={term} />
                      </span>
                      <span className="shrink-0 text-[11px] opacity-60">قسم · {c.count}</span>
                    </Link>
                  </li>
                );
              })}
              {items.map((it) => {
                const o = options.find((x) => x.id === `p-${it.slug}`)!;
                const on = options[active]?.id === o.id;
                return (
                  <li key={o.id} id={`${uid}-${o.id}`} role="option" aria-selected={on}>
                    <Link href={o.href!} onClick={() => go(o)} className={cn("flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-[var(--muted)] focus-visible:bg-[var(--muted)] focus-visible:outline-none", on && "bg-[var(--muted)]")}>
                      <span className="relative size-11 shrink-0 overflow-hidden rounded-lg" style={{ background: "var(--muted)" }}>
                        {it.image ? <Image src={it.image} alt="" fill sizes="44px" className="object-cover" /> : null}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[13px] font-bold">
                        <Marked text={it.name} q={term} />
                      </span>
                      <span className="shrink-0 text-[12px] font-black tabular-nums">{formatEgp(it.price)}</span>
                    </Link>
                  </li>
                );
              })}
              {!items.length && !catHits.length ? <li role="presentation" className="px-4 py-3 text-[13px] opacity-70">لا اقتراحات بعد، اضغطوا بحث لعرض كل النتائج.</li> : null}
              <li role="presentation">
                <button type="submit" className="w-full px-3 py-3 text-start text-[13px] font-black" style={{ color: "var(--primary)" }}>
                  عرض كل النتائج لـ «{term}»
                </button>
              </li>
            </ul>
          ) : (
            <div className="p-3">
              {recent.length ? (
                <div>
                  <div className="mb-1 flex items-center justify-between px-1">
                    <span className="text-[12px] font-bold opacity-70">عمليات البحث الأخيرة</span>
                    <button type="button" onClick={() => save([])} className="text-[12px] font-bold underline underline-offset-4 opacity-70 hover:opacity-100">
                      مسح الكل
                    </button>
                  </div>
                  <ul id={listId} role="listbox" aria-label="عمليات البحث الأخيرة">
                    {recent.map((r) => {
                      const id = `r-${r}`;
                      const on = options[active]?.id === id;
                      return (
                        <li key={r} id={`${uid}-${id}`} role="option" aria-selected={on} className={cn("flex items-center rounded-lg", on && "bg-[var(--muted)]")}>
                          <Link href={`/search?q=${encodeURIComponent(r)}`} onClick={() => go({ id, label: r })} className="flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-lg px-2 text-[13px] font-bold hover:bg-[var(--muted)]">
                            <Clock className="size-4 shrink-0 opacity-50" strokeWidth={SW} aria-hidden="true" />
                            <span className="truncate">{r}</span>
                          </Link>
                          <button type="button" onClick={() => save(recent.filter((x) => x !== r))} className="grid size-9 shrink-0 place-items-center rounded-md opacity-50 hover:opacity-100" aria-label={`حذف «${r}» من السجل`}>
                            <X className="size-3.5" strokeWidth={SW} aria-hidden="true" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}
              {categories.length ? (
                <div className={recent.length ? "mt-3 border-t pt-3" : ""} style={{ borderColor: "var(--border)" }}>
                  <span className="mb-2 block px-1 text-[12px] font-bold opacity-70">تصفحوا الأقسام</span>
                  <div className="flex flex-wrap gap-2">
                    {categories.slice(0, 8).map((c) => (
                      <Link key={c.id} href={`/c/${encodeURIComponent(c.slug)}`} onClick={() => (close(), onDone?.())} className="inline-flex h-9 items-center rounded-full border px-3.5 text-[13px] font-bold hover:bg-[var(--muted)]" style={{ borderColor: "var(--border)" }}>
                        {c.name}
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      ) : null}
    </form>
  );
}
