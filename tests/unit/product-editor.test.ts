import { describe, expect, it } from "vitest";
import { EMPTY_PRODUCT, toNumber, validateProduct, type EditorProduct } from "@/components/dashboard/product/model";

const base = (p: Partial<EditorProduct>): EditorProduct => ({ ...EMPTY_PRODUCT, name: "فستان", price: "300", stock: "5", ...p });

describe("toNumber: الأرقام كما يكتبها التاجر", () => {
  it.each([
    ["٣٠٠", 300],
    ["1,250", 1250],
    ["١٬٢٥٠", 1250],
    ["99.5", 99.5],
    ["٩٩٫٥", 99.5],
    [" 40 ", 40],
  ])("%s ← %d", (s, n) => expect(toNumber(s)).toBe(n));
  it("الفارغ null وغير الرقم NaN", () => {
    expect(toNumber("")).toBeNull();
    expect(toNumber("abc")).toBeNaN();
  });
});

describe("validateProduct: نفس قواعد الخادم قبل الإرسال", () => {
  it("منتج صالح بلا أخطاء", () => expect(validateProduct(base({}))).toEqual({}));
  it("الاسم والسعر إلزاميان، والسعر أكبر من صفر", () => {
    const e = validateProduct(base({ name: " ", price: "0" }));
    expect(e.name).toBeTruthy();
    expect(e.price).toBeTruthy();
  });
  it("السعر قبل الخصم أعلى من سعر البيع أو فارغ", () => {
    expect(validateProduct(base({ compareAt: "250" })).compareAt).toBeTruthy();
    expect(validateProduct(base({ compareAt: "400" })).compareAt).toBeUndefined();
  });
  it("الكمية مطلوبة مع تتبع المخزون بلا تركيبات، وعدد صحيح", () => {
    expect(validateProduct(base({ stock: "" })).stock).toBeTruthy();
    expect(validateProduct(base({ stock: "2.5" })).stock).toBeTruthy();
    expect(validateProduct(base({ stock: "", trackStock: false })).stock).toBeUndefined();
    expect(validateProduct(base({ stock: "", variants: [{ optionValues: ["S"], stock: 2 }] })).stock).toBeUndefined();
  });
  it("الحدود نفسها التي يرفضها الخادم", () => {
    expect(validateProduct(base({ seoTitle: "x".repeat(71) })).seoTitle).toBeTruthy();
    expect(validateProduct(base({ shortDescription: "x".repeat(201) })).shortDescription).toBeTruthy();
  });
});
