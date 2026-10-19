import { describe, expect, it } from "vitest";
import { DEFAULT_PRICING, agentPricingFacts, pricingFrom, quote, validatePricing } from "@/lib/platform-pricing";
import { landingOffer } from "@/lib/landing-pricing";

describe("الدائرة الذهبية: الشهر الأول مجاناً", () => {
  it("الأساسية لشهر = رسوم الذهبية فقط", () => {
    const q = quote(DEFAULT_PRICING, { planId: "basic", months: 1, golden: true, kind: "setup" });
    if (!q.ok) throw new Error(q.error);
    expect(q.credit).toBe(199);
    expect(q.total).toBe(999);
    expect(q.lines.at(-1)?.amount).toBe(-199);
  });

  it("باقة أعلى وأشهر أكثر: الخصم بسعر الأساسية فقط", () => {
    const q = quote(DEFAULT_PRICING, { planId: "growth", months: 3, golden: true, kind: "setup" });
    if (!q.ok) throw new Error(q.error);
    expect(q.total).toBe(999 + 499 * 3 - 199);
  });

  it("العادي والتجديد بلا خصم، والإيقاف يلغيه", () => {
    const reg = quote(DEFAULT_PRICING, { planId: "basic", months: 1, kind: "setup" });
    if (!reg.ok) throw new Error(reg.error);
    expect(reg.credit).toBe(0);
    expect(reg.total).toBe(2999 + 199);
    const off = { ...DEFAULT_PRICING, golden: { ...DEFAULT_PRICING.golden, firstMonthFree: false } };
    const q = quote(off, { planId: "basic", months: 1, golden: true, kind: "setup" });
    if (!q.ok) throw new Error(q.error);
    expect(q.total).toBe(999 + 199);
  });

  it("القراءة والتحقق يحفظان الحقل وينسبانه افتراضياً مفعّلاً", () => {
    expect(pricingFrom(DEFAULT_PRICING).golden.firstMonthFree).toBe(true);
    expect(pricingFrom({ ...DEFAULT_PRICING, golden: { ...DEFAULT_PRICING.golden, firstMonthFree: false } }).golden.firstMonthFree).toBe(false);
  });

  it("الوكيل والهبوط يذكران الهدية بأرقام حقيقية", () => {
    expect(agentPricingFacts(DEFAULT_PRICING, 0)).toContain("الشهر الأول");
    const o = landingOffer(DEFAULT_PRICING, 3);
    expect(o.golden?.seatsLeft).toBe(7);
    expect(o.golden?.firstMonthFree).toBe(true);
    expect(landingOffer(DEFAULT_PRICING, 10).golden).toBeNull();
    expect(validatePricing(DEFAULT_PRICING).ok).toBe(true);
  });
});
