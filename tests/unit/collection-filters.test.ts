import { describe, expect, it } from "vitest";
import { activeFilterCount, buildFacets, classifyOption, EMPTY_FILTERS, filtersToQuery, parseFilters } from "@/lib/collection-filters";

describe("collection filters", () => {
  it("يحلل الرابط ويتجاهل القيم الفاسدة", () => {
    const f = parseFilters({ sort: "nope", min: "500", max: "100", size: "M,L", color: "أسود", stock: "1", sale: "1", sub: "shirts" });
    expect(f.sort).toBe("popular");
    expect(f.min).toBe(10000);
    expect(f.max).toBe(50000);
    expect(f.sizes).toEqual(["M", "L"]);
    expect(f.inStock && f.sale).toBe(true);
    expect(f.sub).toBe("shirts");
    expect(parseFilters({ min: "abc" }).min).toBeNull();
  });
  it("الذهاب والإياب", () => {
    const f = parseFilters({ sort: "price_asc", size: "S", min: "100" });
    expect(parseFilters(Object.fromEntries(new URLSearchParams(filtersToQuery(f))))).toEqual(f);
    expect(filtersToQuery(EMPTY_FILTERS)).toBe("");
  });
  it("عدّ الفلاتر", () => {
    expect(activeFilterCount(parseFilters({ size: "S,M", sale: "1", sort: "newest" }))).toBe(3);
  });
  it("الأوجه", () => {
    expect(classifyOption("اللون")).toBe("color");
    expect(classifyOption("المقاس")).toBe("size");
    expect(classifyOption("الخامة")).toBeNull();
    const fc = buildFacets(
      [
        { opt: "المقاس", val: "L", n: 2 },
        { opt: "المقاس", val: "S", n: 5 },
        { opt: "اللون", val: "أحمر", n: 1 },
        { opt: "اللون", val: "أسود", n: 9 },
        { opt: "الخامة", val: "قطن", n: 3 },
      ],
      { min: 10000, max: 90000 }
    );
    expect(fc.sizes).toEqual(["S", "L"]);
    expect(fc.colors).toEqual(["أسود", "أحمر"]);
  });
});
