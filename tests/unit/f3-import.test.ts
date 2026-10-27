import { describe, expect, it } from "vitest";
import { candidatesFromPlatform, detectPlatform, stripHtml } from "@/lib/platform-import";
import { applyDiscount, describeFromData, duplicateNames, fillMissingDescriptions, priceFlags, roundPrice, roundPrices, tidyName } from "@/lib/import-checks";
import { normalizeCandidate, type Candidate } from "@/lib/import-candidates";

const c = (o: Partial<Candidate>) => normalizeCandidate({ name: "منتج", ...o })!;

describe("platform-import", () => {
  const shop = [
    ["Handle", "Title", "Body (HTML)", "Type", "Option1 Name", "Option1 Value", "Option2 Name", "Option2 Value", "Variant Price", "Variant Compare At Price", "Variant Inventory Qty", "Image Src"],
    ["tee", "تيشيرت قطن", "<p>قطن <b>100%</b></p>", "ملابس", "Size", "M", "Color", "أسود", "300", "400", "5", "https://x.com/a.jpg"],
    ["tee", "", "", "", "Size", "L", "Color", "أسود", "300", "", "3", ""],
    ["bag", "شنطة", "", "", "Title", "Default Title", "", "", "150", "", "2", ""],
  ];
  it("يكتشف Shopify ويجمّع التركيبات", () => {
    expect(detectPlatform(shop[0]!)).toBe("shopify");
    const r = candidatesFromPlatform(shop)!;
    expect(r.candidates).toHaveLength(2);
    const t = r.candidates[0]!;
    expect(t.sizes).toEqual(["M", "L"]);
    expect(t.colors.length).toBe(1);
    expect(t.stock).toBe(8);
    expect(t.price).toBe(300);
    expect(t.compareAt).toBe(400);
    expect(t.description).toBe("قطن 100%");
  });
  it("يقرأ WooCommerce ويتخطى التركيبات", () => {
    const rows = [
      ["Type", "Name", "Regular price", "Sale price", "Categories", "Images", "Stock", "Attribute 1 name", "Attribute 1 value(s)"],
      ["variable", "حذاء", "500", "400", "أحذية > رجالي", "https://x.com/1.jpg, https://x.com/2.jpg", "7", "Size", "40, 41"],
      ["variation", "حذاء - 40", "500", "", "", "", "", "", ""],
    ];
    const r = candidatesFromPlatform(rows)!;
    expect(r.platform).toBe("woocommerce");
    expect(r.candidates).toHaveLength(1);
    expect(r.candidates[0]).toMatchObject({ price: 400, compareAt: 500, category: "رجالي", stock: 7 });
    expect(r.candidates[0]!.images).toHaveLength(2);
  });
  it("يقرأ سلة", () => {
    const r = candidatesFromPlatform([["اسم المنتج", "سعر المنتج", "السعر المخفض", "تصنيف المنتج", "SKU"], ["عباية", "900", "700", "عبايات", "A1"]])!;
    expect(r.platform).toBe("salla");
    expect(r.candidates[0]).toMatchObject({ price: 700, compareAt: 900 });
  });
  it("لا يخطئ في ملف مجهول", () => {
    expect(candidatesFromPlatform([["اسم", "سعر"], ["a", "1"]])).toBeNull();
  });
  it("stripHtml", () => {
    expect(stripHtml("<ul><li>أ</li><li>ب &amp; ج</li></ul>")).toBe("• أ\n• ب & ج");
  });
});

describe("import-checks", () => {
  it("أسعار شاذة", () => {
    const items = [100, 120, 110, 130, 5000, 3].map((p) => c({ price: p, name: `م${p}` }));
    const kinds = Object.fromEntries(priceFlags(items).map((f) => [items.find((i) => i.id === f.id)!.price, f.kind]));
    expect(kinds).toEqual({ 5000: "high", 3: "tiny" });
  });
  it("أسماء مكررة", () => {
    const a = c({ name: "تيشيرت أبيض" });
    const b = c({ name: "تيشيرت  ابيض" });
    const d = c({ name: "حقيبة" });
    const dup = duplicateNames([a, b, d], ["حقيبه"]);
    expect([...dup].sort()).toEqual([a.id, b.id, d.id].sort());
  });
  it("تقريب الأسعار", () => {
    expect(roundPrice(197, "5")).toBe(195);
    expect(roundPrice(203, "10")).toBe(200);
    expect(roundPrice(200, "9")).toBe(199);
    expect(roundPrice(2, "10")).toBe(10);
    const [x] = roundPrices([c({ price: 203, compareAt: 204 })], "10");
    expect(x!.price).toBe(200);
    expect(x!.compareAt).toBe(204);
  });
  it("خصم جماعي", () => {
    const [x] = applyDiscount([c({ price: 200 })], 25);
    expect(x).toMatchObject({ price: 150, compareAt: 200 });
    expect(applyDiscount([c({ price: 200 })], 95)[0]!.price).toBe(200);
  });
  it("وصف من البيانات فقط", () => {
    expect(describeFromData(c({ name: "قميص", colors: ["أسود"], sizes: ["M", "L"] }))).toContain("بلون أسود");
    expect(describeFromData(c({ name: "قميص" }))).toBe("");
    const r = fillMissingDescriptions([c({ colors: ["أسود"] }), c({ description: "موجود" })]);
    expect(r.filled).toBe(1);
  });
  it("تنظيف الاسم", () => {
    expect(tidyName("🔥 تيشيرت قطن ✨ 350 جنيه")).toBe("تيشيرت قطن");
  });
});
