import { describe, expect, it } from "vitest";
import {
  DEFAULT_PRICING,
  agentPricingFacts,
  goldenAvailability,
  limitHighlights,
  previewLines,
  pricingFrom,
  quote,
  startingPrice,
  validatePricing,
  type PricingModel,
} from "@/lib/platform-pricing";
import { timingsFrom, trialSchedule } from "@/lifecycle/timings-rules";

const clone = (): PricingModel => JSON.parse(JSON.stringify(DEFAULT_PRICING));

describe("نموذج الأسعار v4", () => {
  it("الافتراضي: تجهيز 2,999، باقات 199/499/1,499 شهرياً، مدد 1/3/6/12، المميَّزة «النمو»، والذهبية GOLDEN999 لـ10", () => {
    expect(DEFAULT_PRICING.build.price).toBe(2999);
    expect(DEFAULT_PRICING.plans.map((p) => [p.id, p.monthly])).toEqual([
      ["basic", 199],
      ["growth", 499],
      ["pro", 1499],
    ]);
    expect(DEFAULT_PRICING.months).toEqual([1, 3, 6, 12]);
    expect(DEFAULT_PRICING.featured).toBe("growth");
    expect(DEFAULT_PRICING.golden).toEqual({ enabled: true, code: "GOLDEN999", buildPrice: 999, seats: 10, firstMonthFree: true });
    expect(DEFAULT_PRICING.plans[0]!.limits.customDomain).toBe(false);
    expect(DEFAULT_PRICING.plans[1]!.limits.products).toBe(2000);
    expect(startingPrice(DEFAULT_PRICING)).toBe(199);
  });

  it("إعداد فارغ أو تالف = الافتراضي", () => {
    expect(pricingFrom(null)).toEqual(DEFAULT_PRICING);
    expect(pricingFrom("x")).toEqual(DEFAULT_PRICING);
  });

  it("الأشكال القديمة (v3 والسلّم) تُستبدل بالافتراضي مع نقل المقاعد وحالة التشغيل فقط", () => {
    const v3 = pricingFrom({ v: 3, plans: [{ months: 3, price: 1 }], golden: { enabled: false, code: "GOLDEN499", price: 499, months: 3, seats: 7 } });
    expect(v3.plans).toEqual(DEFAULT_PRICING.plans);
    expect(v3.golden).toEqual({ ...DEFAULT_PRICING.golden, enabled: false, seats: 7 });
    expect(pricingFrom({ tiers: [{ upTo: 5, price: 2499 }], golden: { seats: 3 } }).golden.seats).toBe(3);
  });

  it("v4 يُقرأ حقلاً حقلاً، وما فسد يأخذ الافتراضي", () => {
    const m = pricingFrom({
      v: 4,
      build: { price: 1500 },
      plans: [{ id: "basic", name: "البداية", monthly: 149, limits: { products: 100, storageBytes: -1, customDomain: true } }],
      months: [12, 3, 5, 3],
      featured: "nope",
      golden: { enabled: true, code: "bad code!", buildPrice: 500, seats: 4 },
    });
    expect(m.build.price).toBe(1500);
    expect(m.plans[0]).toMatchObject({ name: "البداية", monthly: 149, limits: { products: 100, storageBytes: DEFAULT_PRICING.plans[0]!.limits.storageBytes, customDomain: true } });
    expect(m.plans[1]).toEqual(DEFAULT_PRICING.plans[1]);
    expect(m.months).toEqual([3, 12]);
    expect(m.featured).toBe("growth");
    expect(m.golden).toEqual({ enabled: true, code: "GOLDEN999", buildPrice: 500, seats: 4, firstMonthFree: true });
  });

  it("المبلغ: الأولى = التجهيز + الباقة × الأشهر، والتجديد = الباقة × الأشهر، والذهبية تخفّض التجهيز فقط", () => {
    const setup = quote(DEFAULT_PRICING, { planId: "growth", months: 3, kind: "setup" });
    expect(setup.ok && [setup.build, setup.hosting, setup.total]).toEqual([2999, 1497, 4496]);
    expect(setup.ok && setup.lines).toHaveLength(2);
    const golden = quote(DEFAULT_PRICING, { planId: "basic", months: 1, kind: "setup", golden: true });
    expect(golden.ok && golden.total).toBe(999); // الشهر الأول من الأساسية هدية الدائرة الذهبية
    const renewal = quote(DEFAULT_PRICING, { planId: "pro", months: 12, kind: "renewal" });
    expect(renewal.ok && [renewal.build, renewal.total]).toEqual([0, 1499 * 12]);
    expect(quote(DEFAULT_PRICING, { planId: "pro", months: 2, kind: "setup" }).ok).toBe(false);
    expect(quote(DEFAULT_PRICING, { planId: "gold", months: 1, kind: "setup" }).ok).toBe(false);
    expect(quote(DEFAULT_PRICING, { planId: "basic", months: 1, kind: "renewal", golden: true }).ok).toBe(false);
  });

  it("مقاعد الدائرة الذهبية: المتاح = مفعّل وفيه مقعد", () => {
    const g = DEFAULT_PRICING.golden;
    expect(goldenAvailability(g, 3)).toEqual({ enabled: true, seatsUsed: 3, seatsLeft: 7, available: true });
    expect(goldenAvailability(g, 12).available).toBe(false);
    expect(goldenAvailability({ ...g, enabled: false }, 0).available).toBe(false);
  });

  it("تحقق المالك صارم برسالة واضحة", () => {
    expect(validatePricing(clone()).ok).toBe(true);
    const noMonths = clone();
    noMonths.months = [];
    expect(validatePricing(noMonths)).toMatchObject({ ok: false });
    const badPrice = clone();
    badPrice.plans[1]!.monthly = 0;
    const r = validatePricing(badPrice);
    expect(!r.ok && r.error).toContain("النمو");
    const goldenHigher = clone();
    goldenHigher.golden.buildPrice = 5000;
    expect(validatePricing(goldenHigher).ok).toBe(false);
    const badCode = clone();
    badCode.golden.code = "x";
    expect(validatePricing(badCode).ok).toBe(false);
    const badLimit = clone();
    (badLimit.plans[0]!.limits as Record<string, unknown>).products = "abc";
    expect(validatePricing(badLimit).ok).toBe(false);
  });

  it("حقائق الوكيل: كل الباقات والتجهيز، والذهبية فقط حين تكون متاحة، بلا أي ذكر للهامش", () => {
    const on = agentPricingFacts(DEFAULT_PRICING, 4);
    expect(on).toContain("2,999");
    expect(on).toContain("499");
    expect(on).toContain("الدائرة الذهبية");
    expect(on).toContain("6 من 10");
    expect(agentPricingFacts(DEFAULT_PRICING, 10)).not.toContain("الدائرة الذهبية");
    expect(on).not.toMatch(/هامش|ربح|تكلفة فعلية/);
  });

  it("المعاينة والحدود المعروضة", () => {
    const p = previewLines(DEFAULT_PRICING, 0);
    expect(p.billing[0]).toContain("الإجمالي");
    expect(p.landing.length).toBe(4);
    const h = limitHighlights(DEFAULT_PRICING.plans[0]!.limits);
    expect(h.join(" ")).toContain("300");
    expect(h.join(" ")).toContain("بلا نطاق خاص");
    expect(JSON.stringify(p)).not.toContain("مدى الحياة");
  });
});

describe("مدد ما بعد التسليم", () => {
  it("الافتراضي 24/24/24 والقيم الشاذة تُرفض", () => {
    expect(timingsFrom(null)).toEqual({ trialHours: 24, noticeHours: 24, deleteHours: 24, graceDays: 3 });
    expect(timingsFrom({ trialHours: 0, noticeHours: 99999, deleteHours: 12, graceDays: 7 })).toEqual({ trialHours: 24, noticeHours: 24, deleteHours: 12, graceDays: 7 });
    expect(timingsFrom({ graceDays: 99 }).graceDays).toBe(3);
  });
  it("المواعيد: أفكار في المنتصف، دفع قبل النهاية بساعتين، إيقاف، تنبيه أخير، حذف (72 ساعة افتراضياً)", () => {
    const d = new Date("2026-01-01T00:00:00Z");
    const s = trialSchedule(d, timingsFrom(null));
    const h = (x: Date) => (x.getTime() - d.getTime()) / 3_600_000;
    expect([h(s.ideas), h(s.pay), h(s.freeze), h(s.lastChance), h(s.purge)]).toEqual([12, 22, 24, 48, 72]);
    const short = trialSchedule(d, { trialHours: 2, noticeHours: 1, deleteHours: 1, graceDays: 3 });
    expect(h(short.ideas)).toBe(1);
    expect(h(short.pay)).toBeGreaterThan(h(short.ideas));
    expect(h(short.purge)).toBe(4);
  });
});
