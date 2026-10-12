import { describe, expect, it } from "vitest";
import { reportMonth, reportParagraphs, type ReportInput } from "@/lib/monthly-report";

const base: ReportInput = { storeName: "نوفا", monthLabel: "سبتمبر 2026", cur: { orders: 40, sales: 1200000, visitors: 2000 }, prev: { orders: 32, sales: 1000000, visitors: 2000 }, delivered: 35, returned: 2, topProducts: [{ name: "فستان", qty: 12 }], bestCampaign: { name: "ريلز", orders: 9 }, recoveredCarts: 3, requestsLeft: 2, renewBy: null };

describe("monthly report", () => {
  it("reports last Cairo month", () => {
    const r = reportMonth(new Date("2026-10-01T12:00:00Z"));
    expect(r.key).toBe("2026-09");
    expect(r.label).toBe("سبتمبر 2026");
    expect(r.to.getTime() - r.from.getTime()).toBeGreaterThan(29 * 86400_000);
  });

  it("states real numbers with honest comparisons", () => {
    const t = reportParagraphs(base).join("\n");
    expect(t).toContain("(+25% عن الشهر السابق)");
    expect(t).toContain("40");
    expect(t).toContain("(مثل الشهر السابق)");
    expect(t).toContain("فستان (12)");
    expect(t).toContain("«ريلز»");
    expect(t).toContain("سلات متروكة");
  });

  it("omits what it does not know", () => {
    const t = reportParagraphs({ ...base, prev: null, bestCampaign: null, recoveredCarts: 0, requestsLeft: null, topProducts: [], delivered: 0, returned: 0 }).join("\n");
    expect(t).not.toMatch(/الشهر السابق|حملة|سلة|تعديل|الأكثر/);
    expect(reportParagraphs({ ...base, cur: { orders: 0, sales: 0, visitors: 0 } })[0]).toContain("لم تصل");
  });
});
