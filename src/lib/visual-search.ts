// visual-search.ts — منطق خالص لـ«البحث بالصورة»: ترتيب منتجات المتجر حسب ما قرأه النموذج من الصورة (النوع، الألوان،
// الكلمات، النص الظاهر)، واختيار المرشحين للمقارنة البصرية، وقرار عرض «القطعة نفسها» أو «قريبة منها».
import { z } from "zod";
import { normalizeArabic } from "@/lib/arabic";

export type VisionRead = {
  isProduct: boolean;
  garment: string | null;
  colors: string[];
  keywords: string[];
  visibleText: string | null;
};

export type CatalogItem = { id: string; name: string; text: string; image: string | null; orderCount: number };

/** مفردات الألوان الشائعة (عربي/إنجليزي/فرانكو) إلى صيغة واحدة، حتى يطابق «black» و«اسود» و«أسود». */
const COLOR_ALIASES: Record<string, string[]> = {
  اسود: ["black", "اسود", "سودا", "سوداء", "اسوَد", "eswed"],
  ابيض: ["white", "ابيض", "بيضا", "بيضاء", "abyad"],
  احمر: ["red", "احمر", "حمرا", "حمراء"],
  ازرق: ["blue", "ازرق", "زرقا", "زرقاء", "navy", "كحلي", "كحلى"],
  اخضر: ["green", "اخضر", "خضرا", "زيتي", "olive"],
  بيج: ["beige", "بيج", "كريمي", "cream", "nude", "نود"],
  بني: ["brown", "بني", "بنى", "كافيه", "camel", "جملي"],
  رمادي: ["grey", "gray", "رمادي", "رصاصي", "سكني"],
  وردي: ["pink", "وردي", "بينك", "روز", "rose"],
  بنفسجي: ["purple", "بنفسجي", "موف", "mauve", "lilac", "ليلكي"],
  اصفر: ["yellow", "اصفر", "مستردة", "mustard"],
  برتقالي: ["orange", "برتقالي", "اورنج"],
  ذهبي: ["gold", "ذهبي", "دهبي"],
  فضي: ["silver", "فضي"],
};
const COLOR_OF = new Map<string, string>();
for (const [k, vs] of Object.entries(COLOR_ALIASES)) for (const v of vs) COLOR_OF.set(normalizeArabic(v), k);

const STOP = new Set(["ال", "في", "من", "مع", "و", "a", "the", "with", "and", "of", "for", "قطعه", "منتج", "product"]);

export function tokens(text: string): string[] {
  return normalizeArabic(text)
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .map((t) => t.replace(/^ال(?=\p{L}{3,})/u, ""))
    .filter((t) => t.length >= 2 && !STOP.has(t));
}

const colorKey = (t: string) => COLOR_OF.get(normalizeArabic(t)) ?? null;

/** درجة تطابق منتج مع قراءة الصورة: النص الظاهر (اسم القطعة غالباً) أقوى إشارة، ثم النوع، ثم الألوان والكلمات. */
export function scoreItem(read: VisionRead, item: CatalogItem): number {
  const hay = new Set(tokens(`${item.name} ${item.text}`));
  const hayColors = new Set([...hay].map(colorKey).filter(Boolean) as string[]);
  let s = 0;
  const visible = read.visibleText ? tokens(read.visibleText) : [];
  for (const t of visible) if (hay.has(t)) s += 3;
  if (read.garment) for (const t of tokens(read.garment)) if (hay.has(t)) s += 4;
  for (const c of read.colors) {
    const k = colorKey(c) ?? tokens(c)[0];
    if (k && (hayColors.has(k) || hay.has(k))) s += 2;
  }
  for (const w of read.keywords.flatMap(tokens)) if (hay.has(w)) s += 1;
  return s;
}

/**
 * المرشحون للمقارنة البصرية (حتى `max`، بصور فقط): الأعلى درجة، ومع التعادل الأكثر طلباً. متجر صغير (`max` أو أقل
 * بصور) يُقارن كله بلا ترتيب نصي.
 */
export function pickCandidates(read: VisionRead, items: CatalogItem[], max = 4): CatalogItem[] {
  const withImg = items.filter((i) => i.image);
  if (withImg.length <= max) return withImg;
  return withImg
    .map((i) => ({ i, s: scoreItem(read, i) }))
    .sort((a, b) => b.s - a.s || b.i.orderCount - a.i.orderCount)
    .slice(0, max)
    .map((x) => x.i);
}

export const MATCH_CONFIDENCE = 0.7;

/** قرار العرض من حكم المقارنة: «هي نفسها» فقط بثقة كافية، وإلا «قريبة منها» بلا ادعاء. */
export function decide(verdict: { best: number | null; confidence: number; similar: number[] }, candidates: CatalogItem[]) {
  const at = (n: number | null) => (n && n >= 1 && n <= candidates.length ? candidates[n - 1]! : null);
  const best = verdict.confidence >= MATCH_CONFIDENCE ? at(verdict.best) : null;
  const similar = [...new Set([...(best ? [] : [verdict.best]), ...verdict.similar])]
    .map((n) => at(n))
    .filter((x): x is CatalogItem => Boolean(x) && x !== best)
    .slice(0, 3);
  return { match: best, similar };
}

// المخططات متسامحة عمداً: النموذج قد يعيد لوناً زائداً أو كلمة أطول أو رقماً نصياً؛ نقصّ ونحوّل بدل رفض الرد كله
// (كان أي تجاوز صغير يُسقط القراءة عند كل المزوّدين فيفشل البحث).
const text = (max: number) =>
  z.preprocess((v) => (v == null ? null : String(v).trim().slice(0, max) || null), z.string().nullable()).default(null);
const words = (maxItems: number, maxLen: number) =>
  z.preprocess(
    (v) => (Array.isArray(v) ? v : typeof v === "string" ? v.split(/[,،]/) : []).map((x) => String(x).trim().slice(0, maxLen)).filter(Boolean).slice(0, maxItems),
    z.array(z.string())
  ).default([]);
const num = z.preprocess((v) => (v == null || v === "" ? null : Number(v)), z.number().nullable());
export const readSchema = z.object({
  isProduct: z.preprocess((v) => (typeof v === "string" ? !/^(false|no|لا)$/i.test(v.trim()) : v ?? true), z.boolean()).default(true),
  garment: text(80),
  colors: words(6, 30),
  keywords: words(10, 40),
  visibleText: text(200),
  description: text(200),
});
export const verdictSchema = z.object({
  best: num.default(null).transform((v) => (v != null && Number.isInteger(v) ? v : null)),
  confidence: z.preprocess((v) => Math.min(1, Math.max(0, Number(v) || 0)), z.number()).default(0),
  similar: z.preprocess((v) => (Array.isArray(v) ? v.map(Number).filter(Number.isInteger).slice(0, 4) : []), z.array(z.number())).default([]),
});
