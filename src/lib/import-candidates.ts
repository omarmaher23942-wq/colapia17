// import-candidates.ts — قلب أداة استيراد المنتجات (الإعداد + «استيراد» في اللوحة)، خالص بلا تبعيات خادم:
// نص حر أو جدول (Excel/CSV) أو مخرجات القراءة الذكية ← «مرشّحون» قابلون للمراجعة ← صفوف جاهزة للحفظ.
// مبدأ ثابت: لا مصفوفات إجبارية. المقاسات والألوان رقائق يختارها التاجر، والتركيبات تُولَّد منها بسعر مشترك.
import { z } from "zod";
import { colorFromName } from "@/lib/color-names";
import { parseNumber } from "@/lib/product-import";
import { cleanAttributes, type AttrPair } from "@/lib/niche-attributes";

export const IMPORT_MAX_CANDIDATES = 200;
export const IMPORT_TEXT_CHUNK = 20;

export type Candidate = {
  id: string;
  name: string;
  /** بالجنيه؛ null = بلا سعر ← يُحفظ مسودة بعلامة واضحة. */
  price: number | null;
  compareAt: number | null;
  description: string;
  category: string;
  sizes: string[];
  colors: string[];
  images: string[];
  /** null = متاح دائماً. */
  stock: number | null;
  source: "text" | "image" | "file" | "manual";
  /** سمات النشاط (السعة، الحجم، الوزن…) بصيغة products.attributes. */
  attributes: AttrPair[];
};

// ─── رقائق جاهزة ────────────────────────────────────────────────────────────
export const SIZE_PRESETS = {
  letters: ["XS", "S", "M", "L", "XL", "XXL", "3XL"],
  shoes: ["36", "37", "38", "39", "40", "41", "42", "43", "44", "45"],
  jeans: ["28", "30", "32", "34", "36", "38"],
  free: ["مقاس واحد"],
} as const;
export const COLOR_PRESETS = ["أسود", "أبيض", "بيج", "كحلي", "رمادي", "بني", "أحمر", "أخضر", "أزرق", "وردي", "أصفر", "بنفسجي"] as const;

const LETTER_SIZE = /^(?:xxs|xs|s|m|l|xl|xxl|xxxl|2xl|3xl|4xl|5xl)$/i;
const FREE_SIZE = /(?:مقاس\s*واحد|فري\s*سايز|free\s*size|one\s*size|حجم\s*واحد)/i;

export function normalizeSize(raw: string): string | null {
  const t = raw.trim().replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
  if (!t) return null;
  if (FREE_SIZE.test(t)) return "مقاس واحد";
  if (LETTER_SIZE.test(t)) {
    const u = t.toUpperCase();
    return u === "XXXL" ? "3XL" : u;
  }
  if (/^\d{2}(?:\.5)?$/.test(t)) return t;
  return t.length <= 14 ? t : null;
}

export function normalizeColor(raw: string): string | null {
  const t = raw.trim().slice(0, 24);
  return t ? t : null;
}

const uniq = (xs: string[]) => [...new Set(xs)];

// ─── تحليل نص حر (بلا ذكاء اصطناعي: أساس سريع ومضمون) ──────────────────────

/** يفصل النص إلى مدخلات: فقرات (فاصل سطر فارغ) إن وُجدت، وإلا سطر لكل منتج. يحذف الترقيم والنقاط. */
export function splitProductText(text: string): string[] {
  const clean = text.replace(/\r/g, "").trim();
  if (!clean) return [];
  const blocks = clean.split(/\n\s*\n+/).map((b) => b.trim()).filter(Boolean);
  const multiLineBlocks = blocks.some((b) => b.includes("\n"));
  const entries = multiLineBlocks && blocks.length > 1 ? blocks.map((b) => b.replace(/\n+/g, " ، ")) : clean.split("\n");
  return entries
    .map((l) => l.replace(/^\s*(?:[-•*●▪◦]|\d{1,3}\s*[.)\-–:]|[٠-٩]{1,3}\s*[.)\-–:])\s*/, "").trim())
    .filter((l) => l.length >= 2);
}

const PRICE_UNIT = /(\d[\d,٬٫.]*)\s*(?:ج\.?\s?م\.?|جنيه(?:اً)?|جنية|egp|l\.?e\.?|le)(?![a-z؀-ۿ])/i;
const PRICE_LABEL = /(?:بسعر|السعر|سعر|ب|بـ)\s*[:=]?\s*(\d[\d,٬٫.]*)(?!\s*(?:قطع|حبه|حبة|متر|سم|مم|لتر|جرام|جم|كجم))/i;
const COMPARE_LABEL = /(?:بدل|قبل\s*الخصم|كان|بدلاً\s*من)\s*[:=]?\s*(\d[\d,٬٫.]*)/i;
const SIZES_WORD = /(?:مقاسات?|sizes?|مقاس)\s*[:=]?\s*([^،,;؛\n]+(?:\s+[^،,;؛\n]+)*)/i;
const COLORS_WORD = /(?:ألوان|الوان|لون|colors?)\s*[:=]?\s*([^؛;\n]+)/i;

const toNum = (s: string) => {
  const n = parseNumber(s);
  return n === null || Number.isNaN(n) ? null : n;
};

function sizesIn(text: string): string[] {
  const out: string[] = [];
  if (FREE_SIZE.test(text)) out.push("مقاس واحد");
  for (const m of text.matchAll(/(?<![\p{L}\d])(xxs|xs|xxxl|xxl|xl|[2345]xl|s|m|l)(?![\p{L}\d])/giu)) {
    const n = normalizeSize(m[1]!);
    if (n) out.push(n);
  }
  const word = SIZES_WORD.exec(text);
  if (word) {
    const part = word[1]!;
    const range = /(\d{2})\s*(?:[-–إلىالي]|to)\s*(\d{2})/i.exec(part);
    if (range) {
      const a = Number(range[1]);
      const b = Number(range[2]);
      if (a >= 20 && b <= 60 && b >= a && b - a <= 20) for (let i = a; i <= b; i++) out.push(String(i));
    }
    for (const n of part.matchAll(/(?<![\d.])(\d{2}(?:\.5)?)(?![\d.])/g)) {
      const v = Number(n[1]);
      if (v >= 20 && v <= 60) out.push(n[1]!);
    }
  }
  return uniq(out);
}

function colorsIn(text: string): string[] {
  const out: string[] = [];
  const m = COLORS_WORD.exec(text);
  const area = m?.[1] ?? text;
  const words = area.split(/[\s،,/|+&\-–]+/).map((w) => w.trim()).filter((w) => w.length >= 2 && w.length <= 16);
  for (const w of words) {
    // «وأبيض» = و + أبيض، لكن «وردي» لون قائم بذاته: نجرّب الكلمة بلا واو العطف أولاً ثم الأصل.
    const noWaw = w.startsWith("و") ? w.slice(1) : w;
    const pick = noWaw !== w && colorFromName(noWaw) ? noWaw : colorFromName(w) ? w : colorFromName(w.replace(/^ال/, "")) ? w : null;
    if (!pick) continue;
    const nice = normalizeColor(pick.replace(/^ال(?=\S{3,})/, ""));
    if (nice) out.push(nice);
  }
  return uniq(out);
}

/** يحلل مدخلاً واحداً («تيشيرت قطن، أسود وأبيض، M L XL، 350 جنيه») إلى مرشّح. الباقي بعد الاسم يصير وصفاً. */
export function parseProductEntry(entry: string): Candidate | null {
  const raw = entry.trim();
  if (!raw) return null;
  const digits = raw.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));

  let price: number | null = null;
  let compareAt: number | null = null;
  const cmp = COMPARE_LABEL.exec(digits);
  if (cmp) compareAt = toNum(cmp[1]!);
  const unit = PRICE_UNIT.exec(digits);
  const lab = PRICE_LABEL.exec(digits);
  if (unit) price = toNum(unit[1]!);
  else if (lab) price = toNum(lab[1]!);
  else {
    // آخر رقم قائم بذاته (3–6 خانات) خارج المقاسات يُعدّ السعر.
    const stripped = digits.replace(SIZES_WORD, " ").replace(COMPARE_LABEL, " ");
    const nums = [...stripped.matchAll(/(?<![\d.؀-ۿa-z])(\d{2,6}(?:[.,]\d{1,2})?)(?![\d؀-ۿa-z])/gi)].map((m) => toNum(m[1]!)).filter((n): n is number => n !== null && n >= 5);
    price = nums.length ? nums[nums.length - 1]! : null;
  }
  if (price !== null && (price <= 0 || price > 10_000_000)) price = null;
  if (compareAt !== null && (price === null || compareAt <= price)) compareAt = null;

  const sizes = sizesIn(digits);
  const colors = colorsIn(digits);

  // الاسم: أول مقطع قبل فاصل، وإلا النص حتى أول رقم/وحدة.
  const segs = raw.split(/\s*[،,\n|؛;]\s*|\s+[-–—]\s+/).map((s) => s.trim()).filter(Boolean);
  let name = (segs[0] ?? raw).replace(PRICE_UNIT, "").replace(/\s{2,}/g, " ").trim();
  name = name.replace(/\s+(?:بسعر|سعر|السعر|ب)\s*[:=]?\s*[\d٠-٩][\d٠-٩,.]*\s*$/i, "").trim();
  if (!name) return null;
  const nameWords = name.split(/\s+/);
  if (nameWords.length > 8) name = nameWords.slice(0, 8).join(" ");
  name = name.slice(0, 120);

  const rest = segs.slice(1).filter((s) => !PRICE_UNIT.test(s) && !/^\d+(?:[.,]\d+)?$/.test(s) && !COMPARE_LABEL.test(s) && !SIZES_WORD.test(s) && !COLORS_WORD.test(s) && sizesIn(s).length === 0 && !colorsIn(s).length);
  const description = rest.join("، ").slice(0, 600);

  return { id: newId(), name, price, compareAt, description, category: "", sizes, colors, images: [], stock: null, source: "text", attributes: [] };
}

export function parseProductText(text: string): Candidate[] {
  return splitProductText(text).map(parseProductEntry).filter((c): c is Candidate => Boolean(c)).slice(0, IMPORT_MAX_CANDIDATES);
}

// ─── جداول (Excel / CSV) ────────────────────────────────────────────────────

const norm = (s: string) => s.trim().toLowerCase().replace(/[_\s]+/g, " ").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه");
const COLS: Record<"name" | "price" | "compareAt" | "category" | "description" | "sizes" | "colors" | "images" | "stock", string[]> = {
  name: ["name", "title", "product", "اسم المنتج", "الاسم", "المنتج", "اسم", "الصنف", "البيان"],
  price: ["price", "السعر", "سعر البيع", "سعر", "سعر القطعه", "السعر بالجنيه"],
  compareAt: ["compare at", "old price", "السعر قبل الخصم", "السعر القديم", "سعر قبل الخصم"],
  category: ["category", "القسم", "الفئه", "التصنيف", "النوع"],
  description: ["description", "الوصف", "تفاصيل", "وصف"],
  sizes: ["sizes", "size", "المقاسات", "المقاس", "مقاس"],
  colors: ["colors", "color", "الالوان", "اللون", "الوان", "لون"],
  images: ["images", "image", "image url", "الصور", "الصوره", "رابط الصوره", "صوره"],
  stock: ["stock", "quantity", "qty", "الكميه", "المخزون", "كميه"],
};

export function mapColumns(header: string[]): Partial<Record<keyof typeof COLS, number>> {
  const out: Partial<Record<keyof typeof COLS, number>> = {};
  header.forEach((h, i) => {
    const n = norm(h);
    for (const [f, names] of Object.entries(COLS) as [keyof typeof COLS, string[]][]) if (out[f] === undefined && names.some((a) => norm(a) === n)) out[f] = i;
  });
  return out;
}

const splitList = (s: string) => s.split(/[،,/|;؛\n]+/).map((x) => x.trim()).filter(Boolean);

/** صفوف جدول بصف عناوين ← مرشّحون. بلا عمود سعر: المنتج يبقى مسودة. عمود الاسم الأول إن لم تُعرف العناوين. */
export function candidatesFromTable(table: string[][]): { candidates: Candidate[]; truncated: boolean } {
  const rows = table.filter((r) => r.some((c) => String(c ?? "").trim()));
  if (!rows.length) return { candidates: [], truncated: false };
  let map = mapColumns(rows[0]!.map((c) => String(c ?? "")));
  let body = rows.slice(1);
  if (map.name === undefined) {
    // لا عناوين معروفة: العمود الأول الاسم، والأول الرقمي بعده السعر.
    map = { name: 0 };
    body = rows;
    const probe = rows.slice(0, 5);
    const priceCol = (rows[0]!.length > 1 ? [...rows[0]!.keys()].slice(1) : []).find((c) => probe.every((r) => r[c] !== undefined && toNum(String(r[c])) !== null));
    if (priceCol !== undefined) map.price = priceCol;
  }
  const cell = (r: string[], f: keyof typeof COLS) => (map[f] === undefined ? "" : String(r[map[f]!] ?? "").trim());
  const truncated = body.length > IMPORT_MAX_CANDIDATES;
  const candidates = body.slice(0, IMPORT_MAX_CANDIDATES).flatMap((r) => {
    const name = cell(r, "name").slice(0, 120);
    if (!name) return [];
    const price = toNum(cell(r, "price"));
    const cmpRaw = toNum(cell(r, "compareAt"));
    const stockRaw = toNum(cell(r, "stock"));
    const c: Candidate = {
      id: newId(),
      name,
      price: price !== null && price > 0 ? price : null,
      compareAt: cmpRaw !== null && price !== null && cmpRaw > price ? cmpRaw : null,
      description: cell(r, "description").slice(0, 600),
      category: cell(r, "category").slice(0, 80),
      sizes: uniq(splitList(cell(r, "sizes")).map(normalizeSize).filter((x): x is string => Boolean(x))),
      colors: uniq(splitList(cell(r, "colors")).map(normalizeColor).filter((x): x is string => Boolean(x))),
      images: cell(r, "images").split(/[|\s,]+/).filter((u) => /^https:\/\//i.test(u)).slice(0, 10),
      stock: stockRaw !== null && Number.isInteger(stockRaw) && stockRaw >= 0 ? stockRaw : null,
      source: "file",
      attributes: [],
    };
    return [c];
  });
  return { candidates, truncated };
}

// ─── مخرجات القراءة الذكية ───────────────────────────────────────────────────

/** ما يعيده النموذج لكل منتج؛ متسامح مع الحقول الناقصة، ويُنقَّى في normalizeCandidate. */
export const aiProductSchema = z.object({
  name: z.string().describe("اسم المنتج كما يظهر للمشتري"),
  price: z.number().nullable().optional().describe("السعر بالجنيه المصري إن ظهر، وإلا null"),
  compareAt: z.number().nullable().optional().describe("السعر قبل الخصم إن ظهر"),
  description: z.string().optional().describe("وصف قصير صادق مبني على ما هو ظاهر أو مكتوب فقط"),
  category: z.string().optional().describe("قسم مناسب قصير مثل: تيشيرتات، أحذية، حقائب"),
  sizes: z.array(z.string()).optional().describe("المقاسات إن ذُكرت فقط"),
  colors: z.array(z.string()).optional().describe("الألوان إن ذُكرت أو ظهرت بوضوح"),
  imageIndexes: z.array(z.number().int()).optional().describe("أرقام الصور (تبدأ من 0) التي تخص هذا المنتج"),
  attributes: z.array(z.object({ label: z.string(), value: z.string() })).optional().describe("سمات ظاهرة أو مذكورة فقط"),
});
export const aiProductsSchema = z.object({ products: z.array(aiProductSchema).max(60) });
export type AiProduct = z.infer<typeof aiProductSchema>;

export function candidateFromAi(p: AiProduct, imageUrls: string[], source: Candidate["source"]): Candidate | null {
  const imgs = (p.imageIndexes ?? []).filter((i) => Number.isInteger(i) && i >= 0 && i < imageUrls.length).map((i) => imageUrls[i]!);
  return normalizeCandidate({
    name: p.name,
    price: p.price ?? null,
    compareAt: p.compareAt ?? null,
    description: p.description ?? "",
    category: p.category ?? "",
    sizes: p.sizes ?? [],
    colors: p.colors ?? [],
    images: uniq(imgs),
    source,
    attributes: p.attributes ?? [],
  });
}

// ─── التنقية والدمج ──────────────────────────────────────────────────────────

let seq = 0;
export function newId(): string {
  seq += 1;
  const rnd = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
  return `c${rnd}${seq}`;
}

const collapse = (s: string) => s.replace(/\s+/g, " ").trim();

/** ينقّي أي مرشّح (من أي مصدر) إلى الحدود الآمنة؛ null إن بلا اسم. */
export function normalizeCandidate(input: Partial<Omit<Candidate, "id">> & { id?: string }): Candidate | null {
  const name = collapse(String(input.name ?? "")).slice(0, 120);
  if (!name) return null;
  const price = typeof input.price === "number" && Number.isFinite(input.price) && input.price > 0 && input.price <= 10_000_000 ? Math.round(input.price * 100) / 100 : null;
  const cmp = typeof input.compareAt === "number" && price !== null && input.compareAt > price && input.compareAt <= 10_000_000 ? Math.round(input.compareAt * 100) / 100 : null;
  return {
    id: input.id ?? newId(),
    name,
    price,
    compareAt: cmp,
    description: collapse(String(input.description ?? "")).slice(0, 600),
    category: collapse(String(input.category ?? "")).slice(0, 80),
    sizes: uniq((input.sizes ?? []).map((s) => normalizeSize(String(s))).filter((x): x is string => Boolean(x))).slice(0, 24),
    colors: uniq((input.colors ?? []).map((c) => normalizeColor(String(c))).filter((x): x is string => Boolean(x))).slice(0, 16),
    images: uniq((input.images ?? []).filter((u) => /^https:\/\//i.test(u))).slice(0, 10),
    stock: typeof input.stock === "number" && Number.isInteger(input.stock) && input.stock >= 0 ? input.stock : null,
    source: input.source ?? "manual",
    attributes: cleanAttributes(input.attributes ?? []),
  };
}

const keyOf = (name: string) => collapse(name).toLowerCase().replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/[ً-ٟ]/g, "");

/** يدمج دفعات المرشّحين: المنتج المتكرر بالاسم نفسه يُدمج (صور وخيارات تُجمع، والأول يغلب). */
export function mergeCandidates(existing: Candidate[], incoming: Candidate[]): Candidate[] {
  const out = [...existing];
  const at = new Map(out.map((c, i) => [keyOf(c.name), i]));
  for (const c of incoming) {
    const k = keyOf(c.name);
    const i = at.get(k);
    if (i === undefined) {
      at.set(k, out.length);
      out.push(c);
      continue;
    }
    const e = out[i]!;
    out[i] = {
      ...e,
      price: e.price ?? c.price,
      compareAt: e.compareAt ?? c.compareAt,
      description: e.description || c.description,
      category: e.category || c.category,
      sizes: uniq([...e.sizes, ...c.sizes]),
      colors: uniq([...e.colors, ...c.colors]),
      images: uniq([...e.images, ...c.images]).slice(0, 10),
      stock: e.stock ?? c.stock,
      attributes: cleanAttributes([...e.attributes, ...c.attributes]),
    };
  }
  return out.slice(0, IMPORT_MAX_CANDIDATES);
}

/**
 * يدمج عدة مرشّحين في منتج واحد (صور المنتج نفسه من زوايا مختلفة): يبقى أولهم مكانه بحقوله، وتُضاف صور
 * الباقين وخياراتهم وسماتهم الناقصة، ويُحذفون من القائمة. أقل من اثنين ← بلا تغيير.
 */
export function mergeIntoOne(cands: Candidate[], ids: string[]): Candidate[] {
  const picked = cands.filter((c) => ids.includes(c.id));
  if (picked.length < 2) return cands;
  const [head, ...rest] = picked as [Candidate, ...Candidate[]];
  const merged: Candidate = {
    ...head,
    name: head.name || rest.find((r) => r.name)?.name || "",
    price: head.price ?? rest.find((r) => r.price !== null)?.price ?? null,
    compareAt: head.compareAt ?? rest.find((r) => r.compareAt !== null)?.compareAt ?? null,
    description: head.description || rest.find((r) => r.description)?.description || "",
    category: head.category || rest.find((r) => r.category)?.category || "",
    sizes: uniq([...head.sizes, ...rest.flatMap((r) => r.sizes)]),
    colors: uniq([...head.colors, ...rest.flatMap((r) => r.colors)]),
    images: uniq([...head.images, ...rest.flatMap((r) => r.images)]).slice(0, 10),
    attributes: cleanAttributes([...head.attributes, ...rest.flatMap((r) => r.attributes)]),
  };
  const drop = new Set(rest.map((r) => r.id));
  return cands.filter((c) => !drop.has(c.id)).map((c) => (c.id === head.id ? merged : c));
}

/** أول اسم احتياطي لمنتج تُرك اسمه فارغاً (السعر وحده إلزامي): القسم أو «منتج N». */
export function fallbackName(c: Pick<Candidate, "category">, index: number): string {
  return c.category ? `${c.category} ${index + 1}` : `منتج ${index + 1}`;
}

/** المنتجات التي تنقصها السعر (الإدخال الإلزامي الوحيد). */
export const missingPrice = (cands: Candidate[]): Candidate[] => cands.filter((c) => c.price === null);

/** تجميع أسماء الأقسام: «تيشيرتات» و«التيشيرتات» قسم واحد، وأقصر اسم يغلب. */
export function unifyCategories(cands: Candidate[]): Candidate[] {
  const canon = new Map<string, string>();
  const k = (s: string) => keyOf(s).replace(/^ال/, "");
  for (const c of cands) {
    if (!c.category) continue;
    const key = k(c.category);
    const cur = canon.get(key);
    if (!cur || c.category.length < cur.length) canon.set(key, c.category);
  }
  return cands.map((c) => (c.category ? { ...c, category: canon.get(k(c.category)) ?? c.category } : c));
}

// ─── التركيبات من الرقائق ───────────────────────────────────────────────────

export type VariantPlan = { optionNames: string[]; combos: string[][] };

/** رقائق المقاس واللون ← أسماء الخيارات والتركيبات (حتى 60). بلا رقائق: منتج بسيط بلا تركيبات. */
export function variantPlan(sizes: string[], colors: string[]): VariantPlan {
  const hasSizes = sizes.length > 0 && !(sizes.length === 1 && sizes[0] === "مقاس واحد");
  const optionNames: string[] = [];
  if (hasSizes) optionNames.push("المقاس");
  if (colors.length) optionNames.push("اللون");
  if (!optionNames.length) return { optionNames: [], combos: [] };
  const combos: string[][] = [];
  const A = hasSizes ? sizes : [null];
  const B = colors.length ? colors : [null];
  for (const s of A) for (const c of B) combos.push([...(s ? [s] : []), ...(c ? [c] : [])]);
  return { optionNames, combos: combos.slice(0, 60) };
}

export const isDraft = (c: Candidate) => c.price === null;

/** ما يُحفظ فعلاً: الاسم + السعر + الخيارات. بلا سعر ← مسودة (سعر صفر ويُخفى حتى يحدَّد). */
export function summarize(cands: Candidate[]): { total: number; ready: number; drafts: number; categories: string[] } {
  const drafts = cands.filter(isDraft).length;
  return { total: cands.length, ready: cands.length - drafts, drafts, categories: uniq(cands.map((c) => c.category).filter(Boolean)) };
}

/** تقسيم مصفوفة لدفعات (للتقدم في الاستيراد الطويل). */
export function chunk<T>(xs: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n));
  return out;
}
