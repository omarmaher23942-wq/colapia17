import { describe, expect, it } from "vitest";
import {
  DEFAULT_PRICING,
  goldenAvailability,
  normalizeCoupon,
  perMonth,
  planAmount,
  previewLines,
  pricingFrom,
  startingPrice,
  validateGolden,
  validatePlans,
} from "@/lib/platform-pricing";
import { timingsFrom, trialSchedule } from "@/lifecycle/timings-rules";

describe("نموذج الأسعار v3", () => {
  it("الافتراضي: 3/6/12 شهراً بسعري أول مرة والتجديد، والمميَّزة 12، والدائرة الذهبية GOLDEN499", () => {
    expect(DEFAULT_PRICING.plans).toEqual([
      { months: 3, price: 1999, renewal: 999 },
      { months: 6, price: 2499, renewal: 1699 },
      { months: 12, price: 3499, renewal: 2499 },
    ]);
    expect(DEFAULT_PRICING.featured).toBe(12);
    expect(DEFAULT_PRICING.golden).toEqual({ enabled: true, code: "GOLDEN499", price: 499, months: 3, seats: 5 });
    expect(normalizeCoupon(" golden ٤٩٩ ")).toBe("GOLDEN499");
  });
  it("إعداد فارغ أو تالف = الافتراضي", () => {
    expect(pricingFrom(null)).toEqual(DEFAULT_PRICING);
    expect(pricingFrom({ v: 3, plans: "x", golden: 5 })).toEqual(DEFAULT_PRICING);
  });
  it("الشكل القديم (السلّم) يُقرأ بأمان: افتراضي الباقات مع إبقاء عدد المقاعد فقط", () => {
    const m = pricingFrom({ tiers: [{ upTo: 5, price: 2499 }], basePrice: 2499, renewal: 1299, golden: { code: "GOLDEN599", price: 599, seats: 8 } });
    expect(m.plans).toEqual(DEFAULT_PRICING.plans);
    expect(m.golden).toEqual({ ...DEFAULT_PRICING.golden, seats: 8 });
  });
  it("v3 يُقرأ باقةً باقة وما فسد يأخذ الافتراضي", () => {
    const m = pricingFrom({
      v: 3,
      plans: [{ months: 3, price: 2000, renewal: 1000 }, { months: 6, price: -5, renewal: "x" }, { months: 12, price: 4000, renewal: 3000 }, { months: 9, price: 1, renewal: 1 }],
      featured: 6,
      golden: { enabled: false, code: "vip2027", price: 700, months: 2, seats: 3 },
    });
    expect(m.plans).toEqual([{ months: 3, price: 2000, renewal: 1000 }, { months: 6, price: 2499, renewal: 1699 }, { months: 12, price: 4000, renewal: 3000 }]);
    expect(m.featured).toBe(6);
    expect(m.golden).toEqual({ enabled: false, code: "VIP2027", price: 700, months: 2, seats: 3 });
    expect(pricingFrom({ v: 3, featured: 9 }).featured).toBe(12);
  });
  it("المبلغ بنوع الدفعة: أول مرة أو تجديد، ومدة غير معروفة = null", () => {
    expect(planAmount(DEFAULT_PRICING, 6, "setup")).toBe(2499);
    expect(planAmount(DEFAULT_PRICING, "12", "renewal")).toBe(2499);
    expect(planAmount(DEFAULT_PRICING, 4, "setup")).toBeNull();
    expect(startingPrice(DEFAULT_PRICING)).toBe(1999);
    expect(perMonth(3499, 12)).toBe(292);
  });
  it("مقاعد الدائرة الذهبية: المتاح = مفعّل وفيه مقعد", () => {
    const g = DEFAULT_PRICING.golden;
    expect(goldenAvailability(g, 2)).toEqual({ enabled: true, seatsUsed: 2, seatsLeft: 3, available: true });
    expect(goldenAvailability(g, 5).available).toBe(false);
    expect(goldenAvailability(g, 9).seatsLeft).toBe(0);
    expect(goldenAvailability({ ...g, enabled: false }, 0).available).toBe(false);
  });
  it("تحقق المالك من الباقات: يرفض الناقص والفاسد برسالة", () => {
    const ok = validatePlans({ plans: DEFAULT_PRICING.plans, featured: 12 });
    expect(ok.ok).toBe(true);
    const bad = validatePlans({ plans: [{ months: 3, price: 0, renewal: 5 }, ...DEFAULT_PRICING.plans.slice(1)], featured: 12 });
    expect(bad.ok).toBe(false);
    expect(validatePlans({ plans: DEFAULT_PRICING.plans, featured: 5 }).ok).toBe(false);
    expect(validatePlans({ plans: DEFAULT_PRICING.plans.slice(0, 2), featured: 12 }).ok).toBe(false);
  });
  it("تحقق المالك من الدائرة الذهبية", () => {
    expect(validateGolden({ enabled: true, code: "abc", price: 499, months: 3, seats: 5 }).ok).toBe(false);
    expect(validateGolden({ enabled: true, code: "abcd1", price: 0, months: 3, seats: 5 }).ok).toBe(false);
    expect(validateGolden({ enabled: true, code: "abcd1", price: 499, months: 40, seats: 5 }).ok).toBe(false);
    const v = validateGolden({ enabled: false, code: "gold-9", price: 499, months: 3, seats: 0 });
    expect(v).toEqual({ ok: true, golden: { enabled: false, code: "GOLD-9", price: 499, months: 3, seats: 0 } });
  });
  it("معاينة المالك: الذهبية تظهر فقط حين تكون متاحة", () => {
    expect(previewLines(DEFAULT_PRICING, 1).agent).toContain("الدائرة الذهبية");
    expect(previewLines(DEFAULT_PRICING, 1).landing.at(-1)).toContain("متبقٍ 4 من 5");
    const off = previewLines({ ...DEFAULT_PRICING, golden: { ...DEFAULT_PRICING.golden, enabled: false } }, 0);
    expect(off.landing).toHaveLength(3);
    expect(off.agent).toContain("متوقفة");
  });
  it("لا كلمة «مدى الحياة» في المعاينات", () => {
    const l = previewLines(DEFAULT_PRICING, 0);
    expect([...l.landing, ...l.billing, l.agent].join(" ")).not.toContain("مدى الحياة");
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
