// verify-demo.ts — فحص متجر العرض دون اتصال (بلا قاعدة ولا شبكة): يبني البيانات والـ Blueprint كما يكتبها seed-demo.ts،
// ويتحقق من صلاحية المخطط والتصميم، ووجود كل صورة وفيديو في public/، واعتماد كل ملف في docs/demo-credits.md، وصدق
// الأسئلة الشائعة والشارات أمام حقائق المتجر، واتساق التقييمات والمخزون والسمات وجداول المقاسات.
// يشغّله seed-demo.ts قبل أي كتابة، واختبار tests/unit/demo-seed.test.ts في كل تشغيل للاختبارات.
//
// الاستخدام: npx tsx scripts/demo/verify-demo.ts
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { blueprintSchema, type Section, type StoreBlueprint } from "../../src/blueprint/schema";
import { groundedItems } from "../../src/blueprint/facts";
import { cleanAttributes } from "../../src/lib/niche-attributes";
import { chartFor } from "../../src/lib/size-guide";
import {
  ATTR_CARE, DEMO_MAX_CATEGORIES, ATTR_FIT, ATTR_MATERIAL, DEMO_NICHE, DEMO_THEME, buildDemoBlueprint, demoAssetPaths, demoCategories, demoFacts, fakeCategoryIds, hexOf, isColorOption, isSizeOption,
  loadDemoProducts, productRows, questionsFor, ratingTotals, reviewsFor, variantsOf,
  type DemoProduct, type DemoProductRow, type DemoVariant,
} from "./catalog";

export { fakeCategoryIds };

export type DemoCheck = {
  errors: string[];
  stats: { products: number; variants: number; soldOut: number; lowStock: number; reviews: number; reviewedProducts: number; questions: number; productsWithSizeGuide: number; assets: number };
};

const HEX_RE = /^#[0-9a-f]{6}$/i;
const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function checkProducts(data: DemoProduct[], rows: DemoProductRow[], errors: string[]) {
  const slugs = new Set<string>();
  const categoryKeys = new Set(demoCategories(data).map((c) => c.key));
  for (const p of data) {
    const at = `المنتج ${p.slug}`;
    if (slugs.has(p.slug)) errors.push(`${at}: الرابط مكرر`);
    slugs.add(p.slug);
    // الحقائب والأوشحة والحلي بلا مقاس؛ كل ما عداها (ملابس وأحذية) بمقاس ولون.
    const noSize = p.tags.some((t) => ["حقائب", "أوشحة", "حلي", "قبعات"].includes(t));
    if (!p.options.some((o) => isColorOption(o.name)) || (!noSize && !p.options.some((o) => isSizeOption(o.name)))) errors.push(`${at}: يلزم خيار لون${noSize ? "" : " ومقاس"}`);
    if (p.art && !existsSync(join(process.cwd(), "public", p.images[0] ?? "x"))) errors.push(`${at}: الصورة البديلة غير مولَّدة (npx tsx scripts/demo/make-art.ts)`);
    if (!Number.isInteger(p.price) || p.price <= 0) errors.push(`${at}: سعر غير صالح`);
    if (p.compareAt !== null && p.compareAt <= p.price) errors.push(`${at}: السعر المشطوب لا يزيد على السعر`);
    if (!p.images.length) errors.push(`${at}: بلا صور`);
    if (p.alt.length !== p.images.length || p.alt.some((a) => !a.trim())) errors.push(`${at}: نص بديل ناقص لبعض الصور`);
    for (const o of p.options) {
      if (!o.values.length || new Set(o.values).size !== o.values.length) errors.push(`${at}: قيم الخيار «${o.name}» فارغة أو مكررة`);
      if (isColorOption(o.name)) for (const v of o.values) if (!HEX_RE.test(hexOf(v) ?? "")) errors.push(`${at}: لا لون HEX للقيمة «${v}»`);
    }
  }
  // نشاط واحد فقط: أزياء نسائية، ومجموعة أقسام قليلة ومتماسكة (نتيجة دمج المترادفات).
  if (DEMO_NICHE !== "fashion") errors.push("نشاط متجر العرض يجب أن يكون الأزياء");
  if (data.length < 24 || data.length > 60) errors.push(`عدد المنتجات ${data.length} (المتوقع 24 إلى 60)`);
  if (categoryKeys.size < 4 || categoryKeys.size > DEMO_MAX_CATEGORIES) errors.push(`عدد الأقسام ${categoryKeys.size} (المتوقع 4 إلى ${DEMO_MAX_CATEGORIES})`);
  for (const r of rows) {
    if (!r.categoryKey || !categoryKeys.has(r.categoryKey)) errors.push(`المنتج ${r.slug}: بلا قسم صالح`);
    if (r.images.some((i) => !/^\/demo\/(fashion|products|editorial)\/[\w.-]+\.webp$/.test(i.url))) errors.push(`المنتج ${r.slug}: صورة خارج public/demo`);
  }
  for (const k of categoryKeys) if (!rows.some((r) => r.categoryKey === k)) errors.push(`القسم ${k} بلا منتجات`);

  const allowed = new Set([ATTR_MATERIAL, ATTR_FIT, ATTR_CARE]);
  for (const r of rows) {
    if (!sameJson(cleanAttributes(r.attributes), r.attributes)) errors.push(`سمات ${r.slug} تتغير عند الحفظ من اللوحة (طول أو تكرار)`);
    for (const a of r.attributes) {
      if (!allowed.has(a.label)) errors.push(`سمة غير متوقعة «${a.label}» في ${r.slug}`);
    }
  }

  if (!rows.some((r) => r.stock === 0)) errors.push("لا منتجات نافدة (العرض يحتاج حالة «نفد»)");
  if (!rows.some((r) => r.stock > 0 && r.stock <= 5)) errors.push("لا منتجات بكمية منخفضة");
  if (rows.filter((r) => r.stock > 5).length < rows.length / 2) errors.push("أقل من نصف المنتجات متوفر بكمية جيدة");
  if (!rows.some((r) => r.isFeatured && r.stock > 0)) errors.push("لا منتجات مختارة متوفرة");
}

function checkVariants(data: DemoProduct[], rows: DemoProductRow[], variants: Map<string, DemoVariant[]>, errors: string[]) {
  const bySlug = new Map(rows.map((r) => [r.slug, r]));
  for (const p of data) {
    const vs = variants.get(p.slug) ?? [];
    const expected = p.options.reduce((n, o) => n * o.values.length, p.options.length ? 1 : 0);
    if (vs.length !== expected) errors.push(`تركيبات ${p.slug}: ${vs.length} بدل ${expected}`);
    if (vs.length && vs.reduce((a, v) => a + v.stock, 0) !== bySlug.get(p.slug)!.stock) errors.push(`مخزون ${p.slug} لا يساوي مجموع تركيباته`);
    if (vs.some((v) => v.imageUrl && !p.images.includes(v.imageUrl))) errors.push(`صورة تركيبة في ${p.slug} ليست من صور المنتج`);
  }
}

function checkReviews(rows: DemoProductRow[], now: number, errors: string[], reviews: ReturnType<typeof reviewsFor>, questions: ReturnType<typeof questionsFor>) {
  const born = new Map(rows.map((r) => [r.slug, r.createdAt.getTime()]));
  const ratings = new Set(reviews.map((r) => r.rating));
  if (!reviews.length) errors.push("لا تقييمات");
  if (ratings.size < 3 || !ratings.has(5) || reviews.every((r) => r.rating === 5)) errors.push("توزيع التقييمات غير واقعي (كلها متشابهة)");
  if (new Set(reviews.map((r) => r.body)).size !== reviews.length) errors.push("نصوص تقييمات مكررة");
  for (const r of reviews) {
    if (!Number.isInteger(r.rating) || r.rating < 1 || r.rating > 5) errors.push(`تقييم خارج 1–5 على ${r.slug}`);
    const b = born.get(r.slug);
    if (b === undefined || r.createdAt.getTime() <= b || r.createdAt.getTime() >= now) errors.push(`تاريخ تقييم ${r.slug} قبل إضافة المنتج أو في المستقبل`);
  }
  const totals = ratingTotals(reviews);
  const sum = [...totals.values()].reduce((a, t) => a + t.sum, 0);
  if (sum !== reviews.reduce((a, r) => a + r.rating, 0)) errors.push("مجاميع التقييمات لا تطابق الصفوف");
  if (![...totals.values()].some((t) => t.count >= 3)) errors.push("لا منتج بثلاثة تقييمات (البطاقة لا تعرض النجوم بأقل من 3)");
  for (const q of questions) {
    const b = born.get(q.slug);
    if (!q.answer.trim() || b === undefined || q.createdAt.getTime() <= b || q.answeredAt <= q.createdAt || q.answeredAt.getTime() >= now) errors.push(`سؤال ${q.slug}: تواريخ أو إجابة غير صالحة`);
  }
}

function checkBlueprint(bp: StoreBlueprint, data: DemoProduct[], errors: string[]) {
  const parsed = blueprintSchema.safeParse(bp);
  if (!parsed.success) errors.push(`Blueprint غير صالح: ${JSON.stringify(parsed.error.issues.slice(0, 3))}`);
  if (bp.design.theme !== DEMO_THEME) errors.push(`التصميم ${bp.design.theme} بدل ${DEMO_THEME}`);

  const ids = bp.home.map((s) => s.id);
  if (new Set(ids).size !== ids.length) errors.push("معرّفات أقسام الرئيسية مكررة");
  const hero = bp.home[0];
  if (!hero || hero.type !== "hero" || hero.variant !== "editorial" || hero.videoUrl || hero.images.length < 2 || hero.images.some((i) => !i.url.startsWith("/demo/editorial/"))) errors.push("واجهة الديمو تحريرية بصورتين من public/demo/editorial (بلا فيديو)");
  // كل قسم مخصص (store_block) له ملف في stores/demo/blocks، وكل استبدال قسم نواة موجود فعلاً.
  for (const s of bp.home) if (s.type === "store_block" && !existsSync(join(process.cwd(), "stores/demo/blocks", `${s.name}.tsx`))) errors.push(`القسم المخصص ${s.name} بلا ملف في stores/demo/blocks`);
  for (const f of ["store.json", "theme.css", "slots/Header.tsx", "slots/Footer.tsx", "sections/hero.tsx", "blueprint.json", "seed.json", "DELIVERY.md"]) if (!existsSync(join(process.cwd(), "stores/demo", f))) errors.push(`stores/demo/${f} غير موجود`);

  const slugs = new Set(data.map((p) => p.slug));
  const cats = new Set(demoCategories(data).map((c) => c.key));
  const checkTarget = (t: { type: string; slug?: string; sectionId?: string } | undefined, where: string) => {
    if (!t) return;
    if (t.type === "category" && !cats.has(t.slug ?? "")) errors.push(`${where}: قسم غير موجود ${t.slug}`);
    if (t.type === "product" && !slugs.has(t.slug ?? "")) errors.push(`${where}: منتج غير موجود ${t.slug}`);
    if (t.type === "section" && !ids.includes(t.sectionId ?? "")) errors.push(`${where}: قسم رئيسية غير موجود ${t.sectionId}`);
  };
  bp.header.nav.forEach((n) => checkTarget(n.target, `رابط القائمة «${n.label}»`));
  bp.header.announcement?.items.forEach((i) => checkTarget(i.target, `شريط الإعلانات «${i.text}»`));

  const sources = new Set<string>();
  for (const s of bp.home as Section[]) {
    if (!s.enabled) errors.push(`القسم ${s.id} معطّل (لا أقسام ميتة في العرض)`);
    if (s.type === "hero") [s.primaryCta, s.secondaryCta].forEach((c) => checkTarget(c?.target, `زر الواجهة`));
    if (s.type === "promo_banner") s.items.forEach((i) => {
      if (!i.image) errors.push(`لافتة «${i.title}» بلا صورة`);
      checkTarget(i.cta?.target, `لافتة «${i.title}»`);
    });
    if (s.type === "product_grid") {
      const key = JSON.stringify(s.source);
      if (sources.has(key)) errors.push(`مصدر منتجات مكرر في الرئيسية: ${key}`);
      sources.add(key);
      if (s.source.type === "manual") for (const m of s.source.slugs) if (!slugs.has(m)) errors.push(`القسم ${s.id}: منتج غير موجود ${m}`);
      if (s.source.type === "best_sellers") errors.push(`القسم ${s.id}: «الأكثر مبيعاً» بلا مبيعات حقيقية في متجر العرض`);
    }
    if (s.type === "testimonials" && (!s.includeVerifiedReviews || s.items.length)) errors.push("الآراء يجب أن تأتي من صفوف التقييمات وحدها");
    if (s.type === "store_block" && s.name === "voices" && Object.keys(s.props).some((k) => k !== "limit")) errors.push("قسم الآراء يقرأ صفوف التقييمات وحدها (لا نصوص مكتوبة)");
  }

  // الصدق: كل سؤال شائع وكل شارة تمر بفحص حقائق المتجر كما هي عند العرض.
  const facts = demoFacts(bp);
  const faq = bp.home.find((s): s is Extract<Section, { type: "faq" }> => s.type === "faq");
  if (faq) {
    const kept = groundedItems(faq.items.map((f) => ({ ...f, title: f.q, text: f.a })), facts, "drop");
    if (kept.length !== faq.items.length) errors.push(`أسئلة شائعة لا تسندها سياسة المتجر: ${faq.items.filter((f) => !kept.some((k) => k.q === f.q)).map((f) => f.q).join("، ")}`);
  } else errors.push("لا قسم أسئلة شائعة");
  const trust = bp.home.find((s): s is Extract<Section, { type: "trust_badges" }> => s.type === "trust_badges");
  if (!trust || groundedItems(trust.items, facts).length < 3) errors.push("شارات الثقة الصادقة أقل من 3");
  if (bp.payments.vodafoneCash.enabled || bp.payments.instapay.enabled || !bp.payments.cod.enabled) errors.push("متجر العرض بالدفع عند الاستلام وحده (لا أرقام تحويل مخترعة)");
  if (bp.channels.whatsappNumber || bp.channels.phone) errors.push("لا رقم هاتف أو واتساب مخترع لمتجر العرض");
  if (!bp.seo.noIndex) errors.push("متجر العرض يجب ألا يُفهرس");

  const linked = bp.sizeGuide.charts.flatMap((c) => (Array.isArray(c.appliesTo) ? c.appliesTo : []));
  if (!bp.sizeGuide.charts.length || !linked.length) errors.push("لا جداول مقاسات مربوطة بالأقسام");
}

// جداول المقاسات: الجدول الذي يظهر لمنتج يغطي كل مقاساته، ومنتج لا يغطيه أي جدول لا يرى جدولاً خاطئاً.
function checkSizeCharts(bp: StoreBlueprint, data: DemoProduct[], rows: DemoProductRow[], categoryIds: Record<string, string>, errors: string[]): number {
  const keyOf = new Map(rows.map((r) => [r.slug, r.categoryKey]));
  let covered = 0;
  for (const p of data) {
    const size = p.options.find((o) => isSizeOption(o.name));
    if (!size) continue;
    const chart = chartFor(bp.sizeGuide, categoryIds[keyOf.get(p.slug) ?? ""], p.options.map((o) => o.name), size.values);
    if (!chart) continue;
    covered++;
    const have = new Set(chart.rows.map((r) => r.size));
    const missing = size.values.filter((v) => !have.has(v));
    if (missing.length) errors.push(`جدول «${chart.name}» لا يغطي مقاسات ${p.slug}: ${missing.join("، ")}`);
  }
  if (!covered) errors.push("لا منتج يعرض دليل المقاسات");
  return covered;
}

function checkAssets(paths: string[], root: string, errors: string[]) {
  const credits = existsSync(join(root, "docs/demo-credits.md")) ? readFileSync(join(root, "docs/demo-credits.md"), "utf8") : "";
  if (!credits) errors.push("docs/demo-credits.md غير موجود");
  for (const p of paths) {
    if (!/^\/demo\/(editorial|media|products|fashion)\/[\w.-]+$/.test(p)) errors.push(`مسار ملف غير متوقع: ${p}`);
    if (!existsSync(join(root, "public", p))) errors.push(`ملف غير موجود في public: ${p}`);
    const file = p.split("/").pop()!;
    const credited = p.startsWith("/demo/products/") || p.startsWith("/demo/fashion/")
      ? credits.includes(`\`${file}\``)
      : p.startsWith("/demo/media/")
        ? credits.includes(`public/demo/media/${file.replace(/(-\d+)?\.\w+$/, "")}.mp4`)
        : credits.includes(`public${p}`);
    if (credits && !credited) errors.push(`ملف بلا اعتماد في docs/demo-credits.md: ${p}`);
  }
}

/** يبني متجر العرض كما يزرعه السكربت ويفحصه. لا قاعدة ولا شبكة. */
export function verifyDemo(opts: { now?: number; root?: string } = {}): DemoCheck {
  const now = opts.now ?? Date.now();
  const root = opts.root ?? process.cwd();
  const errors: string[] = [];
  let data: DemoProduct[] = [];
  try {
    data = loadDemoProducts(join(root, "scripts/demo/data"));
  } catch (e) {
    return { errors: [`تعذّرت قراءة بيانات المنتجات: ${(e as Error).message}`], stats: { products: 0, variants: 0, soldOut: 0, lowStock: 0, reviews: 0, reviewedProducts: 0, questions: 0, productsWithSizeGuide: 0, assets: 0 } };
  }
  const rows = productRows(data, now);
  const variants = new Map(data.map((p) => [p.slug, variantsOf(p)]));
  const reviews = reviewsFor(data, rows, now);
  const questions = questionsFor(data, rows, now);
  const categoryIds = fakeCategoryIds(data);

  checkProducts(data, rows, errors);
  checkVariants(data, rows, variants, errors);
  checkReviews(rows, now, errors, reviews, questions);

  let bp: StoreBlueprint | null = null;
  try {
    bp = buildDemoBlueprint({ storeId: "00000000-0000-4000-8000-0000000000aa", email: "demo@colapia.com", categoryIds, productCount: data.length });
  } catch (e) {
    errors.push(`تعذّر بناء الـ Blueprint: ${(e as Error).message.slice(0, 400)}`);
  }
  let charts = 0;
  let assets: string[] = [];
  if (bp) {
    checkBlueprint(bp, data, errors);
    charts = checkSizeCharts(bp, data, rows, categoryIds, errors);
    assets = demoAssetPaths(bp, rows, [...variants.values()].flat());
    checkAssets(assets, root, errors);
  }

  return {
    errors,
    stats: {
      products: rows.length,
      variants: [...variants.values()].reduce((a, v) => a + v.length, 0),
      soldOut: rows.filter((r) => r.stock === 0).length,
      lowStock: rows.filter((r) => r.stock > 0 && r.stock <= 5).length,
      reviews: reviews.length,
      reviewedProducts: ratingTotals(reviews).size,
      questions: questions.length,
      productsWithSizeGuide: charts,
      assets: assets.length,
    },
  };
}

if (process.argv[1] && /verify-demo\.ts$/.test(process.argv[1])) {
  const r = verifyDemo();
  if (r.errors.length) {
    console.error(`✗ متجر العرض فيه ${r.errors.length} مشكلة:\n- ${r.errors.join("\n- ")}`);
    process.exit(1);
  }
  console.log("✓ متجر العرض سليم:", JSON.stringify(r.stats));
}
