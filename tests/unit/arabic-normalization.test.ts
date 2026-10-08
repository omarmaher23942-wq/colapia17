import { describe, it, expect } from "vitest";
import { normalizeArabic, francoToArabic, francoVariants, slugify, buildSearchText } from "@/lib/arabic";
import { normalizeEgyptianPhone } from "@/lib/phone";

describe("Arabic Normalization", () => {
  it("should remove tashkeel and normalize alef/taa", () => {
    expect(normalizeArabic("أَحْمَد")).toBe("احمد");
    expect(normalizeArabic("مَدْرَسَة")).toBe("مدرسه");
    expect(normalizeArabic("عَلِى")).toBe("علي");
  });

  it("should convert Franco to Arabic", () => {
    expect(francoToArabic("fostan")).toBe("فستان");
    expect(francoToArabic("7elw")).toBe("حلو");
  });

  it("should index both skeleton and full Franco forms", () => {
    expect(francoVariants("kotshey")).toEqual(expect.arrayContaining(["كوتشي", "كتشي"]));
    expect(buildSearchText(["fostan a7mar"])).toContain("فستان");
  });

  it("should create valid slugs", () => {
    expect(slugify("فستان أحمر صيفي")).toBe("فستان-احمر-صيفي");
    expect(slugify("T-Shirt 100% Cotton!")).toBe("t-shirt-100-cotton");
  });
});

describe("Phone Normalization", () => {
  it("should normalize Egyptian phone numbers", () => {
    expect(normalizeEgyptianPhone("01012345678")).toBe("01012345678");
    expect(normalizeEgyptianPhone("+201012345678")).toBe("01012345678");
    expect(normalizeEgyptianPhone("٠١٠١٢٣٤٥٦٧٨")).toBe("01012345678"); // Arabic numerals
    expect(normalizeEgyptianPhone("01312345678")).toBeNull(); // Invalid prefix
    expect(normalizeEgyptianPhone("123")).toBeNull(); // Too short
  });
});