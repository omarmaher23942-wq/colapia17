// catalog.ts — متجر العرض V5 (demo.colapia.com): متجر أزياء نسائية واحد كامل ومخصص (stores/demo)، يُبنى بالمسار نفسه
// الذي يبني به أي تاجر متجره:
//   • الأقسام: planCategories ثم planCommit (دمج المترادفات وإنشاء الأقسام والمنتجات والتركيبات، نفس ما يفعله اعتماد الاستيراد).
//   • التصميم: defaultBlueprint ثم applyStarterTemplate("fashion") ثم تصميم «عاجي» وأقسام مخصصة من stores/demo (store_block).
//   • السمات: attributesFor("fashion") و cleanAttributes. جداول المقاسات: قوالب size-guide.
// الإضافات الخاصة بالعرض فقط: توزيع مخزون ثابت، تقييمات وأسئلة مُجابة توضيحية، أعمار منتجات. كلها حتمية (بذرة ثابتة).
//
// الصدق: كل ادعاء في الواجهة مشتق من سياسات المتجر نفسها (blueprint/facts)، والتقييمات موسومة توضيحية بلا شارة «موثّق»،
// وشريط الإعلانات وصفحة «عن المتجر» وصفحتا الدفع والطلب تقول إنه متجر عرض لا يشحن ولا يطلب دفعاً.
import { readFileSync } from "node:fs";
import fashionJson from "./data/fashion.json";
import { join } from "node:path";
import { blueprintSchema, type Section, type StoreBlueprint } from "../../src/blueprint/schema";
import { defaultBlueprint } from "../../src/blueprint/defaults";
import { applyTheme, type ThemeId } from "../../src/blueprint/themes";
import { storeFacts, type StoreFact } from "../../src/blueprint/facts";
import { applyCategoryPlan, planCategories } from "../../src/lib/category-merge";
import { colorFromName } from "../../src/lib/color-names";
import { defaultShippingZones } from "../../src/lib/egypt";
import { planCommit, type CommitPlan } from "../../src/lib/import-commit";
import type { Candidate } from "../../src/lib/import-candidates";
import { formatEgp } from "../../src/lib/money";
import { attributesFor, cleanAttributes, type AttrPair } from "../../src/lib/niche-attributes";
import { SIZE_TEMPLATES, type SizeChart } from "../../src/lib/size-guide";
import { STARTER_TEMPLATES, applyStarterTemplate } from "../../src/lib/store-templates";

// ─── الثوابت ──────────────────────────────────────────────────────────────

export const DEMO_SUB = "demo";
export const DEMO_NAME = "ريحانة للأزياء";
export const DEMO_MERCHANT_NAME = "Colapia Demo";
export const DEMO_DEFAULT_EMAIL = "demo@colapia.com";
export const DEMO_TEMPLATE = "fashion" as const;
/** تصميم «عاجي»: دفء تحريري وأناقة هادئة، الأنسب لأزياء نسائية راقية (القالب نفسه يقترح غيره؛ الاختيار من التصميمات الثمانية). */
export const DEMO_THEME: ThemeId = "ivory-atelier";
export const DEMO_NICHE = STARTER_TEMPLATES[DEMO_TEMPLATE].niche;
export const FREE_SHIPPING_OVER_PIASTERS = 300_000;
export const RETURN_DAYS = 14;
export const DEMO_SIZE_NAME = "المقاس";
export const GENERAL_ETA = "من 2 إلى 5 أيام عمل";
export const DEMO_COUPON = { code: "DEMO10", percent: 10 } as const;
/** عدد المنتجات التي تحمل وسم «جديد» (أُضيفت خلال آخر 14 يوماً) عند الزرع. */
const FRESH_COUNT = 3;
const DAY = 864e5;

export const DATA_DIR = join(process.cwd(), "scripts/demo/data");

// ─── بيانات الملفات ───────────────────────────────────────────────────────

export type DemoOption = { name: string; values: string[] };
export type DemoArt = { shape: string; tone: string };
export type DemoProduct = {
  slug: string; name: string; /** اسم القسم كما يكتبه التاجر؛ يمر بدمج المترادفات قبل الاعتماد. */ category: string; price: number; compareAt: number | null;
  shortDescription: string; description: string; material?: string; fit?: string; care?: string; tags: string[];
  /** حاضر فقط حين صورة المنتج رسم توضيحي بديل (scripts/demo/make-art.ts) لا صورة فوتوغرافية. */
  art?: DemoArt;
  options: DemoOption[]; stock: number; featured: boolean; isNew: boolean; images: string[]; alt: string[];
};

export function loadDemoProducts(dir?: string): DemoProduct[] {
  // بلا مجلد مخصص: البيانات مضمَّنة وقت البناء (تعمل داخل العامل بلا قرص). مع مجلد: قراءة من القرص (اختبارات).
  if (!dir) return fashionJson as unknown as DemoProduct[];
  return JSON.parse(readFileSync(join(dir, "fashion.json"), "utf8")) as DemoProduct[];
}

// ─── عشوائية حتمية (mulberry32): نفس النتائج في كل تشغيل وكل جهاز ───────────

export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── الألوان والسمات ──────────────────────────────────────────────────────

const HEX: Record<string, string> = {
  "كونياك": "#9a4f1f", "بني فاتح": "#a67c52", "كاميل": "#c19a6b", "بني": "#7a5233", "كحلي": "#1d2b4f", "جمل": "#c19a6b", "خاكي": "#a39a6a", "وردي بودرة": "#e8c4c4",
  "زيتي": "#5b6b2f", "عنابي": "#7a1f3d", "بيج": "#d6c7a1", "كريمي": "#f3eee2", "أبيض": "#ffffff", "أسود": "#111111", "رمادي": "#9ca3af", "سماوي": "#a9cfe6",
  "أزرق جينز": "#4a6fa5", "أخضر": "#2f6b4a",
  // ألوان قطع الكتالوج المقدَّم من المالك (من لون القطعة في الصورة).
  "كحلي مقلّم": "#1f2a44", "عنابي مقلّم": "#4a1c28", "بيج فاتح": "#e0d0ba", "بني داكن": "#33211a", "فحمي": "#2c2b30", "أحمر": "#df2d31",
  "أحمر قاني": "#b00328", "أحمر داكن": "#91021a", "بيج منقّط": "#c1b19f", "وردي ترابي": "#ad7970", "وردي مقلّم": "#bba7aa", "رمادي دافئ": "#9a9995",
};
export const hexOf = (label: string): string | undefined => HEX[label] ?? colorFromName(label) ?? undefined;
export const isColorOption = (n: string) => /لون/.test(n);
export const isSizeOption = (n: string) => /مقاس/.test(n);

const NICHE_ATTRS = attributesFor(DEMO_NICHE);
export const ATTR_MATERIAL = NICHE_ATTRS.find((a) => a.key === "material")?.label ?? "الخامة";
export const ATTR_FIT = NICHE_ATTRS.find((a) => a.key === "fit")?.label ?? "القَصّة";
export const ATTR_CARE = "العناية";

/** سمات المنتج بأسماء نشاط الأزياء نفسها التي يعرضها محرر المنتج، فيجدها التاجر معبأة في اللوحة. */
export function attributesOf(p: DemoProduct): AttrPair[] {
  return cleanAttributes([
    ...(p.material ? [{ label: ATTR_MATERIAL, value: p.material }] : []),
    ...(p.fit ? [{ label: ATTR_FIT, value: p.fit }] : []),
    ...(p.care ? [{ label: ATTR_CARE, value: p.care }] : []),
  ]);
}

// وسوم تدّعي حالة زمنية («وصل حديثاً»، «تخفيضات») لا تبقى صحيحة مع مرور الوقت؛ الحالة تُعرض من البيانات الحية.
const STATUS_TAGS = new Set(["وصل حديثاً", "تخفيضات"]);

// ─── توزيع المخزون على التركيبات: يوجد نافد ومنخفض ومتوفر ─────────────────

export function distribute(total: number, n: number): number[] {
  const out = Array<number>(n).fill(0);
  if (total <= 0 || n <= 0) return out;
  // الوحدات تُوزَّع من المنتصف للأطراف (المقاسات الوسطى أكثر طلباً)، فتنفد الأطراف أولاً عند الندرة.
  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => Math.abs(a - (n - 1) / 2) - Math.abs(b - (n - 1) / 2) || a - b);
  for (let u = 0; u < total; u++) out[order[u % n]!]!++;
  return out;
}

const cartesian = (lists: string[][]): string[][] => lists.reduce<string[][]>((acc, vals) => acc.flatMap((a) => vals.map((v) => [...a, v])), [[]]);

export type DemoVariant = { optionValues: string[]; stock: number; imageUrl: string | null; sortOrder: number };

/** تركيبات المنتج (مقاس × لون) بمخزون موزّع، وصورة لكل لون حين تطابق الصور الألوان عدداً وترتيباً. */
export function variantsOf(p: DemoProduct): DemoVariant[] {
  if (!p.options.length) return [];
  const combos = cartesian(p.options.map((o) => o.values));
  const per = distribute(p.stock, combos.length);
  const colourIdx = p.options.findIndex((o) => isColorOption(o.name));
  const colours = colourIdx >= 0 ? p.options[colourIdx]!.values : [];
  return combos.map((vals, k) => ({
    optionValues: vals,
    stock: per[k]!,
    imageUrl: colours.length > 1 && p.images.length >= colours.length ? p.images[colours.indexOf(vals[colourIdx]!)] ?? null : null,
    sortOrder: k,
  }));
}

// ─── الأقسام والمنتجات بمسار الاعتماد نفسه ─────────────────────────────────

export type DemoCategory = CommitPlan["categories"][number];

/** معرّفات حتمية للفحص دون اتصال؛ الزرع الفعلي يمرر crypto.randomUUID. */
export const seqId = (): (() => string) => {
  let n = 0;
  return () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
};

const toCandidate = (p: DemoProduct): Candidate => ({
  id: p.slug, name: p.name, price: p.price, compareAt: p.compareAt, description: p.shortDescription, category: p.category,
  sizes: p.options.find((o) => isSizeOption(o.name))?.values ?? [], colors: p.options.find((o) => isColorOption(o.name))?.values ?? [],
  images: p.images, stock: null, source: "manual", attributes: attributesOf(p),
});

/** أقسام المتجر النهائية بعد الدمج (مفتاح كل قسم = رابطه). */
export function planDemoCategories(data: DemoProduct[]): { assign: Record<string, string>; names: string[] } {
  const plan = planCategories(data.map((p) => ({ id: p.slug, category: p.category })), [], DEMO_MAX_CATEGORIES);
  return { assign: plan.assign, names: plan.categories };
}

export type DemoProductRow = {
  id: string; categoryId: string | null; categoryKey: string; name: string; slug: string; shortDescription: string; description: string;
  pricePiasters: number; compareAtPiasters: number | null; costPiasters: number; stock: number; trackStock: true;
  images: { url: string; alt: string }[]; attributes: AttrPair[];
  optionNames: string[]; optionMeta: { name: string; kind: "color" | "size" | "custom"; values: { label: string; hex?: string }[] }[];
  tags: string[]; isFeatured: boolean;
  searchText: string; sortOrder: number; createdAt: Date;
};
export type DemoCatalog = { categories: DemoCategory[]; rows: DemoProductRow[] };

/** عمر كل منتج بالأيام عند الزرع: أحدث FRESH_COUNT منتجاً داخل نافذة «جديد»، والباقي أقدم متدرجاً. */
function agesInDays(data: DemoProduct[]): Map<string, number> {
  const ages = new Map<string, number>();
  data.filter((p) => p.isNew).forEach((p, k) => ages.set(p.slug, k < FRESH_COUNT ? 1 + Math.floor((k * 12) / FRESH_COUNT) : 16 + (k - FRESH_COUNT) * 2));
  data.forEach((p, i) => {
    if (!ages.has(p.slug)) ages.set(p.slug, 45 + ((i * 7) % 150));
  });
  return ages;
}

/** الكتالوج كما يعتمده المسار العادي (planCommit) مع إضافات العرض: المخزون والتكلفة والخيارات المرئية والأعمار. */
export function buildCatalog(data: DemoProduct[], now: number, storeId = "00000000-0000-4000-8000-0000000000aa", newId: () => string = seqId()): DemoCatalog {
  const merged = applyCategoryPlan(data.map(toCandidate), planCategories(data.map((p) => ({ id: p.slug, category: p.category })), [], DEMO_MAX_CATEGORIES));
  const plan = planCommit({ storeId, candidates: merged, existingCategories: [], existingSlugs: [], tracking: true, newId, sortOffset: { categories: 0, products: 0 } });
  // ترتيب الأقسام في الواجهة: فساتين فعبايات فبقية الأقسام، بدل ترتيب الدمج (بعدد المنتجات).
  const orderOf = (name: string) => {
    const i = CATEGORY_ORDER.indexOf(name);
    return i < 0 ? CATEGORY_ORDER.length : i;
  };
  plan.categories.sort((a, b) => orderOf(a.name) - orderOf(b.name)).forEach((c, k) => (c.sortOrder = k));
  const catById = new Map(plan.categories.map((c) => [c.id, c]));
  const ages = agesInDays(data);
  const rows = data.map((p, i): DemoProductRow => {
    const base = plan.products[i]!;
    const variants = variantsOf(p);
    // مخزون المنتج = مجموع تركيباته (القاعدة العامة في المنصة).
    const stock = variants.length ? variants.reduce((a, v) => a + v.stock, 0) : Math.max(0, p.stock);
    const tags = p.tags.filter((t) => !STATUS_TAGS.has(t));
    return {
      id: base.id, categoryId: base.categoryId, categoryKey: base.categoryId ? catById.get(base.categoryId)!.slug : "",
      name: p.name, slug: p.slug, shortDescription: p.shortDescription, description: p.description,
      pricePiasters: base.pricePiasters, compareAtPiasters: p.compareAt && p.compareAt > p.price ? p.compareAt * 100 : null,
      // تكلفة تقديرية للعرض (تُظهر «الربح التقديري» في لوحة التحكم).
      costPiasters: Math.round(p.price * 100 * 0.55),
      stock, trackStock: true,
      images: p.images.map((u, k) => ({ url: u, alt: p.alt[k] ?? p.name })),
      attributes: base.attributes,
      optionNames: base.optionNames,
      optionMeta: p.options.map((o) => ({
        name: o.name,
        kind: isColorOption(o.name) ? ("color" as const) : isSizeOption(o.name) ? ("size" as const) : ("custom" as const),
        values: o.values.map((l) => (isColorOption(o.name) ? { label: l, hex: hexOf(l) } : { label: l })),
      })),
      tags, isFeatured: p.featured,
      searchText: base.searchText,
      sortOrder: i,
      createdAt: new Date(now - ages.get(p.slug)! * DAY),
    };
  });
  return { categories: plan.categories, rows };
}

export const productRows = (data: DemoProduct[], now: number): DemoProductRow[] => buildCatalog(data, now).rows;
/** الأقسام النهائية بمفاتيحها (الرابط) وأسمائها. */
export const demoCategories = (data: DemoProduct[]): { key: string; name: string }[] => buildCatalog(data, 0).categories.map((c) => ({ key: c.slug, name: c.name }));
/** مفتاح القسم ← معرّف (للفحص دون اتصال). */
export const fakeCategoryIds = (data: DemoProduct[] = loadDemoProducts()): Record<string, string> => Object.fromEntries(buildCatalog(data, 0).categories.map((c) => [c.slug, c.id]));

// ─── التقييمات: نصوص عربية واقعية، بلا جنس للمتكلم، وبلا أي ادعاء «موثّق» ──────

const LINES = {
  pos: [
    "القماش ناعم ومريح طوال اليوم", "القصّة أنيقة وتناسب أكثر من مناسبة", "الخياطة نظيفة والتفاصيل متقنة", "المقاس مطابق للجدول تماماً",
    "اللون في الحقيقة مطابق للصور", "الخامة مريحة ولا تحتاج كيّاً كثيراً", "تنسّق بسهولة مع قطع الخزانة الأخرى", "الشكل في الحقيقة أجمل من الصور",
  ],
  minor: ["الأكمام أطول قليلاً من المتوقع", "القماش أخف مما توقعت", "يحتاج كيّاً قبل أول لبس", "الطول أقصر قليلاً من المعتاد"],
  neg: ["المقاس أصغر من المعتاد", "القماش أرق مما ظهر في الصور"],
};
const CLOSERS = ["أنصح بها", "تستحق سعرها", "تجربة ممتازة بكل المقاييس", "من أفضل ما اشتريت مؤخراً"];
const ONE_STAR = ["لم تناسبني القطعة، والخامة مختلفة عما توقعت", "القطعة مختلفة عن الصور ولم تناسبني"];
const REVIEWERS = [
  "سارة أ.", "محمد ع.", "منة الله ح.", "أحمد س.", "ياسمين ف.", "كريم ع.", "هبة م.", "مصطفى ر.", "نورهان إ.", "عمر ط.", "دعاء ص.",
  "يوسف ن.", "رنا خ.", "طارق ج.", "ندى ب.", "إسلام ك.", "مريم ل.", "حسام و.", "آية ز.", "شادي ه.", "ملك ي.", "باسم ق.", "فرح د.",
  "علي م.", "سلمى ر.", "زياد ت.", "جنى ع.", "خالد ف.", "هالة س.", "مازن ب.",
];

/** صيغ التقييم لكل نجمة: نص فريد مركّب من الجمل أعلاه، ومعه «أصله» (الجملة الأساسية) لتنويع التقييمات المتتالية. */
function bodiesFor(rating: number): { body: string; base: string }[] {
  const out: { body: string; base: string }[] = [];
  if (rating === 5) for (const p of LINES.pos) out.push({ body: `${p}.`, base: p }, ...CLOSERS.map((c) => ({ body: `${p}. ${c}.`, base: p })));
  else if (rating === 4) for (const p of LINES.pos) for (const m of LINES.minor) out.push({ body: `${p}، لكن ${m}.`, base: p });
  else if (rating === 3) for (const m of LINES.minor) out.push({ body: `مقبول بشكل عام، لكن ${m}.`, base: m }, { body: `جيد بالنسبة للسعر، لكن ${m}.`, base: m });
  else if (rating === 2) for (const n of LINES.neg) out.push({ body: `${n}.`, base: n }, { body: `${n}، ولم يناسبني في النهاية.`, base: n });
  else out.push(...ONE_STAR.map((x) => ({ body: `${x}.`, base: x })));
  return out;
}

export type DemoReview = { slug: string; customerName: string; rating: number; body: string; createdAt: Date };

/**
 * التقييمات: ≈90% من المنتجات التي مضى على إضافتها 10 أيام فأكثر (المنتج الجديد بلا تقييمات بعد)، 3–7 لكل منتج،
 * بتوزيع واقعي ليس كله 5 نجوم، وكل تقييم بعد إضافة منتجه بيومين على الأقل، وكل نص فريد في المتجر كله.
 */
export function reviewsFor(data: DemoProduct[], rows: DemoProductRow[], now: number): DemoReview[] {
  const rnd = makeRng(19102026);
  const createdAt = new Map(rows.map((r) => [r.slug, r.createdAt.getTime()]));
  const used = new Set<string>();
  const bases = new Set<string>();
  const out: DemoReview[] = [];
  const COUNTS = [3, 4, 4, 5, 6, 7];
  let nameCursor = 0;
  for (const p of data) {
    const born = createdAt.get(p.slug)!;
    if (now - born < 10 * DAY || rnd() > 0.9) continue;
    const n = COUNTS[Math.floor(rnd() * COUNTS.length)]!;
    for (let k = 0; k < n; k++) {
      const x = rnd();
      const rating = x < 0.55 ? 5 : x < 0.83 ? 4 : x < 0.94 ? 3 : x < 0.98 ? 2 : 1;
      const fresh = bodiesFor(rating).filter((b) => !used.has(b.body));
      const unseen = fresh.filter((b) => !bases.has(b.base));
      const pool = unseen.length ? unseen : fresh;
      if (!pool.length) continue;
      const pick = pool[Math.floor(rnd() * pool.length)]!;
      if (!unseen.length) bases.clear();
      used.add(pick.body);
      bases.add(pick.base);
      const span = Math.max(1, Math.floor((now - born) / DAY) - 3);
      out.push({ slug: p.slug, customerName: REVIEWERS[nameCursor++ % REVIEWERS.length]!, rating, body: pick.body, createdAt: new Date(born + (2 + Math.floor(rnd() * span)) * DAY) });
    }
  }
  return out;
}

/** مجموع التقييمات وعددها لكل منتج (يُكتب في products.rating_sum/rating_count مطابقاً للصفوف). */
export function ratingTotals(reviews: DemoReview[]): Map<string, { sum: number; count: number }> {
  const agg = new Map<string, { sum: number; count: number }>();
  for (const r of reviews) {
    const a = agg.get(r.slug) ?? { sum: 0, count: 0 };
    a.sum += r.rating;
    a.count++;
    agg.set(r.slug, a);
  }
  return agg;
}

// ─── أسئلة المنتجات: أجوبتها من بيانات المنتج وسياسة المتجر نفسها ───────────

export type DemoQuestion = { slug: string; question: string; answer: string; askerName: string; createdAt: Date; answeredAt: Date };

export function questionsFor(data: DemoProduct[], rows: DemoProductRow[], now: number): DemoQuestion[] {
  const createdAt = new Map(rows.map((r) => [r.slug, r.createdAt.getTime()]));
  const first = (name: string) => name.replace(/ .\.$/, "");
  const out: DemoQuestion[] = [];
  data.forEach((p, i) => {
    const born = createdAt.get(p.slug)!;
    if (i % 3 !== 1 || now - born < 14 * DAY) return;
    const qs: { q: string; a: string }[] = [];
    if (p.material) qs.push({ q: "ما خامة هذه القطعة؟", a: `${p.material}.` });
    const size = p.options.find((o) => isSizeOption(o.name));
    if (size && size.values.length > 1) {
      qs.push({
        q: "أي مقاس تنصحون به؟",
        a: `المقاسات المتاحة: ${size.values.join("، ")}. اعتمدوا زر «دليل المقاسات» في صفحة القطعة: يقترح المقاس من الطول والوزن. ومن كان بين مقاسين فالأكبر أريح لهذه القصّة. والاستبدال متاح خلال ${RETURN_DAYS} يوماً من الاستلام إن لم يناسب المقاس.`,
      });
    } else if (p.care) qs.push({ q: "كيف أعتني بالقطعة؟", a: p.care });
    qs.slice(0, 2).forEach((q, k) => {
      const asked = born + (3 + ((i + k) % 7)) * DAY;
      out.push({ slug: p.slug, question: q.q, answer: q.a, askerName: first(REVIEWERS[(i * 7 + k * 3) % REVIEWERS.length]!), createdAt: new Date(asked), answeredAt: new Date(asked + (4 + k) * 3600_000) });
    });
  });
  return out;
}

// ─── دليل المقاسات: جداول نسائية بالمقاسات S–XL، وجدول للأحذية 36–41 ─────────────

type ChartRow = SizeChart["rows"][number];
const row = (size: string, cells: string[], h: [number, number] | null = null, w: [number, number] | null = null): ChartRow => ({
  size, cells, heightFrom: h?.[0] ?? null, heightTo: h?.[1] ?? null, weightFrom: w?.[0] ?? null, weightTo: w?.[1] ?? null,
});

/** أقسام كل جدول بأسماء الأقسام النهائية (تُترجم لمعرّفاتها عند البناء). */
const CHART_SCOPE = {
  dresses: ["أطقم وملابس منزلية"],
  tops: ["بلوزات وتونيكات", "بلوفرات وتريكو", "جواكت ومعاطف"],
  bottoms: ["بناطيل وتنانير"],
  shoes: ["إكسسوارات وأحذية"],
} as const;

/** الجداول بمعرّفات أقسام المتجر الحقيقية (appliesTo). القياسات بالسنتيمتر، ومدى الطول والوزن يغذّي اقتراح المقاس. */
export function sizeCharts(categoryIds: Record<string, string>, names: Record<string, string> = {}): SizeChart[] {
  const ids = (list: readonly string[]) => list.map((n) => categoryIds[names[n] ?? ""]).filter((x): x is string => Boolean(x));
  const dress = SIZE_TEMPLATES.find((t) => t.key === "dresses")!.chart;
  return [
    {
      id: "szdemodress", ...dress, name: "مقاسات الأطقم والملابس المنزلية", appliesTo: ids(CHART_SCOPE.dresses), unit: "سم", columns: ["الصدر", "الوسط", "الورك"],
      note: "قياسات الجسم لا القطعة. الطول يختلف من قطعة لأخرى ويُذكر في وصفها.",
      rows: [
        row("S", ["86", "68", "94"], [155, 163], [47, 56]), row("M", ["92", "74", "100"], [160, 168], [55, 65]),
        row("L", ["98", "80", "106"], [164, 172], [64, 75]), row("XL", ["104", "86", "112"], [168, 176], [73, 86]),
      ],
    },
    {
      id: "szdemotops", ...dress, name: "مقاسات البلوزات والبلوفرات والجواكت", appliesTo: ids(CHART_SCOPE.tops), unit: "سم", columns: ["الصدر", "الكتف", "الطول"],
      note: "قياس القطعة مفرودة على سطح مستوٍ.",
      rows: [
        row("S", ["90", "37", "60"], [155, 163], [47, 56]), row("M", ["96", "38.5", "62"], [160, 168], [55, 65]),
        row("L", ["102", "40", "64"], [164, 172], [64, 75]), row("XL", ["108", "41.5", "66"], [168, 176], [73, 86]),
      ],
    },
    {
      id: "szdemobottoms", ...dress, name: "مقاسات البناطيل والتنانير", appliesTo: ids(CHART_SCOPE.bottoms), unit: "سم", columns: ["الوسط", "الورك", "طول الساق"],
      note: "قياس الجسم للوسط والورك، وطول الساق من الفخذ إلى الكاحل.",
      rows: [
        row("S", ["68", "94", "100"], [155, 163], [47, 56]), row("M", ["74", "100", "101"], [160, 168], [55, 65]),
        row("L", ["80", "106", "102"], [164, 172], [64, 75]), row("XL", ["86", "112", "103"], [168, 176], [73, 86]),
      ],
    },
    {
      id: "szdemoshoes", ...SIZE_TEMPLATES.find((t) => t.key === "shoes")!.chart, name: "مقاسات الأحذية", appliesTo: ids(CHART_SCOPE.shoes),
      rows: [["36", "23.3"], ["37", "24"], ["38", "24.7"], ["39", "25.3"], ["40", "26"], ["41", "26.7"]].map(([sz, c]) => row(sz!, [c!])),
    },
  ];
}

// ─── الـ Blueprint ────────────────────────────────────────────────────────

/** مناطق الشحن: الجدول الافتراضي للمحافظات السبع والعشرين (رسوم ومدد واقعية حسب المنطقة). */
export const shippingZoneRows = () => defaultShippingZones();

/** حقائق المتجر كما سيحسبها العرض (سياسات الـ Blueprint + مناطق الشحن المفعّلة). */
export function demoFacts(bp: StoreBlueprint): StoreFact[] {
  const zones = shippingZoneRows().filter((z) => z.isActive);
  return storeFacts(bp, { activeGovernorates: zones.length, fastestDays: Math.min(...zones.map((z) => z.etaMaxDays)) });
}

const img = (url: string, alt: string, focalY = 0.45) => ({ url, alt, focalX: 0.5, focalY });
type Target = StoreBlueprint["header"]["nav"][number]["target"];
const cta = (label: string, target: Target, style: "primary" | "secondary" = "primary") => ({ label, target, style });

/**
 * أسئلة شائعة: كل سؤال عن سياسة يُضاف فقط إن كانت حقيقة في المتجر (blueprint/facts)، وبأرقام الحقيقة نفسها،
 * فيمر بفحص groundedItems عند العرض كما هو. وسؤال صريح عن طبيعة متجر العرض.
 */
export function faqItems(facts: StoreFact[]): { q: string; a: string }[] {
  const has = (key: string) => facts.some((x) => x.key === key);
  const items: { q: string; a: string }[] = [
    { q: "هل هذا متجر حقيقي؟", a: "هذا متجر عرض من Colapia يوضح شكل المتجر الجاهز وتجربة الشراء كاملة. يمكن إضافة القطع إلى السلة وإتمام الطلب للتجربة، لكن الطلب يُسجَّل تجريبياً فلا يُشحن ولا يُطلب عنه أي مبلغ. بعض صور القطع رسوم توضيحية بدل التصوير." },
    { q: "كيف أطلب؟", a: "باختيار المقاس واللون، ثم «إضافة للسلة»، ثم إكمال بيانات الشحن في صفحة إتمام الطلب." },
    { q: "كيف أعرف المقاس المناسب؟", a: "في الصفحة الرئيسية أداة «اعرفوا مقاسكم» تقترح المقاس من الطول والوزن، وفي صفحة كل قطعة زر «دليل المقاسات» بجدول القياسات بالسنتيمتر." },
    { q: "ما مدة التوصيل؟", a: `${GENERAL_ETA} حسب المحافظة، وتظهر المدة المتوقعة لكل محافظة في صفحة إتمام الطلب.` },
  ];
  if (has("cod")) items.push({ q: "هل الدفع عند الاستلام متاح؟", a: "نعم، الدفع نقداً عند استلام الطلب متاح لكل الطلبات." });
  if (has("inspection")) items.push({ q: "هل يمكن فتح الشحنة قبل الدفع؟", a: "نعم، يمكن فتح الشحنة وفحص القطعة مع المندوب قبل الدفع." });
  if (has("returns")) items.push({ q: "ما سياسة الاستبدال والاسترجاع؟", a: `الاستبدال والاسترجاع متاحان خلال ${RETURN_DAYS} يوماً من الاستلام، بشرط أن تكون القطعة بحالتها الأصلية.` });
  if (has("free_shipping_over")) items.push({ q: "متى يكون الشحن مجانياً؟", a: `الشحن مجاني لأي طلب قيمته ${formatEgp(FREE_SHIPPING_OVER_PIASTERS)} أو أكثر.` });
  return items;
}

/** الحالة التي تُكتب في stores (يقرؤها السكربت). */
export const demoStoreSettings = (now: number) => ({
  name: DEMO_NAME,
  status: "active" as const,
  plan: "growth",
  planMonths: 12,
  activatedAt: new Date(now - 60 * DAY),
  deliveredAt: new Date(now - 60 * DAY),
  setupStartedAt: new Date(now - 61 * DAY),
  setupCompletedAt: new Date(now - 60 * DAY),
  // استضافة بعيدة المدى: لا تجديد ولا سماح ولا إيقاف.
  hostingExpiresAt: new Date("2099-12-31T00:00:00Z"),
  showcaseOptIn: false,
  acceptingOrders: true,
  onboarding: { nicheKind: DEMO_NICHE, templateId: DEMO_TEMPLATE, themeId: DEMO_THEME },
  // علامة متجر العرض: كل طلب فيه تجريبي بلا بريد (lib/demo-store.ts)، ومستثنى من التقارير الشهرية.
  prefs: { demo: true },
});

/** صور ومحتوى الأقسام المخصصة (stores/demo): كلها من ملفات public/demo الموثقة في docs/demo-credits.md. */
export const DEMO_EDITORIAL = {
  heroMain: { url: "/demo/editorial/lookbook-3.webp", alt: "معطف صوف طويل بلون الجمل مع قبعة عريضة الحافة بين أعمدة بيضاء" },
  heroSecond: { url: "/demo/editorial/lookbook-2.webp", alt: "ترنش كوت بيج مفتوح فوق توب أبيض وبنطلون بيج" },
  railDresses: "/demo/editorial/rail-dresses.webp",
  railBoutique: "/demo/editorial/rail-boutique.webp",
  bag: "/demo/fashion/green-leather-tote-1.webp",
  earrings: "/demo/fashion/tortoise-hoop-earrings-1.webp",
  blazer: "/demo/editorial/hero-side.webp",
  utility: "/demo/editorial/lookbook-1.webp",
} as const;

/** غلاف كل قسم في «تسوقوا حسب القسم»: صورة فوتوغرافية متى وُجدت لقسمه، وإلا صورة أول منتج. */
export const CATEGORY_COVERS: Record<string, string> = {
  "جواكت ومعاطف": DEMO_EDITORIAL.heroSecond.url,
  "أطقم وملابس منزلية": DEMO_EDITORIAL.blazer,
  "إكسسوارات وأحذية": DEMO_EDITORIAL.bag,
};

/** ترتيب عرض الأقسام (الأكثر تسوقاً أولاً)، وما سواه يتبع بترتيبه. */
export const CATEGORY_ORDER = ["بلوزات وتونيكات", "بلوفرات وتريكو", "جواكت ومعاطف", "بناطيل وتنانير", "أطقم وملابس منزلية", "إكسسوارات وأحذية"];
/** سقف أقسام الديمو: ثمانية أقسام لكتالوج بنحو خمسين منتجاً (الافتراضي للمتاجر الجديدة 6). */
export const DEMO_MAX_CATEGORIES = 8;

export function buildDemoBlueprint(opts: { storeId: string; email: string; categoryIds: Record<string, string>; productCount: number; data?: DemoProduct[] }): StoreBlueprint {
  const data = opts.data ?? loadDemoProducts();
  const base = defaultBlueprint({
    name: DEMO_NAME,
    tagline: "أزياء نسائية بقصّات هادئة وخامات مريحة، في متجر عرض من Colapia",
    industry: "fashion",
    email: opts.email,
    inspectionAllowed: true,
    storeId: opts.storeId,
    productCount: opts.productCount,
    hasHeroImages: true,
    variationSeed: "demo-colapia-v5-women",
    toneOfVoice: "premium_formal",
  });

  // سياسات المتجر كما يضبطها التاجر في خطوات الإعداد.
  const policies: StoreBlueprint = {
    ...base,
    payments: { ...base.payments, cod: { ...base.payments.cod, enabled: true }, vodafoneCash: { enabled: false }, instapay: { enabled: false } },
    shipping: { ...base.shipping, freeOverPiasters: FREE_SHIPPING_OVER_PIASTERS, flatRatePiasters: null, generalEta: GENERAL_ETA, inspectionAllowed: true, pickupEnabled: false, giftEnabled: true, giftWrapPiasters: 0 },
    returns: { ...base.returns, windowDays: RETURN_DAYS, allowExchange: true, allowRefund: true },
  };
  // قالب البدء للأزياء ثم تصميم «عاجي» كاملاً (الألوان والخطوط والبطاقة والأزرار) بدل ألوان القالب المبهجة.
  const shell = applyTheme(applyStarterTemplate(policies, DEMO_TEMPLATE), DEMO_THEME);
  const facts = demoFacts(shell);
  const freeShipping = facts.some((f) => f.key === "free_shipping_over");

  const cats = demoCategories(data);
  const catByName = Object.fromEntries(cats.map((c) => [c.name, c.key]));
  const heroSrc = shell.home.find((s): s is Extract<Section, { type: "hero" }> => s.type === "hero")!;
  const byId = (id: string) => shell.home.find((s) => s.id === id)!;
  const block = (id: string, name: string, title: string, props: Record<string, unknown>, background: Section["background"] = "default"): Section => ({
    id, type: "store_block", enabled: true, spacing: "normal", reveal: "fade", background, variant: "default", name, title, props,
  });

  const home: Section[] = [
    {
      ...heroSrc,
      variant: "editorial",
      eyebrow: "مجموعة الموسم",
      headline: "أناقة هادئة لكل يوم",
      subheadline: "بلوزات وبلوفرات وجواكت وأطقم بخامات مريحة وقصّات تناسب مختلف المقاسات، مع أداة تقترح مقاسكم من الطول والوزن.",
      images: [img(DEMO_EDITORIAL.heroMain.url, DEMO_EDITORIAL.heroMain.alt, 0.35), img(DEMO_EDITORIAL.heroSecond.url, DEMO_EDITORIAL.heroSecond.alt, 0.4)],
      videoUrl: undefined,
      highlights: [],
      spotlightProductSlug: "longline-camel-wool-coat",
      primaryCta: cta("تسوقوا المجموعة", { type: "all_products" }),
      secondaryCta: cta("شاهدوا الإطلالات", { type: "section", sectionId: "lookbook" }, "secondary"),
      textAlign: "start",
      height: "tall",
      enableKineticTypography: false,
    },
    { ...(byId("trust") as Section), spacing: "compact" },
    block("mosaic", "category-mosaic", "تسوقوا حسب القسم", { covers: CATEGORY_COVERS, order: CATEGORY_ORDER }),
    { ...(byId("new") as Section), id: "new", variant: "featured_first", title: "وصل حديثاً", subtitle: "أحدث القطع في المتجر", limit: 8 } as Section,
    block("look", "shop-the-look", "تسوقوا الإطلالة", {
      image: DEMO_EDITORIAL.heroMain.url, alt: DEMO_EDITORIAL.heroMain.alt,
      caption: "معطف طويل بلون الجمل فوق طبقات هادئة: قطع تُلبس معاً أو كلٌّ على حدة.",
      items: [
        { slug: "longline-camel-wool-coat", role: "المعطف" },
        { slug: "wide-leg-trousers", role: "البنطلون" },
        { slug: "green-leather-tote", role: "الحقيبة" },
      ],
    }, "muted"),
    { ...(byId("best") as Section), id: "best", variant: "carousel", title: "مختارات ريحانة", subtitle: "قطع اخترناها لكم من كل الأقسام", source: { type: "featured" }, limit: 10 } as Section,
    {
      id: "sale-banner", type: "promo_banner", enabled: true, spacing: "normal", reveal: "fade", background: "default", variant: "wide",
      items: [{
        eyebrow: "تخفيضات", title: "قطع مختارة بأسعار مخفّضة", text: `أسعار أقل على قطع من البلوفرات والجواكت والإكسسوارات، وكود ${DEMO_COUPON.code} يخفّض ${DEMO_COUPON.percent}% عند إتمام الطلب.`,
        image: img(DEMO_EDITORIAL.railBoutique, "شماعة متجر بفساتين وبلوزات بدرجات البيج والخوخ والصدأ بجوار نافذة", 0.5),
        cta: cta("تسوقوا التخفيضات", { type: "section", sectionId: "sale" }), couponCode: DEMO_COUPON.code,
      }],
    },
    { ...(byId("new") as Section), id: "sale", variant: "grid", background: "default", title: "عروض بأسعار مخفّضة", subtitle: "خصومات على السعر الأصلي", source: { type: "on_sale" }, limit: 8 } as Section,
    block("lookbook", "lookbook", "إطلالات من المجموعة", {
      looks: [
        { image: DEMO_EDITORIAL.heroMain.url, alt: DEMO_EDITORIAL.heroMain.alt, title: "معطف الجمل", slug: "longline-camel-wool-coat" },
        { image: DEMO_EDITORIAL.heroSecond.url, alt: DEMO_EDITORIAL.heroSecond.alt, title: "ترنش الصباح", slug: "belted-trench-coat" },
        { image: DEMO_EDITORIAL.blazer, alt: "بليزر بلون الجمل فوق توب أبيض وجينز فاتح", title: "بليزر بدرجات الجمل", slug: "camel-blazer-trouser-set" },
        { image: DEMO_EDITORIAL.utility, alt: "طقم قميص وبنطلون بلون الخاكي", title: "طقم يوم طويل", slug: "khaki-utility-set" },
      ],
    }),
    block("fit", "fit-finder", "اعرفوا مقاسكم", { category: "بلوزات وتونيكات" }, "muted"),
    block("fabric", "fabric-guide", "الخامات في هذه المجموعة", {}),
    block("voices", "voices", "آراء من التقييمات", { limit: 6 }, "muted"),
    { ...(byId("faq") as Section), items: faqItems(facts) } as Section,
  ];
  const about: Section = {
    id: "about", type: "about", enabled: true, spacing: "normal", reveal: "fade", background: "default", variant: "split", title: "عن متجر العرض",
    body: `${DEMO_NAME} متجر عرض أعدّه فريق Colapia ليُظهر شكل المتجر الجاهز ولوحة التحكم: أقسام لأزياء نسائية بأغلفتها، وقطع بمقاسات وألوان ومخزون، وأداة لاقتراح المقاس، وتقييمات وأسئلة مُجابة، وتجربة شراء كاملة حتى تأكيد الطلب.\nالقطع والأسعار والتقييمات هنا للعرض فقط، وبعض الصور رسوم توضيحية بدل التصوير، والطلبات تُسجَّل تجريبياً فلا تُشحن ولا يُطلب عنها أي دفع.`,
    image: img(DEMO_EDITORIAL.railDresses, "شماعة بفساتين سوداء وزيتية أمام ستائر كريمية", 0.5),
    stats: [], milestones: [],
  };
  home.push(about);

  const bp: StoreBlueprint = {
    ...shell,
    brand: {
      ...shell.brand,
      description: "متجر عرض من Colapia يوضح شكل المتجر الجاهز وتجربة الشراء ولوحة التحكم. القطع والصور للعرض فقط.",
      voice: "premium_formal",
    },
    header: {
      ...shell.header,
      transparentOnHero: false,
      // الشريط العلوي (مع إفصاح العرض الدائم) يرسمه stores/demo/slots/Header.tsx.
      announcement: shell.header.announcement ? { ...shell.header.announcement, enabled: false } : undefined,
    },
    footer: { ...shell.footer, tagline: "متجر عرض من Colapia: القطع للعرض والطلبات تجريبية." },
    conversion: {
      ...shell.conversion,
      // لا رقم واتساب حقيقياً لمتجر العرض، فلا زر واتساب ولا طلب عبر ماسنجر.
      whatsappButton: false,
      messengerOrderButton: false,
      freeShippingBar: { enabled: true, thresholdPiasters: FREE_SHIPPING_OVER_PIASTERS },
      lowStockAlert: { enabled: true, threshold: 5 },
      // لا طلبات حقيقية هنا، فلا «اشترى للتو» ولا مشاهدين مزيفين.
      socialProofToasts: { enabled: false, minOrdersToShow: 5, lookbackHours: 72 },
      liveViewers: false,
      exitIntentOffer: { ...shell.conversion.exitIntentOffer, enabled: false },
    },
    checkout: { ...shell.checkout, successMessage: "تم تسجيل الطلب التجريبي. هذا متجر عرض، فلن يُشحن الطلب ولن يُطلب أي دفع." },
    invoice: { ...shell.invoice, footerNote: "متجر عرض: فاتورة توضيحية لطلب تجريبي" },
    seo: {
      ...shell.seo,
      title: `${DEMO_NAME}: متجر عرض من Colapia`,
      description: "تصفحوا متجر أزياء نسائية كاملاً كما يراه الزبائن: أقسام ومقاسات وألوان وأداة لاقتراح المقاس وتجربة شراء تجريبية.",
      // متجر عرض لا يبيع فعلاً: لا يُفهرس في محركات البحث.
      noIndex: true,
    },
    productPage: { ...shell.productPage, showAttributesTable: true, showReviews: true },
    sizeGuide: { charts: sizeCharts(opts.categoryIds, catByName) },
    home,
  };

  return blueprintSchema.parse(bp);
}

/** كل ملفات public/demo التي يشير إليها متجر العرض (للفحص دون اتصال وللاعتمادات). */
export function demoAssetPaths(bp: StoreBlueprint, rows: DemoProductRow[], variants: DemoVariant[]): string[] {
  const set = new Set<string>();
  const walk = (v: unknown) => {
    if (typeof v === "string") {
      if (v.startsWith("/demo/")) set.add(v);
    } else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(bp);
  for (const r of rows) r.images.forEach((i) => set.add(i.url));
  for (const v of variants) if (v.imageUrl) set.add(v.imageUrl);
  return [...set].sort();
}
