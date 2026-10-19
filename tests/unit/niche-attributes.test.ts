import { describe, expect, it } from "vitest";
import { attributesFor, attrValue, cleanAttributes, foldForNiche, joinValues, nicheOf, resolveNiche, setAttr, splitValues, usesSizeColor, NICHES } from "@/lib/niche-attributes";
import { fallbackName, mergeIntoOne, missingPrice, normalizeCandidate, type Candidate } from "@/lib/import-candidates";
import { planCommit } from "@/lib/import-commit";
import { sniffVideoType } from "@/lib/media";

const cand = (p: Partial<Candidate>): Candidate => ({ id: p.id ?? "x", name: "", price: null, compareAt: null, description: "", category: "", sizes: [], colors: [], images: [], stock: null, source: "manual", attributes: [], ...p });

describe("nicheOf", () => {
  it("يتعرف على الأنشطة الشائعة بالعربية والإنجليزية", () => {
    expect(nicheOf("براند ملابس حريمي ورجالي")).toBe("fashion");
    expect(nicheOf("محل موبايلات وإكسسوارات")).toBe("electronics");
    expect(nicheOf("عطور فرنسية")).toBe("perfume");
    expect(nicheOf("أحذية رياضية")).toBe("shoes");
    expect(nicheOf("حلويات بيتي")).toBe("food");
    expect(nicheOf("مكياج وعناية بالبشرة")).toBe("beauty");
    expect(nicheOf("ديكور منزلي")).toBe("home");
    expect(nicheOf("ملابس أطفال")).toBe("kids");
    expect(nicheOf("Streetwear brand")).toBe("fashion");
    expect(nicheOf("")).toBe("other");
    expect(nicheOf("خدمات تصميم")).toBe("other");
  });

  it("اختيار التاجر الصريح يغلب ما قاله للوكيل", () => {
    expect(resolveNiche({ niche: "ملابس", nicheKind: "electronics" })).toBe("electronics");
    expect(resolveNiche({ niche: "عطور" })).toBe("perfume");
    expect(resolveNiche(null, "متجر سماعات")).toBe("electronics");
    expect(resolveNiche({ nicheKind: "bogus" }, "عسل")).toBe("food");
  });
});

describe("attributesFor / usesSizeColor", () => {
  it("لا حقول مقاس ولون لغير الملابس، وحقول مناسبة لكل نشاط", () => {
    expect(usesSizeColor("fashion")).toBe(true);
    expect(usesSizeColor("shoes")).toBe(true);
    expect(usesSizeColor("electronics")).toBe(false);
    expect(usesSizeColor("perfume")).toBe(false);
    const el = attributesFor("electronics").map((a) => a.label);
    expect(el).toEqual(expect.arrayContaining(["السعة", "اللون", "الضمان"]));
    expect(attributesFor("perfume").map((a) => a.label)).toContain("الحجم");
    expect(attributesFor("food").map((a) => a.label)).toContain("الوزن");
    expect(attributesFor("other")).toEqual([]);
    for (const n of NICHES) for (const a of attributesFor(n)) expect(a.label).not.toMatch(/المقاس$/);
  });

  it("يعيد نسخة مستقلة لا تعدّل الأصل", () => {
    const a = attributesFor("electronics");
    a[0]!.values!.push("x");
    expect(attributesFor("electronics")[0]!.values).not.toContain("x");
  });
});

describe("قيم السمات", () => {
  it("setAttr يضيف ويعدّل ويحذف بالاسم", () => {
    let l = setAttr([], "السعة", "128GB");
    l = setAttr(l, "الضمان", "سنة");
    l = setAttr(l, "السعة", "256GB");
    expect(l).toEqual([{ label: "السعة", value: "256GB" }, { label: "الضمان", value: "سنة" }]);
    expect(setAttr(l, "السعة", "  ")).toEqual([{ label: "الضمان", value: "سنة" }]);
    expect(attrValue(l, "الضمان")).toBe("سنة");
  });

  it("cleanAttributes يحذف الفارغ والمكرر", () => {
    expect(cleanAttributes([{ label: "أ", value: "1" }, { label: "أ", value: "2" }, { label: "", value: "x" }, { label: "ب", value: " " }, null])).toEqual([{ label: "أ", value: "1" }]);
    expect(cleanAttributes("bad")).toEqual([]);
  });

  it("splitValues/joinValues", () => {
    expect(splitValues("50 مل، 100 مل,  ")).toEqual(["50 مل", "100 مل"]);
    expect(joinValues(["أ", "ب", "أ", ""])).toBe("أ، ب");
  });

  it("foldForNiche ينقل الألوان إلى سمة اللون ويلغي التركيبات في نشاط بلا مقاسات", () => {
    const c = cand({ sizes: ["M"], colors: ["أسود", "فضي"] });
    const el = foldForNiche(c, "electronics");
    expect(el.sizes).toEqual([]);
    expect(el.colors).toEqual([]);
    expect(attrValue(el.attributes, "اللون")).toBe("أسود، فضي");
    expect(foldForNiche(c, "perfume").attributes).toEqual([]);
    expect(foldForNiche(c, "fashion")).toBe(c);
  });
});

describe("الاستيراد: الدمج والسعر والسمات", () => {
  it("mergeIntoOne يجمع صور المنتج نفسه ويبقي حقول الأول", () => {
    const a = cand({ id: "a", name: "سماعة", images: ["https://m/1.jpg"] });
    const b = cand({ id: "b", price: 300, images: ["https://m/2.jpg"], attributes: [{ label: "اللون", value: "أسود" }] });
    const c = cand({ id: "c", name: "آخر" });
    const out = mergeIntoOne([a, b, c], ["a", "b"]);
    expect(out.map((x) => x.id)).toEqual(["a", "c"]);
    expect(out[0]).toMatchObject({ name: "سماعة", price: 300, images: ["https://m/1.jpg", "https://m/2.jpg"], attributes: [{ label: "اللون", value: "أسود" }] });
    expect(mergeIntoOne([a, b], ["a"])).toEqual([a, b]);
  });

  it("missingPrice وfallbackName", () => {
    expect(missingPrice([cand({ id: "1" }), cand({ id: "2", price: 10 })]).map((c) => c.id)).toEqual(["1"]);
    expect(fallbackName({ category: "عطور" }, 2)).toBe("عطور 3");
    expect(fallbackName({ category: "" }, 0)).toBe("منتج 1");
  });

  it("normalizeCandidate يحفظ السمات المنقّاة وplanCommit يكتبها", () => {
    const n = normalizeCandidate({ name: "عطر", price: 500, attributes: [{ label: "الحجم", value: "100 مل" }, { label: "", value: "x" }] })!;
    expect(n.attributes).toEqual([{ label: "الحجم", value: "100 مل" }]);
    let i = 0;
    const plan = planCommit({ storeId: "s", candidates: [n], existingCategories: [], existingSlugs: [], tracking: true, newId: () => `id${i++}` });
    expect(plan.products[0]!.attributes).toEqual([{ label: "الحجم", value: "100 مل" }]);
    expect(plan.products[0]!.searchText).toContain("100");
  });
});

describe("sniffVideoType", () => {
  const ftyp = (brand: string) => new Uint8Array([0, 0, 0, 24, ...[..."ftyp"].map((c) => c.charCodeAt(0)), ...[...brand].map((c) => c.charCodeAt(0)), 0, 0, 0, 0]);
  it("يقبل MP4 وWEBM ويميز MOV والصور", () => {
    expect(sniffVideoType(ftyp("isom"))).toEqual({ type: "video/mp4", ext: "mp4" });
    expect(sniffVideoType(ftyp("qt  "))).toBe("quicktime");
    expect(sniffVideoType(ftyp("heic"))).toBeNull();
    expect(sniffVideoType(new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0, 0]))).toEqual({ type: "video/webm", ext: "webm" });
    expect(sniffVideoType(new Uint8Array([0xff, 0xd8, 0xff, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]))).toBeNull();
  });
});
