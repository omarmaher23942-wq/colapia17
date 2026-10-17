"use client";

// ReviewGrid — مراجعة المنتجات قبل الاعتماد: بطاقة لكل مرشّح بالاسم والسعر والقسم وصوره، والمقاسات والألوان رقائق
// تُضغط (لا جداول ولا تركيبات يدوية). منتج بلا سعر يُعلَّم بوضوح ويُحفظ مسودة. بطاقات طويلة القائمة تُرسم بـ content-visibility.
import { useId, useRef, useState } from "react";
import { ImagePlus, Plus, Trash2, X } from "lucide-react";
import { colorFromName } from "@/lib/color-names";
import { COLOR_PRESETS, SIZE_PRESETS, normalizeColor, normalizeSize, variantPlan, type Candidate } from "@/lib/import-candidates";
import { fmtNum } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Chip, inputCls, Spinner } from "./ui";
import { uploadImages } from "./upload";

const SIZE_GROUPS = [
  { id: "letters", label: "حروف", list: SIZE_PRESETS.letters },
  { id: "shoes", label: "أحذية", list: SIZE_PRESETS.shoes },
  { id: "jeans", label: "بناطيل", list: SIZE_PRESETS.jeans },
] as const;

function ChipPicker({
  label,
  options,
  value,
  onChange,
  normalize,
  swatchFor,
  addLabel,
}: {
  label: string;
  options: readonly string[];
  value: string[];
  onChange: (v: string[]) => void;
  normalize: (s: string) => string | null;
  swatchFor?: (s: string) => string | null;
  addLabel: string;
}) {
  const [draft, setDraft] = useState("");
  const id = useId();
  const toggle = (o: string) => onChange(value.includes(o) ? value.filter((x) => x !== o) : [...value, o]);
  const custom = value.filter((v) => !options.includes(v));
  const add = () => {
    const n = normalize(draft);
    setDraft("");
    if (n && !value.includes(n)) onChange([...value, n].slice(0, 24));
  };
  return (
    <div role="group" aria-labelledby={id} className="space-y-1.5">
      <p id={id} className="text-[12px] font-bold text-ink-2">
        {label}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {[...options, ...custom].map((o) => (
          <Chip key={o} on={value.includes(o)} onClick={() => toggle(o)} swatch={swatchFor?.(o) ?? undefined}>
            {o}
          </Chip>
        ))}
        <span className="inline-flex items-center">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            onBlur={add}
            aria-label={addLabel}
            placeholder={addLabel}
            maxLength={20}
            className="h-9 w-28 rounded-lg border border-dashed border-edge/20 bg-transparent px-2.5 text-[12px] font-bold text-ink outline-none placeholder:font-normal placeholder:text-ink-3 focus:border-nova/60"
          />
        </span>
      </div>
    </div>
  );
}

function PriceInput({ value, onChange, label, placeholder }: { value: number | null; onChange: (n: number | null) => void; label: string; placeholder: string }) {
  const [text, setText] = useState(value === null ? "" : String(value));
  const commit = (t: string) => {
    const n = Number(t.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/[,٬\s]/g, "").replace("٫", "."));
    onChange(t.trim() === "" || !Number.isFinite(n) || n <= 0 ? null : Math.round(n * 100) / 100);
  };
  return (
    <input
      inputMode="decimal"
      value={text}
      aria-label={label}
      placeholder={placeholder}
      onChange={(e) => {
        setText(e.target.value);
        commit(e.target.value);
      }}
      onBlur={() => setText(value === null ? "" : String(value))}
      className={cn(inputCls, "tabular-nums")}
    />
  );
}

function ProductCard({ c, categories, onChange, onRemove }: { c: Candidate; categories: string[]; onChange: (p: Partial<Candidate>) => void; onRemove: () => void }) {
  const [group, setGroup] = useState<(typeof SIZE_GROUPS)[number]["id"]>(c.sizes.some((s) => /^\d/.test(s)) ? "shoes" : "letters");
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const draft = c.price === null;
  const plan = variantPlan(c.sizes, c.colors);
  const listId = useId();
  const sizeOptions = [...(SIZE_GROUPS.find((g) => g.id === group)?.list ?? []), ...SIZE_PRESETS.free];

  async function addImages(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setErr(null);
    const r = await uploadImages([...files].slice(0, 10 - c.images.length));
    setUploading(false);
    if (r.error) setErr(r.error);
    if (r.urls.length) onChange({ images: [...c.images, ...r.urls].slice(0, 10) });
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <article className={cn("dash-card space-y-3.5 p-3.5 [content-visibility:auto] [contain-intrinsic-size:auto_420px] sm:p-4", draft && "ring-1 ring-warn/40")}>
      <div className="flex gap-3">
        <div className="shrink-0">
          <div className="relative size-20 overflow-hidden rounded-xl border border-edge/10 bg-edge/[0.04] sm:size-24">
            {c.images[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.images[0]} alt={c.name} className="size-full object-cover" loading="lazy" />
            ) : (
              <span className="grid size-full place-items-center text-ink-3">
                <ImagePlus className="size-6" aria-hidden="true" />
              </span>
            )}
            {c.images.length > 1 ? <span className="absolute bottom-1 start-1 rounded-md bg-black/60 px-1.5 text-[10.5px] font-bold text-white">{fmtNum(c.images.length)}</span> : null}
          </div>
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <input value={c.name} onChange={(e) => onChange({ name: e.target.value.slice(0, 120) })} aria-label="اسم المنتج" placeholder="اسم المنتج" className={cn(inputCls, "font-black")} />
          <div className="grid grid-cols-2 gap-2">
            <PriceInput value={c.price} onChange={(n) => onChange({ price: n, compareAt: n !== null && c.compareAt !== null && c.compareAt <= n ? null : c.compareAt })} label="السعر بالجنيه" placeholder="السعر (ج)" />
            <PriceInput value={c.compareAt} onChange={(n) => onChange({ compareAt: n })} label="السعر قبل الخصم (اختياري)" placeholder="قبل الخصم" />
          </div>
        </div>
        <button type="button" onClick={onRemove} aria-label={`حذف ${c.name}`} className="grid size-9 shrink-0 place-items-center rounded-lg text-ink-3 transition hover:bg-bad/10 hover:text-bad focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova/50">
          <Trash2 className="size-4" aria-hidden="true" />
        </button>
      </div>

      {draft ? <p className="rounded-lg bg-warn/10 px-3 py-2 text-[12px] font-bold text-warn">بلا سعر: سيُحفظ كمسودة ولن يظهر في المتجر حتى تحددوا سعره.</p> : null}

      <div>
        <input list={listId} value={c.category} onChange={(e) => onChange({ category: e.target.value.slice(0, 80) })} aria-label="القسم" placeholder="القسم (مثل: تيشيرتات)" className={inputCls} />
        <datalist id={listId}>
          {categories.map((k) => (
            <option key={k} value={k} />
          ))}
        </datalist>
      </div>

      <details className="group rounded-xl border border-edge/10 bg-edge/[0.02] open:bg-edge/[0.035]" open={c.sizes.length > 0 || c.colors.length > 0}>
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-3 text-[12.5px] font-bold text-ink-2 [&::-webkit-details-marker]:hidden">
          <span>
            المقاسات والألوان
            <span className="ms-2 font-normal text-ink-3">{plan.combos.length ? `${fmtNum(plan.combos.length)} خيار` : "اختياري"}</span>
          </span>
          <span aria-hidden="true" className="text-ink-3 transition group-open:rotate-180">
            ▾
          </span>
        </summary>
        <div className="space-y-3.5 border-t border-edge/10 p-3">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="نوع المقاسات">
              {SIZE_GROUPS.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  role="tab"
                  aria-selected={group === g.id}
                  onClick={() => setGroup(g.id)}
                  className={cn("min-h-8 rounded-md px-2.5 text-[11.5px] font-bold transition", group === g.id ? "bg-edge/10 text-ink" : "text-ink-3 hover:text-ink")}
                >
                  {g.label}
                </button>
              ))}
            </div>
            <ChipPicker label="المقاسات" options={sizeOptions} value={c.sizes} onChange={(sizes) => onChange({ sizes })} normalize={normalizeSize} addLabel="مقاس آخر" />
          </div>
          <ChipPicker label="الألوان" options={COLOR_PRESETS} value={c.colors} onChange={(colors) => onChange({ colors })} normalize={normalizeColor} swatchFor={colorFromName} addLabel="لون آخر" />
          <p className="text-[11.5px] leading-5 text-ink-3">تُنشأ الخيارات من اختياركم بنفس السعر، ويمكن تحديد المخزون أو الاستثناءات لاحقاً من صفحة المنتج.</p>
        </div>
      </details>

      <div className="flex flex-wrap items-center gap-2">
        {c.images.slice(0, 6).map((u, i) => (
          <span key={u} className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={u} alt="" className="size-10 rounded-lg border border-edge/10 object-cover" loading="lazy" />
            <button type="button" aria-label="إزالة الصورة" onClick={() => onChange({ images: c.images.filter((x) => x !== u) })} className="absolute -end-1 -top-1 grid size-5 place-items-center rounded-full bg-ink text-space shadow hover:bg-bad hover:text-white">
              <X className="size-3" aria-hidden="true" />
            </button>
            <span className="sr-only">صورة {i + 1}</span>
          </span>
        ))}
        <input ref={fileRef} type="file" accept="image/*" multiple className="sr-only" tabIndex={-1} onChange={(e) => void addImages(e.target.files)} />
        {c.images.length < 10 ? (
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-dashed border-edge/25 px-3 text-[12px] font-bold text-ink-2 hover:border-nova/60 hover:text-ink disabled:opacity-60">
            {uploading ? <Spinner className="size-3.5" /> : <ImagePlus className="size-3.5" aria-hidden="true" />}
            {c.images.length ? "إضافة صور" : "إضافة صور للمنتج"}
          </button>
        ) : null}
        {err ? <span className="text-[12px] font-bold text-bad">{err}</span> : null}
      </div>
    </article>
  );
}

export function ReviewGrid({ items, onChange, existingCategories }: { items: Candidate[]; onChange: (next: Candidate[]) => void; existingCategories: string[] }) {
  const cats = [...new Set([...existingCategories, ...items.map((i) => i.category).filter(Boolean)])];
  const patch = (id: string, p: Partial<Candidate>) => onChange(items.map((c) => (c.id === id ? { ...c, ...p } : c)));
  const [bulk, setBulk] = useState("");
  const missingCat = items.filter((i) => !i.category).length;
  return (
    <div className="space-y-3">
      {missingCat > 1 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-edge/10 bg-edge/[0.03] p-2.5">
          <label htmlFor="bulk-cat" className="text-[12px] font-bold text-ink-2">
            {fmtNum(missingCat)} منتج بلا قسم:
          </label>
          <input id="bulk-cat" value={bulk} onChange={(e) => setBulk(e.target.value)} placeholder="اكتبوا قسماً لتطبيقه عليها" className={cn(inputCls, "min-h-10 max-w-60 flex-1")} />
          <button
            type="button"
            disabled={!bulk.trim()}
            onClick={() => {
              onChange(items.map((c) => (c.category ? c : { ...c, category: bulk.trim().slice(0, 80) })));
              setBulk("");
            }}
            className="min-h-10 rounded-lg bg-edge/10 px-3 text-[12px] font-black text-ink transition hover:bg-edge/15 disabled:opacity-50"
          >
            تطبيق
          </button>
        </div>
      ) : null}
      <ul className="grid gap-3 lg:grid-cols-2" aria-label="المنتجات المقترحة للمراجعة">
        {items.map((c) => (
          <li key={c.id}>
            <ProductCard c={c} categories={cats} onChange={(p) => patch(c.id, p)} onRemove={() => onChange(items.filter((x) => x.id !== c.id))} />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AddBlankButton({ onAdd, disabled }: { onAdd: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onAdd} disabled={disabled} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-dashed border-edge/25 px-4 text-[13px] font-bold text-ink-2 transition hover:border-nova/60 hover:text-ink disabled:opacity-50">
      <Plus className="size-4" aria-hidden="true" />
      إضافة منتج يدوياً
    </button>
  );
}
