"use client";

// SearchResults — نتائج البحث: ترتيب (الأنسب/السعر/الأحدث)، «المتوفر فقط»، وسقف سعر سريع؛ والنافد يتأخر دائماً.
// عند غياب النتائج: «اسألوا المتجر عن هذا المنتج» برسالة واتساب جاهزة بكلمة البحث، والبحث بالصورة.
import { useMemo, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { BrandIcon } from "./brand-icons";
import { ProductCard, type ProductCardProduct } from "./ProductCard";
import { useStore } from "./StoreProvider";
import { arrangeResults, RESULT_SORTS, requestProductMessage, type ResultSort } from "@/lib/search-ui";
import { waLink } from "@/lib/whatsapp";
import { formatEgp } from "@/lib/money";

export function SearchResults({ rows, query }: { rows: ProductCardProduct[]; query: string }) {
  const { channels, brand } = useStore();
  const [sort, setSort] = useState<ResultSort>("relevance");
  const [inStock, setInStock] = useState(false);
  const [maxEgp, setMaxEgp] = useState<number | null>(null);

  const prices = rows.map((r) => r.pricePiasters).sort((a, b) => a - b);
  const steps = useMemo(() => {
    if (prices.length < 4) return [] as number[];
    const pick = (q: number) => Math.round(prices[Math.floor((prices.length - 1) * q)]! / 100 / 50) * 50;
    return [...new Set([pick(0.25), pick(0.5), pick(0.75)])].filter((v) => v > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);
  const shown = arrangeResults(rows, { sort, inStockOnly: inStock, max: maxEgp === null ? null : maxEgp * 100 });

  if (!rows.length) {
    const wa = query ? waLink(channels.whatsappNumber, requestProductMessage(query, brand.name)) : null;
    return wa ? (
      <a href={wa} target="_blank" rel="noopener noreferrer" className="s-btn mx-auto flex w-fit gap-2">
        <BrandIcon brand="whatsapp" className="size-4" />
        اسألوا المتجر عن «{query}»
      </a>
    ) : null;
  }

  return (
    <div>
      {rows.length > 1 ? (
        <div className="mb-4 flex flex-wrap items-center gap-2" role="group" aria-label="ترتيب النتائج وتصفيتها">
          <SlidersHorizontal className="size-4 opacity-60" aria-hidden="true" />
          <select value={sort} onChange={(e) => setSort(e.target.value as ResultSort)} aria-label="ترتيب النتائج" className="s-input h-10 rounded-xl border bg-transparent px-3 text-[13px] font-bold" style={{ borderColor: "var(--border)" }}>
            {RESULT_SORTS.map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
          <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 text-[13px] font-bold">
            <input type="checkbox" checked={inStock} onChange={(e) => setInStock(e.target.checked)} className="size-4 accent-[var(--primary)]" /> المتوفر فقط
          </label>
          {steps.map((v) => (
            <button key={v} type="button" aria-pressed={maxEgp === v} onClick={() => setMaxEgp(maxEgp === v ? null : v)} className="inline-flex h-10 items-center rounded-full border px-3 text-[13px] font-bold" style={{ borderColor: maxEgp === v ? "var(--primary)" : "var(--border)", color: maxEgp === v ? "var(--primary)" : undefined }}>
              حتى {formatEgp(v * 100)}
            </button>
          ))}
        </div>
      ) : null}
      {shown.length ? (
        <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {shown.map((p) => (
            <li key={p.id}>
              <ProductCard product={p} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-10 text-center opacity-70" role="status">
          لا نتائج بهذه التصفية، جرّبوا إلغاء بعضها.
        </p>
      )}
    </div>
  );
}
