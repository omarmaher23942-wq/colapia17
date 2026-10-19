import { describe, expect, it } from "vitest";
import { emailLocalSlugs, looksLikeEmail, suggestSlug, toSlug } from "@/agency/slug";

describe("toSlug: نقحرة اسم المتجر", () => {
  it("يكتب الكلمات الشائعة بمعناها والاسم بنقحرة مقروءة", () => {
    expect(toSlug("نور للملابس")).toBe("nour-wear");
    expect(toSlug("كريم للعطور")).toBe("krim-perfumes");
    expect(toSlug("النور")).toBe("el-nour");
  });
  it("الكلمات العامة تُكتب بمعناها", () => {
    expect(toSlug("متجر نور")).toBe("store-nour");
    expect(toSlug("Nour Store")).toBe("nour-store");
  });
  it("اللاتيني يبقى كما هو بشرطات", () => {
    expect(toSlug("Mira Shoes")).toBe("mira-shoes");
    expect(toSlug("H&M Kids")).toBe("h-m-kids");
  });
  it("قصير جداً = null", () => {
    expect(toSlug("ا")).toBeNull();
    expect(toSlug("  ")).toBeNull();
  });
});

describe("suggestSlug: من اسم المتجر ثم إنستجرام، لا من البريد أبداً", () => {
  it("اسم المتجر أولاً حتى لو وُجد حساب إنستجرام", () => {
    expect(suggestSlug({ storeName: "نور للملابس", socialUrl: "https://instagram.com/nour.eg/", code: "1" })).toBe("nour-wear");
  });
  it("حساب إنستجرام يطابق البريد (حساب شخصي) لا يُستخدم", () => {
    const s = suggestSlug({ storeName: "x", socialUrl: "https://instagram.com/omarmaher23942/", email: "omarmaher23942@gmail.com", code: "123456" });
    expect(s).toBe("store-123456");
  });
  it("يتجاوز المأخوذ بلاحقة رقمية", () => {
    expect(suggestSlug({ storeName: "Nour", code: "1" }, (s) => s === "nour")).toBe("nour-2");
  });
  it("يستبعد مرشحاً مطابقاً للجزء المحلي من البريد بفروق شرطات وأرقام", () => {
    const avoid = emailLocalSlugs("Omar.Maher+shop@gmail.com");
    expect(avoid).toContain("omar-maher");
    expect(looksLikeEmail("omar-maher", avoid)).toBe(true);
    expect(looksLikeEmail("omarmaher7", avoid)).toBe(true);
    expect(looksLikeEmail("nour-wear", avoid)).toBe(false);
  });
});
