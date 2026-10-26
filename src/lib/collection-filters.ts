// collection-filters.ts — حالة صفحات المنتجات (الأقسام و/all) كلها في الرابط: ترتيب، سعر، مقاس، لون، متوفر، تخفيضات، قسم فرعي.
// خالص: يُحلّل من searchParams ويُكتب إلى رابط، ويُستخدم من الخادم والمتصفح بالقواعد نفسها.
import { sizeRank } from "@/lib/pdp";

export const SORTS = [
  ["popular", "الأكثر طلباً"],
  ["newest", "الأحدث"],
  ["price_asc", "السعر: من الأقل"],
  ["price_desc", "السعر: من الأعلى"],
  ["rating", "الأعلى تقييماً"],
  ["discount", "الأكبر خصماً"],
] as const;
export type SortKey = (typeof SORTS)[number][0];

export type CollectionFilters = {
  sort: SortKey;
  /** حدود السعر بالقروش. */
  min: number | null;
  max: number | null;
  sizes: string[];
  colors: string[];
  inStock: boolean;
  sale: boolean;
  /** slug قسم فرعي. */
  sub: string | null;
};

export const EMPTY_FILTERS: CollectionFilters = { sort: "popular", min: null, max: null, sizes: [], colors: [], inStock: false, sale: false, sub: null };

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const list = (v: string | string[] | undefined) =>
  (one(v) ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter((x) => x.length > 0 && x.length <= 40)
    .slice(0, 12);
const egpToPiasters = (v: string | undefined) => {
  const n = Number((v ?? "").replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))));
  return v && Number.isFinite(n) && n >= 0 && n < 10_000_000 ? Math.round(n * 100) : null;
};

export function parseFilters(sp: SP): CollectionFilters {
  const sort = one(sp.sort);
  let min = egpToPiasters(one(sp.min));
  let max = egpToPiasters(one(sp.max));
  if (min !== null && max !== null && min > max) [min, max] = [max, min];
  const sub = one(sp.sub)?.trim();
  return {
    sort: SORTS.some(([k]) => k === sort) ? (sort as SortKey) : "popular",
    min,
    max,
    sizes: list(sp.size),
    colors: list(sp.color),
    inStock: one(sp.stock) === "1",
    sale: one(sp.sale) === "1",
    sub: sub && sub.length <= 80 ? sub : null,
  };
}

/** سلسلة استعلام الرابط (بلا ?) — القيم الافتراضية لا تُكتب. */
export function filtersToQuery(f: CollectionFilters, extra: Record<string, string> = {}): string {
  const q = new URLSearchParams(extra);
  if (f.sort !== "popular") q.set("sort", f.sort);
  if (f.min !== null) q.set("min", String(Math.round(f.min / 100)));
  if (f.max !== null) q.set("max", String(Math.round(f.max / 100)));
  if (f.sizes.length) q.set("size", f.sizes.join(","));
  if (f.colors.length) q.set("color", f.colors.join(","));
  if (f.inStock) q.set("stock", "1");
  if (f.sale) q.set("sale", "1");
  if (f.sub) q.set("sub", f.sub);
  return q.toString();
}

/** عدد الفلاتر الفعالة (الترتيب والقسم الفرعي لا يُحسبان). */
export function activeFilterCount(f: CollectionFilters): number {
  return (f.min !== null ? 1 : 0) + (f.max !== null ? 1 : 0) + f.sizes.length + f.colors.length + (f.inStock ? 1 : 0) + (f.sale ? 1 : 0);
}

/** تصنيف خيارات المنتجات إلى مقاسات وألوان من اسم الخيار. */
export function classifyOption(optionName: string): "size" | "color" | null {
  if (/لون|color|colour/i.test(optionName)) return "color";
  if (/مقاس|قياس|size|حجم/i.test(optionName)) return "size";
  return null;
}

export type Facets = { sizes: string[]; colors: string[]; priceMin: number | null; priceMax: number | null };

/** من صفوف (اسم الخيار، القيمة، العدد) إلى أوجه فلترة مرتبة: المقاسات على سلمها، والألوان بالأكثر حضوراً. */
export function buildFacets(rows: { opt: string | null; val: string; n: number }[], price: { min: number | null; max: number | null }): Facets {
  const sizes = new Map<string, number>();
  const colors = new Map<string, number>();
  for (const r of rows) {
    const kind = r.opt ? classifyOption(r.opt) : null;
    if (kind === "size") sizes.set(r.val, Math.max(sizes.get(r.val) ?? 0, r.n));
    if (kind === "color") colors.set(r.val, Math.max(colors.get(r.val) ?? 0, r.n));
  }
  return {
    sizes: [...sizes.keys()].sort((a, b) => sizeRank(a) - sizeRank(b) || a.localeCompare(b, "ar")),
    colors: [...colors.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ar")).map(([k]) => k),
    priceMin: price.min,
    priceMax: price.max,
  };
}

export const PAGE_SIZE = 24;
