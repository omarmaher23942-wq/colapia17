// catalog.ts — متجر العرض V3 (demo.colapia.com) كبيانات ومنطق خالص بلا قاعدة بيانات:
// المنتجات بسمات نشاط الأزياء وتركيبات المقاس × اللون ومخزونها، والتقييمات والأسئلة المُجابة، وجداول المقاسات،
// والـ Blueprint بالتصميم الافتراضي «منتصف الليل» (بطاقات زئبقية) وواجهة فيديو. نتائجه حتمية تماماً (عشوائية بذرة ثابتة).
// يستخدمه سكربت الزرع (seed-demo.ts) وسكربت الفحص دون اتصال (verify-demo.ts) واختبار vitest.
//
// الصدق: كل ادعاء في الواجهة مشتق من سياسات المتجر نفسها (blueprint/facts)، والتقييمات موسومة توضيحية بلا شارة «موثّق»،
// وشريط الإعلانات وصفحة «عن المتجر» وصفحتا الدفع والطلب تقول إنه متجر عرض لا يشحن ولا يطلب دفعاً.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { blueprintSchema, type Section, type StoreBlueprint } from "../../src/blueprint/schema";
import { defaultBlueprint } from "../../src/blueprint/defaults";
import { applyTheme, type ThemeId } from "../../src/blueprint/themes";
import { storeFacts, type StoreFact } from "../../src/blueprint/facts";
import { buildSearchText } from "../../src/lib/arabic";
import { colorFromName } from "../../src/lib/color-names";
import { defaultShippingZones } from "../../src/lib/egypt";
import { formatEgp } from "../../src/lib/money";
import { attributesFor, cleanAttributes, type AttrPair } from "../../src/lib/niche-attributes";
import { SIZE_TEMPLATES, type SizeChart } from "../../src/lib/size-guide";

// ─── الثوابت ──────────────────────────────────────────────────────────────

export const DEMO_SUB = "demo";
export const DEMO_NAME = "كولابيا ستايل";
export const DEMO_MERCHANT_NAME = "Colapia Demo";
export const DEMO_DEFAULT_EMAIL = "demo@colapia.com";
export const DEMO_THEME: ThemeId = "midnight-mercury";
export const DEMO_NICHE = "fashion" as const;
export const HERO_VIDEO = "/demo/media/hero-fashion.mp4";
export const HERO_POSTER = "/demo/media/hero-fashion.webp";
export const FREE_SHIPPING_OVER_PIASTERS = 150_000;
export const RETURN_DAYS = 14;
export const GENERAL_ETA = "من 2 إلى 5 أيام عمل";
export const DEMO_COUPON = { code: "DEMO10", percent: 10 } as const;
/** خصم الكمية على قطع أساسية مختارة (يظهر في صفحة المنتج وفي قسم «اشتروا أكثر ووفّروا»). */
export const VOLUME_TIERS = [
  { minQty: 2, percentOff: 5 },
  { minQty: 3, percentOff: 10 },
] as const;
/** قطع أساسية متوفرة بلا سعر مشطوب (فلا يتكرر المنتج بين «العروض» و«خصم الكمية»). */
export const VOLUME_SLUGS = ["classic-white-crew-tee", "essential-black-tee", "olive-cotton-tee", "black-pullover-hoodie", "classic-indigo-jeans", "stone-cotton-chinos"] as const;
/** عدد المنتجات التي تحمل وسم «جديد» (أُضيفت خلال آخر 14 يوماً) عند الزرع. */
const FRESH_COUNT = 14;
const DAY = 864e5;

export const DATA_DIR = join(process.cwd(), "scripts/demo/data");

export const CATEGORIES: readonly { key: string; name: string; description: string }[] = [
  { key: "tshirts", name: "تيشيرتات", description: "قطع قطنية أساسية للاستعمال اليومي." },
  { key: "shirts", name: "قمصان", description: "قمصان كتان وقطن ودنيم بقصّات مريحة." },
  { key: "hoodies", name: "هوديز وكنزات", description: "طبقات دافئة للأيام الباردة." },
  { key: "jackets", name: "جاكيتات ومعاطف", description: "جاكيتات ومعاطف بخامات وقصّات متنوعة." },
  { key: "pants", name: "بناطيل", description: "جينز وتشينو وجوغر لكل المناسبات." },
  { key: "dresses", name: "فساتين وعبايات", description: "فساتين وعبايات للمناسبات واليوم العادي." },
  { key: "shoes", name: "أحذية", description: "سنيكرز وكلاسيك وصنادل وبوتات." },
  { key: "bags", name: "حقائب", description: "حقائب يد وكتف وظهر وحافظات بطاقات." },
  { key: "accessories", name: "إكسسوارات", description: "ساعات ونظارات وإيشاربات وتفاصيل تكمل الإطلالة." },
];

// ─── بيانات الملفات ───────────────────────────────────────────────────────

export type DemoOption = { name: string; values: string[] };
export type DemoProduct = {
  slug: string; name: string; category: string; price: number; compareAt: number | null;
  shortDescription: string; description: string; material?: string; care?: string; tags: string[];
  options: DemoOption[]; stock: number; featured: boolean; isNew: boolean; images: string[]; alt: string[];
};

export function loadDemoProducts(dir = DATA_DIR): DemoProduct[] {
  const out: DemoProduct[] = [];
  for (const c of CATEGORIES) out.push(...(JSON.parse(readFileSync(join(dir, `${c.key}.json`), "utf8")) as DemoProduct[]));
  return out;
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

// ألوان بأسمائها المركّبة في البيانات (ما لا يُذكر هنا يُطابَق بالاسم في color-names).
const HEX: Record<string, string> = {
  "أسود ونحاسي": "#1c1917", "فضي وكحلي": "#27364d", "تورتواز بني": "#8a5a3c", "برتقالي وأزرق": "#e8731a",
  "موكا بنقشة بنية": "#8b6a52", "برقوقي": "#5b2a4a", "روز مطفي": "#c98f94", "أبيض بنقشة زرقاء وخوخية": "#f1efe9",
  "أخضر عشبي": "#4d7a3c", "أحمر كرزي": "#b3122f", "بني محمر": "#8b4a2f", "أسود مغسول": "#33353a",
  "نيلي": "#1f2a56", "أزرق متوسط": "#3b6bb0", "أزرق داكن": "#1d3557", "أزرق فاتح": "#9dbcd9", "حجري": "#b9b2a3",
  "رملي": "#d8c6a5", "كونياك": "#9a4f1f", "بني فاتح": "#a67c52", "كاميل": "#c19a6b", "نعناعي فاتح": "#bfe9d8",
  "وردي فاتح": "#f6c9d4", "أخضر مريمي": "#a5b8a0", "عاجي بخطوط حمراء": "#f3ecdf", "عاجي": "#f3ecdf",
  "رمادي ميلانج": "#a8a9ad", "بيج كتان": "#d9ccb2", "كريمي": "#f1e8d6", "زيتي": "#5b6b2f", "كاكي": "#b5a77a",
};
export const hexOf = (label: string): string | undefined => HEX[label] ?? colorFromName(label) ?? undefined;
export const isColorOption = (n: string) => /لون/.test(n);
export const isSizeOption = (n: string) => /مقاس/.test(n);

// القَصّة كما تصفها البيانات صراحة (قيم سمة «القَصّة» في نشاط الأزياء). ما لا يُذكر وصفه بوضوح لا يُخمَّن.
const FIT: Record<string, string> = {
  "classic-white-crew-tee": "عادية", "essential-black-tee": "عادية", "olive-cotton-tee": "عادية", "soft-cotton-mint-tee": "عادية",
  "sand-curved-hem-tee": "عادية", "tipped-red-polo": "عادية", "heavyweight-boxy-white-tee": "واسعة", "oversized-black-tee": "أوفر سايز",
  "natural-linen-band-collar-shirt": "عادية", "navy-linen-short-sleeve-shirt": "عادية", "sage-button-down-shirt": "عادية", "indigo-denim-shirt": "عادية",
  "ivory-corduroy-overshirt": "واسعة", "sand-camp-collar-shirt": "واسعة",
  "black-pullover-hoodie": "عادية", "lavender-hoodie": "عادية", "ivory-fleece-hoodie": "عادية", "oatmeal-v-neck-sweater": "عادية",
  "heather-grey-oversized-hoodie": "أوفر سايز", "sand-oversized-crewneck": "أوفر سايز", "mocha-cropped-hoodie": "واسعة", "camel-roll-neck-sweater": "واسعة",
  "tan-shearling-aviator-jacket": "عادية",
  "classic-indigo-jeans": "عادية", "stone-cotton-chinos": "عادية", "sand-cargo-joggers": "عادية",
  "tie-waist-wide-leg-denim": "واسعة", "black-wide-leg-lounge-pants": "واسعة", "beige-crepe-wide-leg-trousers": "واسعة",
  "dusty-rose-embroidered-abaya": "واسعة", "black-satin-shirt-dress": "أوفر سايز",
};
export const FIT_SLUGS = Object.keys(FIT);

const FASHION_ATTRS = attributesFor(DEMO_NICHE);
const label = (key: string) => FASHION_ATTRS.find((a) => a.key === key)?.label ?? key;
export const ATTR_MATERIAL = label("material");
export const ATTR_FIT = label("fit");
export const ATTR_CARE = "العناية";
/** قيم «القَصّة» المقترحة في محرر المنتج (القائمة نفسها التي يراها التاجر). */
export const FIT_VALUES = FASHION_ATTRS.find((a) => a.key === "fit")?.values ?? [];

/** سمات المنتج بأسماء نشاط الأزياء نفسها التي يعرضها محرر المنتج، فيجدها التاجر معبأة في اللوحة. */
export function attributesOf(p: DemoProduct): AttrPair[] {
  return cleanAttributes([
    ...(p.material ? [{ label: ATTR_MATERIAL, value: p.material }] : []),
    ...(FIT[p.slug] ? [{ label: ATTR_FIT, value: FIT[p.slug]! }] : []),
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

// ─── صفوف المنتجات ────────────────────────────────────────────────────────

export type DemoProductRow = {
  categoryKey: string; name: string; slug: string; shortDescription: string; description: string;
  pricePiasters: number; compareAtPiasters: number | null; costPiasters: number; stock: number; trackStock: true;
  images: { url: string; alt: string }[]; attributes: AttrPair[];
  optionNames: string[]; optionMeta: { name: string; kind: "color" | "size" | "custom"; values: { label: string; hex?: string }[] }[];
  tags: string[]; isFeatured: boolean; volumeTiers: { minQty: number; percentOff: number }[];
  searchText: string; sortOrder: number; createdAt: Date;
};

/** ترتيب العرض: دوري بين الأقسام، فتظهر «كل المنتجات» و«المختارات» متنوعة، ويبقى ترتيب كل قسم كما في بياناته. */
function roundRobin(data: DemoProduct[]): Map<string, number> {
  const queues = CATEGORIES.map((c) => data.filter((p) => p.category === c.key));
  const order = new Map<string, number>();
  for (let i = 0, n = 0; order.size < data.length; i++) for (const q of queues) if (q[i]) order.set(q[i]!.slug, n++);
  return order;
}

/** عمر كل منتج بالأيام عند الزرع: أحدث FRESH_COUNT منتجاً (موزعة على الأقسام) داخل نافذة «جديد»، والباقي أقدم متدرجاً. */
function agesInDays(data: DemoProduct[], order: Map<string, number>): Map<string, number> {
  const ages = new Map<string, number>();
  const fresh = data.filter((p) => p.isNew).sort((a, b) => order.get(a.slug)! - order.get(b.slug)!);
  fresh.forEach((p, k) => ages.set(p.slug, k < FRESH_COUNT ? 1 + Math.floor((k * 12) / FRESH_COUNT) : 16 + (k - FRESH_COUNT) * 2));
  data.forEach((p, i) => {
    if (!ages.has(p.slug)) ages.set(p.slug, 45 + ((i * 7) % 150));
  });
  return ages;
}

export function productRows(data: DemoProduct[], now: number): DemoProductRow[] {
  const order = roundRobin(data);
  const ages = agesInDays(data, order);
  const volume = new Set<string>(VOLUME_SLUGS);
  return data.map((p) => {
    const variants = variantsOf(p);
    const stock = variants.length ? variants.reduce((a, v) => a + v.stock, 0) : Math.max(0, p.stock);
    const tags = p.tags.filter((t) => !STATUS_TAGS.has(t));
    return {
      categoryKey: p.category, name: p.name, slug: p.slug, shortDescription: p.shortDescription, description: p.description,
      pricePiasters: p.price * 100, compareAtPiasters: p.compareAt && p.compareAt > p.price ? p.compareAt * 100 : null,
      // تكلفة تقديرية للعرض (تُظهر «الربح التقديري» في لوحة التحكم).
      costPiasters: Math.round(p.price * 100 * 0.55),
      // مخزون المنتج = مجموع تركيباته (القاعدة العامة في المنصة).
      stock, trackStock: true,
      images: p.images.map((u, k) => ({ url: u, alt: p.alt[k] ?? p.name })),
      attributes: attributesOf(p),
      optionNames: p.options.map((o) => o.name),
      optionMeta: p.options.map((o) => ({
        name: o.name,
        kind: isColorOption(o.name) ? ("color" as const) : isSizeOption(o.name) ? ("size" as const) : ("custom" as const),
        values: o.values.map((l) => (isColorOption(o.name) ? { label: l, hex: hexOf(l) } : { label: l })),
      })),
      tags, isFeatured: p.featured,
      volumeTiers: volume.has(p.slug) ? VOLUME_TIERS.map((t) => ({ ...t })) : [],
      searchText: buildSearchText([p.name, p.shortDescription, ...tags]),
      sortOrder: order.get(p.slug)!,
      createdAt: new Date(now - ages.get(p.slug)! * DAY),
    };
  });
}

// ─── التقييمات: نصوص عربية واقعية لكل قسم، بلا جنس للمتكلم، وبلا أي ادعاء «موثّق» ──────

type Lines = { pos: string[]; minor: string[]; neg: string[] };
const REVIEW_LINES: Record<string, Lines> = {
  tshirts: {
    pos: ["الخامة ناعمة والقصة مضبوطة، وشكلها ثابت بعد الغسيل", "قطعة أساسية تُلبس مع كل شيء، واللون مطابق للصور", "القطن مريح جداً في الحر ولا يلتصق بالجسم", "الخياطة نظيفة والرقبة لم تتمدد بعد عدة غسلات", "المقاس مطابق لجدول المقاسات تماماً", "جودة واضحة بالنسبة للسعر", "اللون ثابت ولم يبهت بعد الغسيل", "تُلبس وحدها أو تحت قميص مفتوح بشكل جميل"],
    minor: ["كان الأفضل لو الطول أكبر قليلاً", "اللون أفتح بدرجة من الصورة", "يحتاج كيّاً خفيفاً بعد الغسيل"],
    neg: ["الخامة أخف مما توقعت", "المقاس أصغر من المعتاد، والأفضل طلب مقاس أكبر"],
  },
  shirts: {
    pos: ["القماش خفيف وأنيق ومريح طوال اليوم", "الخياطة نظيفة والأزرار متينة", "يصلح للعمل وللخروج، وشكله مرتب في الحالتين", "القصة مريحة بلا ضيق عند الكتفين", "اللون هادئ ويتنسق بسهولة مع البناطيل الفاتحة والداكنة", "الياقة تحافظ على شكلها طوال اليوم", "شكله في الحقيقة أجمل من الصور"],
    minor: ["يتجعد بسرعة ويحتاج كيّاً", "الأكمام أطول قليلاً من المتوقع", "اللون أغمق قليلاً من الصورة"],
    neg: ["القماش أرق مما توقعت", "الياقة لم تحافظ على شكلها بعد الغسيل"],
  },
  hoodies: {
    pos: ["دافئ ومريح، والقماش يحافظ على شكله بعد الغسيل", "القصة عصرية واللون هادئ ويتنسق بسهولة", "الخامة ناعمة من الداخل ولا تسبب أي حكة", "مناسب تماماً لأيام الشتاء المعتادة", "تفاصيل الأساور والحافة متقنة", "يُلبس مع الجينز والبناطيل الرياضية بسهولة", "شكله في الحقيقة أجمل من الصور"],
    minor: ["أوسع قليلاً من المتوقع، والمقاس المعتاد كافٍ", "اللون أغمق بدرجة من الصورة", "ظهر عليه وبر خفيف بعد عدة غسلات"],
    neg: ["ليس دافئاً بما يكفي للبرد الشديد", "الأساور أضيق من المعتاد"],
  },
  jackets: {
    pos: ["شكله فخم والخامة قوية", "التفاصيل والخياطة ممتازة، ويتنسق مع أكثر من إطلالة", "القصة مريحة وتسمح بطبقة تحته", "الإغلاق متين ويعمل بسلاسة", "قطعة تستحق الاستثمار فيها", "التشطيب من الداخل نظيف ومتقن", "شكله في الحقيقة أجمل من الصور"],
    minor: ["الأكمام أطول قليلاً في مقاسي", "أثقل قليلاً مما توقعت", "يحتاج بعض الوقت حتى يلين"],
    neg: ["المقاس أصغر من الجدول، والأفضل مقاس أكبر", "اللون مختلف قليلاً عن الصورة"],
  },
  pants: {
    pos: ["القصة مريحة وتقعد جيداً", "القماش متين والخياطة نظيفة", "الخصر مضبوط والطول مناسب", "يصلح للعمل وللخروج", "الخامة لا تتجعد بسهولة", "يتنسق مع التيشيرتات والقمصان بسهولة", "اللون مطابق للصور تماماً"],
    minor: ["الطول أكبر قليلاً ويحتاج تقصيراً", "اللون أغمق قليلاً من الصورة", "الجيوب أصغر مما توقعت"],
    neg: ["الخصر أضيق من المقاس المكتوب", "الخامة أخف مما توقعت"],
  },
  dresses: {
    pos: ["القماش منسدل والقصة أنيقة", "اللون مطابق للصور تماماً", "التفاصيل دقيقة ومنظمة", "مريح طوال اليوم رغم أناقته", "الطول مضبوط ومناسب", "الخياطة نظيفة من الداخل والخارج", "شكله في الحقيقة أجمل من الصور"],
    minor: ["يحتاج كيّاً قبل اللبس", "البطانة أخف مما توقعت", "الأكمام أوسع قليلاً من المتوقع"],
    neg: ["الطول أقصر من المتوقع بالنسبة للمقاس", "الخامة أخف مما ظهر في الصور"],
  },
  shoes: {
    pos: ["مريح من أول يوم دون أي ألم", "الشكل أنيق والنعل ثابت", "الجودة واضحة في الخياطة والخامة", "المقاس مطابق للجدول تماماً", "يتنسق مع أكثر من إطلالة", "الخامة ناعمة ولم تسبب أي احتكاك", "شكله في الحقيقة أجمل من الصور"],
    minor: ["يحتاج يومين ليلين قليلاً", "أضيق قليلاً من المعتاد عند الأصابع", "النعل أقسى قليلاً في البداية"],
    neg: ["المقاس أصغر من المعتاد", "لم يكن مريحاً في المشي الطويل"],
  },
  bags: {
    pos: ["الخامة ممتازة والخياطة متقنة", "مساحتها مناسبة للأغراض اليومية", "شكلها راقٍ وتتنسق مع أي لبس", "الإكسسوارات المعدنية متينة والبطانة نظيفة", "خفيفة ومريحة في الحمل", "التشطيب نظيف في كل التفاصيل", "شكلها في الحقيقة أجمل من الصور"],
    minor: ["الجيب الداخلي أصغر قليلاً", "أصغر قليلاً مما توقعت", "اللون أفتح بدرجة من الصورة"],
    neg: ["أصغر من تصوري بكثير", "اللون مختلف عن الصورة"],
  },
  accessories: {
    pos: ["التصميم أنيق والتفاصيل أجمل من الصور", "مناسبة جداً كهدية", "تكمل الإطلالة بلمسة بسيطة", "الجودة ممتازة بالنسبة للسعر", "تفاصيلها متقنة وتشطيبها نظيف", "شكلها في الحقيقة أجمل من الصور"],
    minor: ["أصغر قليلاً مما توقعت", "اللون مختلف بدرجة عن الصورة"],
    neg: ["التفاصيل أبسط من توقعي", "لم تكن كما توقعت من الصور"],
  },
};
const CLOSERS = ["أنصح بالمنتج", "يستحق سعره", "تجربة ممتازة بكل المقاييس", "من أفضل ما اشتريت مؤخراً"];
const ONE_STAR = ["لم يناسبني المنتج، والخامة مختلفة عما توقعت", "المنتج مختلف عن الصور ولم يناسبني"];
const REVIEWERS = [
  "سارة أ.", "محمد ع.", "منة الله ح.", "أحمد س.", "ياسمين ف.", "كريم ع.", "هبة م.", "مصطفى ر.", "نورهان إ.", "عمر ط.", "دعاء ص.",
  "يوسف ن.", "رنا خ.", "طارق ج.", "ندى ب.", "إسلام ك.", "مريم ل.", "حسام و.", "آية ز.", "شادي ه.", "ملك ي.", "باسم ق.", "فرح د.",
  "علي م.", "سلمى ر.", "زياد ت.", "جنى ع.", "خالد ف.", "هالة س.", "مازن ب.",
];

/** صيغ التقييم لكل نجمة: نص فريد مركّب من جمل القسم، ومعه «أصله» (الجملة الأساسية) لتنويع التقييمات المتتالية. */
function bodiesFor(category: string, rating: number): { body: string; base: string }[] {
  const l = REVIEW_LINES[category]!;
  const out: { body: string; base: string }[] = [];
  if (rating === 5) for (const p of l.pos) out.push({ body: `${p}.`, base: p }, ...CLOSERS.map((c) => ({ body: `${p}. ${c}.`, base: p })));
  else if (rating === 4) for (const p of l.pos) for (const m of l.minor) out.push({ body: `${p}، لكن ${m}.`, base: p });
  else if (rating === 3) for (const m of l.minor) out.push({ body: `مقبول بشكل عام، لكن ${m}.`, base: m }, { body: `جيد بالنسبة للسعر، لكن ${m}.`, base: m });
  else if (rating === 2) for (const n of l.neg) out.push({ body: `${n}.`, base: n }, { body: `${n}، ولم يناسبني في النهاية.`, base: n });
  else out.push(...ONE_STAR.map((x) => ({ body: `${x}.`, base: x })));
  return out;
}

export type DemoReview = { slug: string; customerName: string; rating: number; body: string; createdAt: Date };

/**
 * التقييمات: ≈70% من المنتجات التي مضى على إضافتها 21 يوماً فأكثر (المنتج الجديد بلا تقييمات بعد)، 2–6 لكل منتج،
 * بتوزيع واقعي ليس كله 5 نجوم، وكل تقييم بعد إضافة منتجه بيومين على الأقل، وكل نص فريد في المتجر كله.
 */
export function reviewsFor(data: DemoProduct[], rows: DemoProductRow[], now: number): DemoReview[] {
  const rnd = makeRng(19102026);
  const createdAt = new Map(rows.map((r) => [r.slug, r.createdAt.getTime()]));
  const used = new Set<string>();
  // الجمل الأساسية المستخدمة في كل قسم: تُفضَّل جملة لم تُستخدم بعد، فلا تتشابه تقييمات القسم الواحد.
  const usedBase = new Map<string, Set<string>>();
  const out: DemoReview[] = [];
  const COUNTS = [2, 3, 3, 4, 4, 5, 6];
  let nameCursor = 0;
  for (const p of data) {
    const born = createdAt.get(p.slug)!;
    if (now - born < 21 * DAY || rnd() > 0.7) continue;
    const n = COUNTS[Math.floor(rnd() * COUNTS.length)]!;
    for (let k = 0; k < n; k++) {
      const x = rnd();
      const rating = x < 0.55 ? 5 : x < 0.83 ? 4 : x < 0.94 ? 3 : x < 0.98 ? 2 : 1;
      const bases = usedBase.get(p.category) ?? new Set<string>();
      usedBase.set(p.category, bases);
      const fresh = bodiesFor(p.category, rating).filter((b) => !used.has(b.body));
      const unseen = fresh.filter((b) => !bases.has(b.base));
      const pool = unseen.length ? unseen : fresh;
      if (!pool.length) continue;
      const pick = pool[Math.floor(rnd() * pool.length)]!;
      if (!unseen.length) bases.clear();
      used.add(pick.body);
      bases.add(pick.base);
      const body = pick.body;
      const span = Math.max(1, Math.floor((now - born) / DAY) - 3);
      out.push({
        slug: p.slug,
        customerName: REVIEWERS[nameCursor++ % REVIEWERS.length]!,
        rating,
        body,
        createdAt: new Date(born + (2 + Math.floor(rnd() * span)) * DAY),
      });
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
    if (i % 5 !== 2 || now - born < 14 * DAY) return;
    const qs: { q: string; a: string }[] = [];
    if (p.material) qs.push({ q: "ما خامة هذا المنتج؟", a: `${p.material}.` });
    const size = p.options.find((o) => isSizeOption(o.name));
    if (size && size.values.length > 1) {
      qs.push({
        q: "أي مقاس تنصحون به؟",
        a: `المقاسات المتاحة: ${size.values.join("، ")}. اختاروا مقاسكم المعتاد، ومن كان بين مقاسين فالأكبر أريح. والاستبدال متاح خلال ${RETURN_DAYS} يوماً من الاستلام إن لم يناسب المقاس.`,
      });
    } else if (p.care) qs.push({ q: "كيف أعتني بالقطعة؟", a: p.care });
    qs.slice(0, 2).forEach((q, k) => {
      const asked = born + (3 + ((i + k) % 7)) * DAY;
      out.push({ slug: p.slug, question: q.q, answer: q.a, askerName: first(REVIEWERS[(i * 7 + k * 3) % REVIEWERS.length]!), createdAt: new Date(asked), answeredAt: new Date(asked + (4 + k) * 3600_000) });
    });
  });
  return out;
}

// ─── جداول المقاسات (دليل المقاسات في صفحة المنتج) ─────────────────────────

const tpl = (key: string) => SIZE_TEMPLATES.find((t) => t.key === key)!.chart;
const row = (size: string, cells: string[], h?: [number, number], w?: [number, number]) => ({
  size, cells, heightFrom: h?.[0] ?? null, heightTo: h?.[1] ?? null, weightFrom: w?.[0] ?? null, weightTo: w?.[1] ?? null,
});

/** الجداول بمعرّفات أقسام المتجر الحقيقية (appliesTo). كل جدول يغطي مقاسات منتجات أقسامه، ومقاس لا يغطيه لا يعرض جدولاً. */
export function sizeCharts(categoryIds: Record<string, string>): SizeChart[] {
  const ids = (...keys: string[]) => keys.map((k) => categoryIds[k]).filter((x): x is string => Boolean(x));
  const tops = tpl("tops");
  return [
    { id: "szdemotops", ...tops, name: "مقاسات القطع العلوية", appliesTo: ids("tshirts", "shirts", "hoodies", "jackets"), note: "القياس والقطعة مفرودة على سطح مستوٍ. للقصّات الواسعة يكفي المقاس المعتاد." },
    { id: "szdemojeans", ...tpl("pants"), name: "مقاسات الجينز", appliesTo: ids("pants"), note: "المقاس = محيط الوسط بالإنش تقريباً." },
    {
      id: "szdemopants", name: "مقاسات البناطيل", appliesTo: ids("pants"), unit: "سم", columns: ["الوسط", "طول الرجل"], note: "القياس والبنطلون مفرود على سطح مستوٍ.",
      rows: [row("S", ["74", "100"], [158, 168], [52, 64]), row("M", ["80", "102"], [165, 174], [62, 74]), row("L", ["86", "104"], [171, 180], [72, 84]), row("XL", ["92", "106"], [176, 186], [82, 94]), row("XXL", ["98", "108"], [182, 192], [92, 106])],
    },
    { id: "szdemodress", ...tpl("dresses"), name: "مقاسات الفساتين", appliesTo: ids("dresses") },
    {
      id: "szdemoabaya", name: "أطوال العبايات", appliesTo: ids("dresses"), unit: "سم", columns: ["طول العباية"], note: "رقم المقاس هو طول العباية بالإنش، ويُختار حسب الطول.",
      rows: [row("52", ["132"], [150, 155]), row("54", ["137"], [155, 160]), row("56", ["142"], [160, 165]), row("58", ["147"], [165, 170]), row("60", ["152"], [170, 176])],
    },
    {
      id: "szdemoshoes", ...tpl("shoes"), name: "مقاسات الأحذية", appliesTo: ids("shoes"),
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
const S = { enabled: true, spacing: "normal" as const, reveal: "fade" as const };

const pct = (n: number) => `${n}%`;
export const volumeLine = () =>
  VOLUME_TIERS.map((t, i) => `${i ? "و" : "خصم "}${pct(t.percentOff)} عند شراء ${t.minQty === 2 ? "قطعتين" : `${t.minQty} قطع${i === VOLUME_TIERS.length - 1 ? " فأكثر" : ""}`}`).join(" ") + " من المنتج نفسه";

/**
 * أسئلة شائعة: كل سؤال عن سياسة يُضاف فقط إن كانت حقيقة في المتجر (blueprint/facts)، وبأرقام الحقيقة نفسها،
 * فيمر بفحص groundedItems عند العرض كما هو. وسؤال صريح عن طبيعة متجر العرض.
 */
export function faqItems(facts: StoreFact[]): { q: string; a: string }[] {
  const has = (key: string) => facts.some((x) => x.key === key);
  const items: { q: string; a: string }[] = [
    { q: "هل هذا متجر حقيقي؟", a: "هذا متجر عرض من Colapia يوضح شكل المتجر الجاهز وتجربة الشراء كاملة. يمكن إضافة المنتجات إلى السلة وإتمام الطلب للتجربة، لكن الطلب يُسجَّل تجريبياً فلا يُشحن ولا يُطلب عنه أي مبلغ." },
    { q: "كيف أطلب؟", a: "باختيار المنتج والمقاس واللون، ثم «إضافة للسلة»، ثم إكمال بيانات الشحن في صفحة إتمام الطلب." },
    { q: "كيف أختار المقاس المناسب؟", a: "في صفحة كل منتج بمقاسات زر «دليل المقاسات»: يعرض القياسات بالسنتيمتر، ويقترح المقاس من الطول والوزن." },
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
  onboarding: { nicheKind: DEMO_NICHE },
  // علامة متجر العرض: كل طلب فيه تجريبي بلا بريد (lib/demo-store.ts)، ومستثنى من التقارير الشهرية.
  prefs: { demo: true },
});

export function buildDemoBlueprint(opts: { storeId: string; email: string; categoryIds: Record<string, string>; productCount: number }): StoreBlueprint {
  const base = defaultBlueprint({
    name: DEMO_NAME,
    tagline: "أزياء يومية بخامات مدروسة، في متجر عرض من Colapia",
    industry: DEMO_NICHE,
    email: opts.email,
    inspectionAllowed: true,
    storeId: opts.storeId,
    productCount: opts.productCount,
    hasHeroImages: true,
    variationSeed: "demo-colapia-v3",
    toneOfVoice: "premium_formal",
  });

  const policies: StoreBlueprint = {
    ...base,
    payments: { ...base.payments, cod: { ...base.payments.cod, enabled: true }, vodafoneCash: { enabled: false }, instapay: { enabled: false } },
    shipping: { ...base.shipping, freeOverPiasters: FREE_SHIPPING_OVER_PIASTERS, flatRatePiasters: null, generalEta: GENERAL_ETA, inspectionAllowed: true, pickupEnabled: false },
    returns: { ...base.returns, windowDays: RETURN_DAYS, allowExchange: true, allowRefund: true },
  };
  const facts = demoFacts(policies);
  const freeShipping = facts.some((f) => f.key === "free_shipping_over");
  const trust = base.home.find((x) => x.type === "trust_badges");

  const home: Section[] = [
    {
      id: "hero", type: "hero", ...S, background: "default", variant: "video",
      eyebrow: "تشكيلة الموسم",
      headline: "أناقة يومية بخامات مدروسة",
      subheadline: "ملابس وأحذية وإكسسوارات بمقاسات وألوان واضحة، ودليل مقاسات يقترح المقاس المناسب. متجر عرض لتجربة الشراء كاملة.",
      images: [img(HERO_POSTER, "ملابس كتان بألوان هادئة على علّاقات خشبية بجانب مانيكان", 0.5)],
      videoUrl: HERO_VIDEO,
      highlights: [],
      primaryCta: cta("تسوقوا الآن", { type: "all_products" }),
      secondaryCta: cta("وصل حديثاً", { type: "section", sectionId: "new" }, "secondary"),
      overlayOpacity: 0.4, textAlign: "start", height: "screen", autoplayMs: 5000,
      enableParallax: false, enableKineticTypography: false, enableAmbientGlow: false,
    },
    { id: "cats", type: "categories", ...S, background: "default", variant: "grid", title: "تسوقوا حسب القسم", categorySlugs: [], showProductCount: true },
    { id: "new", type: "product_grid", ...S, background: "default", variant: "grid", title: "وصل حديثاً", subtitle: "أحدث القطع في المتجر", source: { type: "newest" }, limit: 8, columnsMobile: 2, columnsDesktop: 4, showViewAll: true, quickAdd: true },
    {
      id: "editorial", type: "promo_banner", ...S, background: "default", variant: "split_duo",
      items: [
        { title: "قمصان بقصّات مريحة وخامات طبيعية", text: "كتان وقطن ودنيم بألوان هادئة تتنسق بسهولة.", image: img("/demo/editorial/banner-new.webp", "ثلاثة عارضين بقمصان وجاكيتات بألوان محايدة"), cta: cta("اكتشفوا القمصان", { type: "category", slug: "shirts" }) },
        { eyebrow: "كود تجريبي", title: `خصم ${pct(DEMO_COUPON.percent)} بكود ${DEMO_COUPON.code}`, text: "يعمل عند إتمام الطلب لتجربة أكواد الخصم في متجر العرض.", image: img("/demo/editorial/banner-sale.webp", "رف فساتين وبلوزات بألوان دافئة"), couponCode: DEMO_COUPON.code, cta: cta("شاهدوا العروض", { type: "section", sectionId: "sale" }) },
      ],
    },
    { id: "featured", type: "product_grid", ...S, background: "muted", variant: "carousel", title: "مختارات المتجر", subtitle: "قطع اخترناها لكم من كل الأقسام", source: { type: "featured" }, limit: 10, columnsMobile: 2, columnsDesktop: 4, showViewAll: true, quickAdd: true },
    {
      id: "lookbook", type: "promo_banner", ...S, background: "default", variant: "triple",
      items: [
        { title: "إطلالة بلون واحد من الرأس للقدم", image: img("/demo/editorial/lookbook-1.webp", "عارض بقميص وبنطلون بلون كاكي أمام جدار رملي", 0.35), cta: cta("تسوقوا البناطيل", { type: "category", slug: "pants" }) },
        { title: "معاطف خفيفة فوق الأساسيات", image: img("/demo/editorial/lookbook-2.webp", "عارضة بمعطف بيج طويل مفتوح فوق ملابس فاتحة", 0.35), cta: cta("تسوقوا الجاكيتات", { type: "category", slug: "jackets" }) },
        { title: "إكسسوارات تكمل الإطلالة", image: img("/demo/editorial/banner-accessories.webp", "أقراط ونظارة شمسية وإيشارب حرير على خلفية بيضاء", 0.5), cta: cta("تسوقوا الإكسسوارات", { type: "category", slug: "accessories" }) },
      ],
    },
    { id: "value", type: "product_grid", ...S, background: "default", variant: "grid", title: "اشتروا أكثر ووفّروا", subtitle: volumeLine(), source: { type: "manual", slugs: [...VOLUME_SLUGS] }, limit: VOLUME_SLUGS.length, columnsMobile: 2, columnsDesktop: 3, showViewAll: false, quickAdd: true },
    { id: "sale", type: "product_grid", ...S, background: "muted", variant: "grid", title: "عروض بأسعار مخفّضة", subtitle: "خصومات على السعر الأصلي للقطعة", source: { type: "on_sale" }, limit: 8, columnsMobile: 2, columnsDesktop: 4, showViewAll: true, quickAdd: true },
    ...(trust ? [{ ...trust, spacing: "compact" as const }] : []),
    {
      id: "about", type: "about", ...S, background: "muted", variant: "split", title: "عن متجر العرض",
      body: `${DEMO_NAME} متجر عرض أعدّه فريق Colapia ليُظهر شكل المتجر الجاهز ولوحة التحكم: أقسام بأغلفة، ومنتجات بمقاسات وألوان ومخزون، ودليل مقاسات، وتقييمات وأسئلة مُجابة، وتجربة شراء كاملة حتى تأكيد الطلب.\nالمنتجات والصور والتقييمات هنا للعرض فقط، والطلبات تُسجَّل تجريبياً فلا تُشحن ولا يُطلب عنها أي دفع.`,
      image: img("/demo/editorial/about.webp", "ورشة خياطة صغيرة بإضاءة دافئة وطاولة قص وماكينة خياطة"),
      stats: [], milestones: [],
    },
    { id: "reviews", type: "testimonials", ...S, background: "default", variant: "cards", title: "آراء العملاء", subtitle: "تقييمات توضيحية لمتجر العرض، وليست من طلبات حقيقية.", items: [], includeVerifiedReviews: true },
    { id: "faq", type: "faq", ...S, background: "default", variant: "accordion", title: "أسئلة شائعة", items: faqItems(facts) },
    { id: "contact", type: "contact", ...S, background: "muted", variant: "cards", title: "تواصلوا معنا", showChannels: true },
  ];

  const bp: StoreBlueprint = {
    ...policies,
    brand: {
      ...policies.brand,
      description: "متجر عرض من Colapia يوضح شكل المتجر الجاهز وتجربة الشراء ولوحة التحكم. المنتجات والصور للعرض فقط.",
      voice: "premium_formal",
    },
    header: {
      ...policies.header,
      transparentOnHero: false,
      announcement: {
        enabled: true, dismissible: true, rotate: true,
        items: [
          { text: "متجر عرض من Colapia: الطلبات هنا تجريبية ولا تُشحن" },
          ...(freeShipping ? [{ text: `شحن مجاني للطلبات بقيمة ${formatEgp(FREE_SHIPPING_OVER_PIASTERS)} فأكثر`, target: { type: "all_products" as const } }] : []),
          { text: `كود ${DEMO_COUPON.code} لتجربة الخصم عند إتمام الطلب`, target: { type: "section" as const, sectionId: "sale" } },
        ],
      },
      nav: [
        { label: "الرئيسية", target: { type: "home" } },
        { label: "كل المنتجات", target: { type: "all_products" } },
        { label: "فساتين وعبايات", target: { type: "category", slug: "dresses" } },
        { label: "جاكيتات ومعاطف", target: { type: "category", slug: "jackets" } },
        { label: "أحذية", target: { type: "category", slug: "shoes" } },
        { label: "تواصلوا معنا", target: { type: "contact" } },
      ],
    },
    footer: { ...policies.footer, tagline: "متجر عرض من Colapia: المنتجات للعرض والطلبات تجريبية." },
    conversion: {
      ...policies.conversion,
      // لا رقم واتساب حقيقياً لمتجر العرض، فلا زر واتساب ولا طلب عبر ماسنجر.
      whatsappButton: false,
      messengerOrderButton: false,
      freeShippingBar: { enabled: true, thresholdPiasters: FREE_SHIPPING_OVER_PIASTERS },
      lowStockAlert: { enabled: true, threshold: 5 },
      // لا طلبات حقيقية هنا، فلا «اشترى للتو» ولا مشاهدين مزيفين.
      socialProofToasts: { enabled: false, minOrdersToShow: 5, lookbackHours: 72 },
      liveViewers: false,
      exitIntentOffer: { ...policies.conversion.exitIntentOffer, enabled: false },
    },
    checkout: { ...policies.checkout, successMessage: "تم تسجيل الطلب التجريبي. هذا متجر عرض، فلن يُشحن الطلب ولن يُطلب أي دفع." },
    invoice: { ...policies.invoice, footerNote: "متجر عرض: فاتورة توضيحية لطلب تجريبي" },
    seo: {
      ...policies.seo,
      title: `${DEMO_NAME}: متجر عرض من Colapia`,
      description: "تصفحوا متجر أزياء كاملاً كما يراه الزبائن: أقسام ومقاسات وألوان ودليل مقاسات وتجربة شراء تجريبية.",
      // متجر عرض لا يبيع فعلاً: لا يُفهرس في محركات البحث.
      noIndex: true,
    },
    productPage: { ...policies.productPage, showAttributesTable: true, showReviews: true },
    sizeGuide: { charts: sizeCharts(opts.categoryIds) },
    home,
  };

  // التصميم الافتراضي كاملاً (ألوان الوضعين والخطوط والبطاقة الزئبقية والخلفية والحركة) مع حفظ المحتوى.
  return blueprintSchema.parse(applyTheme(bp, DEMO_THEME));
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
  for (const c of CATEGORIES) set.add(categoryImage(c.key));
  return [...set].sort();
}

export const categoryImage = (key: string) => `/demo/editorial/cat-${key}.webp`;
