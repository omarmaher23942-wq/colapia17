// import-checks.ts — فحوص ذكية على مرشّحي الاستيراد قبل الاعتماد (خالص ومختبَر): أسعار شاذة، أسماء مكررة، تقريب الأسعار،
// خصم جماعي، ووصف مبدئي صادق بلا ذكاء اصطناعي من بيانات المنتج نفسها.
import type { Candidate } from "@/lib/import-candidates";

const fold = (s: string) => s.toLowerCase().replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/[ً-ٟ]/g, "").replace(/\s+/g, " ").trim();

export type PriceFlag = { id: string; kind: "high" | "low" | "tiny"; text: string };

/** أسعار تستحق مراجعة: أقل من 5 جنيه (غالباً خطأ)، أو أبعد بكثير عن وسيط بقية المنتجات. */
export function priceFlags(items: Candidate[]): PriceFlag[] {
  const prices = items.map((c) => c.price).filter((p): p is number => p !== null && p > 0).sort((a, b) => a - b);
  const median = prices.length >= 4 ? prices[Math.floor(prices.length / 2)]! : null;
  const out: PriceFlag[] = [];
  for (const c of items) {
    if (c.price === null || c.price <= 0) continue;
    if (c.price < 5) out.push({ id: c.id, kind: "tiny", text: "السعر أقل من 5 جنيه. تأكدوا أنه ليس خطأ كتابة." });
    else if (median && c.price >= median * 8) out.push({ id: c.id, kind: "high", text: "السعر أعلى بكثير من بقية المنتجات. تأكدوا من الأصفار." });
    else if (median && c.price <= median / 8) out.push({ id: c.id, kind: "low", text: "السعر أقل بكثير من بقية المنتجات. تأكدوا منه." });
  }
  return out;
}

/** منتجات تتطابق أسماؤها مع منتجات موجودة في المتجر (أو مع بعضها) فيُخشى التكرار. */
export function duplicateNames(items: Candidate[], existingNames: string[]): Set<string> {
  const have = new Set(existingNames.map(fold).filter(Boolean));
  const seen = new Map<string, string>();
  const dup = new Set<string>();
  for (const c of items) {
    const k = fold(c.name);
    if (!k) continue;
    if (have.has(k)) dup.add(c.id);
    const first = seen.get(k);
    if (first) {
      dup.add(first);
      dup.add(c.id);
    } else seen.set(k, c.id);
  }
  return dup;
}

export type RoundMode = "none" | "5" | "10" | "9";
/** تقريب السعر لأقرب 5 أو 10 جنيه، أو لينتهي بـ 9 (199 بدل 200). */
export function roundPrice(price: number, mode: RoundMode): number {
  if (!(price > 0) || mode === "none") return price;
  if (mode === "9") return Math.max(9, Math.round(price / 10) * 10 - 1);
  const step = Number(mode);
  return Math.max(step, Math.round(price / step) * step);
}

/** يطبّق التقريب على المحدد (أو الكل) دون لمس المنتجات بلا سعر. */
export function roundPrices(items: Candidate[], mode: RoundMode, ids?: string[]): Candidate[] {
  const set = ids ? new Set(ids) : null;
  return items.map((c) => {
    if (c.price === null || (set && !set.has(c.id))) return c;
    const price = roundPrice(c.price, mode);
    return { ...c, price, compareAt: c.compareAt !== null && c.compareAt > price ? c.compareAt : null };
  });
}

/** خصم نسبته pct%: السعر الحالي يصبح «قبل» والجديد أقل. يرفض النسب خارج 1-90. */
export function applyDiscount(items: Candidate[], pct: number, ids?: string[]): Candidate[] {
  if (!(pct >= 1 && pct <= 90)) return items;
  const set = ids ? new Set(ids) : null;
  return items.map((c) => {
    if (c.price === null || (set && !set.has(c.id))) return c;
    const base = c.compareAt && c.compareAt > c.price ? c.compareAt : c.price;
    const now = Math.max(1, Math.round(base * (1 - pct / 100)));
    return now >= base ? c : { ...c, price: now, compareAt: base };
  });
}

/** وصف مبدئي صادق من بيانات المنتج وحدها (لا اختراع): اللون والمقاسات والسمات المكتوبة. */
export function describeFromData(c: Pick<Candidate, "name" | "colors" | "sizes" | "attributes" | "category">): string {
  const parts: string[] = [];
  if (c.colors.length) parts.push(c.colors.length === 1 ? `بلون ${c.colors[0]}` : `متوفر بألوان: ${c.colors.join("، ")}`);
  if (c.sizes.length) parts.push(c.sizes.length === 1 ? `بمقاس ${c.sizes[0]}` : `بمقاسات: ${c.sizes.join("، ")}`);
  for (const a of c.attributes.slice(0, 4)) if (a.value) parts.push(`${a.label}: ${a.value}`);
  if (!parts.length) return "";
  return `${c.name.trim()}${c.category ? ` من قسم ${c.category}` : ""}. ${parts.join(". ")}.`.slice(0, 400);
}

/** يملأ الوصف الفارغ فقط بالوصف المبدئي. */
export function fillMissingDescriptions(items: Candidate[]): { items: Candidate[]; filled: number } {
  let filled = 0;
  const next = items.map((c) => {
    if (c.description.trim()) return c;
    const d = describeFromData(c);
    if (!d) return c;
    filled += 1;
    return { ...c, description: d };
  });
  return { items: next, filled };
}

/** ينظّف اسماً: يحذف الإيموجي والرموز الزخرفية وتكرار المسافات والسعر الملصق بآخره. */
export function tidyName(name: string): string {
  return name
    .replace(/[\p{Extended_Pictographic}‍️]/gu, "")
    .replace(/[~*_#|•●★☆]+/g, " ")
    .replace(/\s*[-–—:]?\s*\d[\d,٬.]*\s*(ج\.?م?|جنيه|egp|le)\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

export function tidyNames(items: Candidate[]): { items: Candidate[]; changed: number } {
  let changed = 0;
  const next = items.map((c) => {
    const t = tidyName(c.name);
    if (t && t !== c.name) {
      changed += 1;
      return { ...c, name: t };
    }
    return c;
  });
  return { items: next, changed };
}
