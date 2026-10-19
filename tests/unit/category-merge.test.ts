import { describe, expect, it } from "vitest";
import { applyCategoryPlan, categoryKey, MAX_CATEGORIES, MISC_CATEGORY, mergeAiAssignment, planCategories } from "@/lib/category-merge";

const mk = (cats: string[]) => cats.map((category, i) => ({ id: `p${i}`, category }));

describe("توحيد الأقسام", () => {
  it("المفرد والجمع و«ال» قسم واحد", () => {
    expect(categoryKey("تيشيرت")).toBe(categoryKey("التيشيرتات"));
    expect(categoryKey("حقيبة")).toBe(categoryKey("حقائب"));
    expect(categoryKey("أحذية")).toBe(categoryKey("حذاء"));
  });

  it("عيب «قسم لكل منتج»: عشرة منتجات بأسماء متقاربة تصير قسمين", () => {
    const items = mk(["تيشيرت", "تيشيرتات", "التيشيرت", "تيشيرت قطن", "تيشيرت أسود", "حذاء", "أحذية", "حذاء رياضي", "الحذاء", "حذاء كاجوال"]);
    const plan = planCategories(items);
    expect(new Set(Object.values(plan.assign)).size).toBe(2);
    expect(plan.changed).toBe(true);
  });

  it("الاسم الأكثر تكراراً هو الاسم النهائي", () => {
    const plan = planCategories(mk(["بنطلون", "بنطلونات", "بنطلونات", "بنطلونات"]));
    expect(plan.categories).toEqual(["بنطلونات"]);
  });

  it("يطابق أقسام المتجر الحالية أولاً بنفس اسمها", () => {
    const plan = planCategories(mk(["حقائب", "شنط"]), ["حقائب يد"]);
    expect(new Set(Object.values(plan.assign))).toEqual(new Set(["حقائب يد"]));
  });

  it("لا يزيد عن الحد الأقصى: 12 قسماً مختلفاً تصير 6 على الأكثر والباقي «منتجات متنوعة»", () => {
    const names = ["قميص", "حذاء", "ساعة", "عطر", "نظارة", "حقيبة", "كوب", "مصباح", "وسادة", "سجادة", "شمعة", "إطار"];
    const plan = planCategories(mk(names));
    expect(plan.categories.length).toBeLessThanOrEqual(MAX_CATEGORIES);
    expect(plan.categories).toContain(MISC_CATEGORY);
    // كل منتج له قسم.
    expect(Object.keys(plan.assign)).toHaveLength(names.length);
  });

  it("الأصغر يُدمج في الأقرب بالكلمات قبل «المتنوعة»", () => {
    const items = mk(["حذاء رياضي", "حذاء رياضي", "حذاء رياضي", "حذاء كاجوال", "قميص", "قميص", "ساعة", "ساعة", "عطر", "عطر", "حقيبة", "حقيبة", "كوب", "كوب"]);
    const plan = planCategories(items, [], 5);
    expect(plan.categories.length).toBeLessThanOrEqual(5);
    // «حذاء كاجوال» يلتحق بقسم الحذاء بدل «المتنوعة».
    expect(plan.assign.p3).toBe(plan.assign.p0);
  });

  it("منتج بلا قسم يبقى بلا قسم، ولا تغيير عند عدم الحاجة", () => {
    const plan = planCategories(mk(["", "تيشيرت"]));
    expect(plan.assign.p0).toBeUndefined();
    expect(plan.changed).toBe(false);
    expect(applyCategoryPlan(mk(["", "تيشيرت"]), plan)).toEqual(mk(["", "تيشيرت"]));
  });

  it("قرار الذكاء الاصطناعي: رقم قسم خارج النطاق أو منتج مُهمل يبقى بقسمه السابق", () => {
    const items = mk(["x", "y", "z"]);
    const out = mergeAiAssignment(items, { categories: ["ملابس", "أحذية"], assign: [{ i: 0, c: 0 }, { i: 1, c: 7 }] });
    expect(out.map((o) => o.category)).toEqual(["ملابس", "y", "z"]);
  });

  it("دمج قرار الذكاء ثم التوحيد يمنع قسماً لكل منتج حتى لو أخطأ النموذج", () => {
    const items = mk(Array.from({ length: 9 }, (_, i) => `قسم${i}`));
    const ai = mergeAiAssignment(items, { categories: items.map((x) => x.category), assign: items.map((_, i) => ({ i, c: i })) });
    expect(planCategories(ai).categories.length).toBeLessThanOrEqual(MAX_CATEGORIES);
  });
});
