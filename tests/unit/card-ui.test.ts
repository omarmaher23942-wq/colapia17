import { describe, expect, it } from "vitest";
import { cardBadges, cardRating, cardSwatches, effectiveStock, isSoldOut } from "@/lib/card-ui";

const base = { trackStock: true, stock: 5, pricePiasters: 10000, compareAtPiasters: null, createdAt: new Date("2026-01-01"), ratingCount: 0, ratingSum: 0 };
const now = new Date("2026-10-17");

describe("card ui", () => {
  it("مخزون التركيبات: null = متاح دائماً", () => {
    expect(effectiveStock({ ...base, variants: [{ isAvailable: true, stock: null }, { isAvailable: true, stock: 0 }] })).toBeNull();
    expect(isSoldOut({ ...base, variants: [{ isAvailable: true, stock: 0 }, { isAvailable: false, stock: 4 }] })).toBe(true);
    expect(effectiveStock({ ...base, trackStock: false, stock: 0 })).toBeNull();
  });
  it("الشارات", () => {
    expect(cardBadges({ ...base, stock: 0 }, now)).toEqual([{ key: "soldOut", tone: "muted" }]);
    const sale = cardBadges({ ...base, compareAtPiasters: 20000, isBestSeller: true, createdAt: new Date("2026-10-10") }, now);
    expect(sale.map((b) => b.key)).toEqual(["sale", "best"]);
    expect(sale[0]?.pct).toBe(50);
    expect(cardBadges({ ...base, createdAt: new Date("2026-10-10") }, now).map((b) => b.key)).toEqual(["new"]);
    expect(cardBadges(base, now)).toEqual([]);
  });
  it("الألوان", () => {
    const s = cardSwatches({
      optionNames: ["اللون", "المقاس"],
      variants: ["أسود", "أحمر", "أزرق", "أخضر", "أصفر", "وردي"].map((c, i) => ({ isAvailable: true, stock: 1, optionValues: [c, "M"], sortOrder: i })),
    });
    expect(s.items).toHaveLength(4);
    expect(s.more).toBe(2);
    expect(cardSwatches({ optionNames: ["المقاس"], variants: [{ isAvailable: true, stock: 1, optionValues: ["M"] }] }).items).toEqual([]);
  });
  it("التقييم يشترط 3", () => {
    expect(cardRating({ ratingCount: 2, ratingSum: 10 })).toBeNull();
    expect(cardRating({ ratingCount: 4, ratingSum: 18 })?.avg).toBe(4.5);
  });
});
