// متجر العرض V3: البيانات والـ Blueprint كما يزرعها scripts/demo/seed-demo.ts، مفحوصة دون اتصال (verify-demo.ts).
import { describe, expect, it } from "vitest";
import { blueprintSchema } from "@/blueprint/schema";
import { groundedItems } from "@/blueprint/facts";
import { verifyDemo, fakeCategoryIds } from "../../scripts/demo/verify-demo";
import {
  DEMO_THEME, HERO_VIDEO, VOLUME_SLUGS, VOLUME_TIERS, buildDemoBlueprint, demoFacts, demoStoreSettings, distribute, faqItems,
  loadDemoProducts, productRows, ratingTotals, reviewsFor, variantsOf, volumeLine,
} from "../../scripts/demo/catalog";

const NOW = Date.parse("2026-10-19T09:00:00Z");

describe("متجر العرض V3", () => {
  it("الفحص الكامل دون اتصال: مخطط صالح، وكل صورة موجودة ومعتمدة، وكل ادعاء صادق", () => {
    const r = verifyDemo({ now: NOW });
    expect(r.errors).toEqual([]);
    expect(r.stats.products).toBeGreaterThanOrEqual(60);
    expect(r.stats.soldOut).toBeGreaterThan(0);
    expect(r.stats.lowStock).toBeGreaterThan(0);
    expect(r.stats.reviews).toBeGreaterThan(60);
    expect(r.stats.productsWithSizeGuide).toBeGreaterThan(30);
  });

  it("حتمي: نفس النتائج في كل تشغيل", () => {
    const data = loadDemoProducts();
    const a = reviewsFor(data, productRows(data, NOW), NOW);
    const b = reviewsFor(data, productRows(data, NOW), NOW);
    expect(a).toEqual(b);
    const bp1 = buildDemoBlueprint({ storeId: "s", email: "demo@colapia.com", categoryIds: fakeCategoryIds(), productCount: data.length });
    const bp2 = buildDemoBlueprint({ storeId: "s", email: "demo@colapia.com", categoryIds: fakeCategoryIds(), productCount: data.length });
    expect(bp1).toEqual(bp2);
  });

  it("التصميم الافتراضي كاملاً وواجهة فيديو الأزياء", () => {
    const bp = buildDemoBlueprint({ storeId: "s", email: "demo@colapia.com", categoryIds: fakeCategoryIds(), productCount: 79 });
    expect(blueprintSchema.safeParse(bp).success).toBe(true);
    expect(bp.design.theme).toBe(DEMO_THEME);
    expect(bp.design.cardStyle).toBe("mercury");
    expect(bp.theme.mode).toBe("dark");
    const hero = bp.home[0]!;
    expect(hero.type === "hero" && hero.videoUrl).toBe(HERO_VIDEO);
    // الدفع عند الاستلام وحده، وبلا أرقام هاتف أو تحويل مخترعة، ولا فهرسة.
    expect(bp.payments.cod.enabled && !bp.payments.vodafoneCash.enabled && !bp.payments.instapay.enabled).toBe(true);
    expect(bp.channels.whatsappNumber ?? bp.channels.phone).toBeUndefined();
    expect(bp.seo.noIndex).toBe(true);
    expect(bp.shipping.inspectionAllowed).toBe(true);
    expect(bp.returns.windowDays).toBe(14);
  });

  it("الأسئلة الشائعة تمر بفحص الحقائق، وتسقط إن تغيرت السياسة", () => {
    const bp = buildDemoBlueprint({ storeId: "s", email: "demo@colapia.com", categoryIds: fakeCategoryIds(), productCount: 79 });
    const facts = demoFacts(bp);
    const items = faqItems(facts);
    const asGrounded = (list: typeof items, f = facts) => groundedItems(list.map((x) => ({ ...x, title: x.q, text: x.a })), f, "drop");
    expect(asGrounded(items)).toHaveLength(items.length);
    // لو صارت مدة الاستبدال 7 أيام لسقط سؤال الـ 14 يوماً (لا وعد قديم).
    const changed = demoFacts({ ...bp, returns: { ...bp.returns, windowDays: 7 } });
    expect(asGrounded(items, changed).some((x) => x.q.includes("الاستبدال"))).toBe(false);
  });

  it("إعدادات المتجر: نشط بباقة النمو واستضافة بعيدة، وعلامة العرض، ونشاط الأزياء", () => {
    const s = demoStoreSettings(NOW);
    expect(s).toMatchObject({ status: "active", plan: "growth", acceptingOrders: true, prefs: { demo: true }, onboarding: { nicheKind: "fashion" } });
    expect(s.hostingExpiresAt.getUTCFullYear()).toBe(2099);
  });

  it("التقييمات: مجاميع كل منتج مطابقة، وليست كلها 5 نجوم، ولا تقييم لمنتج قبل إضافته", () => {
    const data = loadDemoProducts();
    const rows = productRows(data, NOW);
    const reviews = reviewsFor(data, rows, NOW);
    const totals = ratingTotals(reviews);
    for (const [slug, t] of totals) {
      const own = reviews.filter((r) => r.slug === slug);
      expect(t).toEqual({ sum: own.reduce((a, r) => a + r.rating, 0), count: own.length });
    }
    expect(new Set(reviews.map((r) => r.rating)).size).toBeGreaterThanOrEqual(4);
    const born = new Map(rows.map((r) => [r.slug, r.createdAt.getTime()]));
    expect(reviews.every((r) => r.createdAt.getTime() > born.get(r.slug)!)).toBe(true);
  });

  it("المخزون: مجموع التركيبات، والوسط أولاً عند الندرة", () => {
    expect(distribute(3, 5)).toEqual([0, 1, 1, 1, 0]);
    expect(distribute(0, 4)).toEqual([0, 0, 0, 0]);
    expect(distribute(7, 0)).toEqual([]);
    const data = loadDemoProducts();
    const rows = new Map(productRows(data, NOW).map((r) => [r.slug, r]));
    for (const p of data.filter((x) => x.options.length)) expect(variantsOf(p).reduce((a, v) => a + v.stock, 0)).toBe(rows.get(p.slug)!.stock);
  });

  it("خصم الكمية على قطع متوفرة بلا سعر مشطوب، ونصه من الشرائح نفسها", () => {
    const rows = new Map(productRows(loadDemoProducts(), NOW).map((r) => [r.slug, r]));
    for (const s of VOLUME_SLUGS) expect(rows.get(s)).toMatchObject({ compareAtPiasters: null, volumeTiers: VOLUME_TIERS.map((t) => ({ ...t })) });
    expect(volumeLine()).toBe("خصم 5% عند شراء قطعتين و10% عند شراء 3 قطع فأكثر من المنتج نفسه");
  });
});
