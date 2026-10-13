import { describe, expect, it } from "vitest";
import { readinessScore, readinessSteps, type ReadinessInput } from "@/lib/store-readiness";

const base: ReadinessInput = {
  activeProducts: 6, activeWithoutImages: 0, activeWithCost: 6, activeShippingZones: 27, flatShipping: false, hasOrders: true, hasTestOrder: true,
  sizeProducts: 0, hasSizeChart: false, hasLogo: true, hasWhatsapp: true,
  payments: { cod: true, vodafoneCash: { enabled: false, ready: false }, instapay: { enabled: false, ready: false } },
  policySet: true, hasPixel: false, customDomain: false,
};
const keys = (i: ReadinessInput) => readinessSteps(i, "/s").map((s) => s.key);
const step = (i: ReadinessInput, k: string) => readinessSteps(i, "/s").find((s) => s.key === k)!;

describe("readiness", () => {
  it("is 100% with optional steps open", () => {
    expect(readinessScore(readinessSteps(base, "/s")).pct).toBe(100);
  });
  it("flags a transfer method with no number", () => {
    const s = step({ ...base, payments: { ...base.payments, vodafoneCash: { enabled: true, ready: false } } }, "payments");
    expect(s.ok).toBe(false);
    expect(s.why).toContain("بلا رقم");
  });
  it("asks for a size guide only when products have sizes", () => {
    expect(keys(base)).not.toContain("sizes");
    expect(step({ ...base, sizeProducts: 3 }, "sizes").ok).toBe(false);
  });
  it("treats a flat rate as shipping set and hides the domain step when unavailable", () => {
    expect(step({ ...base, activeShippingZones: 0, flatShipping: true }, "shipping").ok).toBe(true);
    expect(keys({ ...base, customDomain: null })).not.toContain("domain");
  });
  it("drafted stores start with policies off", () => {
    expect(readinessScore(readinessSteps({ ...base, policySet: false, hasOrders: false, hasTestOrder: false }, "/s")).done).toBe(readinessScore(readinessSteps(base, "/s")).total - 3);
  });
});
