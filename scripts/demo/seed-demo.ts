// seed-demo.ts — ينشئ/يحدّث متجر الديمو `demo` (demo.colapia.com) بالكامل من scripts/demo/data/*.json.
// المتجر عيّنة عرض حقيقية الشكل: 79 منتجاً بصور وتركيبات ومخزون، أقسام بأغلفة، تقييمات وأسئلة مُجابة، واجهة بفيديو.
// كل ما فيه موسوم صراحة أنه تجريبي (شريط الإعلانات، «عن المتجر»، التقييمات غير موثّقة بلا طلب)، ولا ادعاءات مخترعة.
//
// الاستخدام:
//   محلياً:   bash scripts/dev/preview.sh demo            ثم http://demo.localhost:3100
//   الإنتاج:  DEMO_SEED_PRODUCTION=yes npx tsx --require ./scripts/dev/no-server-only.cjs scripts/demo/seed-demo.ts
//             (بأسرار الإنتاج على جهاز المالك؛ بلا المتغير يرفض السكربت أي قاعدة غير محلية)
//
// إعادة التشغيل آمنة: يحذف صفوف متجر الديمو وحده (بمعرّفه) ويعيد بناءها، ولا يمس أي متجر آخر.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { db } from "../../src/db/client";
import { getTenantDb } from "../../src/db/tenant";
import { merchants, stores, storeBlueprints, categories, products, productVariants, productQuestions, reviews, discounts, shippingZones } from "../../src/db/schema";
import { blueprintSchema, type StoreBlueprint } from "../../src/blueprint/schema";
import { defaultBlueprint } from "../../src/blueprint/defaults";
import { defaultShippingZones } from "../../src/lib/egypt";
import { buildSearchText } from "../../src/lib/arabic";
import { colorFromName } from "../../src/lib/color-names";

const SUB = "demo";
const NAME = "ستايل ديمو";
const DAY = 864e5;
const DATA = join(process.cwd(), "scripts/demo/data");

// ─── بيانات الملفات ───────────────────────────────────────────────────────
type Opt = { name: string; values: string[] };
type DemoProduct = {
  slug: string; name: string; category: string; price: number; compareAt: number | null;
  shortDescription: string; description: string; material?: string; care?: string; tags: string[];
  options: Opt[]; stock: number; featured: boolean; isNew: boolean; images: string[]; alt: string[];
};

const CATEGORIES: { key: string; name: string; description: string }[] = [
  { key: "tshirts", name: "تيشيرتات", description: "قطع قطنية أساسية للاستعمال اليومي." },
  { key: "shirts", name: "قمصان", description: "قمصان كتان وقطن بقصّات مريحة." },
  { key: "hoodies", name: "هوديز وكنزات", description: "طبقات دافئة للأيام الباردة." },
  { key: "jackets", name: "جاكيتات ومعاطف", description: "جاكيتات بخامات وقصّات متنوعة." },
  { key: "pants", name: "بناطيل", description: "جينز وشينو وجوجر لكل المناسبات." },
  { key: "dresses", name: "فساتين وعبايات", description: "فساتين وعبايات للمناسبات واليوم العادي." },
  { key: "shoes", name: "أحذية", description: "سنيكرز وكلاسيك وصنادل." },
  { key: "bags", name: "حقائب", description: "حقائب يد وكتف وظهر." },
  { key: "accessories", name: "إكسسوارات", description: "ساعات ونظارات وأوشحة وتفاصيل تكمل الإطلالة." },
];

function load(): DemoProduct[] {
  const out: DemoProduct[] = [];
  for (const c of CATEGORIES) out.push(...(JSON.parse(readFileSync(join(DATA, `${c.key}.json`), "utf8")) as DemoProduct[]));
  const files = readdirSync(DATA).filter((f) => f.endsWith(".json"));
  if (files.length < 11) throw new Error("ملفات البيانات ناقصة في scripts/demo/data");
  return out;
}

// ألوان معروفة بأسمائها المركّبة في البيانات (ما لا يُعرف يعود لمطابقة الاسم في color-names).
const HEX: Record<string, string> = {
  "أسود ونحاسي": "#1c1917", "فضي وكحلي": "#27364d", "تورتواز بني": "#8a5a3c", "برتقالي وأزرق": "#e8731a",
  "موكا بنقشة بنية": "#8b6a52", "برقوقي": "#5b2a4a", "روز مطفي": "#c98f94", "أبيض بنقشة زرقاء وخوخية": "#f1efe9",
  "أخضر عشبي": "#4d7a3c", "أحمر كرزي": "#b3122f", "بني محمر": "#8b4a2f", "أسود مغسول": "#33353a",
  "نيلي": "#1f2a56", "أزرق متوسط": "#3b6bb0", "أزرق داكن": "#1d3557", "أزرق فاتح": "#9dbcd9", "حجري": "#b9b2a3",
  "رملي": "#d8c6a5", "كونياك": "#9a4f1f", "بني فاتح": "#a67c52", "كاميل": "#c19a6b", "نعناعي فاتح": "#bfe9d8",
  "وردي فاتح": "#f6c9d4", "أخضر مريمي": "#a5b8a0", "عاجي بخطوط حمراء": "#f3ecdf", "عاجي": "#f3ecdf",
  "رمادي ميلانج": "#a8a9ad", "بيج كتان": "#d9ccb2", "كريمي": "#f1e8d6", "زيتي": "#5b6b2f", "كاكي": "#b5a77a",
};
const hexOf = (label: string) => HEX[label] ?? colorFromName(label) ?? undefined;
const isColor = (n: string) => /لون/.test(n);
const isSize = (n: string) => /مقاس/.test(n);

// ─── عشوائية ثابتة لنتائج متطابقة في كل تشغيل ─────────────────────────────
const rng = (() => {
  let s = 17102026;
  return () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
})();
const pick = <T,>(a: readonly T[]): T => a[Math.floor(rng() * a.length)]!;
function shuffle<T>(a: T[]): T[] {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [r[i], r[j]] = [r[j]!, r[i]!];
  }
  return r;
}

// ─── التقييمات: نصوص عربية واقعية لكل قسم، وبلا أي ادعاء «موثّق» ──────────
const REVIEW_TEXT: Record<string, Record<number, string[]>> = {
  tshirts: {
    5: ["الخامة ناعمة والقصة مظبوطة، وبعد الغسيل ما اتغير شكلها.", "قطعة أساسية بكل معنى الكلمة، اشتريت منها أكثر من لون.", "مريحة جداً في الحر وما بتلزق على الجسم."],
    4: ["جودة القماش حلوة والمقاس مناسب، لكن كنت أفضّل طولاً أكبر قليلاً.", "قطعة كويسة بالسعر، اللون مطابق للصورة تقريباً."],
    3: ["الخامة مقبولة لكن أخف مما توقعت.", "المقاس أصغر بقليل من المعتاد، أنصح بمقاس أكبر."],
    2: ["اللون أفتح مما ظهر في الصور."],
  },
  shirts: {
    5: ["القماش خفيف وأنيق، ومناسب جداً للصيف.", "الخياطة نظيفة والأزرار متينة، قصة مريحة بلا ضيق.", "ألبسه للشغل وللخروج، وفي الحالتين شكله مرتب."],
    4: ["قميص جميل بخامة جيدة، يحتاج كيّاً خفيفاً بعد الغسيل.", "المقاس مضبوط والخامة مريحة، والسعر معقول."],
    3: ["الشكل حلو لكن الأكمام أطول من المتوقع.", "الخامة تتجعد بسهولة، وده طبيعي في الكتان."],
    2: ["كنت متوقعاً سُمكاً أكبر في القماش."],
  },
  hoodies: {
    5: ["دافئ جداً ومبطّن من الداخل، ويستحق سعره.", "القصة عصرية والقماش تقيل وما بيفقد شكله بعد الغسيل.", "أحسن هودي اشتريته، مريح وخفيف نسبياً رغم دفئه."],
    4: ["الخامة ممتازة، لكن الغطاء أكبر قليلاً مما توقعت.", "دافئ ومريح، واللون غامق شوية عن الصورة."],
    3: ["مناسب للشتاء الخفيف فقط، مش للبرد الشديد."],
    2: ["الأساور أضيق من المعتاد وقلّلت راحته."],
  },
  jackets: {
    5: ["الجاكيت شكله فخم وخامته قوية، وبيدفّي فعلاً.", "التفاصيل والخياطة ممتازة، وبينسّق مع أكتر من إطلالة.", "قصة مريحة وبتسمح بطبقة تحتها، أنا راضٍ جداً."],
    4: ["جودة عالية، لكن الأكمام أطول شوية في مقاسي.", "جاكيت أنيق، والسحاب سلس ومتين."],
    3: ["الشكل حلو لكنه أثقل مما توقعت."],
    2: ["المقاس فعلياً أصغر من الجدول، يحتاج مقاساً أكبر."],
  },
  pants: {
    5: ["القصة مريحة وتقعد كويس، والقماش متين.", "مناسب للشغل وللخروج، واشتريت منه لونين.", "الخصر مضبوط والخامة ما بتتجعد."],
    4: ["بنطلون ممتاز، لكن الطول أكبر قليلاً وأحتاج تقصيراً.", "الخامة ناعمة والمقاس مناسب، والسعر مقبول."],
    3: ["اللون أغمق من الصورة قليلاً، لكنه مريح."],
    2: ["الخصر أضيق من المقاس المكتوب."],
  },
  dresses: {
    5: ["القماش منسدل وجميل، والتطريز دقيق ومنظّم.", "لبسته في مناسبة وكان مريحاً وأنيقاً.", "اللون زي الصورة تماماً، والقصة تدي شكل حلو."],
    4: ["قطعة راقية، والتفاصيل ممتازة لكنها تحتاج كيّاً قبل اللبس.", "المقاس مناسب والخامة جيدة، والسعر منصف."],
    3: ["الشكل جميل لكن الخامة أخف من توقعي."],
    2: ["الطول أقصر من المتوقع بالنسبة لمقاسي."],
  },
  shoes: {
    5: ["مريح من أول يوم من غير ما يعوّر، والجلد ناعم.", "شكله شيك والنعل ثابت، ينفع للمشي الطويل.", "الجودة واضحة في الخياطة والجلد، أنا مبسوط بيه."],
    4: ["حذاء جميل ومريح، يحتاج يومين لينفتح قليلاً.", "المقاس مضبوط والشكل أنيق، والسعر مناسب."],
    3: ["مريح لكن المقاس أضيق قليلاً من المعتاد."],
    2: ["كنت أتوقع نعلاً أطرى."],
  },
  bags: {
    5: ["الجلد ممتاز والخياطة متقنة، ومساحتها كافية لكل أغراضي.", "شكلها راقي وبتتنسق مع أي لبس، وخفيفة على الكتف.", "التفاصيل المعدنية متينة والبطانة نظيفة."],
    4: ["حقيبة جميلة وعملية، لكن الجيب الداخلي أصغر قليلاً.", "الجودة حلوة بالنسبة للسعر."],
    3: ["الشكل حلو لكنها أصغر من تصوري."],
    2: ["لون الجلد أفتح قليلاً من الصورة."],
  },
  accessories: {
    5: ["التصميم أنيق وتفاصيله أحلى من الصور.", "هدية ناجحة، والتغليف كان مرتباً.", "خفيف ومريح وبيكمل الإطلالة."],
    4: ["قطعة جميلة وتؤدي الغرض، والسعر مقبول.", "الشكل راقي لكن أتمنى لو كان أثقل قليلاً."],
    3: ["مقبولة بالسعر، وتفاصيلها أبسط من توقعي."],
    2: ["اللون مختلف قليلاً عن الصورة."],
  },
};
const NAMES = ["سارة أ.", "محمد ع.", "منة الله ح.", "أحمد س.", "ياسمين ف.", "كريم ع.", "هبة م.", "مصطفى ر.", "نورهان إ.", "عمر ط.", "دعاء ص.", "يوسف ن.", "رنا خ.", "طارق ج.", "ندى ب.", "إسلام ك.", "مريم ل.", "حسام و.", "آية ز.", "شادي ه.", "ملك ي.", "باسم ق."];

// توزيع التقييمات الإجمالي (مجموع واحد لكل المتجر): 5★ ≈ 57% و4★ ≈ 29% و3★ ≈ 10% و2★ ≈ 3% و1★ ≈ 1%.
function ratingPool(n: number): number[] {
  const share: [number, number][] = [[5, 0.57], [4, 0.29], [3, 0.1], [2, 0.03], [1, 0.01]];
  const pool: number[] = [];
  for (const [r, p] of share) for (let i = 0; i < Math.round(n * p); i++) pool.push(r);
  while (pool.length < n) pool.push(5);
  return shuffle(pool.slice(0, n));
}
const ONE_STAR = "لم يناسبني المنتج، المقاس والخامة مختلفان عمّا توقعت.";

// ─── أسئلة المنتجات: أجوبتها من بيانات المنتج نفسها ───────────────────────
function questionsFor(p: DemoProduct, i: number): { q: string; a: string; asker: string }[] {
  const out: { q: string; a: string; asker: string }[] = [];
  if (p.material) out.push({ q: "ما هي خامة هذا المنتج؟", a: `${p.material}.`, asker: NAMES[(i * 3) % NAMES.length]!.replace(/ .$/, "") });
  if (p.care) out.push({ q: "كيف أعتني بالقطعة؟", a: p.care, asker: NAMES[(i * 5 + 2) % NAMES.length]!.replace(/ .$/, "") });
  const size = p.options.find((o) => isSize(o.name));
  if (size && size.values.length > 1) {
    out.push({ q: "أيّ مقاس تنصحون به؟", a: `المقاسات المتاحة: ${size.values.join("، ")}. اختاروا مقاسكم المعتاد، وإن كنتم بين مقاسين فالأكبر أريح. وإن احتجتم تغييره فالاستبدال متاح وفق سياسة المتجر.`, asker: NAMES[(i * 7 + 4) % NAMES.length]!.replace(/ .$/, "") });
  }
  return out.slice(0, 2);
}

// ─── توزيع المخزون على التركيبات: يوجد نافد ومنخفض ومتوفر ─────────────────
function distribute(total: number, n: number): number[] {
  const out = Array<number>(n).fill(0);
  if (total <= 0) return out;
  // الوحدات تُوزَّع من المنتصف للأطراف (المقاسات الوسطى أكثر طلباً)، فتنفد الأطراف أولاً عند الندرة.
  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => Math.abs(a - (n - 1) / 2) - Math.abs(b - (n - 1) / 2));
  for (let u = 0; u < total; u++) out[order[u % n]!]!++;
  return out;
}

const cartesian = (lists: string[][]): string[][] => lists.reduce<string[][]>((acc, vals) => acc.flatMap((a) => vals.map((v) => [...a, v])), [[]]);

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  const local = /@[^/]+\.local\.neon\//.test(url);
  if (!url) throw new Error("DATABASE_URL مطلوب");
  if (!local && process.env.DEMO_SEED_PRODUCTION !== "yes") {
    throw new Error("قاعدة غير محلية: شغّله محلياً عبر scripts/dev/preview.sh demo، أو ضع DEMO_SEED_PRODUCTION=yes عن قصد.");
  }

  const data = load();
  if (data.length !== 79) console.warn(`تنبيه: عدد المنتجات ${data.length} (المتوقع 79)`);

  // ─── حذف الديمو القديم (بمعرّفه وحده) ───
  const old = await db.select().from(stores).where(eq(stores.subdomain, SUB)).limit(1);
  if (old[0]) {
    await db.delete(stores).where(eq(stores.id, old[0].id)); // يسقط كل صفوف المتجر بالتتالي
    await db.delete(merchants).where(eq(merchants.id, old[0].merchantId));
  }

  const now = Date.now();
  const [m] = await db
    .insert(merchants)
    .values({ displayName: "Colapia Demo", email: "demo@colapia.com", isActivated: true, createdAt: new Date(now - 90 * DAY) })
    .returning();
  const [s] = await db
    .insert(stores)
    .values({
      merchantId: m!.id, subdomain: SUB, name: NAME, status: "active", plan: "standard", planMonths: 12,
      activatedAt: new Date(now - 60 * DAY), deliveredAt: new Date(now - 60 * DAY),
      // استضافة بعيدة المدى: لا تجديد ولا سماح ولا إيقاف. وعلم الديمو في prefs يستثنيه من تقارير ورسائل التجار.
      hostingExpiresAt: new Date("2099-12-31T00:00:00Z"),
      setupStartedAt: new Date(now - 60 * DAY), setupCompletedAt: new Date(now - 60 * DAY),
      showcaseOptIn: false, acceptingOrders: true,
      prefs: { demo: true },
    })
    .returning();
  const storeId = s!.id;
  const t = await getTenantDb(storeId);

  // ─── الأقسام ───
  const cats = await t
    .insert(categories)
    .values(CATEGORIES.map((c, i) => ({ storeId, name: c.name, slug: c.key, description: c.description, imageUrl: `/demo/editorial/cat-${c.key}.webp`, sortOrder: i })))
    .returning();
  const catId = new Map(cats.map((c) => [c.slug, c.id]));

  // ─── المنتجات ───
  const VOLUME = new Set(["classic-white-crew-tee", "essential-black-tee", "cotton-jersey-joggers", "heavyweight-boxy-white-tee"]);
  const rows = data.map((p, i) => {
    const sizeOpt = p.options.find((o) => isSize(o.name));
    const total = p.stock;
    const colourCount = p.options.find((o) => isColor(o.name))?.values.length ?? 0;
    return {
      storeId, categoryId: catId.get(p.category)!, name: p.name, slug: p.slug,
      shortDescription: p.shortDescription, description: p.description,
      pricePiasters: p.price * 100, compareAtPiasters: p.compareAt ? p.compareAt * 100 : null,
      costPiasters: Math.round(p.price * 100 * 0.55),
      stock: total, trackStock: true,
      images: p.images.map((u, k) => ({ url: u, alt: p.alt[k] ?? p.name })),
      attributes: [
        ...(p.material ? [{ label: "الخامة", value: p.material }] : []),
        ...(p.care ? [{ label: "العناية", value: p.care }] : []),
      ],
      optionNames: p.options.map((o) => o.name),
      optionMeta: p.options.map((o) => ({
        name: o.name,
        kind: (isColor(o.name) ? "color" : isSize(o.name) ? "size" : "custom") as "color" | "size" | "custom",
        values: o.values.map((label) => (isColor(o.name) ? { label, hex: hexOf(label) } : { label })),
      })),
      tags: p.tags, isFeatured: p.featured,
      volumeTiers: VOLUME.has(p.slug) ? [{ minQty: 2, percentOff: 5 }, { minQty: 3, percentOff: 10 }] : [],
      searchText: buildSearchText([p.name, p.shortDescription, ...p.tags]),
      sortOrder: i,
      // الجديد: آخر 12 يوماً (يظهر وسم «جديد»)، والباقي أقدم متدرجاً.
      createdAt: new Date(now - (p.isNew ? 1 + (i % 11) : 20 + ((i * 7) % 160)) * DAY),
      _meta: { sizeCount: sizeOpt?.values.length ?? 0, colourCount },
    };
  });
  const inserted = [];
  for (let i = 0; i < rows.length; i += 25) {
    inserted.push(...(await t.insert(products).values(rows.slice(i, i + 25).map(({ _meta, ...r }) => r)).returning()));
  }
  const byslug = new Map(inserted.map((r) => [r.slug, r]));

  // ─── التركيبات (مقاس × لون) بمخزون موزّع، وصورة لكل لون عند تعدد الألوان ───
  const variantRows: (typeof productVariants.$inferInsert)[] = [];
  for (const p of data) {
    const row = byslug.get(p.slug)!;
    if (!p.options.length) continue;
    const combos = cartesian(p.options.map((o) => o.values));
    const per = distribute(p.stock, combos.length);
    const colourIdx = p.options.findIndex((o) => isColor(o.name));
    const colours = colourIdx >= 0 ? p.options[colourIdx]!.values : [];
    combos.forEach((vals, k) => {
      let imageUrl: string | null = null;
      if (colours.length > 1 && p.images.length >= colours.length) imageUrl = p.images[colours.indexOf(vals[colourIdx]!)] ?? null;
      variantRows.push({ storeId, productId: row.id, optionValues: vals, stock: per[k]!, imageUrl, sortOrder: k });
    });
  }
  for (let i = 0; i < variantRows.length; i += 100) await t.insert(productVariants).values(variantRows.slice(i, i + 100));
  // مخزون المنتج = مجموع تركيباته (القاعدة العامة في المنصة).
  for (const p of data) {
    if (!p.options.length) continue;
    const sum = variantRows.filter((v) => v.productId === byslug.get(p.slug)!.id).reduce((a, v) => a + (v.stock ?? 0), 0);
    await t.update(products).set({ stock: sum }).where(eq(products.id, byslug.get(p.slug)!.id));
  }

  // ─── التقييمات (≈60% من المنتجات، 2–3 لكل منها) ───
  const reviewed = data.filter((_, i) => i % 5 < 3); // 60%
  const plan: { p: DemoProduct; n: number }[] = reviewed.map((p, i) => ({ p, n: i % 3 === 0 ? 3 : 2 }));
  const pool = ratingPool(plan.reduce((a, x) => a + x.n, 0));
  const reviewRows: (typeof reviews.$inferInsert)[] = [];
  const agg = new Map<string, { sum: number; count: number }>();
  let cursor = 0;
  for (const { p, n } of plan) {
    const row = byslug.get(p.slug)!;
    const texts = REVIEW_TEXT[p.category]!;
    const used = new Set<string>();
    for (let k = 0; k < n; k++) {
      const rating = pool[cursor++]!;
      const options = texts[rating] ?? texts[5]!;
      let body = rating === 1 ? ONE_STAR : pick(options);
      for (let tries = 0; used.has(body) && tries < 6; tries++) body = pick(options);
      used.add(body);
      reviewRows.push({
        storeId, productId: row.id, customerName: NAMES[(cursor * 3 + k) % NAMES.length]!, rating, body,
        isApproved: true,
        // تقييمات عرض بلا طلب حقيقي: ليست «موثّقة» ولا تظهر بشارة المشتري الموثّق.
        isVerified: false,
        createdAt: new Date(now - (3 + Math.floor(rng() * 110)) * DAY),
      });
      const a = agg.get(row.id) ?? { sum: 0, count: 0 };
      a.sum += rating; a.count++;
      agg.set(row.id, a);
    }
  }
  for (let i = 0; i < reviewRows.length; i += 100) await t.insert(reviews).values(reviewRows.slice(i, i + 100));
  for (const [id, a] of agg) await t.update(products).set({ ratingSum: a.sum, ratingCount: a.count }).where(eq(products.id, id));

  // ─── أسئلة مُجابة على ≈10 منتجات ───
  const qRows: (typeof productQuestions.$inferInsert)[] = [];
  data.forEach((p, i) => {
    if (i % 8 !== 1) return;
    questionsFor(p, i).forEach((q, k) =>
      qRows.push({
        storeId, productId: byslug.get(p.slug)!.id, question: q.q, answer: q.a, askerName: q.asker, status: "answered",
        createdAt: new Date(now - (12 + i + k) * DAY), answeredAt: new Date(now - (11 + i + k) * DAY),
      })
    );
  });
  if (qRows.length) await t.insert(productQuestions).values(qRows);

  // ─── الشحن والخصم ───
  await t.insert(shippingZones).values(defaultShippingZones().map((z) => ({ ...z, storeId })));
  await t.insert(discounts).values({ storeId, code: "DEMO10", type: "percentage", value: 10, isActive: true });

  // ─── الـ Blueprint: الافتراضي V2 ثم تخصيص الديمو ───
  const base = defaultBlueprint({
    name: NAME, tagline: "متجر تجريبي من Colapia لعرض شكل المتجر ولوحة التحكم",
    industry: "fashion", email: "demo@colapia.com", inspectionAllowed: true, storeId, colorPreference: "#1f2937",
    productCount: data.length, hasHeroImages: true, variationSeed: "demo-colapia-2026",
  });
  const cta = (label: string, target: StoreBlueprint["header"]["nav"][number]["target"], style: "primary" | "secondary" = "primary") => ({ label, target, style });
  const img = (url: string, alt = "") => ({ url, alt, focalX: 0.5, focalY: 0.4 });
  const sec = { enabled: true, spacing: "normal" as const, reveal: "fade" as const };

  const bp: StoreBlueprint = {
    ...base,
    brand: { ...base.brand, description: "متجر تجريبي أنشأه فريق Colapia ليعرض شكل المتجر الجاهز ولوحة التحكم. المنتجات والصور للعرض فقط." },
    theme: { ...base.theme, imageRatio: "portrait", productCardStyle: "elevated" },
    header: {
      ...base.header,
      transparentOnHero: false,
      announcement: {
        enabled: true, dismissible: true, rotate: true,
        items: [
          { text: "متجر تجريبي من Colapia: الطلبات هنا غير حقيقية" },
          { text: "جرّبوا كود الخصم DEMO10 عند إتمام الطلب", target: { type: "all_products" } },
        ],
      },
      nav: [
        { label: "الرئيسية", target: { type: "home" } },
        { label: "كل المنتجات", target: { type: "all_products" } },
        { label: "فساتين وعبايات", target: { type: "category", slug: "dresses" } },
        { label: "أحذية", target: { type: "category", slug: "shoes" } },
        { label: "تواصل معنا", target: { type: "contact" } },
      ],
    },
    footer: { ...base.footer, tagline: "متجر تجريبي من Colapia" },
    conversion: {
      ...base.conversion,
      whatsappButton: false,
      freeShippingBar: { enabled: true, thresholdPiasters: 150000 },
      // لا طلبات حقيقية هنا، فلا نعرض «اشترى للتو» ولا مشاهدين مزيفين.
      socialProofToasts: { enabled: false, minOrdersToShow: 5, lookbackHours: 72 },
      liveViewers: false,
    },
    shipping: { ...base.shipping, freeOverPiasters: 150000, flatRatePiasters: null },
    home: [
      {
        id: "hero", type: "hero", ...sec, background: "default", variant: "fullscreen",
        eyebrow: "متجر تجريبي", headline: "تشكيلة الموسم الجديد",
        subheadline: "قطع أساسية بخامات مريحة وتفاصيل مدروسة، من التيشيرتات إلى الجاكيتات والأحذية.",
        images: [img("/demo/media/hero-fashion.webp", "رف ملابس كتان بألوان هادئة")],
        videoUrl: "/demo/media/hero-fashion.mp4",
        highlights: [], primaryCta: cta("تسوقوا الآن", { type: "all_products" }),
        secondaryCta: cta("وصل حديثاً", { type: "section", sectionId: "new" }, "secondary"),
        overlayOpacity: 0.45, textAlign: "start", height: "screen", autoplayMs: 5000,
        enableParallax: false, enableKineticTypography: false, enableAmbientGlow: false,
      },
      { id: "cats", type: "categories", ...sec, background: "default", variant: "cards_overlay", title: "تسوقوا حسب القسم", categorySlugs: [], showProductCount: true },
      { id: "new", type: "product_grid", ...sec, background: "default", variant: "grid", title: "وصل حديثاً", source: { type: "newest" }, limit: 8, columnsMobile: 2, columnsDesktop: 4, showViewAll: true, quickAdd: true },
      {
        id: "promo", type: "promo_banner", ...sec, background: "default", variant: "split_duo",
        items: [
          { eyebrow: "المجموعة الجديدة", title: "إطلالات خفيفة للموسم", text: "قمصان وبناطيل بقصّات مريحة.", image: img("/demo/editorial/banner-new.webp", "ثلاثة عارضين بقمصان وجاكيتات بألوان محايدة"), cta: cta("اكتشفوا", { type: "category", slug: "shirts" }) },
          { eyebrow: "عروض", title: "خصومات على قطع مختارة", text: "كود DEMO10 للتجربة فقط.", image: img("/demo/editorial/banner-sale.webp", "رف فساتين وبلوزات بألوان دافئة"), couponCode: "DEMO10", cta: cta("شاهدوا العروض", { type: "section", sectionId: "sale" }) },
        ],
      },
      { id: "featured", type: "product_grid", ...sec, background: "muted", variant: "carousel", title: "مختارات المتجر", source: { type: "featured" }, limit: 10, columnsMobile: 2, columnsDesktop: 4, showViewAll: true, quickAdd: true },
      {
        id: "lookbook", type: "promo_banner", ...sec, background: "default", variant: "triple",
        items: [
          { title: "إطلالة اليوم", image: img("/demo/editorial/lookbook-1.webp", "إطلالة بألوان محايدة"), cta: cta("تسوقوا", { type: "category", slug: "jackets" }) },
          { title: "أساسيات للتنسيق", image: img("/demo/editorial/lookbook-2.webp", "تنسيق قطع أساسية"), cta: cta("تسوقوا", { type: "category", slug: "tshirts" }) },
          { title: "لمسة أخيرة", image: img("/demo/editorial/banner-accessories.webp", "إكسسوارات"), cta: cta("تسوقوا", { type: "category", slug: "accessories" }) },
        ],
      },
      { id: "sale", type: "product_grid", ...sec, background: "default", variant: "grid", title: "عروض", source: { type: "on_sale" }, limit: 8, columnsMobile: 2, columnsDesktop: 4, showViewAll: true, quickAdd: true },
      {
        id: "about", type: "about", ...sec, background: "muted", variant: "split", title: "عن هذا المتجر",
        body: "ستايل ديمو متجر تجريبي أنشأه فريق Colapia ليعرض شكل متجر جاهز ولوحة تحكم كاملة: الأقسام والمنتجات وخيارات المقاس واللون والتقييمات والأسئلة. المنتجات والصور والتقييمات هنا للعرض فقط، ولا تُشحن أي طلبات منه.",
        image: img("/demo/editorial/about.webp", "رف ملابس في متجر"), stats: [],
        milestones: [],
      },
      base.home.find((x) => x.id === "trust")!,
      { id: "reviews", type: "testimonials", ...sec, background: "default", variant: "carousel", title: "آراء من تقييمات العرض", subtitle: "تقييمات تجريبية للعرض، وليست من طلبات حقيقية.", items: [], includeVerifiedReviews: true },
      base.home.find((x) => x.id === "faq")!,
      base.home.find((x) => x.id === "contact")!,
    ],
  };
  const parsed = blueprintSchema.safeParse(bp);
  if (!parsed.success) throw new Error(`Blueprint غير صالح: ${JSON.stringify(parsed.error.issues.slice(0, 5))}`);
  await t.insert(storeBlueprints).values({ storeId, data: parsed.data, updatedBy: "demo-seed" });

  const sold = variantRows.filter((v) => v.stock === 0).length;
  console.log(`✓ demo جاهز: ${data.length} منتجاً، ${variantRows.length} تركيبة (${sold} نافدة)، ${reviewRows.length} تقييماً على ${agg.size} منتجاً، ${qRows.length} سؤالاً مُجاباً.`);
  console.log(local ? "  http://demo.localhost:3100" : "  https://demo.colapia.com");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
