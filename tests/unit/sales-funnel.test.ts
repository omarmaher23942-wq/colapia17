import { describe, expect, it } from "vitest";
import { funnelSteps, outreachSteps, weakestStep, type FunnelCounts } from "@/lib/sales-funnel";

const c: FunnelCounts = { outreach: { sent: 40, replied: 10, reachedForm: 4 }, conversations: 60, submitted: 18, delivered: 12, paid: 3, revenue: 749700, renewals: 0, deliveredCohortPaid: 3 };

describe("sales funnel", () => {
  it("computes each step rate from the previous one", () => {
    expect(funnelSteps(c).map((s) => s.rate)).toEqual([null, 30, 67, 25]);
    expect(outreachSteps(c.outreach).map((s) => s.rate)).toEqual([null, 25, 40]);
  });
  it("has no rate without a base", () => {
    expect(funnelSteps({ ...c, conversations: 0 })[1]!.rate).toBeNull();
  });
  it("finds the weakest step with enough volume", () => {
    expect(weakestStep(funnelSteps(c))?.key).toBe("paid");
    expect(weakestStep(funnelSteps({ ...c, conversations: 3, submitted: 1, delivered: 1, paid: 0 }))).toBeNull();
  });
});
