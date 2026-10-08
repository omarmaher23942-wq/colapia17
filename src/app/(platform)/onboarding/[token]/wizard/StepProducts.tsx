"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ImagePlus, Library, ArrowLeft, Plus, Trash2, Package, ChevronDown, Copy, Star, FolderTree, X, Sparkles, Infinity as InfinityIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { IndustryId, OnboardingAsset, OnboardingProduct, OnboardingSection } from "@/onboarding/schema";
import { ImageUploader } from "../components/ImageUploader";
import { ErrorText, Field, MoneyInput, NumberInput, Section, SmartHint, StepHeading, inputCls } from "./ui";
import { VariantEditor } from "./VariantEditor";
import { blankProduct, uid } from "./model";

const SECTION_IDEAS: Partial<Record<IndustryId, string[]>> = {
  fashion: ["رجالي", "حريمي", "أطفال", "عروض"],
  beauty: ["عناية بالبشرة", "مكياج", "عطور", "عناية بالشعر"],
  electronics: ["سماعات", "شواحن وكابلات", "إكسسوارات موبايل"],
  food: ["حلويات", "مكسرات", "عسل وأعشاب"],
  home: ["مطبخ", "ديكور", "مفروشات"],
  kids: ["ملابس", "ألعاب", "مستلزمات الرضّع"],
  accessories: ["شنط", "ساعات", "محافظ"],
  gifts: ["هدايا رجالي", "هدايا حريمي", "توزيعات"],
  health: ["فيتامينات", "مكملات", "أعشاب"],
};

export function StepProducts({
  token,
  industry,
  sections,
  products,
  setProducts,
  setSections,
  errors,
  onOpenLibrary,
}: {
  token: string;
  industry?: IndustryId;
  sections: OnboardingSection[];
  products: OnboardingProduct[];
  setProducts: (p: OnboardingProduct[]) => void;
  setSections: (s: OnboardingSection[]) => void;
  errors: Record<string, string>;
  onOpenLibrary: () => void;
}) {
  // كل صورة تُرفع هنا تصبح منتجاً مستقلاً، يكتب له التاجر الاسم والسعر فقط.
  const [batch, setBatch] = useState<OnboardingAsset[]>([]);
  const consumed = useRef(new Set<string>());
  const [openId, setOpenId] = useState<string | null>(null);
  useEffect(() => {
    const fresh = batch.filter((a) => !consumed.current.has(a.id));
    if (!fresh.length) return;
    fresh.forEach((a) => consumed.current.add(a.id));
    setProducts([...products, ...fresh.map((a) => blankProduct([a], sections[0]?.name))].slice(0, 50));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batch]);

  // أي خطأ داخل تفاصيل منتج (مثل خيار بلا قيم) يفتح بطاقته تلقائياً حتى يظهر الحقل الخاطئ.
  const errorSig = Object.keys(errors).join(",");
  useEffect(() => {
    const idx = products.findIndex((_, i) => errors[`p${i}options`]);
    if (idx >= 0) setOpenId(products[idx]!.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [errorSig]);

  const update = (id: string, p: Partial<OnboardingProduct>) =>
    setProducts(products.map((x) => (x.id === id ? ({ ...x, ...p } as OnboardingProduct) : x)));

  const sectionNames = useMemo(() => sections.map((s) => s.name), [sections]);
  const ideas = (SECTION_IDEAS[industry ?? "fashion"] ?? []).filter((n) => !sectionNames.includes(n));
  const missing = products.filter((p) => !p.name.trim() || !(Number(p.priceEgp) > 0)).length;

  return (
    <div className="space-y-6">
      <StepHeading
        eyebrow="الخطوة 2 من 5"
        title="منتجاتك"
        sub="ارفع صور منتجاتك فتتحول كل صورة إلى منتج. اكتب الاسم والسعر، وأضف المقاسات والألوان إن وُجدت. الأوصاف وصفحات المنتجات علينا."
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="dash-card p-4 sm:p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-black text-ink">
            <ImagePlus className="size-4 text-nova-2" aria-hidden="true" /> من صور منتجاتك
          </div>
          <ImageUploader token={token} value={batch} onChange={setBatch} max={30} label="اختر الصور أو اسحبها هنا" hint="حتى 30 صورة دفعة واحدة" />
        </div>
        <button type="button" onClick={onOpenLibrary} className="dash-card group flex flex-col items-start gap-3 p-4 text-start transition hover:border-nova/40 sm:p-5">
          <span className="grid size-11 place-items-center rounded-2xl bg-gradient-to-br from-aurora to-nova text-white shadow-lg">
            <Library className="size-5" aria-hidden="true" />
          </span>
          <span className="text-sm font-black text-ink">من مكتبة المنتجات الجاهزة</span>
          <span className="text-[12.5px] leading-6 text-ink-2">منتجات مجهزة حسب نشاطك بصورها وأوصافها. اختر وعدّل السعر فقط.</span>
          <span className="mt-auto inline-flex items-center gap-1 text-[12px] font-black text-nova-2">
            تصفح المكتبة <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-1" />
          </span>
        </button>
      </div>

      <Section icon={FolderTree} title="أقسام متجرك" sub="اختياري: نرتب المنتجات فيها. إن تركتها نقترح أقساماً مناسبة.">
        <SectionsEditor sections={sections} ideas={ideas} onChange={(next) => {
          setSections(next);
          const names = new Set(next.map((s) => s.name));
          if (products.some((p) => p.categoryName && !names.has(p.categoryName)))
            setProducts(products.map((p) => (p.categoryName && !names.has(p.categoryName) ? ({ ...p, categoryName: undefined } as OnboardingProduct) : p)));
        }} />
      </Section>

      <ErrorText className="text-[13px]">{errors.products}</ErrorText>

      {products.length ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-black text-ink">
              منتجاتك <span className="text-ink-3">({products.length}/50)</span>
              {missing ? <span className="ms-2 rounded-full bg-amber-400/15 px-2 py-0.5 text-[11px] text-amber-500 dark:text-amber-300">{missing} تحتاج اسماً أو سعراً</span> : null}
            </p>
            <button
              type="button"
              onClick={() => {
                const p = blankProduct([], sections[0]?.name);
                setProducts([...products, p]);
                setOpenId(p.id);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[12px] font-black text-nova-2 transition hover:bg-nova/10"
            >
              <Plus className="size-3.5" /> منتج يدوي
            </button>
          </div>
          <ul className="grid gap-3">
            <AnimatePresence initial={false}>
              {products.map((p, i) => (
                <motion.li key={p.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }}>
                  <ProductCard
                    token={token}
                    industry={industry}
                    product={p}
                    index={i}
                    sections={sectionNames}
                    open={openId === p.id}
                    onToggle={() => setOpenId(openId === p.id ? null : p.id)}
                    onChange={(patch) => update(p.id, patch)}
                    onDuplicate={() => {
                      const copy = { ...p, id: uid(), name: `${p.name} (نسخة)`, bestSeller: false } as OnboardingProduct;
                      setProducts([...products.slice(0, i + 1), copy, ...products.slice(i + 1)].slice(0, 50));
                    }}
                    onRemove={() => setProducts(products.filter((x) => x.id !== p.id))}
                    errors={errors}
                  />
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
          <SmartHint>نكتب لكل منتج وصفاً مقنعاً وعناوين بحث، ونضع الأكثر مبيعاً في الواجهة. يمكنك تعديل كل شيء من لوحة التحكم.</SmartHint>
        </div>
      ) : null}
    </div>
  );
}

function SectionsEditor({ sections, ideas, onChange }: { sections: OnboardingSection[]; ideas: string[]; onChange: (s: OnboardingSection[]) => void }) {
  const [draft, setDraft] = useState("");
  const add = (name: string) => {
    const n = name.trim().slice(0, 60);
    if (!n || sections.some((s) => s.name === n) || sections.length >= 20) return;
    onChange([...sections, { id: uid(), name: n }]);
  };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {sections.map((s) => (
          <span key={s.id} className="inline-flex items-center gap-1.5 rounded-xl bg-nova/15 px-3 py-1.5 text-[12.5px] font-black text-ink">
            {s.name}
            <button type="button" aria-label={`حذف قسم ${s.name}`} onClick={() => onChange(sections.filter((x) => x.id !== s.id))} className="text-ink-3 hover:text-rose-400">
              <X className="size-3.5" />
            </button>
          </span>
        ))}
        <form
          className="flex items-center gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            add(draft);
            setDraft("");
          }}
        >
          <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="قسم جديد" aria-label="اسم قسم جديد" className={cn(inputCls, "h-9 w-36 text-[12.5px]")} />
          <button type="submit" aria-label="إضافة القسم" className="grid size-9 place-items-center rounded-xl bg-edge/[0.06] text-ink-2 hover:bg-nova/20">
            <Plus className="size-4" />
          </button>
        </form>
      </div>
      {ideas.length ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11.5px] text-ink-3">مقترحة:</span>
          {ideas.map((n) => (
            <button key={n} type="button" onClick={() => add(n)} className="rounded-lg border border-edge/10 px-2.5 py-1 text-[12px] font-bold text-ink-3 hover:border-nova/40 hover:text-ink">
              + {n}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ProductCard({
  token,
  industry,
  product: p,
  index: i,
  sections,
  open,
  onToggle,
  onChange,
  onDuplicate,
  onRemove,
  errors,
}: {
  token: string;
  industry?: IndustryId;
  product: OnboardingProduct;
  index: number;
  sections: string[];
  open: boolean;
  onToggle: () => void;
  onChange: (p: Partial<OnboardingProduct>) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  errors: Record<string, string>;
}) {
  const cover = p.images.find((x) => x.id === p.primaryImageId) ?? p.images[0];
  const discount = p.compareAtEgp && p.compareAtEgp > p.priceEgp && p.priceEgp > 0 ? Math.round((1 - p.priceEgp / p.compareAtEgp) * 100) : 0;
  const unlimited = p.stock === null || p.stock === undefined;
  const hasError = Boolean(errors[`p${i}name`] || errors[`p${i}price`] || errors[`p${i}compare`] || errors[`p${i}options`]);

  return (
    <div className={cn("dash-card overflow-hidden", hasError && "ring-1 ring-rose-400/40", open && "ring-1 ring-nova/30")}>
      <div className="flex items-start gap-3 p-3">
        <div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-edge/[0.05] sm:size-[72px]">
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover.url} alt="" className="size-full object-cover" />
          ) : (
            <Package className="m-auto mt-5 size-6 text-ink-3" />
          )}
          {discount ? <span className="absolute start-1 top-1 rounded-md bg-rose-500 px-1 text-[10px] font-black text-white">-{discount}%</span> : null}
          {p.bestSeller ? <Star className="absolute bottom-1 end-1 size-4 fill-amber-400 text-amber-400" /> : null}
        </div>
        <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-[1fr_110px_110px]">
          <input
            value={p.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="اسم المنتج"
            aria-label="اسم المنتج"
            aria-invalid={!!errors[`p${i}name`] || undefined}
            className={cn(inputCls, "h-10 text-[13px]", errors[`p${i}name`] && "border-rose-400/60")}
          />
          <MoneyInput value={p.priceEgp} onChange={(v) => onChange({ priceEgp: v })} placeholder="السعر" invalid={!!errors[`p${i}price`]} />
          <MoneyInput value={p.compareAtEgp ?? 0} onChange={(v) => onChange({ compareAtEgp: v || undefined })} placeholder="قبل الخصم" invalid={!!errors[`p${i}compare`]} />
        </div>
        <div className="flex shrink-0 flex-col gap-1">
          <button type="button" onClick={onToggle} aria-expanded={open} aria-label="تفاصيل المنتج" className="grid size-9 place-items-center rounded-lg text-ink-2 transition hover:bg-edge/[0.06]">
            <ChevronDown className={cn("size-4 transition", open && "rotate-180")} />
          </button>
          <button type="button" onClick={onRemove} aria-label={`حذف ${p.name || "المنتج"}`} className="grid size-9 place-items-center rounded-lg text-ink-3 transition hover:bg-rose-400/10 hover:text-rose-400">
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>

      {hasError ? (
        <div className="space-y-1 px-3 pb-3">
          <ErrorText>{errors[`p${i}name`]}</ErrorText>
          <ErrorText>{errors[`p${i}price`]}</ErrorText>
          <ErrorText>{errors[`p${i}compare`]}</ErrorText>
          {!open ? <ErrorText>{errors[`p${i}options`]}</ErrorText> : null}
        </div>
      ) : null}

      {!open ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-edge/[0.06] px-3 py-2 text-[11.5px] text-ink-3">
          {p.categoryName ? <span className="rounded-md bg-edge/[0.05] px-2 py-0.5 font-bold">{p.categoryName}</span> : null}
          {p.options.length ? <span className="rounded-md bg-edge/[0.05] px-2 py-0.5 font-bold">{p.variants.length} تركيبة</span> : null}
          <span>{unlimited ? "مخزون غير محدود" : `المخزون: ${p.stock}`}</span>
          <button type="button" onClick={onToggle} className="ms-auto font-black text-nova-2">
            المقاسات والألوان والتفاصيل
          </button>
        </div>
      ) : (
        <div className="space-y-5 border-t border-edge/[0.06] p-4">
          <Field label="صور المنتج" hint="الأولى هي الصورة الرئيسية">
            <ImageUploader
              token={token}
              value={p.images}
              onChange={(images) => onChange({ images, primaryImageId: images.find((x) => x.id === p.primaryImageId)?.id ?? images[0]?.id ?? "" })}
              max={8}
              label="أضف صوراً"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="القسم">
              <select
                value={p.categoryName ?? ""}
                onChange={(e) => onChange({ categoryName: e.target.value || undefined })}
                aria-label="قسم المنتج"
                className={cn(inputCls, "h-10 text-[13px]")}
              >
                <option value="">نختار له قسماً مناسباً</option>
                {sections.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="المخزون" hint={p.options.length ? "يُحدد لكل تركيبة بالأسفل" : undefined}>
              <div className="flex items-center gap-2">
                <NumberInput
                  value={unlimited ? 0 : (p.stock ?? 0)}
                  onChange={(n) => onChange({ stock: n })}
                  max={1_000_000}
                  ariaLabel="الكمية المتاحة"
                  suffix="قطعة"
                  className={cn("flex-1", (unlimited || p.options.length > 0) && "pointer-events-none opacity-40")}
                />
                <button
                  type="button"
                  aria-pressed={unlimited}
                  onClick={() => onChange({ stock: unlimited ? 20 : null })}
                  className={cn("inline-flex h-10 items-center gap-1.5 rounded-xl border px-3 text-[12px] font-black transition", unlimited ? "border-nova/50 bg-nova/15 text-ink" : "border-edge/10 text-ink-3")}
                >
                  <InfinityIcon className="size-4" /> غير محدود
                </button>
              </div>
            </Field>
          </div>

          <Field label="الوصف" hint="اختياري: اكتب أي تفاصيل مهمة، ونصيغها نحن بأسلوب مقنع">
            <textarea
              value={p.description ?? ""}
              onChange={(e) => onChange({ description: e.target.value.slice(0, 3000) })}
              rows={3}
              placeholder="مثال: قطن 100٪، مناسب للصيف، الخياطة مزدوجة..."
              className={cn(inputCls, "h-auto resize-y py-2.5 text-[13px] font-medium leading-6")}
            />
          </Field>

          <Field label="المقاسات والألوان" hint="لكل تركيبة سعر ومخزون مستقلان" error={errors[`p${i}options`]}>
            <VariantEditor product={p} industry={industry} onChange={onChange} />
          </Field>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              aria-pressed={p.bestSeller}
              onClick={() => onChange({ bestSeller: !p.bestSeller })}
              className={cn(
                "inline-flex h-10 items-center gap-1.5 rounded-xl border px-3 text-[12.5px] font-black transition",
                p.bestSeller ? "border-amber-400/50 bg-amber-400/15 text-amber-600 dark:text-amber-300" : "border-edge/10 text-ink-2"
              )}
            >
              <Star className={cn("size-4", p.bestSeller && "fill-current")} /> الأكثر مبيعاً
            </button>
            <button type="button" onClick={onDuplicate} className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-edge/10 px-3 text-[12.5px] font-black text-ink-2 hover:bg-edge/[0.04]">
              <Copy className="size-4" /> تكرار المنتج
            </button>
            <span className="ms-auto inline-flex items-center gap-1 text-[11.5px] text-ink-3">
              <Sparkles className="size-3.5 text-aurora" /> الوصف وعناوين البحث علينا
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
