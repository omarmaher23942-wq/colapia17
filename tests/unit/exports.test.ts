import { describe, expect, it } from "vitest";
import { mapHeader } from "@/lib/product-import";
import { PRODUCT_EXPORT_HEADERS, discountRows, productRows } from "@/lib/exports";

describe("exports", () => {
  it("ترويسات المنتجات يفهمها الاستيراد كلها", () => {
    const m = mapHeader([...PRODUCT_EXPORT_HEADERS]);
    for (const f of ["name", "price", "compareAt", "cost", "stock", "sku", "category", "description", "images"]) expect(m).toHaveProperty(f);
  });
  it("صف المنتج بالجنيه والكمية فارغة بلا تتبع", () => {
    const [r] = productRows([{ name: "أ", price: 12550, compareAt: null, cost: 5000, stock: 4, trackStock: false, sku: "S1", category: "ق", description: null, images: ["https://a/1.jpg", "https://a/2.jpg"], status: "active" }]);
    expect(r).toEqual(["أ", 125.5, "", 50, "", "S1", "ق", null, "https://a/1.jpg https://a/2.jpg", "منشور"]);
  });
  it("الخصم بالنسبة والمبلغ", () => {
    const rows = discountRows([
      { code: "A", type: "percentage", value: 10, minSubtotal: null, maxUses: null, used: 2, startsAt: null, endsAt: null, active: true },
      { code: "B", type: "fixed", value: 5000, minSubtotal: 20000, maxUses: 5, used: 0, startsAt: null, endsAt: null, active: false },
    ]);
    expect(rows[0]![2]).toBe("10%");
    expect(rows[1]![2]).toBe(50);
    expect(rows[1]![8]).toBe("لا");
  });
});
