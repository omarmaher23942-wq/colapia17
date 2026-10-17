import { describe, expect, it } from "vitest";
import { funnelSteps, weakestStep, type FunnelCounts } from "@/lib/sales-funnel";

const c: FunnelCounts = { conversations: 100, leads: 40, created: 30, setupDone: 18, paid: 6, paidGolden: 1, revenue: 749700, renewals: 0 };

describe("sales funnel v2", () => {
  it("computes each step rate from the previous one", () => {
    expect(funnelSteps(c).map((s) => [s.key, s.rate])).toEqual([
      ["conversations", null],
      ["leads", 40],
      ["created", 75],
      ["setupDone", 60],
      ["paid", 33],
    ]);
  });
  it("has no rate without a base", () => {
    expect(funnelSteps({ ...c, conversations: 0 })[1]!.rate).toBeNull();
  });
  it("finds the weakest step with enough volume", () => {
    expect(weakestStep(funnelSteps(c))?.key).toBe("paid");
    expect(weakestStep(funnelSteps({ ...c, conversations: 3, leads: 1, created: 1, setupDone: 0, paid: 0 }))).toBeNull();
  });
  it("never exceeds 100%", () => {
    expect(funnelSteps({ ...c, created: 99 })[2]!.rate).toBe(100);
  });
});
