import { describe, expect, it } from "vitest";
import { channelOf, inventoryReport, profitByProduct, repeatStats, resolvePeriod, salesByCategory, salesByChannel } from "@/lib/reports";

const NOW = new Date("2026-10-27T10:00:00Z");

describe("resolvePeriod", () => {
  it("آخر 7 أيام تشمل اليوم", () => {
    const p = resolvePeriod({ period: "7" }, NOW);
    expect(p.toKey).toBe("2026-10-27");
    expect(p.fromKey).toBe("2026-10-21");
  });
  it("هذا الشهر والشهر الماضي", () => {
    expect(resolvePeriod({ period: "month" }, NOW).fromKey).toBe("2026-10-01");
    const l = resolvePeriod({ period: "last_month" }, NOW);
    expect([l.fromKey, l.toKey]).toEqual(["2026-09-01", "2026-09-30"]);
  });
  it("الشهر الماضي في يناير هو ديسمبر السابق", () => {
    const l = resolvePeriod({ period: "last_month" }, new Date("2027-01-10T10:00:00Z"));
    expect([l.fromKey, l.toKey]).toEqual(["2026-12-01", "2026-12-31"]);
  });
  it("فترة مخصصة صالحة وغير صالحة", () => {
    const ok = resolvePeriod({ period: "custom", from: "2026-10-01", to: "2026-10-10" }, NOW);
    expect(ok.preset).toBe("custom");
    expect(ok.toKey).toBe("2026-10-10");
    expect(resolvePeriod({ period: "custom", from: "2026-10-10", to: "2026-10-01" }, NOW).preset).toBe("30");
    expect(resolvePeriod({ period: "custom", from: "2026-02-31", to: "2026-03-05" }, NOW).preset).toBe("30");
    expect(resolvePeriod({ period: "custom", from: "2024-01-01", to: "2026-10-10" }, NOW).preset).toBe("30");
  });
});

describe("profitByProduct", () => {
  it("يحسب الربح والهامش ويرتب بالإيراد", () => {
    const r = profitByProduct([
      { productId: "a", name: "أ", categoryName: null, qty: 2, revenuePiasters: 20000, costPiasters: 3000 },
      { productId: "a", name: "أ", categoryName: null, qty: 1, revenuePiasters: 10000, costPiasters: 3000 },
      { productId: "b", name: "ب", categoryName: null, qty: 1, revenuePiasters: 50000, costPiasters: 10000 },
    ]);
    expect(r[0]!.key).toBe("b");
    const a = r.find((x) => x.key === "a")!;
    expect(a.qty).toBe(3);
    expect(a.profitPiasters).toBe(30000 - 9000);
    expect(a.marginPct).toBe(70);
  });
  it("تكلفة مجهولة = لا ربح مخترع", () => {
    const [p] = profitByProduct([{ productId: "a", name: "أ", categoryName: null, qty: 1, revenuePiasters: 100, costPiasters: null }]);
    expect(p!.profitPiasters).toBeNull();
    expect(p!.marginPct).toBeNull();
  });
});

describe("التقسيمات", () => {
  it("القسم والنسبة", () => {
    const s = salesByCategory([
      { productId: "a", name: "أ", categoryName: "ملابس", qty: 1, revenuePiasters: 300, costPiasters: null },
      { productId: "b", name: "ب", categoryName: null, qty: 1, revenuePiasters: 100, costPiasters: null },
    ]);
    expect(s[0]!.label).toBe("ملابس");
    expect(s[0]!.sharePct).toBe(75);
    expect(s[1]!.label).toBe("بدون قسم");
  });
  it("القناة", () => {
    expect(channelOf("campaign:x").label).toBe("حملات إعلانية");
    expect(channelOf("chat:instagram").label).toBe("شات · إنستجرام");
    expect(channelOf(null).key).toBe("storefront");
    const s = salesByChannel([{ source: "storefront", totalPiasters: 100 }, { source: "campaign:a", totalPiasters: 300 }, { source: "campaign:b", totalPiasters: 100 }]);
    expect(s[0]!.key).toBe("campaign");
    expect(s[0]!.orders).toBe(2);
  });
});

describe("inventoryReport", () => {
  const base = { categoryName: null, trackStock: true, lastSoldAt: null as Date | null, soldInWindow: 0 };
  it("القيمة والراكد وأيام التغطية", () => {
    const r = inventoryReport(
      [
        { ...base, id: "1", name: "أ", stock: 10, pricePiasters: 1000, costPiasters: 400, soldInWindow: 30, lastSoldAt: new Date("2026-10-26T00:00:00Z") },
        { ...base, id: "2", name: "ب", stock: 5, pricePiasters: 2000, costPiasters: 900 },
        { ...base, id: "3", name: "ج", stock: 0, pricePiasters: 1, costPiasters: 1 },
        { ...base, id: "4", name: "د", stock: null, pricePiasters: 1, costPiasters: 1 },
      ],
      30,
      NOW
    );
    expect(r.lines).toHaveLength(2);
    expect(r.units).toBe(15);
    expect(r.retailValue).toBe(20000);
    expect(r.costValue).toBe(4000 + 4500);
    expect(r.deadCount).toBe(1);
    expect(r.lines.find((l) => l.id === "1")!.daysCover).toBe(10);
  });
  it("تكلفة ناقصة تُخفي الإجمالي", () => {
    const r = inventoryReport([{ ...base, id: "1", name: "أ", stock: 1, pricePiasters: 10, costPiasters: null }], 30, NOW);
    expect(r.costValue).toBeNull();
    expect(r.costKnownPct).toBe(0);
  });
});

describe("repeatStats", () => {
  it("نسبة العائدين", () => {
    const r = repeatStats([{ orders: 1, spentPiasters: 100 }, { orders: 3, spentPiasters: 500 }]);
    expect(r.repeatPct).toBe(50);
    expect(r.avgOrdersPerCustomer).toBe(2);
    expect(r.avgValuePiasters).toBe(300);
    expect(repeatStats([]).repeatPct).toBeNull();
  });
});
