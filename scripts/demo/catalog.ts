// catalog.ts — متجر العرض V3 (demo.colapia.com): متجر أحذية واحد كامل، يُبنى بالمسار نفسه الذي يبني به أي تاجر متجره:
//   • الأقسام: planCategories ثم planCommit (دمج المترادفات وإنشاء الأقسام والمنتجات والتركيبات، نفس ما يفعله اعتماد الاستيراد).
//   • التصميم: defaultBlueprint ثم applyStarterTemplate("shoes") ثم applyHeroMedia (واجهة تُبنى من صور المنتجات).
//   • السمات: attributesFor("shoes") و cleanAttributes. جداول المقاسات: قوالب size-guide.
// الإضافات الخاصة بالعرض فقط: توزيع مخزون ثابت، تقييمات وأسئلة مُجابة توضيحية، أعمار منتجات. كلها حتمية (بذرة ثابتة).
//
// الصدق: كل ادعاء في الواجهة مشتق من سياسات المتجر نفسها (blueprint/facts)، والتقييمات موسومة توضيحية بلا شارة «موثّق»،
// وشريط الإعلانات وصفحة «عن المتجر» وصفحتا الدفع والطلب تقول إنه متجر عرض لا يشحن ولا يطلب دفعاً.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { blueprintSchema, type Section, type StoreBlueprint } from "../../src/blueprint/schema";
import { defaultBlueprint } from "../../src/blueprint/defaults";
import type { ThemeId } from "../../src/blueprint/themes";
import { storeFacts, type StoreFact } from "../../src/blueprint/facts";
import { applyHeroMedia } from "../../src/lib/design-tweak";
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
export const DEMO_NAME = "كولابيا للأحذية";
export const DEMO_MERCHANT_NAME = "Colapia Demo";
export const DEMO_DEFAULT_EMAIL = "demo@colapia.com";
export const DEMO_TEMPLATE = "shoes" as const;
/** تصميم المتجر يأتي من قالب البدء نفسه (midnight-mercury بالبطاقة الزئبقية)، لا من اختيار خاص بالعرض. */
export const DEMO_THEME: ThemeId = STARTER_TEMPLATES[DEMO_TEMPLATE].theme;
export const DEMO_NICHE = STARTER_TEMPLATES[DEMO_TEMPLATE].niche;
export const FREE_SHIPPING_OVER_PIASTERS = 300_000;
export const RETURN_DAYS = 14;
export const GENERAL_ETA = "من 2 إلى 5 أيام عمل";
export const DEMO_COUPON = { code: "DEMO10", percent: 10 } as const;
/** عدد المنتجات التي تحمل وسم «جديد» (أُضيفت خلال آخر 14 يوماً) عند الزرع. */
const FRESH_COUNT = 3;
const DAY = 864e5;
const HERO_ORIGIN = "https://demo.invalid";

export const DATA_DIR = join(process.cwd(), "scripts/demo/data");

// ─── بيانات الملفات ───────────────────────────────────────────────────────

export type DemoOption = { name: string; values: string[] };
export type DemoProduct = {
  slug: string; name: string; /** اسم القسم كما يكتبه التاجر؛ يمر بدمج المترادفات قبل الاعتماد. */ category: string; price: number; compareAt: number | null;
  shortDescription: string; description: string; material?: string; care?: string; tags: string[];
  options: DemoOption[]; stock: number; featured: boolean; isNew: boolean; images: string[]; alt: string[];
};

export function loadDemoProducts(dir = DATA_DIR): DemoProduct[] {
  return JSON.parse(readFileSync(join(dir, "shoes.json"), "utf8")) as DemoProduct[];
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

const HEX: Record<string, string> = { "كونياك": "#9a4f1f", "بني فاتح": "#a67c52", "كاميل": "#c19a6b", "بني": "#6b4423", "كحلي": "#1d2b4f" };
export const hexOf = (label: string): string | undefined => HEX[label] ?? colorFromName(label) ?? undefined;
export const isColorOption = (n: string) => /لون/.test(n);
export const isSizeOption = (n: string) => /مقاس/.test(n);

const SHOE_ATTRS = attributesFor(DEMO_NICHE);
export const ATTR_MATERIAL = SHOE_ATTRS.find((a) => a.key === "material")?.label ?? "الخامة";
export const ATTR_CARE = "العناية";

/** سمات المنتج بأسماء نشاط الأحذية نفسها التي يعرضها محرر المنتج، فيجدها التاجر معبأة في اللوحة. */
export function attributesOf(p: DemoProduct): AttrPair[] {
  return cleanAttributes([
    ...(p.material ? [{ label: ATTR_MATERIAL, value: p.material }] : []),
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
  const plan = planCategories(data.map((p) => ({ id: p.slug, category: p.category })));
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
  const merged = applyCategoryPlan(data.map(toCandidate), planCategories(data.map((p) => ({ id: p.slug, category: p.category }))));
  const plan = planCommit({ storeId, candidates: merged, existingCategories: [], existingSlugs: [], tracking: true, newId, sortOffset: { categories: 0, products: 0 } });
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
  pos: ["مريح من أول يوم دون أي ألم", "الشكل أنيق والنعل ثابت", "الجودة واضحة في الخياطة والخامة", "المقاس مطابق للجدول تماماً", "يتنسق مع أكثر من إطلالة", "الخامة ناعمة ولم تسبب أي احتكاك", "شكله في الحقيقة أجمل من الصور", "التشطيب نظيف والجلد بحالة ممتازة"],
  minor: ["يحتاج يومين ليلين قليلاً", "أضيق قليلاً من المعتاد عند الأصابع", "النعل أقسى قليلاً في البداية"],
  neg: ["المقاس أصغر من المعتاد", "لم يكن مريحاً في المشي الطويل"],
};
const CLOSERS = ["أنصح به", "يستحق سعره", "تجربة ممتازة بكل المقاييس", "من أفضل ما اشتريت مؤخراً"];
const ONE_STAR = ["لم يناسبني المنتج، والخامة مختلفة عما توقعت", "المنتج مختلف عن الصور ولم يناسبني"];
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
    if (p.material) qs.push({ q: "ما خامة هذا الحذاء؟", a: `${p.material}.` });
    const size = p.options.find((o) => isSizeOption(o.name));
    if (size && size.values.length > 1) {
      qs.push({
        q: "أي مقاس تنصحون به؟",
        a: `المقاسات المتاحة: ${size.values.join("، ")}. اختاروا مقاسكم المعتاد، ومن كان بين مقاسين فالأكبر أريح. والاستبدال متاح خلال ${RETURN_DAYS} يوماً من الاستلام إن لم يناسب المقاس.`,
      });
    } else if (p.care) qs.push({ q: "كيف أعتني بالحذاء؟", a: p.care });
    qs.slice(0, 2).forEach((q, k) => {
      const asked = born + (3 + ((i + k) % 7)) * DAY;
      out.push({ slug: p.slug, question: q.q, answer: q.a, askerName: first(REVIEWERS[(i * 7 + k * 3) % REVIEWERS.length]!), createdAt: new Date(asked), answeredAt: new Date(asked + (4 + k) * 3600_000) });
    });
  });
  return out;
}

// ─── دليل المقاسات (جدول واحد للأحذية، من قالب المنصة نفسه) ─────────────────

const row = (size: string, cells: string[]) => ({ size, cells, heightFrom: null, heightTo: null, weightFrom: null, weightTo: null });

/** الجدول بمعرّفات أقسام المتجر الحقيقية (appliesTo)، ويغطي المقاسات 36–45. */
export function sizeCharts(categoryIds: Record<string, string>): SizeChart[] {
  const tpl = SIZE_TEMPLATES.find((t) => t.key === "shoes")!.chart;
  return [
    {
      id: "szdemoshoes", ...tpl, name: "مقاسات الأحذية", appliesTo: Object.values(categoryIds),
      rows: [["36", "23.3"], ["37", "24"], ["38", "24.7"], ["39", "25.3"], ["40", "26"], ["41", "26.7"], ["42", "27.3"], ["43", "28"], ["44", "28.7"], ["45", "29.3"]].map(([s, c]) => row(s!, [c!])),
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
    { q: "هل هذا متجر حقيقي؟", a: "هذا متجر عرض من Colapia يوضح شكل المتجر الجاهز وتجربة الشراء كاملة. يمكن إضافة المنتجات إلى السلة وإتمام الطلب للتجربة، لكن الطلب يُسجَّل تجريبياً فلا يُشحن ولا يُطلب عنه أي مبلغ." },
    { q: "كيف أطلب؟", a: "باختيار المقاس واللون، ثم «إضافة للسلة»، ثم إكمال بيانات الشحن في صفحة إتمام الطلب." },
    { q: "كيف أختار المقاس المناسب؟", a: "في صفحة كل حذاء زر «دليل المقاسات»: يعرض الجدول بالمقاسات من 36 إلى 45 مع طول القدم بالسنتيمتر." },
    { q: "ما مدة التوصيل؟", a: `${GENERAL_ETA} حسب المحافظة، وتظهر المدة المتوقعة لكل محافظة في صفحة إتمام الطلب.` },
  ];
  if (has("cod")) items.push({ q: "هل الدفع عند الاستلام متاح؟", a: "نعم، الدفع نقداً عند استلام الطلب متاح لكل الطلبات." });
  if (has("inspection")) items.push({ q: "هل يمكن فتح الشحنة قبل الدفع؟", a: "نعم، يمكن فتح الشحنة وفحص المنتج مع المندوب قبل الدفع." });
  if (has("returns")) items.push({ q: "ما سياسة الاستبدال والاسترجاع؟", a: `الاستبدال والاسترجاع متاحان خلال ${RETURN_DAYS} يوماً من الاستلام، بشرط أن يكون المنتج بحالته الأصلية.` });
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

export function buildDemoBlueprint(opts: { storeId: string; email: string; categoryIds: Record<string, string>; productCount: number; data?: DemoProduct[] }): StoreBlueprint {
  const data = opts.data ?? loadDemoProducts();
  const base = defaultBlueprint({
    name: DEMO_NAME,
    tagline: "أحذية جلد وسويد بمقاسات من 36 إلى 45، في متجر عرض من Colapia",
    industry: "shoes",
    email: opts.email,
    inspectionAllowed: true,
    storeId: opts.storeId,
    productCount: opts.productCount,
    hasHeroImages: true,
    variationSeed: "demo-colapia-v3-shoes",
    toneOfVoice: "premium_formal",
  });

  // سياسات المتجر كما يضبطها التاجر في خطوات الإعداد.
  const policies: StoreBlueprint = {
    ...base,
    payments: { ...base.payments, cod: { ...base.payments.cod, enabled: true }, vodafoneCash: { enabled: false }, instapay: { enabled: false } },
    shipping: { ...base.shipping, freeOverPiasters: FREE_SHIPPING_OVER_PIASTERS, flatRatePiasters: null, generalEta: GENERAL_ETA, inspectionAllowed: true, pickupEnabled: false, giftEnabled: true, giftWrapPiasters: 0 },
    returns: { ...base.returns, windowDays: RETURN_DAYS, allowExchange: true, allowRefund: true },
  };
  // قالب البدء للأحذية: التصميم الكامل (منتصف الليل + بطاقات زئبقية) وتركيب الرئيسية.
  const templated = applyStarterTemplate(policies, DEMO_TEMPLATE);
  const facts = demoFacts(templated);
  const freeShipping = facts.some((f) => f.key === "free_shipping_over");

  // واجهة تُبنى من صور المنتجات بالمسار نفسه الذي يضغطه التاجر («تلقائي من منتجاتي»).
  const catalogRows = productRows(data, 0);
  const heroPicks = catalogRows.filter((r) => r.isFeatured).concat(catalogRows.filter((r) => !r.isFeatured)).slice(0, 4);
  const withHero = applyHeroMedia(templated, { kind: "auto" }, HERO_ORIGIN, heroPicks.map((r) => ({ url: `${HERO_ORIGIN}${r.images[0]!.url}`, alt: r.images[0]!.alt })));
  if ("error" in withHero) throw new Error(withHero.error);
  const shell = withHero.blueprint;

  const home: Section[] = shell.home.flatMap((s): Section[] => {
    if (s.type === "hero") {
      return [{
        ...s,
        images: s.images.map((i) => ({ ...i, url: i.url.replace(HERO_ORIGIN, "") })),
        eyebrow: "تشكيلة الموسم",
        headline: "خطوة واثقة في كل مناسبة",
        subheadline: "سنيكرز وكاجوال وكعب وبوت وصنادل بجلد وسويد، ودليل مقاسات يقترح المقاس المناسب. متجر عرض لتجربة الشراء كاملة.",
        primaryCta: cta("تسوقوا الآن", { type: "all_products" }),
        secondaryCta: cta("وصل حديثاً", { type: "section", sectionId: "new" }, "secondary"),
      }];
    }
    // لا مبيعات حقيقية في متجر العرض، فلا قسم «الأكثر مبيعاً»: مختارات يحددها المتجر.
    if (s.type === "product_grid" && s.id === "best") return [{ ...s, title: "مختارات المتجر", subtitle: "أحذية اخترناها لكم", source: { type: "featured" } }];
    if (s.type === "product_grid" && s.id === "new") {
      return [s, { ...s, id: "sale", background: "muted", variant: "grid", title: "عروض بأسعار مخفّضة", subtitle: "خصومات على السعر الأصلي", source: { type: "on_sale" }, limit: 8 }];
    }
    if (s.type === "trust_badges") return [{ ...s, spacing: "compact" }];
    if (s.type === "testimonials") return [{ ...s, title: "آراء العملاء", subtitle: "تقييمات توضيحية لمتجر العرض، وليست من طلبات حقيقية.", items: [], includeVerifiedReviews: true }];
    if (s.type === "faq") return [{ ...s, items: faqItems(facts) }];
    return [s];
  });
  const faqAt = home.findIndex((s) => s.type === "faq");
  const about: Section = {
    id: "about", type: "about", enabled: true, spacing: "normal", reveal: "fade", background: "muted", variant: "split", title: "عن متجر العرض",
    body: `${DEMO_NAME} متجر عرض أعدّه فريق Colapia ليُظهر شكل المتجر الجاهز ولوحة التحكم: أقسام للأحذية بأغلفتها، ومنتجات بمقاسات وألوان ومخزون، ودليل مقاسات، وتقييمات وأسئلة مُجابة، وتجربة شراء كاملة حتى تأكيد الطلب.\nالمنتجات والصور والتقييمات هنا للعرض فقط، والطلبات تُسجَّل تجريبياً فلا تُشحن ولا يُطلب عنها أي دفع.`,
    image: img(catalogRows[1]!.images[0]!.url, catalogRows[1]!.images[0]!.alt, 0.5),
    stats: [], milestones: [],
  };
  home.splice(faqAt < 0 ? home.length : faqAt, 0, about);

  const bp: StoreBlueprint = {
    ...shell,
    brand: {
      ...shell.brand,
      description: "متجر عرض من Colapia يوضح شكل المتجر الجاهز وتجربة الشراء ولوحة التحكم. المنتجات والصور للعرض فقط.",
      voice: "premium_formal",
    },
    header: {
      ...shell.header,
      transparentOnHero: false,
      announcement: {
        enabled: true, dismissible: true, rotate: true,
        items: [
          { text: "متجر عرض من Colapia: الطلبات هنا تجريبية ولا تُشحن" },
          ...(freeShipping ? [{ text: `شحن مجاني للطلبات بقيمة ${formatEgp(FREE_SHIPPING_OVER_PIASTERS)} فأكثر`, target: { type: "all_products" as const } }] : []),
          { text: `كود ${DEMO_COUPON.code} لتجربة الخصم عند إتمام الطلب`, target: { type: "section" as const, sectionId: "sale" } },
        ],
      },
      // القائمة الافتراضية كما هي: الواجهة تضيف أقسام المتجر إليها تلقائياً.
    },
    footer: { ...shell.footer, tagline: "متجر عرض من Colapia: المنتجات للعرض والطلبات تجريبية." },
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
      description: "تصفحوا متجر أحذية كاملاً كما يراه الزبائن: أقسام ومقاسات وألوان ودليل مقاسات وتجربة شراء تجريبية.",
      // متجر عرض لا يبيع فعلاً: لا يُفهرس في محركات البحث.
      noIndex: true,
    },
    productPage: { ...shell.productPage, showAttributesTable: true, showReviews: true },
    sizeGuide: { charts: sizeCharts(opts.categoryIds) },
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
