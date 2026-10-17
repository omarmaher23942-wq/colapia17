// card-ui.ts — منطق بطاقة المنتج الخالص: المخزون الفعلي، الشارات الصادقة، الألوان، والتقييم.
import { savingsPercent } from "@/lib/money";
import { orderedOptionValues, swatchColor } from "@/lib/pdp";

type VariantLike = { isAvailable: boolean; stock: number | null; optionValues?: string[]; sortOrder?: number };
export type CardProductLike = {
  trackStock: boolean;
  stock: number | null;
  pricePiasters: number;
  compareAtPiasters: number | null;
  createdAt: Date | string;
  ratingCount: number;
  ratingSum: number;
  optionNames?: string[];
  optionMeta?: { name: string; kind?: string; values: { label: string; hex?: string }[] }[];
  variants?: VariantLike[];
  isBestSeller?: boolean;
};

/**
 * المخزون الفعلي للبطاقة: null = متاح بلا حد. منتج بتركيبات: متاح دائماً إن وُجدت تركيبة متاحة بلا كمية،
 * وإلا مجموع كميات التركيبات المتاحة.
 */
export function effectiveStock(p: Pick<CardProductLike, "trackStock" | "stock" | "variants">): number | null {
  if (!p.trackStock) return null;
  if (p.variants && p.variants.length) {
    const avail = p.variants.filter((v) => v.isAvailable);
    if (avail.some((v) => v.stock === null)) return null;
    return avail.reduce((s, v) => s + (v.stock ?? 0), 0);
  }
  return p.stock;
}

export const isSoldOut = (p: Pick<CardProductLike, "trackStock" | "stock" | "variants">) => {
  const s = effectiveStock(p);
  return s !== null && s <= 0;
};

export type CardBadge = { key: "soldOut" | "sale" | "new" | "best"; tone: "muted" | "sale" | "primary"; pct?: number };

const NEW_DAYS = 14;

/** الشارات الصادقة: واحدة بأولوية (نفد > خصم > الأكثر مبيعاً > جديد) وما يُعرض لا يتجاوز اثنتين. */
export function cardBadges(p: CardProductLike, now = new Date()): CardBadge[] {
  if (isSoldOut(p)) return [{ key: "soldOut", tone: "muted" }];
  const out: CardBadge[] = [];
  const pct = savingsPercent(p.pricePiasters, p.compareAtPiasters);
  if (pct > 0) out.push({ key: "sale", tone: "sale", pct });
  if (p.isBestSeller) out.push({ key: "best", tone: "primary" });
  const created = new Date(p.createdAt).getTime();
  if (Number.isFinite(created) && now.getTime() - created <= NEW_DAYS * 86_400_000 && now.getTime() >= created) out.push({ key: "new", tone: "primary" });
  return out.slice(0, 2);
}

/** ألوان حقيقية للبطاقة (حتى 4) من خيار اللون، مرتبة، ومعها العدد المتبقي. */
export function cardSwatches(p: Pick<CardProductLike, "optionNames" | "optionMeta" | "variants">, max = 4): { items: { label: string; color: string }[]; more: number } {
  const names = p.optionNames ?? [];
  const idx = names.findIndex((n, i) => {
    const def = p.optionMeta?.find((m) => m.name === n);
    return def ? def.kind === "color" : /لون|color/i.test(n) && i >= 0;
  });
  if (idx < 0 || !p.variants?.length) return { items: [], more: 0 };
  const vs = p.variants.filter((v) => v.optionValues && v.isAvailable).map((v) => ({ optionValues: v.optionValues!, sortOrder: v.sortOrder }));
  const values = orderedOptionValues(idx, names[idx]!, vs, p.optionMeta ?? []);
  const items: { label: string; color: string }[] = [];
  for (const label of values) {
    const color = swatchColor(names[idx]!, label, p.optionMeta ?? []);
    if (color) items.push({ label, color });
  }
  return { items: items.slice(0, max), more: Math.max(0, items.length - max) };
}

/** متوسط التقييم للعرض على البطاقة: فقط حين يبلغ العدد 3 فأكثر (لا نجوم من تقييم واحد). */
export function cardRating(p: Pick<CardProductLike, "ratingCount" | "ratingSum">): { avg: number; count: number } | null {
  if (p.ratingCount < 3) return null;
  return { avg: p.ratingSum / p.ratingCount, count: p.ratingCount };
}
