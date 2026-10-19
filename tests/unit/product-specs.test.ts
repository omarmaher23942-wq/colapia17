import { describe, expect, it } from "vitest";
import { attributeFacets, compareRows, matchesFacets, optionSpecs, productSpecs, writtenSpecs } from "@/components/storefront/product/specs";

const phone = (cap: string, color: string, extra: Record<string, unknown> = {}) => ({
  attributes: [{ label: "السعة", value: cap }, { label: "الضمان", value: "سنة" }],
  optionNames: ["اللون"],
  variants: [{ optionValues: [color], isAvailable: true }, { optionValues: ["رمادي"], isAvailable: false }],
  ...extra,
});

describe("سمات المنتج الحقيقية", () => {
  it("تنظف السمات المكتوبة وتحذف المكرر والفارغ", () => {
    expect(writtenSpecs([{ label: " الخامة ", value: "قطن " }, { label: "الخامه", value: "x" }, { label: "", value: "y" }, null, "z"])).toEqual([{ label: "الخامة", value: "قطن" }]);
    expect(writtenSpecs("bad")).toEqual([]);
  });

  it("الخيارات من التركيبات المتاحة فقط", () => {
    expect(optionSpecs(phone("128GB", "أسود"))).toEqual([{ label: "اللون", values: ["أسود"] }]);
  });

  it("الجدول = المكتوب ثم الخيارات المتاحة", () => {
    expect(productSpecs(phone("128GB", "أسود"))).toEqual([
      { label: "السعة", value: "128GB" },
      { label: "الضمان", value: "سنة" },
      { label: "اللون المتاح", value: "أسود" },
    ]);
  });

  it("المقارنة تميّز المختلف وتضع «—» للناقص", () => {
    const rows = compareRows(phone("128GB", "أسود"), { attributes: [{ label: "السعة", value: "256GB" }, { label: "الوزن", value: "180 جم" }] });
    expect(rows.find((r) => r.label === "السعة")).toEqual({ label: "السعة", a: "128GB", b: "256GB", differs: true });
    expect(rows.find((r) => r.label === "الوزن")?.a).toBe("—");
  });

  it("الفلاتر من سمات مشتركة بقيم مختلفة فقط، والمطابقة صحيحة", () => {
    const list = [phone("128GB", "أسود"), phone("256GB", "أزرق"), phone("128GB", "أزرق")];
    const facets = attributeFacets(list);
    const cap = facets.find((f) => f.label === "السعة");
    expect(cap?.values).toEqual([{ value: "128GB", count: 2 }, { value: "256GB", count: 1 }]);
    // الضمان قيمة واحدة للجميع: لا فلتر.
    expect(facets.some((f) => f.label === "الضمان")).toBe(false);
    expect(list.filter((p) => matchesFacets(p, { السعة: ["128GB"], اللون: ["أزرق"] }))).toHaveLength(1);
    expect(list.filter((p) => matchesFacets(p, {}))).toHaveLength(3);
  });
});
