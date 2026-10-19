"use client";

// ReviewGrid — مراجعة المنتجات قبل الاعتماد: بطاقة لكل منتج بحقول واضحة العناوين والتلميحات وبحجم مريح للمس (44px+
// وخط 16px فلا يكبّر iOS الصفحة). السعر وحده إلزامي ويظهر خطؤه في مكانه، وكل الباقي مقترح وقابل للتعديل.
// الحقول تتبع نشاط المتجر: الملابس والأحذية لها مقاسات وألوان، والإلكترونيات سعة ولون وضمان، والعطور حجم… إلخ.
// صور المنتج نفسه من زوايا مختلفة تُدمج في منتج واحد: بالسحب فوق بطاقة أخرى، أو بالتحديد ثم «دمج».
import { useId, useRef, useState } from "react";
import { GripVertical, ImagePlus, Merge, Plus, Trash2, X } from "lucide-react";
import { colorFromName } from "@/lib/color-names";
import { COLOR_PRESETS, SIZE_PRESETS, normalizeColor, normalizeSize, variantPlan, mergeIntoOne, type Candidate } from "@/lib/import-candidates";
import { attributesFor, attrValue, joinValues, setAttr, splitValues, usesSizeColor, type Niche, type NicheAttribute } from "@/lib/niche-attributes";
import { fmtNum } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Chip, Spinner } from "./ui";
import { uploadImages } from "./upload";

/** حقل كبير مريح: 48px ارتفاعاً و16px خطاً (لا تكبير تلقائي على iOS) وحلقة تركيز واضحة. */
export const bigInput =
  "min-h-12 w-full rounded-xl border border-edge/15 bg-edge/[0.03] px-3.5 text-[16px] font-bold text-ink outline-none transition-colors placeholder:font-normal placeholder:text-ink-3/80 focus:border-nova/70 focus:ring-2 focus:ring-nova/25 aria-[invalid=true]:border-bad/70 aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-bad/20";

const SIZE_GROUPS = [
  { id: "letters", label: "حروف", list: SIZE_PRESETS.letters },
  { id: "shoes", label: "أحذية", list: SIZE_PRESETS.shoes },
  { id: "jeans", label: "بناطيل", list: SIZE_PRESETS.jeans },
] as const;

function Label({ htmlFor, children, required, optional }: { htmlFor: string; children: React.ReactNode; required?: boolean; optional?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 flex items-baseline gap-1.5 text-[13px] font-black text-ink">
      {children}
      {required ? (
        <span className="text-bad" aria-hidden="true">
          *
        </span>
      ) : null}
      {required ? <span className="sr-only">(إلزامي)</span> : null}
      {optional ? <span className="text-[12px] font-normal text-ink-3">(اختياري)</span> : null}
    </label>
  );
}

function Hint({ id, children, error }: { id: string; children?: React.ReactNode; error?: string | null }) {
  if (error)
    return (
      <p id={id} className="mt-1.5 text-[12.5px] font-bold text-bad" role="alert">
        {error}
      </p>
    );
  return children ? (
    <p id={id} className="mt-1.5 text-[12px] leading-5 text-ink-3">
      {children}
    </p>
  ) : null;
}

const toNum = (t: string): number | null => {
  const n = Number(t.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/[,٬\s]/g, "").replace("٫", "."));
  return t.trim() === "" || !Number.isFinite(n) || n <= 0 ? null : Math.round(n * 100) / 100;
};

function PriceField({ id, label, value, onChange, required, hint, error, placeholder }: { id: string; label: string; value: number | null; onChange: (n: number | null) => void; required?: boolean; hint?: string; error?: string | null; placeholder: string }) {
  const [text, setText] = useState(value === null ? "" : String(value));
  const [touched, setTouched] = useState(false);
  const bad = text.trim() !== "" && toNum(text) === null ? "اكتبوا رقماً أكبر من صفر، مثل 350" : null;
  const shown = bad ?? (required && touched && value === null ? "السعر مطلوب" : null) ?? error ?? null;
  return (
    <div>
      <Label htmlFor={id} required={required} optional={!required}>
        {label}
      </Label>
      <div className="relative">
        <input
          id={id}
          inputMode="decimal"
          value={text}
          placeholder={placeholder}
          aria-invalid={shown ? true : undefined}
          aria-describedby={`${id}-h`}
          aria-required={required || undefined}
          onChange={(e) => {
            setText(e.target.value);
            onChange(toNum(e.target.value));
          }}
          onBlur={() => {
            setTouched(true);
            if (value !== null) setText(String(value));
          }}
          className={cn(bigInput, "pe-14 tabular-nums")}
        />
        <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 end-3.5 grid place-items-center text-[13px] font-bold text-ink-3">
          ج.م
        </span>
      </div>
      <Hint id={`${id}-h`} error={shown}>
        {hint}
      </Hint>
    </div>
  );
}

function ChipPicker({
  label,
  options,
  value,
  onChange,
  normalize,
  swatchFor,
  addLabel,
  hint,
}: {
  label: string;
  options: readonly string[];
  value: string[];
  onChange: (v: string[]) => void;
  normalize: (s: string) => string | null;
  swatchFor?: (s: string) => string | null;
  addLabel: string;
  hint?: string;
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
    <div role="group" aria-labelledby={id} className="space-y-2">
      <p id={id} className="text-[13px] font-black text-ink">
        {label}
        {value.length ? <span className="ms-2 text-[12px] font-normal text-ink-3">{fmtNum(value.length)} محدد</span> : null}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {[...options, ...custom].map((o) => (
          <Chip key={o} on={value.includes(o)} onClick={() => toggle(o)} swatch={swatchFor?.(o) ?? undefined} className="min-h-11 px-3.5 text-[13.5px]">
            {o}
          </Chip>
        ))}
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
          placeholder={`+ ${addLabel}`}
          maxLength={24}
          className="min-h-11 w-36 rounded-lg border border-dashed border-edge/25 bg-transparent px-3 text-[16px] font-bold text-ink outline-none placeholder:text-[13px] placeholder:font-normal placeholder:text-ink-3 focus:border-nova/60 focus:ring-2 focus:ring-nova/20"
        />
      </div>
      {hint ? <p className="text-[12px] leading-5 text-ink-3">{hint}</p> : null}
    </div>
  );
}

/** حقل سمة من سمات النشاط: خيارات جاهزة (يمكن اختيار أكثر من قيمة) أو نص حر. */
export function NicheAttributeField({ attr, value, onChange, idPrefix }: { attr: NicheAttribute; value: string; onChange: (v: string) => void; idPrefix: string }) {
  const id = `${idPrefix}-${attr.key}`;
  if (attr.kind === "option" && attr.values?.length) {
    return (
      <ChipPicker
        label={attr.label}
        options={attr.values}
        value={splitValues(value)}
        onChange={(vs) => onChange(joinValues(vs))}
        normalize={(s) => s.trim().slice(0, 40) || null}
        swatchFor={attr.key === "color" ? colorFromName : undefined}
        addLabel={`${attr.label} آخر`}
      />
    );
  }
  return (
    <div>
      <Label htmlFor={id} optional>
        {attr.label}
      </Label>
      <input id={id} value={value} maxLength={120} onChange={(e) => onChange(e.target.value)} placeholder={attr.placeholder} className={bigInput} />
    </div>
  );
}

/** سمات حرة بالاسم والقيمة (الخامة، بلد الصنع…): لأي نشاط، وهي الوحيدة لمن لا سمات جاهزة لنشاطه. تظهر في صفحة المنتج جدولاً. */
function FreeAttributes({ idPrefix, known, attributes, onChange, title }: { idPrefix: string; known: string[]; attributes: Candidate["attributes"]; onChange: (a: Candidate["attributes"]) => void; title: string }) {
  const [open, setOpen] = useState(false);
  const free = attributes.filter((a) => !known.includes(a.label));
  const [label, setLabel] = useState("");
  const [value, setValue] = useState("");
  const add = () => {
    const l = label.trim().slice(0, 40);
    const v = value.trim().slice(0, 120);
    if (!l || !v || known.includes(l)) return;
    onChange(setAttr(attributes, l, v));
    setLabel("");
    setValue("");
  };
  if (!open && !free.length)
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-dashed border-edge/25 px-3.5 text-[13px] font-bold text-ink-2 hover:border-nova/60 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova/50">
        <Plus className="size-4" aria-hidden="true" />
        إضافة مواصفة (مثل الخامة أو بلد الصنع)
      </button>
    );
  return (
    <fieldset className="space-y-3 rounded-xl border border-edge/10 bg-edge/[0.02] p-3.5">
      <legend className="px-1 text-[13px] font-black text-ink">
        {title} <span className="text-[12px] font-normal text-ink-3">(اختياري)</span>
      </legend>
      {free.map((a) => (
        <div key={a.label} className="flex items-center gap-2">
          <span className="min-w-0 basis-1/3 truncate text-[13px] font-bold text-ink-2">{a.label}</span>
          <input
            aria-label={`قيمة ${a.label}`}
            value={a.value}
            maxLength={120}
            onChange={(e) => onChange(attributes.map((x) => (x.label === a.label ? { ...x, value: e.target.value } : x)))}
            onBlur={(e) => !e.target.value.trim() && onChange(setAttr(attributes, a.label, ""))}
            className={cn(bigInput, "flex-1")}
          />
          <button type="button" aria-label={`حذف ${a.label}`} onClick={() => onChange(setAttr(attributes, a.label, ""))} className="grid size-11 shrink-0 place-items-center rounded-xl text-ink-3 hover:bg-bad/10 hover:text-bad focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova/50">
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      ))}
      <div className="grid gap-2 sm:grid-cols-[1fr_1.4fr_auto]">
        <div>
          <Label htmlFor={`${idPrefix}-fl`}>اسم المواصفة</Label>
          <input id={`${idPrefix}-fl`} value={label} maxLength={40} onChange={(e) => setLabel(e.target.value)} placeholder="مثال: الخامة" className={bigInput} />
        </div>
        <div>
          <Label htmlFor={`${idPrefix}-fv`}>القيمة</Label>
          <input
            id={`${idPrefix}-fv`}
            value={value}
            maxLength={120}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            placeholder="مثال: قطن 100%"
            className={bigInput}
          />
        </div>
        <button type="button" onClick={add} disabled={!label.trim() || !value.trim()} className="mt-auto min-h-12 rounded-xl bg-edge/10 px-4 text-[13px] font-black text-ink transition hover:bg-edge/15 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova/50">
          إضافة
        </button>
      </div>
    </fieldset>
  );
}

function ProductCard({
  c,
  index,
  niche,
  categories,
  onChange,
  onRemove,
  showErrors,
  selected,
  onSelect,
  onDropOn,
}: {
  c: Candidate;
  index: number;
  niche: Niche;
  categories: string[];
  onChange: (p: Partial<Candidate>) => void;
  onRemove: () => void;
  showErrors: boolean;
  selected: boolean;
  onSelect: (on: boolean) => void;
  onDropOn: (sourceId: string) => void;
}) {
  const [group, setGroup] = useState<(typeof SIZE_GROUPS)[number]["id"]>(c.sizes.some((s) => /^\d/.test(s)) ? "shoes" : "letters");
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const uid = useId();
  const listId = `${uid}-cats`;
  const sizes = usesSizeColor(niche);
  const plan = variantPlan(c.sizes, c.colors);
  const attrs = attributesFor(niche);
  const sizeOptions = [...(SIZE_GROUPS.find((g) => g.id === group)?.list ?? []), ...SIZE_PRESETS.free];
  const title = c.name.trim() || `منتج ${fmtNum(index + 1)}`;

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
    <article
      id={`cand-${c.id}`}
      aria-label={title}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("application/x-clp-cand")) {
          e.preventDefault();
          setOver(true);
        }
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        setOver(false);
        const src = e.dataTransfer.getData("application/x-clp-cand");
        if (src && src !== c.id) {
          e.preventDefault();
          onDropOn(src);
        }
      }}
      className={cn(
        "dash-card scroll-mt-28 space-y-4 p-4 [content-visibility:auto] [contain-intrinsic-size:auto_640px] sm:p-5",
        showErrors && c.price === null && "ring-2 ring-bad/40",
        selected && "ring-2 ring-nova/60",
        over && "ring-2 ring-nova bg-nova/[0.05]"
      )}
    >
      <div className="flex items-start gap-3">
        <div className="relative shrink-0">
          <div className="size-24 overflow-hidden rounded-xl border border-edge/10 bg-[repeating-conic-gradient(rgb(128_128_128/.12)_0_25%,transparent_0_50%)] bg-[length:14px_14px] sm:size-28">
            {c.images[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.images[0]} alt={title} className="size-full object-contain" loading="lazy" decoding="async" />
            ) : (
              <span className="grid size-full place-items-center text-ink-3">
                <ImagePlus className="size-7" aria-hidden="true" />
              </span>
            )}
          </div>
          {c.images.length > 1 ? <span className="absolute bottom-1.5 start-1.5 rounded-md bg-black/70 px-1.5 text-[11px] font-bold text-white">{fmtNum(c.images.length)} صور</span> : null}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-black text-ink">{title}</p>
          <p className="mt-0.5 text-[12px] text-ink-3">{c.price !== null ? `${fmtNum(c.price)} ج.م` : "السعر لم يُكتب بعد"}</p>
          <label className="mt-2 inline-flex min-h-11 cursor-pointer items-center gap-2 text-[12.5px] font-bold text-ink-2">
            <input type="checkbox" checked={selected} onChange={(e) => onSelect(e.target.checked)} className="size-5 accent-[var(--dash-nova)]" />
            تحديد للدمج
          </label>
        </div>
        <div className="flex shrink-0 flex-col items-center gap-1">
          <button type="button" onClick={onRemove} aria-label={`حذف ${title}`} className="grid size-11 place-items-center rounded-xl text-ink-3 transition hover:bg-bad/10 hover:text-bad focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova/50">
            <Trash2 className="size-[18px]" aria-hidden="true" />
          </button>
          <span
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData("application/x-clp-cand", c.id);
              e.dataTransfer.effectAllowed = "move";
            }}
            title="اسحبوا البطاقة فوق منتج آخر لدمجهما في منتج واحد"
            aria-hidden="true"
            className="hidden size-11 cursor-grab place-items-center rounded-xl text-ink-3 hover:bg-edge/5 active:cursor-grabbing sm:grid"
          >
            <GripVertical className="size-[18px]" />
          </span>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <PriceField
          id={`${uid}-price`}
          label="السعر"
          required
          value={c.price}
          onChange={(n) => onChange({ price: n, compareAt: n !== null && c.compareAt !== null && c.compareAt <= n ? null : c.compareAt })}
          placeholder="مثال: 350"
          hint="السعر الذي يدفعه الزبون بالجنيه."
          error={showErrors && c.price === null ? "اكتبوا سعر هذا المنتج" : null}
        />
        <PriceField id={`${uid}-cmp`} label="السعر قبل الخصم" value={c.compareAt} onChange={(n) => onChange({ compareAt: n })} placeholder="مثال: 450" hint="يظهر مشطوباً بجانب السعر إن كان أعلى منه." />
      </div>

      <div>
        <Label htmlFor={`${uid}-name`} optional>
          اسم المنتج
        </Label>
        <input id={`${uid}-name`} value={c.name} maxLength={120} onChange={(e) => onChange({ name: e.target.value })} placeholder="مثال: تيشيرت قطن أبيض" aria-describedby={`${uid}-name-h`} className={bigInput} />
        <Hint id={`${uid}-name-h`}>كما يبحث عنه الزبون. إن تُرك فارغاً نضع اسماً مؤقتاً تعدّلونه لاحقاً.</Hint>
      </div>

      <div>
        <Label htmlFor={`${uid}-cat`} optional>
          القسم
        </Label>
        <input id={`${uid}-cat`} list={listId} value={c.category} maxLength={80} onChange={(e) => onChange({ category: e.target.value })} placeholder="مثال: تيشيرتات" aria-describedby={`${uid}-cat-h`} className={bigInput} />
        <datalist id={listId}>
          {categories.map((k) => (
            <option key={k} value={k} />
          ))}
        </datalist>
        <Hint id={`${uid}-cat-h`}>اختاروا قسماً موجوداً أو اكتبوا اسماً جديداً فيُنشأ تلقائياً.</Hint>
      </div>

      <div>
        <Label htmlFor={`${uid}-desc`} optional>
          وصف قصير
        </Label>
        <textarea id={`${uid}-desc`} value={c.description} maxLength={600} rows={2} onChange={(e) => onChange({ description: e.target.value })} placeholder="الخامة، الاستخدام، ما يميزه…" className={cn(bigInput, "min-h-20 resize-y py-3 leading-7")} />
      </div>

      {attrs.length ? (
        <fieldset className="space-y-4 rounded-xl border border-edge/10 bg-edge/[0.02] p-3.5">
          <legend className="px-1 text-[13px] font-black text-ink">تفاصيل المنتج</legend>
          {attrs.map((a) => (
            <NicheAttributeField key={a.key} idPrefix={uid} attr={a} value={attrValue(c.attributes, a.label)} onChange={(v) => onChange({ attributes: setAttr(c.attributes, a.label, v) })} />
          ))}
        </fieldset>
      ) : null}

      <FreeAttributes
        idPrefix={uid}
        known={attrs.map((a) => a.label)}
        attributes={c.attributes}
        onChange={(attributes) => onChange({ attributes })}
        title={attrs.length ? "مواصفات أخرى" : "تفاصيل المنتج"}
      />

      {sizes ? (
        <details className="group rounded-xl border border-edge/10 bg-edge/[0.02] open:bg-edge/[0.035]" open={c.sizes.length > 0 || c.colors.length > 0}>
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 px-3.5 text-[13px] font-black text-ink [&::-webkit-details-marker]:hidden">
            <span>
              المقاسات والألوان
              <span className="ms-2 text-[12px] font-normal text-ink-3">{plan.combos.length ? `${fmtNum(plan.combos.length)} خيار` : "اختياري"}</span>
            </span>
            <span aria-hidden="true" className="text-ink-3 transition group-open:rotate-180">
              ▾
            </span>
          </summary>
          <div className="space-y-4 border-t border-edge/10 p-3.5">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="نوع المقاسات">
                {SIZE_GROUPS.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    role="radio"
                    aria-checked={group === g.id}
                    onClick={() => setGroup(g.id)}
                    className={cn("min-h-10 rounded-lg px-3 text-[12.5px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova/50", group === g.id ? "bg-edge/10 text-ink" : "text-ink-3 hover:text-ink")}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
              <ChipPicker label="المقاسات" options={sizeOptions} value={c.sizes} onChange={(s) => onChange({ sizes: s })} normalize={normalizeSize} addLabel="مقاس آخر" />
            </div>
            <ChipPicker label="الألوان" options={COLOR_PRESETS} value={c.colors} onChange={(colors) => onChange({ colors })} normalize={normalizeColor} swatchFor={colorFromName} addLabel="لون آخر" hint="تُنشأ الخيارات من اختياركم بنفس السعر، ويمكن تحديد المخزون لكل خيار لاحقاً من صفحة المنتج." />
          </div>
        </details>
      ) : null}

      <div>
        <p className="mb-2 text-[13px] font-black text-ink">
          الصور <span className="text-[12px] font-normal text-ink-3">({fmtNum(c.images.length)} من 10)</span>
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {c.images.map((u, i) => (
            <span key={u} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u} alt={`صورة ${i + 1} من ${title}`} className="size-14 rounded-lg border border-edge/10 object-cover" loading="lazy" decoding="async" />
              <button type="button" aria-label={`إزالة الصورة ${i + 1}`} onClick={() => onChange({ images: c.images.filter((x) => x !== u) })} className="absolute -end-2 -top-2 grid size-7 place-items-center rounded-full bg-ink text-space shadow hover:bg-bad hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova">
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </span>
          ))}
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" tabIndex={-1} aria-label="إضافة صور للمنتج" onChange={(e) => void addImages(e.target.files)} />
          {c.images.length < 10 ? (
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="inline-flex min-h-14 items-center gap-1.5 rounded-lg border border-dashed border-edge/25 px-3.5 text-[13px] font-bold text-ink-2 hover:border-nova/60 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova/50 disabled:opacity-60">
              {uploading ? <Spinner className="size-4" /> : <ImagePlus className="size-4" aria-hidden="true" />}
              {c.images.length ? "إضافة صور" : "إضافة صور للمنتج"}
            </button>
          ) : null}
        </div>
        {err ? <p className="mt-1.5 text-[12.5px] font-bold text-bad">{err}</p> : null}
      </div>
    </article>
  );
}

export function ReviewGrid({
  items,
  onChange,
  existingCategories,
  niche,
  showErrors = false,
}: {
  items: Candidate[];
  onChange: (next: Candidate[]) => void;
  existingCategories: string[];
  niche: Niche;
  showErrors?: boolean;
}) {
  const cats = [...new Set([...existingCategories, ...items.map((i) => i.category).filter(Boolean)])];
  const patch = (id: string, p: Partial<Candidate>) => onChange(items.map((c) => (c.id === id ? { ...c, ...p } : c)));
  const [bulk, setBulk] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const missingCat = items.filter((i) => !i.category).length;
  const live = picked.filter((id) => items.some((c) => c.id === id));

  const merge = (ids: string[]) => {
    onChange(mergeIntoOne(items, ids));
    setPicked([]);
  };

  return (
    <div className="space-y-3">
      {missingCat > 1 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-edge/10 bg-edge/[0.03] p-3">
          <label htmlFor="bulk-cat" className="text-[13px] font-bold text-ink-2">
            {fmtNum(missingCat)} منتج بلا قسم:
          </label>
          <input id="bulk-cat" value={bulk} onChange={(e) => setBulk(e.target.value)} placeholder="اكتبوا قسماً لتطبيقه عليها" className={cn(bigInput, "max-w-64 flex-1")} />
          <button
            type="button"
            disabled={!bulk.trim()}
            onClick={() => {
              onChange(items.map((c) => (c.category ? c : { ...c, category: bulk.trim().slice(0, 80) })));
              setBulk("");
            }}
            className="min-h-12 rounded-xl bg-edge/10 px-4 text-[13px] font-black text-ink transition hover:bg-edge/15 disabled:opacity-50"
          >
            تطبيق
          </button>
        </div>
      ) : null}
      {items.length > 1 ? <p className="text-[12px] leading-5 text-ink-3">صور المنتج نفسه من زوايا مختلفة؟ حدّدوا بطاقاتها ثم «دمج في منتج واحد»، أو اسحبوا بطاقة فوق أخرى.</p> : null}
      <ul className="grid gap-3 xl:grid-cols-2" aria-label="المنتجات للمراجعة">
        {items.map((c, i) => (
          <li key={c.id}>
            <ProductCard
              c={c}
              index={i}
              niche={niche}
              categories={cats}
              showErrors={showErrors}
              onChange={(p) => patch(c.id, p)}
              onRemove={() => onChange(items.filter((x) => x.id !== c.id))}
              selected={live.includes(c.id)}
              onSelect={(on) => setPicked((cur) => (on ? [...new Set([...cur, c.id])] : cur.filter((x) => x !== c.id)))}
              onDropOn={(src) => merge([c.id, src])}
            />
          </li>
        ))}
      </ul>
      {live.length >= 2 ? (
        <div className="sticky bottom-20 z-20 mx-auto flex w-fit flex-wrap items-center gap-2 rounded-2xl border border-nova/40 bg-space-2/95 p-2 shadow-xl backdrop-blur" role="region" aria-label="دمج المنتجات المحددة">
          <button type="button" onClick={() => merge(live)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-nova px-4 text-[13.5px] font-black text-white dark:text-space">
            <Merge className="size-4" aria-hidden="true" />
            دمج في منتج واحد ({fmtNum(live.length)})
          </button>
          <button type="button" onClick={() => setPicked([])} className="min-h-11 rounded-xl px-3 text-[13px] font-bold text-ink-2 hover:bg-edge/5">
            إلغاء التحديد
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function AddBlankButton({ onAdd, disabled }: { onAdd: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onAdd} disabled={disabled} className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-dashed border-edge/25 px-4 text-[14px] font-bold text-ink-2 transition hover:border-nova/60 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova/50 disabled:opacity-50">
      <Plus className="size-4" aria-hidden="true" />
      إضافة منتج يدوياً
    </button>
  );
}
