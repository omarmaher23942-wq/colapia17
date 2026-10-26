import { describe, expect, it } from "vitest";
import { addRecent, arrangeResults, foldTerm, highlightParts, parseRecent, requestProductMessage } from "@/lib/search-ui";

describe("search-ui", () => {
  it("يوحّد الكلمات العربية", () => {
    expect(foldTerm("  أحذيَة  ١٢ ")).toBe("احذيه 12");
  });
  it("يضيف الأخيرة بلا تكرار وبحد أقصى", () => {
    let l: string[] = [];
    for (const t of ["حذاء", "شنطة", "حذاء", "ا", "قميص", "بنطلون", "جاكيت", "ساعة", "نظارة"]) l = addRecent(l, t);
    expect(l[0]).toBe("نظارة");
    expect(l).toHaveLength(6);
    expect(new Set(l).size).toBe(6);
    expect(addRecent(["حذاء"], "الحذاء ")[0]).toBe("الحذاء");
    expect(addRecent(["حذاء"], "إ").length).toBe(1);
  });
  it("يقرأ المخزن التالف", () => {
    expect(parseRecent("{x")).toEqual([]);
    expect(parseRecent(null)).toEqual([]);
    expect(parseRecent(JSON.stringify(["حذاء", 3, "a"]))).toEqual(["حذاء"]);
  });
  it("يبرز الكلمات المطابقة", () => {
    const p = highlightParts("حذاء رياضي أسود", "رياضي حذاء");
    expect(p.filter((x) => x.hit).map((x) => x.text)).toEqual(["حذاء", "رياضي"]);
    expect(p.map((x) => x.text).join("")).toBe("حذاء رياضي أسود");
    expect(highlightParts("abc", "a(").every((x) => !x.hit || x.text === "a")).toBe(true);
    expect(highlightParts("نص", "")).toEqual([{ text: "نص", hit: false }]);
  });
  it("يرتب ويصفي النتائج", () => {
    const rows = [
      { id: 1, pricePiasters: 300, createdAt: "2026-01-01", trackStock: true, stock: 0 },
      { id: 2, pricePiasters: 200, createdAt: "2026-02-01" },
      { id: 3, pricePiasters: 100, createdAt: "2026-03-01" },
    ];
    expect(arrangeResults(rows, { sort: "relevance", inStockOnly: false }).map((r) => r.id)).toEqual([2, 3, 1]);
    expect(arrangeResults(rows, { sort: "price_asc", inStockOnly: false }).map((r) => r.id)).toEqual([3, 2, 1]);
    expect(arrangeResults(rows, { sort: "newest", inStockOnly: true }).map((r) => r.id)).toEqual([3, 2]);
    expect(arrangeResults(rows, { sort: "price_desc", inStockOnly: false, max: 250 }).map((r) => r.id)).toEqual([2, 3]);
  });
  it("رسالة طلب منتج", () => {
    expect(requestProductMessage(" فستان ", "نور")).toContain("«فستان»");
  });
});
