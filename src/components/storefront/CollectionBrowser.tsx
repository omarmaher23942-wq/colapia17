"use client";

// CollectionBrowser — صفحة منتجات (قسم أو الكل): عدد النتائج، ترتيب، فلاتر في درج، شرائح الأقسام الفرعية، كثافة العرض،
// و«تحميل المزيد» يضيف إلى القائمة نفسها بدل صفحة جديدة. حالة الفلاتر كلها في الرابط (قابل للمشاركة والرجوع).
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, LayoutGrid, Loader2, SlidersHorizontal, Square, X } from "lucide-react";
import { ProductCard, type ProductCardProduct } from "./ProductCard";
import { SheetDialog } from "./SheetDialog";
import { useStore } from "./StoreProvider";
import { loadMoreCollectionAction } from "@/server/actions/collection";
import { SORTS, PAGE_SIZE, activeFilterCount, filtersToQuery, type CollectionFilters, type Facets, type SortKey } from "@/lib/collection-filters";
import { arCount, NOUN } from "@/lib/format";
import { cn } from "@/lib/utils";
import { attributeFacets, matchesFacets } from "./product/specs";

/** المقاس واللون يفلترهما الخادم؛ بقية السمات الحقيقية (سعة، حجم، خامة...) تُفلتر هنا من بيانات المنتجات. */
const SERVER_FACET = /مقاس|المقاس|size|لون|اللون|color/i;
const MAX_CLIENT_ROWS = 400;

export type SubCat = { slug: string; name: string; productCount: number };

export function CollectionBrowser({
  basePath,
  categorySlug,
  initial,
  total,
  facets,
  filters,
  subs = [],
}: {
  basePath: string;
  categorySlug?: string;
  initial: ProductCardProduct[];
  total: number;
  facets: Facets;
  filters: CollectionFilters;
  subs?: SubCat[];
}) {
  const router = useRouter();
  const { subdomain } = useStore();
  const [rows, setRows] = useState(initial);
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [dense, setDense] = useState(false);
  useEffect(() => {
    try {
      setDense(localStorage.getItem("clp-dense") === "1");
    } catch {
      /* no-op */
    }
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem("clp-dense", dense ? "1" : "0");
    } catch {
      /* no-op */
    }
  }, [dense]);
  const [draft, setDraft] = useState(filters);
  const [attr, setAttr] = useState<Record<string, string[]>>({});
  const [draftAttr, setDraftAttr] = useState<Record<string, string[]>>({});
  const [loadingAll, setLoadingAll] = useState(false);
  const attrFacets = useMemo(() => attributeFacets(rows).filter((f) => !SERVER_FACET.test(f.label)), [rows]);
  const attrCount = Object.values(attr).reduce((n, v) => n + v.length, 0);
  const visible = useMemo(() => (attrCount ? rows.filter((p) => matchesFacets(p, attr)) : rows), [rows, attr, attrCount]);

  // فلترة السمات تحتاج كل منتجات القائمة لا الصفحة الأولى وحدها: تُجلب البقية مرة واحدة (حتى 400) عند فتح الفلاتر.
  const loadAll = async () => {
    if (rows.length >= total || rows.length >= MAX_CLIENT_ROWS || loadingAll) return;
    setLoadingAll(true);
    let acc = rows;
    try {
      while (acc.length < total && acc.length < MAX_CLIENT_ROWS) {
        const r = await loadMoreCollectionAction({ subdomain, category: categorySlug, query, offset: acc.length });
        const fresh = (r.rows as ProductCardProduct[]).filter((n) => !acc.some((c) => c.id === n.id));
        if (!fresh.length) break;
        acc = [...acc, ...fresh];
      }
      setRows(acc);
    } finally {
      setLoadingAll(false);
    }
  };
  const count = activeFilterCount(filters) + Object.values(attr).reduce((n, v) => n + v.length, 0);
  const query = useMemo(() => filtersToQuery(filters), [filters]);
  const go = (f: CollectionFilters) => {
    const q = filtersToQuery(f);
    router.push(q ? `${basePath}?${q}` : basePath, { scroll: false });
  };

  const more = () =>
    start(async () => {
      const r = await loadMoreCollectionAction({ subdomain, category: categorySlug, query, offset: rows.length });
      setRows((cur) => [...cur, ...(r.rows as ProductCardProduct[]).filter((n) => !cur.some((c) => c.id === n.id))]);
    });

  // رجوع من صفحة منتج: تُستعاد القائمة بالعدد الذي كان محمّلاً وموضع التمرير (لا بداية القائمة من جديد).
  const memoKey = `clp-coll:${subdomain}:${basePath}?${query}`;
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    let memo: { n: number; y: number } | null = null;
    try {
      memo = JSON.parse(sessionStorage.getItem(memoKey) ?? "null");
    } catch {
      memo = null;
    }
    if (!memo || !(memo.n > 0)) return;
    const target = memo;
    (async () => {
      let acc = rows;
      while (acc.length < Math.min(target.n, total, MAX_CLIENT_ROWS)) {
        const r = await loadMoreCollectionAction({ subdomain, category: categorySlug, query, offset: acc.length });
        const fresh = (r.rows as ProductCardProduct[]).filter((n) => !acc.some((c) => c.id === n.id));
        if (!fresh.length) break;
        acc = [...acc, ...fresh];
      }
      if (acc.length > rows.length) setRows(acc);
      requestAnimationFrame(() => window.scrollTo({ top: target.y }));
    })().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const save = () => {
      try {
        sessionStorage.setItem(memoKey, JSON.stringify({ n: rows.length, y: Math.round(window.scrollY) }));
      } catch {
        /* no-op */
      }
    };
    window.addEventListener("pagehide", save);
    return () => {
      save();
      window.removeEventListener("pagehide", save);
    };
  }, [memoKey, rows.length]);

  // تحميل تلقائي عند الاقتراب من نهاية القائمة (الزر يبقى بديلاً للوحة المفاتيح ولمن عطّل الحركة).
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || rows.length >= total || attrCount || pending || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((e) => e[0]?.isIntersecting && more(), { rootMargin: "600px 0px" });
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows.length, total, attrCount, pending]);

  const chips: { key: string; label: string; clear: CollectionFilters }[] = [];
  if (filters.min !== null || filters.max !== null) chips.push({ key: "price", label: `السعر ${filters.min !== null ? Math.round(filters.min / 100) : 0} - ${filters.max !== null ? Math.round(filters.max / 100) : "∞"}`, clear: { ...filters, min: null, max: null } });
  for (const s of filters.sizes) chips.push({ key: `s-${s}`, label: `المقاس ${s}`, clear: { ...filters, sizes: filters.sizes.filter((x) => x !== s) } });
  for (const c of filters.colors) chips.push({ key: `c-${c}`, label: c, clear: { ...filters, colors: filters.colors.filter((x) => x !== c) } });
  if (filters.inStock) chips.push({ key: "stock", label: "متوفر فقط", clear: { ...filters, inStock: false } });
  if (filters.sale) chips.push({ key: "sale", label: "تخفيضات", clear: { ...filters, sale: false } });
  const attrChips = Object.entries(attr).flatMap(([label, vals]) => vals.map((v) => ({ key: `a-${label}-${v}`, label: `${label}: ${v}`, remove: () => setAttr((cur) => ({ ...cur, [label]: (cur[label] ?? []).filter((x) => x !== v) })) })));

  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  return (
    <div>
      {subs.length ? (
        <nav aria-label="الأقسام الفرعية" className="hide-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4">
          <Link href={basePath + (query ? `?${filtersToQuery({ ...filters, sub: null })}` : "")} aria-current={!filters.sub ? "true" : undefined} className={chip(!filters.sub)} style={chipStyle(!filters.sub)}>
            الكل
          </Link>
          {subs.map((s) => (
            <Link key={s.slug} href={`${basePath}?${filtersToQuery({ ...filters, sub: s.slug })}`} aria-current={filters.sub === s.slug ? "true" : undefined} className={chip(filters.sub === s.slug)} style={chipStyle(filters.sub === s.slug)}>
              {s.name}
            </Link>
          ))}
        </nav>
      ) : null}

      <div className="sticky top-0 z-30 -mx-4 mb-3 flex flex-wrap items-center gap-2 px-4 py-2" style={{ background: "color-mix(in srgb, var(--background) 94%, transparent)", backdropFilter: "blur(8px)" }}>
        {true ? (
          <button
            type="button"
            onClick={() => {
              setDraft(filters);
              setDraftAttr(attr);
              setOpen(true);
              void loadAll();
            }}
            className="inline-flex h-11 items-center gap-2 rounded-full border px-4 text-sm font-bold focus-visible:outline-none focus-visible:ring-2"
            style={{ borderColor: "var(--border)" }}
          >
            <SlidersHorizontal className="size-4" aria-hidden="true" />
            تصفية
            {count ? (
              <span className="grid size-5 place-items-center rounded-full text-[12px] font-black tabular-nums" style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}>
                {count}
              </span>
            ) : null}
          </button>
        ) : null}
        <label className="inline-flex items-center gap-2 text-sm">
          <span className="sr-only">ترتيب المنتجات</span>
          <select value={filters.sort} onChange={(e) => go({ ...filters, sort: e.target.value as SortKey })} className="h-11 rounded-full border bg-transparent px-4 text-base font-bold" style={{ borderColor: "var(--border)" }}>
            {SORTS.map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <p className="ms-auto text-sm font-bold opacity-70" aria-live="polite">
          {arCount(attrCount ? visible.length : total, NOUN.product)}
        </p>
        <button type="button" onClick={() => setDense((d) => !d)} aria-pressed={dense} aria-label={dense ? "عرض بطاقات أكبر" : "عرض بطاقات أصغر"} className="hidden size-11 place-items-center rounded-full border sm:grid lg:hidden" style={{ borderColor: "var(--border)" }}>
          {dense ? <Square className="size-4" aria-hidden="true" /> : <LayoutGrid className="size-4" aria-hidden="true" />}
        </button>
        <button type="button" onClick={() => setDense((d) => !d)} aria-pressed={dense} aria-label={dense ? "عرض بطاقة واحدة في الصف" : "عرض بطاقتين في الصف"} className="grid size-11 place-items-center rounded-full border sm:hidden" style={{ borderColor: "var(--border)" }}>
          {dense ? <Square className="size-4" aria-hidden="true" /> : <LayoutGrid className="size-4" aria-hidden="true" />}
        </button>
      </div>

      {chips.length || attrChips.length ? (
        <ul className="mb-4 flex flex-wrap gap-2" aria-label="الفلاتر الفعالة">
          {attrChips.map((c) => (
            <li key={c.key}>
              <button type="button" onClick={c.remove} className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-bold focus-visible:outline-none focus-visible:ring-2" style={{ background: "var(--muted)" }} aria-label={`إزالة ${c.label}`}>
                {c.label}
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
          {chips.map((c) => (
            <li key={c.key}>
              <button type="button" onClick={() => go(c.clear)} className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-bold focus-visible:outline-none focus-visible:ring-2" style={{ background: "var(--muted)" }} aria-label={`إزالة ${c.label}`}>
                {c.label}
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
          <li>
            <button type="button" onClick={() => { setAttr({}); go({ ...filters, min: null, max: null, sizes: [], colors: [], inStock: false, sale: false }); }} className="h-9 px-2 text-[13px] font-bold underline-offset-4 hover:underline">
              مسح الكل
            </button>
          </li>
        </ul>
      ) : null}

      {visible.length ? (
        <ul className={cn("s-stagger grid gap-3 sm:gap-4", dense ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" : "grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5")}>
          {visible.map((p, i) => (
            <li key={p.id}>
              <ProductCard product={p} priority={i < 4} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="py-16 text-center">
          <p className="font-bold">لا توجد منتجات تطابق هذه الفلاتر</p>
          {count ? (
            <button type="button" onClick={() => { setAttr({}); go({ ...filters, min: null, max: null, sizes: [], colors: [], inStock: false, sale: false }); }} className="s-btn mt-4">
              مسح الفلاتر
            </button>
          ) : null}
        </div>
      )}

      {rows.length < total && !attrCount ? (
        <div ref={sentinel} className="mt-8 text-center">
          <p className="mb-3 text-sm opacity-70">
            تم عرض {rows.length} من {total}
          </p>
          <button type="button" onClick={more} disabled={pending} className="s-btn-ghost h-12 px-8">
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            <span>عرض المزيد</span>
          </button>
        </div>
      ) : rows.length > PAGE_SIZE ? (
        <p className="mt-8 text-center text-sm opacity-70">وصلتم إلى نهاية القائمة</p>
      ) : null}

      <SheetDialog
        open={open}
        onClose={() => setOpen(false)}
        title="تصفية المنتجات"
        footer={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setAttr({});
                go({ ...draft, min: null, max: null, sizes: [], colors: [], inStock: false, sale: false });
              }}
              className="s-btn-ghost h-12 flex-1"
            >
              مسح
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setAttr(draftAttr);
                go(draft);
              }}
              className="s-btn h-12 flex-[2]"
            >
              عرض النتائج
            </button>
          </div>
        }
      >
        <div className="space-y-6">
          <fieldset className="space-y-2">
            <legend className="mb-1 text-sm font-black">السعر (جنيه)</legend>
            <div className="flex items-center gap-2">
              <input
                inputMode="numeric"
                dir="ltr"
                aria-label="أقل سعر"
                placeholder={facets.priceMin !== null ? String(Math.floor(facets.priceMin / 100)) : "من"}
                value={draft.min !== null ? String(Math.round(draft.min / 100)) : ""}
                onChange={(e) => setDraft((d) => ({ ...d, min: e.target.value ? Math.round(Number(e.target.value.replace(/\D/g, "")) * 100) : null }))}
                className="s-input h-11 w-full rounded-xl border bg-transparent px-3 text-base"
                style={{ borderColor: "var(--border)" }}
              />
              <span aria-hidden="true">-</span>
              <input
                inputMode="numeric"
                dir="ltr"
                aria-label="أعلى سعر"
                placeholder={facets.priceMax !== null ? String(Math.ceil(facets.priceMax / 100)) : "إلى"}
                value={draft.max !== null ? String(Math.round(draft.max / 100)) : ""}
                onChange={(e) => setDraft((d) => ({ ...d, max: e.target.value ? Math.round(Number(e.target.value.replace(/\D/g, "")) * 100) : null }))}
                className="s-input h-11 w-full rounded-xl border bg-transparent px-3 text-base"
                style={{ borderColor: "var(--border)" }}
              />
            </div>
          </fieldset>

          {facets.sizes.length ? (
            <fieldset>
              <legend className="mb-2 text-sm font-black">المقاس</legend>
              <div className="flex flex-wrap gap-2">
                {facets.sizes.map((s) => (
                  <Toggle key={s} on={draft.sizes.includes(s)} onClick={() => setDraft((d) => ({ ...d, sizes: toggle(d.sizes, s) }))}>
                    {s}
                  </Toggle>
                ))}
              </div>
            </fieldset>
          ) : null}

          {facets.colors.length ? (
            <fieldset>
              <legend className="mb-2 text-sm font-black">اللون</legend>
              <div className="flex flex-wrap gap-2">
                {facets.colors.map((c) => (
                  <Toggle key={c} on={draft.colors.includes(c)} onClick={() => setDraft((d) => ({ ...d, colors: toggle(d.colors, c) }))}>
                    {c}
                  </Toggle>
                ))}
              </div>
            </fieldset>
          ) : null}

          {attrFacets.map((f) => (
            <fieldset key={f.label}>
              <legend className="mb-2 text-sm font-black">{f.label}</legend>
              <div className="flex flex-wrap gap-2">
                {f.values.map((v) => (
                  <Toggle key={v.value} on={(draftAttr[f.label] ?? []).includes(v.value)} onClick={() => setDraftAttr((d) => ({ ...d, [f.label]: toggle(d[f.label] ?? [], v.value) }))}>
                    {v.value}
                    <span className="ms-1 text-[12px] font-medium opacity-70 tabular-nums">({v.count})</span>
                  </Toggle>
                ))}
              </div>
            </fieldset>
          ))}
          {loadingAll ? (
            <p className="flex items-center gap-2 text-[13px] opacity-75" role="status">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" /> نجهّز كل سمات المنتجات…
            </p>
          ) : null}

          <fieldset className="space-y-2">
            <legend className="sr-only">خيارات إضافية</legend>
            <Check2 label="المتوفر فقط" on={draft.inStock} onChange={(v) => setDraft((d) => ({ ...d, inStock: v }))} />
            <Check2 label="المنتجات المخفضة" on={draft.sale} onChange={(v) => setDraft((d) => ({ ...d, sale: v }))} />
          </fieldset>
        </div>
      </SheetDialog>
    </div>
  );
}

const chipStyle = (on: boolean): React.CSSProperties | undefined => (on ? { background: "var(--primary)", color: "var(--primary-foreground)" } : undefined);
const chip = (on: boolean) =>
  cn("inline-flex h-10 shrink-0 items-center rounded-full border px-4 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2", on ? "border-transparent" : "border-[var(--border)]");

function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn("inline-flex h-11 min-w-11 items-center justify-center rounded-full border-2 px-4 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2", on ? "border-[var(--primary)] text-[var(--primary)]" : "border-[var(--border)]")}
    >
      {children}
    </button>
  );
}

function Check2({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="checkbox" aria-checked={on} onClick={() => onChange(!on)} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-1 text-start text-sm font-bold focus-visible:outline-none focus-visible:ring-2">
      <span className={cn("grid size-5 place-items-center rounded border-2", on ? "border-[var(--primary)]" : "border-[var(--border)]")} style={on ? { background: "var(--primary)", color: "var(--primary-foreground)" } : undefined} aria-hidden="true">
        {on ? <Check className="size-3.5" strokeWidth={3} /> : null}
      </span>
      {label}
    </button>
  );
}
