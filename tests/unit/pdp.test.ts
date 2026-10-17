import { describe, expect, it } from "vitest";
import { activeTier, deliveryRange, orderedOptionValues, sizeRank, swatchColor, tierUnitPrice, validateQuestion } from "@/lib/pdp";

describe("pdp", () => {
  it("يرتب المقاسات على السلم", () => {
    const vs = ["XL", "S", "M", "L"].map((v, i) => ({ optionValues: [v], sortOrder: i }));
    expect(orderedOptionValues(0, "المقاس", vs)).toEqual(["S", "M", "L", "XL"]);
    expect(sizeRank("42") < sizeRank("S")).toBe(true);
  });
  it("يحترم ترتيب التعريف ثم sort_order", () => {
    const vs = [{ optionValues: ["أحمر"], sortOrder: 0 }, { optionValues: ["أسود"], sortOrder: 1 }];
    expect(orderedOptionValues(0, "اللون", vs, [{ name: "اللون", kind: "color", values: [{ label: "أسود" }, { label: "أحمر" }] }])).toEqual(["أسود", "أحمر"]);
    expect(orderedOptionValues(0, "اللون", vs)).toEqual(["أحمر", "أسود"]);
  });
  it("لون الدائرة", () => {
    expect(swatchColor("اللون", "x", [{ name: "اللون", kind: "color", values: [{ label: "x", hex: "#123456" }] }])).toBe("#123456");
    expect(swatchColor("اللون", "أسود")).toBe("#111111");
    expect(swatchColor("المقاس", "M")).toBeNull();
  });
  it("خصم الكمية", () => {
    const t = [{ minQty: 2, percentOff: 10 }, { minQty: 4, percentOff: 20 }];
    expect(activeTier(t, 1)).toBeNull();
    expect(activeTier(t, 3)?.percentOff).toBe(10);
    expect(tierUnitPrice(10000, t, 4)).toBe(8000);
    expect(tierUnitPrice(10000, t, 1)).toBe(10000);
  });
  it("نطاق التوصيل بتوقيت القاهرة وتجاوز الجمعة", () => {
    const r = deliveryRange(new Date("2026-10-13T12:00:00Z"), 2, 3);
    expect(r.text).toContain("أكتوبر");
    expect(r.text.startsWith("بين")).toBe(true);
    expect(deliveryRange(new Date("2026-10-13T12:00:00Z"), 2, 2).text.startsWith("بين")).toBe(false);
    // الخميس + يوم = السبت (الجمعة لا تُعد)
    expect(deliveryRange(new Date("2026-10-15T09:00:00Z"), 1, 1).text).toContain("السبت");
  });
  it("تحقق السؤال", () => {
    expect(validateQuestion({ question: "هل متوفر بمقاس آخر؟" }).ok).toBe(true);
    expect(validateQuestion({ question: "ق" }).ok).toBe(false);
    expect(validateQuestion({ question: "شوفوا http://x.com لو سمحتم" }).ok).toBe(false);
  });
});
