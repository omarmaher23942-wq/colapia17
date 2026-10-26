// search-ui.ts — منطق البحث في واجهة المتجر الخالص: عمليات البحث الأخيرة، إبراز الكلمة المطابقة، وترتيب النتائج وتصفيتها.
// خالص (بلا DOM) ليُختبر ويُستخدم من الرأس وصفحة البحث بالقواعد نفسها.

export const RECENT_MAX = 6;

/** يوحّد الكلمة للمقارنة: مسافات، أرقام هندية، همزات وتاء مربوطة وياء. */
export function foldTerm(s: string): string {
  return s
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[ً-ٟـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/[ىئ]/g, "ي")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** يضيف كلمة بحث في مقدمة القائمة بلا تكرار (مقارنة موحّدة) وبحد أقصى. كلمة أقصر من حرفين لا تُحفظ. */
export function addRecent(list: string[], term: string, max = RECENT_MAX): string[] {
  const t = term.replace(/\s+/g, " ").trim().slice(0, 60);
  if (t.length < 2) return list;
  const key = foldTerm(t);
  return [t, ...list.filter((x) => foldTerm(x) !== key)].slice(0, max);
}

/** يقرأ القائمة المحفوظة بتسامح مع أي قيمة تالفة. */
export function parseRecent(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const v: unknown = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    return v.filter((x): x is string => typeof x === "string" && x.length >= 2 && x.length <= 60).slice(0, RECENT_MAX);
  } catch {
    return [];
  }
}

export type TextPart = { text: string; hit: boolean };

/** يقسم النص إلى أجزاء مع إبراز كل كلمة من البحث وردت فيه (حرفياً، بلا حساسية لحالة الأحرف اللاتينية). */
export function highlightParts(text: string, query: string): TextPart[] {
  const words = [...new Set(query.trim().split(/\s+/).filter((w) => w.length >= 2))].sort((a, b) => b.length - a.length);
  if (!text || !words.length) return [{ text, hit: false }];
  const esc = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const re = new RegExp(`(${esc.join("|")})`, "gi");
  const out: TextPart[] = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    const i = m.index ?? 0;
    if (i > last) out.push({ text: text.slice(last, i), hit: false });
    out.push({ text: m[0], hit: true });
    last = i + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), hit: false });
  return out.length ? out : [{ text, hit: false }];
}

export const RESULT_SORTS = [
  ["relevance", "الأنسب"],
  ["price_asc", "السعر: من الأقل"],
  ["price_desc", "السعر: من الأعلى"],
  ["newest", "الأحدث"],
] as const;
export type ResultSort = (typeof RESULT_SORTS)[number][0];

type Row = { pricePiasters: number; createdAt: Date | string; trackStock?: boolean; stock?: number | null; variants?: { isAvailable: boolean; stock: number | null }[] };

function available(r: Row): boolean {
  if (!r.trackStock) return true;
  if (r.variants?.length) {
    const av = r.variants.filter((v) => v.isAvailable);
    return av.some((v) => v.stock === null || v.stock > 0);
  }
  return r.stock === null || r.stock === undefined || r.stock > 0;
}

/** ترتيب وتصفية نتائج بحث محمّلة بالكامل (حتى 48): «الأنسب» يبقي ترتيب الخادم، والنافد يُؤخَّر دائماً ما لم يُطلب المتوفر فقط. */
export function arrangeResults<T extends Row>(rows: T[], opts: { sort: ResultSort; inStockOnly: boolean; max?: number | null }): T[] {
  let list = rows.map((r, i) => ({ r, i }));
  if (opts.inStockOnly) list = list.filter((x) => available(x.r));
  if (opts.max != null) list = list.filter((x) => x.r.pricePiasters <= opts.max!);
  const cmp: Record<ResultSort, (a: { r: T; i: number }, b: { r: T; i: number }) => number> = {
    relevance: (a, b) => a.i - b.i,
    price_asc: (a, b) => a.r.pricePiasters - b.r.pricePiasters || a.i - b.i,
    price_desc: (a, b) => b.r.pricePiasters - a.r.pricePiasters || a.i - b.i,
    newest: (a, b) => new Date(b.r.createdAt).getTime() - new Date(a.r.createdAt).getTime() || a.i - b.i,
  };
  list.sort((a, b) => Number(!available(a.r)) - Number(!available(b.r)) || cmp[opts.sort](a, b));
  return list.map((x) => x.r);
}

/** رسالة واتساب لطلب منتج لم يجده الزائر. */
export function requestProductMessage(query: string, storeName: string): string {
  const q = query.trim().slice(0, 80);
  return `أهلاً ${storeName}، بحثت عن «${q}» في المتجر ولم أجده. هل هو متوفر أو يمكن توفيره؟`;
}
