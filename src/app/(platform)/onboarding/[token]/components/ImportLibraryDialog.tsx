"use client";

// components/ImportLibraryDialog.tsx — dialog استيراد منتجات من المكتبة.
//
// السبب الجذري:
// تاجر جديد بدون منتجات → ترك الاستمارة. المكتبة تحل 80% من المشكلة،
// لكن بدون UI جذاب للاختيار، التاجر ما هيستخدمها.
//
// المبادئ:
//  - Modal على ≥ lg / Bottom sheet على < lg.
//  - عرض المنتجات كشبكة قابلة للاختيار المتعدد.
//  - تصفية بالسعر + تعديل جماعي للأسعار.
//  - معاينة كاملة لكل منتج قبل الاختيار.
//  - احترام prefers-reduced-motion.
import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  X,
  Check,
  Package,
  Search,
  Sparkles,
  Wand2,
  ChevronDown,
  Info,
} from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  getLibraryByIndustry,
  libraryProductToOnboardingProduct,
  type LibraryProduct,
} from "@/onboarding/products-library";
import type {
  IndustryId,
  OnboardingProduct,
  OnboardingSection,
} from "@/onboarding/schema";

const SW = 1.75;

export function ImportLibraryDialog({
  open,
  onClose,
  industry,
  sections,
  onImport,
}: {
  open: boolean;
  onClose: () => void;
  industry: IndustryId | undefined;
  sections: OnboardingSection[];
  onImport: (products: OnboardingProduct[]) => void;
}) {
  const reduce = useReducedMotion();
  const category = useMemo(() => getLibraryByIndustry(industry), [industry]);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [priceMultiplier, setPriceMultiplier] = useState(1);
  const [defaultSectionId, setDefaultSectionId] = useState(
    sections[0]?.id ?? ""
  );
  const [showPricePanel, setShowPricePanel] = useState(false);

  // إعادة التهيئة عند الإغلاق.
  useEffect(() => {
    if (!open) {
      setSelected(new Set());
      setQuery("");
      setPriceMultiplier(1);
      setShowPricePanel(false);
    }
  }, [open]);

  // منع تمرير الـ body.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const filtered = useMemo(() => {
    if (!category) return [];
    if (!query.trim()) return category.products;
    const q = query.toLowerCase().trim();
    return category.products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.shortDescription.toLowerCase().includes(q) ||
        p.keywords.some((k) => k.toLowerCase().includes(q))
    );
  }, [category, query]);

  const allSelected = useMemo(
    () => filtered.length > 0 && filtered.every((p) => selected.has(p.id)),
    [filtered, selected]
  );

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((p) => p.id)));
    }
  };

  const handleImport = () => {
    if (selected.size === 0) {
      toast.error("اختر منتجاً واحداً على الأقل.");
      return;
    }
    if (!category) return;

    const productsToImport: OnboardingProduct[] = [];
    for (const p of category.products) {
      if (!selected.has(p.id)) continue;
      // نطبق multiplier على السعر.
      const adjustedPrice = Math.round(p.priceEgp * priceMultiplier);
      const adjustedCompareAt = p.compareAtEgp
        ? Math.round(p.compareAtEgp * priceMultiplier)
        : undefined;

      const onboarded = libraryProductToOnboardingProduct(
        {
          ...p,
          priceEgp: adjustedPrice,
          compareAtEgp: adjustedCompareAt,
        },
        defaultSectionId
      );
      productsToImport.push(onboarded);
    }

    onImport(productsToImport);
    toast.success(`تم استيراد ${productsToImport.length} منتج بنجاح.`);
    onClose();
  };

  if (!category) {
    return (
      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
            onClick={onClose}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#0b0f2a] p-6 text-center shadow-2xl"
            >
              <Package className="mx-auto size-10 text-[#8d97c4]" strokeWidth={1.5} />
              <h3 className="mt-3 text-sm font-black text-white">
                لا توجد مكتبة متاحة لهذا المجال
              </h3>
              <p className="mt-2 text-[11.5px] leading-relaxed text-[#8d97c4]">
                أكمل خطوة بيانات المتجر واختر المجال أولاً، ثم عد لاستيراد
                المنتجات.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="mt-5 inline-flex h-10 w-full items-center justify-center rounded-xl bg-gradient-to-b from-[#6f86ff] to-[#5b74ff] text-xs font-black text-white"
              >
                حسناً
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    );
  }

  const previewTotal = Math.round(
    (category.products
      .filter((p) => selected.has(p.id))
      .reduce((sum, p) => sum + p.priceEgp, 0) as number) * priceMultiplier
  );

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.18 }}
            onClick={onClose}
            className="fixed inset-0 z-[80] bg-black/75 backdrop-blur-sm"
            aria-hidden="true"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="استيراد منتجات من المكتبة"
            initial={reduce ? false : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: 24 }}
            transition={{ duration: reduce ? 0 : 0.24, ease: [0.22, 1, 0.36, 1] }}
            dir="rtl"
            className={cn(
              "fixed z-[90] flex flex-col overflow-hidden bg-[#07091a] text-[#eaf0ff] shadow-2xl",
              "inset-x-0 bottom-0 top-10 rounded-t-3xl border-t border-[#232b66]",
              "md:inset-x-4 md:bottom-6 md:top-6 md:rounded-3xl md:border"
            )}
          >
            {/* Header */}
            <header className="flex shrink-0 items-center justify-between gap-2 border-b border-[#232b66] px-4 py-3 sm:px-5">
              <div className="flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-xl bg-[#6f86ff]/15 text-[#8fa8ff]">
                  <Sparkles className="size-4" strokeWidth={SW} aria-hidden="true" />
                </span>
                <div>
                  <h2 className="text-sm font-black text-white">
                    {category.label}
                  </h2>
                  <p className="mt-0.5 text-[10.5px] text-[#8d97c4]">
                    {category.products.length} منتج جاهز للاستيراد
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="إغلاق"
                className="grid size-9 place-items-center rounded-lg text-[#8d97c4] transition-colors hover:bg-white/5 hover:text-white"
              >
                <X className="size-4" strokeWidth={SW} aria-hidden="true" />
              </button>
            </header>

            {/* Toolbar: search + toggle all + price panel toggle */}
            <div className="shrink-0 space-y-2 border-b border-[#232b66] p-3 sm:p-4">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-0 flex-1">
                  <Search
                    className="pointer-events-none absolute end-3 top-1/2 size-3.5 -translate-y-1/2 opacity-50"
                    strokeWidth={SW}
                    aria-hidden="true"
                  />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="ابحث في المكتبة…"
                    className="h-10 w-full rounded-xl border border-[#232b66] bg-[#10153a] px-3 pe-9 text-xs font-bold text-white outline-none focus:border-[#8fa8ff]"
                  />
                </div>

                <button
                  type="button"
                  onClick={toggleAll}
                  className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-[#232b66] bg-[#10153a] px-3 text-[11.5px] font-bold text-[#c3cdf0] transition-colors hover:border-[#3f4fbf] hover:text-white"
                >
                  <Check className="size-3.5" strokeWidth={2.5} aria-hidden="true" />
                  {allSelected ? "إلغاء الكل" : "اختر الكل"}
                </button>

                <button
                  type="button"
                  onClick={() => setShowPricePanel((v) => !v)}
                  aria-expanded={showPricePanel}
                  className={cn(
                    "inline-flex h-10 items-center gap-1.5 rounded-xl border px-3 text-[11.5px] font-bold transition-colors",
                    showPricePanel
                      ? "border-[#8fa8ff]/40 bg-[#6f86ff]/15 text-white"
                      : "border-[#232b66] bg-[#10153a] text-[#c3cdf0] hover:border-[#3f4fbf] hover:text-white"
                  )}
                >
                  <Wand2 className="size-3.5" strokeWidth={SW} aria-hidden="true" />
                  تعديل الأسعار
                  <ChevronDown
                    className={cn(
                      "size-3 transition-transform",
                      showPricePanel && "rotate-180"
                    )}
                    strokeWidth={2.5}
                    aria-hidden="true"
                  />
                </button>
              </div>

              {/* Price panel */}
              <AnimatePresence initial={false}>
                {showPricePanel ? (
                  <motion.div
                    initial={reduce ? false : { opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={reduce ? undefined : { opacity: 0, height: 0 }}
                    transition={{ duration: reduce ? 0 : 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-3 rounded-xl border border-[#232b66] bg-[#10153a] p-3">
                      <div>
                        <label className="mb-1.5 flex items-center justify-between text-[11px] font-bold text-[#c3cdf0]">
                          <span>معامل السعر</span>
                          <span className="font-mono text-white">
                            × {priceMultiplier.toFixed(2)}
                          </span>
                        </label>
                        <input
                          type="range"
                          min={0.5}
                          max={2}
                          step={0.05}
                          value={priceMultiplier}
                          onChange={(e) =>
                            setPriceMultiplier(Number(e.target.value))
                          }
                          className="w-full accent-[#6f86ff]"
                        />
                        <div className="mt-1 flex justify-between text-[10px] text-[#8d97c4]">
                          <span>×0.5</span>
                          <span>×1.0 (الافتراضي)</span>
                          <span>×2.0</span>
                        </div>
                      </div>

                      {sections.length > 0 ? (
                        <div>
                          <label className="mb-1 block text-[11px] font-bold text-[#c3cdf0]">
                            أضف إلى القسم
                          </label>
                          <select
                            value={defaultSectionId}
                            onChange={(e) => setDefaultSectionId(e.target.value)}
                            className="h-9 w-full rounded-lg border border-[#232b66] bg-[#0c1029] px-2.5 text-xs font-bold text-white outline-none focus:border-[#8fa8ff]"
                          >
                            <option value="">بدون قسم</option>
                            {sections.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : null}
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>

            {/* Products grid */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4">
              {filtered.length === 0 ? (
                <div className="grid place-items-center py-16 text-center">
                  <Package className="size-8 text-[#8d97c4]" strokeWidth={1.5} />
                  <p className="mt-3 text-xs font-bold text-[#8d97c4]">
                    لا نتائج مطابقة
                  </p>
                </div>
              ) : (
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {filtered.map((p) => (
                    <LibraryCard
                      key={p.id}
                      product={p}
                      selected={selected.has(p.id)}
                      priceMultiplier={priceMultiplier}
                      onToggle={() => toggle(p.id)}
                    />
                  ))}
                </ul>
              )}
            </div>

            {/* Footer */}
            <footer className="shrink-0 border-t border-[#232b66] bg-[#0b0f2a] p-3 sm:p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-[#c3cdf0]">
                    <span className="text-white">{selected.size}</span> منتج
                    مُحدَّد
                  </p>
                  {selected.size > 0 ? (
                    <p className="mt-0.5 font-mono text-[10.5px] text-[#8d97c4]">
                      القيمة الإجمالية ≈ {previewTotal.toLocaleString("en-US")} ج.م
                    </p>
                  ) : (
                    <p className="mt-0.5 flex items-center gap-1 text-[10.5px] text-[#8d97c4]">
                      <Info className="size-2.5" strokeWidth={2.5} aria-hidden="true" />
                      يمكنك تعديل الأسعار والتفاصيل بعد الاستيراد
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="h-11 rounded-xl border border-[#232b66] bg-[#10153a] px-4 text-xs font-bold text-[#c3cdf0] transition-colors hover:text-white"
                  >
                    إلغاء
                  </button>
                  <button
                    type="button"
                    onClick={handleImport}
                    disabled={selected.size === 0}
                    className="inline-flex h-11 items-center gap-2 rounded-xl bg-gradient-to-l from-[#6f86ff] to-[#8fa8ff] px-5 text-xs font-black text-[#07091a] shadow-md transition-all hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Sparkles className="size-3.5" strokeWidth={2.5} aria-hidden="true" />
                    استورد {selected.size > 0 ? `(${selected.size})` : ""}
                  </button>
                </div>
              </div>
            </footer>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}

// ─── Library Card ──────────────────────────────────────────────────────────
function LibraryCard({
  product,
  selected,
  priceMultiplier,
  onToggle,
}: {
  product: LibraryProduct;
  selected: boolean;
  priceMultiplier: number;
  onToggle: () => void;
}) {
  const adjustedPrice = Math.round(product.priceEgp * priceMultiplier);

  return (
    <li>
      <button
        type="button"
        role="checkbox"
        aria-checked={selected}
        onClick={onToggle}
        className={cn(
          "group relative flex w-full flex-col overflow-hidden rounded-2xl border text-start transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6f86ff]",
          selected
            ? "border-[#8fa8ff] bg-[#6f86ff]/[0.08] shadow-lg shadow-[#6f86ff]/10"
            : "border-[#232b66] bg-[#10153a] hover:border-[#3f4fbf]"
        )}
      >
        {/* Selection indicator */}
        <span
          className={cn(
            "absolute end-2 top-2 z-10 grid size-6 place-items-center rounded-full border-2 transition-colors",
            selected
              ? "border-[#6f86ff] bg-[#6f86ff] text-white"
              : "border-white/20 bg-black/40 text-transparent group-hover:border-white/40"
          )}
          aria-hidden="true"
        >
          <Check className="size-3.5" strokeWidth={3} />
        </span>

        {/* Image */}
        <div className="relative aspect-square w-full overflow-hidden bg-[#0c1029]">
          <Image
            src={`https://picsum.photos/seed/${product.id}/400/400`}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            unoptimized
          />
        </div>

        {/* Info */}
        <div className="flex flex-1 flex-col gap-1.5 p-2.5">
          <p className="line-clamp-2 text-[11.5px] font-black leading-snug text-white">
            {product.name}
          </p>
          <p className="line-clamp-2 text-[10px] leading-relaxed text-[#8d97c4]">
            {product.shortDescription}
          </p>

          <div className="mt-auto flex items-baseline gap-2">
            <span className="font-mono text-sm font-black text-white">
              {adjustedPrice}
            </span>
            <span className="text-[10px] text-[#8d97c4]">ج.م</span>
            {product.compareAtEgp ? (
              <span className="font-mono text-[10px] text-[#8d97c4] line-through">
                {Math.round(product.compareAtEgp * priceMultiplier)}
              </span>
            ) : null}
          </div>

          {product.colors && product.colors.length > 0 ? (
            <div className="flex gap-1 pt-0.5">
              {product.colors.slice(0, 5).map((c) => (
                <span
                  key={c.name}
                  title={c.name}
                  className="size-3 rounded-full border border-white/20"
                  style={{ background: c.hex }}
                />
              ))}
            </div>
          ) : null}
        </div>
      </button>
    </li>
  );
}