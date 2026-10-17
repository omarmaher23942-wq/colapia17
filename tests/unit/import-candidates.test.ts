import { describe, expect, it } from "vitest";
import {
  candidateFromAi,
  candidatesFromTable,
  chunk,
  mergeCandidates,
  normalizeCandidate,
  normalizeSize,
  parseProductEntry,
  parseProductText,
  splitProductText,
  summarize,
  unifyCategories,
  variantPlan,
} from "@/lib/import-candidates";
import { planCommit } from "@/lib/import-commit";

describe("تقسيم النص الحر", () => {
  it("سطر لكل منتج مع حذف الترقيم والنقاط", () => {
    const e = splitProductText("1. تيشيرت قطن 350\n- حذاء رياضي 890\n• شنطة جلد 520");
    expect(e).toEqual(["تيشيرت قطن 350", "حذاء رياضي 890", "شنطة جلد 520"]);
  });
  it("فقرات مفصولة بسطر فارغ تصير منتجاً لكل فقرة", () => {
    const e = splitProductText("تيشيرت قطن\nمقاسات M L\nسعره 300\n\nحذاء رياضي\nمقاسات 40 41\nسعره 800");
    expect(e).toHaveLength(2);
    expect(e[0]).toContain("تيشيرت قطن");
  });
  it("نص فارغ", () => expect(splitProductText("  \n ")).toEqual([]));
});

describe("تحليل سطر منتج", () => {
  it("اسم وألوان ومقاسات وسعر", () => {
    const c = parseProductEntry("تيشيرت قطن، أسود وأبيض، مقاسات S M L XL، 350 جنيه")!;
    expect(c.name).toBe("تيشيرت قطن");
    expect(c.price).toBe(350);
    expect(c.sizes).toEqual(["S", "M", "L", "XL"]);
    expect(c.colors).toEqual(expect.arrayContaining(["أسود", "أبيض"]));
  });
  it("أرقام هندية ووحدة ج.م", () => {
    expect(parseProductEntry("بنطلون جينز ٤٥٠ ج.م")!.price).toBe(450);
  });
  it("مقاسات الأحذية ليست سعراً", () => {
    const c = parseProductEntry("حذاء رياضي أبيض، مقاسات 40 41 42 43، 890")!;
    expect(c.price).toBe(890);
    expect(c.sizes).toEqual(["40", "41", "42", "43"]);
  });
  it("مدى مقاسات 38-42", () => {
    expect(parseProductEntry("صندل مقاسات 38-42 سعر 300")!.sizes).toEqual(["38", "39", "40", "41", "42"]);
  });
  it("سعر قبل الخصم بعد كلمة بدل", () => {
    const c = parseProductEntry("فستان صيفي 450 جنيه بدل 600")!;
    expect(c.price).toBe(450);
    expect(c.compareAt).toBe(600);
  });
  it("بلا سعر يبقى null (مسودة)", () => {
    const c = parseProductEntry("إيشارب حرير")!;
    expect(c.price).toBeNull();
    expect(c.name).toBe("إيشارب حرير");
  });
  it("مقاس واحد", () => {
    expect(parseProductEntry("حقيبة يد فري سايز 300 ج")!.sizes).toEqual(["مقاس واحد"]);
  });
  it("قائمة كاملة", () => {
    expect(parseProductText("تيشيرت 200\nجاكيت 900\n")).toHaveLength(2);
  });
});

describe("جداول Excel وCSV", () => {
  it("يقرأ العناوين العربية والمقاسات والألوان", () => {
    const { candidates } = candidatesFromTable([
      ["اسم المنتج", "السعر", "القسم", "المقاسات", "الألوان", "الكمية"],
      ["تيشيرت", "١٥٠", "تيشيرتات", "S, M, L", "أسود، أبيض", "20"],
      ["حذاء", "700", "أحذية", "40 41", "", ""],
    ]);
    expect(candidates).toHaveLength(2);
    expect(candidates[0]).toMatchObject({ name: "تيشيرت", price: 150, category: "تيشيرتات", sizes: ["S", "M", "L"], colors: ["أسود", "أبيض"], stock: 20 });
    expect(candidates[1]!.price).toBe(700);
  });
  it("بلا عمود سعر: مسودة", () => {
    const { candidates } = candidatesFromTable([["الاسم"], ["منتج أ"], ["منتج ب"]]);
    expect(candidates.map((c) => c.price)).toEqual([null, null]);
  });
  it("بلا عناوين معروفة: العمود الأول اسم والرقمي سعر", () => {
    const { candidates } = candidatesFromTable([
      ["قميص كتان", "400"],
      ["بنطلون", "500"],
    ]);
    expect(candidates).toHaveLength(2);
    expect(candidates[0]!.price).toBe(400);
  });
  it("يقص عند 200 ويخبر", () => {
    const rows = [["name", "price"], ...Array.from({ length: 260 }, (_, i) => [`p${i}`, "10"])];
    const r = candidatesFromTable(rows);
    expect(r.candidates).toHaveLength(200);
    expect(r.truncated).toBe(true);
  });
  it("السعر قبل الخصم الأصغر يُهمل", () => {
    const { candidates } = candidatesFromTable([["name", "price", "compare at"], ["x", "100", "80"]]);
    expect(candidates[0]!.compareAt).toBeNull();
  });
});

describe("تنقية المرشّحين", () => {
  it("يرفض بلا اسم ويحصر القيم", () => {
    expect(normalizeCandidate({ name: "  " })).toBeNull();
    const c = normalizeCandidate({ name: "  منتج   مميز ", price: -5, sizes: ["m", "M", "xl", "x".repeat(40)], colors: ["أسود", "أسود"], images: ["http://a/x.jpg", "https://a/y.jpg"] })!;
    expect(c.name).toBe("منتج مميز");
    expect(c.price).toBeNull();
    expect(c.sizes).toEqual(["M", "XL"]);
    expect(c.colors).toEqual(["أسود"]);
    expect(c.images).toEqual(["https://a/y.jpg"]);
  });
  it("normalizeSize", () => {
    expect(normalizeSize("xxxl")).toBe("3XL");
    expect(normalizeSize("فري سايز")).toBe("مقاس واحد");
    expect(normalizeSize("٤٢")).toBe("42");
  });
  it("candidateFromAi يربط أرقام الصور ويتجاهل الخارجة عن النطاق", () => {
    const c = candidateFromAi({ name: "حذاء", price: 500, imageIndexes: [0, 5, 1] }, ["https://a/0.jpg", "https://a/1.jpg"], "image")!;
    expect(c.images).toEqual(["https://a/0.jpg", "https://a/1.jpg"]);
  });
  it("دمج المتكرر بالاسم", () => {
    const a = normalizeCandidate({ name: "تيشيرت", price: null, sizes: ["M"], images: ["https://a/1.jpg"] })!;
    const b = normalizeCandidate({ name: "التيشيرت".replace("ال", ""), price: 200, sizes: ["L"], images: ["https://a/2.jpg"] })!;
    const m = mergeCandidates([a], [b]);
    expect(m).toHaveLength(1);
    expect(m[0]).toMatchObject({ price: 200, sizes: ["M", "L"], images: ["https://a/1.jpg", "https://a/2.jpg"] });
  });
  it("توحيد الأقسام المتشابهة", () => {
    const xs = ["تيشيرتات", "التيشيرتات", "أحذية"].map((category, i) => normalizeCandidate({ name: `p${i}`, category })!);
    const u = unifyCategories(xs);
    expect(new Set(u.map((c) => c.category)).size).toBe(2);
  });
  it("chunk وsummarize", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    const s = summarize([normalizeCandidate({ name: "a", price: 5, category: "x" })!, normalizeCandidate({ name: "b" })!]);
    expect(s).toMatchObject({ total: 2, ready: 1, drafts: 1, categories: ["x"] });
  });
});

describe("التركيبات من الرقائق", () => {
  it("لا رقائق: لا تركيبات", () => expect(variantPlan([], [])).toEqual({ optionNames: [], combos: [] }));
  it("مقاس واحد لا يصنع خياراً", () => expect(variantPlan(["مقاس واحد"], []).combos).toEqual([]));
  it("مقاسات فقط", () => expect(variantPlan(["S", "M"], [])).toEqual({ optionNames: ["المقاس"], combos: [["S"], ["M"]] }));
  it("ضرب المقاس في اللون", () => {
    const p = variantPlan(["S", "M"], ["أسود", "أبيض"]);
    expect(p.optionNames).toEqual(["المقاس", "اللون"]);
    expect(p.combos).toHaveLength(4);
    expect(p.combos[0]).toEqual(["S", "أسود"]);
  });
  it("سقف 60 تركيبة", () => {
    const sizes = Array.from({ length: 12 }, (_, i) => String(30 + i));
    expect(variantPlan(sizes, ["أ", "ب", "ج", "د", "هـ", "و"]).combos.length).toBe(60);
  });
});

describe("خطة الحفظ", () => {
  let n = 0;
  const newId = () => `id-${++n}`;
  it("أقسام جديدة تُنشأ والموجودة تُطابق، ومنتج بلا سعر مسودة", () => {
    const c = [
      normalizeCandidate({ name: "تيشيرت", price: 100, category: "ملابس", sizes: ["S", "M"], colors: ["أسود"] })!,
      normalizeCandidate({ name: "حذاء", price: 300, category: "الأحذية" })!,
      normalizeCandidate({ name: "إيشارب" })!,
    ];
    const plan = planCommit({ storeId: "s", candidates: c, existingCategories: [{ id: "cat1", name: "أحذية", slug: "ahdhia" }], existingSlugs: [], tracking: true, newId });
    expect(plan.categories.map((x) => x.name)).toEqual(["ملابس"]);
    expect(plan.products[1]!.categoryId).toBe("cat1");
    expect(plan.products[2]).toMatchObject({ status: "draft", pricePiasters: 0 });
    expect(plan.products[0]!.pricePiasters).toBe(10000);
    expect(plan.variants).toHaveLength(2);
    expect(plan.variants.every((v) => v.pricePiasters === null && v.productId === plan.products[0]!.id)).toBe(true);
    expect(plan.stats).toMatchObject({ active: 2, drafts: 1, newCategories: 1, variantCount: 2 });
  });
  it("روابط فريدة ولو تكرر الاسم", () => {
    const c = [normalizeCandidate({ name: "منتج", price: 1 })!, normalizeCandidate({ name: "منتج", price: 2 })!];
    const plan = planCommit({ storeId: "s", candidates: c, existingCategories: [], existingSlugs: ["منتج"], tracking: false, newId });
    expect(new Set(plan.products.map((p) => p.slug)).size).toBe(2);
  });
  it("الكمية تُسجل فقط عند تتبع المخزون وبلا تركيبات", () => {
    const withStock = normalizeCandidate({ name: "أ", price: 10, stock: 5 })!;
    const p1 = planCommit({ storeId: "s", candidates: [withStock], existingCategories: [], existingSlugs: [], tracking: true, newId }).products[0]!;
    expect(p1).toMatchObject({ trackStock: true, stock: 5 });
    const p2 = planCommit({ storeId: "s", candidates: [withStock], existingCategories: [], existingSlugs: [], tracking: false, newId }).products[0]!;
    expect(p2).toMatchObject({ trackStock: false, stock: null });
  });
});
