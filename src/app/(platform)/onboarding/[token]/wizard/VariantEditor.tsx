"use client";

// VariantEditor — المقاسات والألوان لكل منتج، بسعر ومخزون لكل تركيبة.
// التاجر يختار القيم كأقراص سريعة (مقاسات وألوان شائعة حسب نشاطه)، والجدول يُولَّد تلقائياً.
import { useState } from "react";
import { Plus, X, Palette, Ruler, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import type { IndustryId, OnboardingProduct } from "@/onboarding/schema";
import { ErrorText, MoneyInput, NumberInput, inputCls } from "./ui";
import { uid } from "./model";

type Option = OnboardingProduct["options"][number];
type Variant = OnboardingProduct["variants"][number];

const COLOR_PRESETS = ["أسود", "أبيض", "كحلي", "رمادي", "بيج", "بني", "أحمر", "أخضر", "أزرق", "وردي", "ذهبي", "فضي"];
const SIZE_PRESETS: Partial<Record<IndustryId, string[]>> & { default: string[] } = {
  fashion: ["S", "M", "L", "XL", "XXL", "3XL"],
  kids: ["0-6 شهور", "6-12 شهر", "1-2 سنة", "2-3 سنة", "4-5 سنة", "6-7 سنة"],
  accessories: ["صغير", "وسط", "كبير"],
  beauty: ["30 مل", "50 مل", "100 مل"],
  food: ["250 جم", "500 جم", "1 كجم"],
  default: ["صغير", "وسط", "كبير"],
};
const SHOE_SIZES = ["37", "38", "39", "40", "41", "42", "43", "44", "45"];
const MAX_COMBOS = 60;
/** كمية افتراضية لكل تركيبة جديدة (يعدّلها التاجر في الجدول). */
const DEFAULT_VARIANT_STOCK = 10;

function combos(options: Option[]): Record<string, string>[] {
  return options.reduce<Record<string, string>[]>(
    (acc, o) => acc.flatMap((k) => o.values.map((v) => ({ ...k, [o.id]: v.id }))),
    [{}]
  );
}

const keyOf = (k: Record<string, string>) => JSON.stringify(Object.entries(k).sort());

/** يعيد بناء التركيبات مع الإبقاء على سعر ومخزون أي تركيبة موجودة. */
function rebuild(options: Option[], prev: Variant[]): Variant[] {
  if (!options.length || options.some((o) => !o.values.length)) return [];
  const old = new Map(prev.map((v) => [keyOf(v.key), v]));
  return combos(options)
    .slice(0, MAX_COMBOS)
    .map((key) => old.get(keyOf(key)) ?? { key, priceEgp: null, stock: DEFAULT_VARIANT_STOCK, available: true, imageIds: [] });
}

export function VariantEditor({
  product,
  industry,
  onChange,
  error,
}: {
  product: OnboardingProduct;
  industry?: IndustryId;
  onChange: (p: Partial<OnboardingProduct>) => void;
  error?: string;
}) {
  const options = product.options;
  const setOptions = (next: Option[]) => onChange({ options: next, variants: rebuild(next, product.variants) });

  const addOption = (kind: Option["kind"]) => {
    if (options.length >= 2) return;
    const name = kind === "color" ? "اللون" : kind === "size" ? "المقاس" : "النوع";
    setOptions([...options, { id: uid(), name, kind, values: [] }]);
  };

  const sizePresets = industry === "fashion" && /حذاء|كوتش|جزم|شوز|صندل/.test(product.name) ? SHOE_SIZES : SIZE_PRESETS[industry ?? "default"] ?? SIZE_PRESETS.default;

  return (
    <div className="space-y-4">
      {options.map((o, oi) => (
        <OptionRow
          key={o.id}
          option={o}
          presets={o.kind === "color" ? COLOR_PRESETS : o.kind === "size" ? sizePresets : []}
          onChange={(next) => setOptions(options.map((x, j) => (j === oi ? next : x)))}
          onRemove={() => setOptions(options.filter((_, j) => j !== oi))}
        />
      ))}

      {options.length < 2 ? (
        <div className="flex flex-wrap gap-2">
          {!options.some((o) => o.kind === "size") ? (
            <AddOption icon={Ruler} label="أضف مقاسات" onClick={() => addOption("size")} />
          ) : null}
          {!options.some((o) => o.kind === "color") ? (
            <AddOption icon={Palette} label="أضف ألوان" onClick={() => addOption("color")} />
          ) : null}
          <AddOption icon={Tag} label="خيار آخر" onClick={() => addOption("custom")} />
        </div>
      ) : null}

      <ErrorText>{error}</ErrorText>

      {product.variants.length ? (
        <div className="overflow-hidden rounded-2xl border border-edge/10">
          <div className="flex items-center justify-between gap-2 border-b border-edge/[0.07] bg-edge/[0.03] px-3 py-2">
            <span className="text-[12px] font-black text-ink">{product.variants.length} تركيبة</span>
            <span className="text-[11px] text-ink-3">السعر الفارغ = سعر المنتج الأساسي</span>
          </div>
          <ul className="max-h-80 divide-y divide-edge/[0.06] overflow-y-auto">
            {product.variants.map((v, vi) => {
              const label = options
                .map((o) => o.values.find((x) => x.id === v.key[o.id])?.label)
                .filter(Boolean)
                .join(" / ");
              const set = (patch: Partial<Variant>) =>
                onChange({ variants: product.variants.map((x, j) => (j === vi ? { ...x, ...patch } : x)) });
              return (
                <li key={keyOf(v.key)} className={cn("grid grid-cols-[1fr_96px_76px_auto] items-center gap-2 px-3 py-2", !v.available && "opacity-50")}>
                  <span className="truncate text-[12.5px] font-bold text-ink">{label}</span>
                  <MoneyInput value={v.priceEgp ?? undefined} onChange={(n) => set({ priceEgp: n || null })} placeholder={String(product.priceEgp || "السعر")} ariaLabel={`سعر ${label}`} />
                  <NumberInput value={v.stock ?? 0} onChange={(n) => set({ stock: n })} max={100000} ariaLabel={`مخزون ${label}`} suffix="قطعة" />
                  <button
                    type="button"
                    role="switch"
                    aria-checked={v.available}
                    aria-label={`${label} متاح`}
                    onClick={() => set({ available: !v.available })}
                    className={cn("relative h-6 w-10 rounded-full transition", v.available ? "bg-emerald-500" : "bg-edge/20")}
                  >
                    <span className={cn("absolute top-1 size-4 rounded-full bg-white shadow transition-all", v.available ? "start-5" : "start-1")} />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function AddOption({ icon: Icon, label, onClick }: { icon: typeof Ruler; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-dashed border-edge/20 px-3 text-[12px] font-black text-ink-2 transition hover:border-nova/50 hover:text-ink"
    >
      <Icon className="size-3.5" /> {label}
    </button>
  );
}

function OptionRow({ option, presets, onChange, onRemove }: { option: Option; presets: string[]; onChange: (o: Option) => void; onRemove: () => void }) {
  const [draft, setDraft] = useState("");
  const has = (label: string) => option.values.some((v) => v.label === label);
  const add = (label: string) => {
    const l = label.trim().slice(0, 40);
    if (!l || has(l) || option.values.length >= 20) return;
    onChange({ ...option, values: [...option.values, { id: uid(), label: l }] });
  };
  return (
    <div className="space-y-2.5 rounded-2xl border border-edge/10 p-3">
      <div className="flex items-center gap-2">
        <input
          value={option.name}
          onChange={(e) => onChange({ ...option, name: e.target.value.slice(0, 40) })}
          aria-label="اسم الخيار"
          className={cn(inputCls, "h-9 max-w-40 text-[13px]")}
        />
        <button type="button" onClick={onRemove} aria-label={`حذف ${option.name}`} className="ms-auto grid size-8 place-items-center rounded-lg text-ink-3 hover:bg-rose-400/10 hover:text-rose-400">
          <X className="size-4" />
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {option.values.map((v) => (
          <span key={v.id} className="inline-flex items-center gap-1 rounded-lg bg-nova/15 px-2 py-1 text-[12px] font-bold text-ink">
            {v.label}
            <button
              type="button"
              aria-label={`إزالة ${v.label}`}
              onClick={() => onChange({ ...option, values: option.values.filter((x) => x.id !== v.id) })}
              className="text-ink-3 hover:text-rose-400"
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            add(draft);
            setDraft("");
          }}
          className="flex items-center gap-1"
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="قيمة جديدة"
            aria-label={`قيمة جديدة لـ ${option.name}`}
            className="h-8 w-28 rounded-lg border border-edge/10 bg-transparent px-2 text-[12px] text-ink outline-none focus:border-nova"
          />
          <button type="submit" aria-label="إضافة" className="grid size-8 place-items-center rounded-lg bg-edge/[0.06] text-ink-2 hover:bg-nova/20">
            <Plus className="size-3.5" />
          </button>
        </form>
      </div>
      {presets.length ? (
        <div className="flex flex-wrap gap-1.5">
          {presets
            .filter((p) => !has(p))
            .map((p) => (
              <button key={p} type="button" onClick={() => add(p)} className="rounded-lg border border-edge/10 px-2 py-1 text-[11.5px] font-bold text-ink-3 hover:border-nova/40 hover:text-ink">
                + {p}
              </button>
            ))}
        </div>
      ) : null}
    </div>
  );
}
