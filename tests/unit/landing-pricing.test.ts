import { describe, expect, it } from "vitest";
import { DEFAULT_PRICING } from "@/lib/platform-pricing";
import { changesLabel, fmtPrice, instagramUrl, planCards, startingText } from "@/lib/landing-pricing";

describe("landing-pricing", () => {
  it("يبني ثلاث بطاقات مرتبة بالمدة مع الباقة المميزة والتكلفة الشهرية", () => {
    const cards = planCards(DEFAULT_PRICING);
    expect(cards.map((c) => c.months)).toEqual([3, 6, 12]);
    expect(cards.filter((c) => c.featured).map((c) => c.months)).toEqual([12]);
    expect(cards[0]!.price).toBe(1999);
    expect(cards[0]!.renewal).toBe(999);
    expect(cards[2]!.perMonth).toBeLessThan(cards[0]!.perMonth);
    expect(cards[0]!.priceText).toBe(fmtPrice(1999));
  });

  it("لا يعرض الدائرة الذهبية ضمن البطاقات", () => {
    expect(planCards(DEFAULT_PRICING).every((c) => c.price !== DEFAULT_PRICING.golden.price)).toBe(true);
  });

  it("نص السعر الابتدائي من أرخص باقة", () => {
    expect(startingText(DEFAULT_PRICING)).toContain(fmtPrice(1999));
  });

  it("عدد طلبات التعديل بصيغة عربية صحيحة", () => {
    expect(changesLabel(1)).toBe("طلب تعديل واحد");
    expect(changesLabel(2)).toBe("طلبا تعديل");
    expect(changesLabel(5)).toContain("طلبات");
    expect(changesLabel(12)).toContain("طلب تعديل");
  });

  it("رابط إنستجرام https فقط مع بديل افتراضي", () => {
    expect(instagramUrl(undefined)).toBe("https://ig.me/m/colapia.eg");
    expect(instagramUrl("javascript:alert(1)")).toBe("https://ig.me/m/colapia.eg");
    expect(instagramUrl("http://x.com")).toBe("https://ig.me/m/colapia.eg");
    expect(instagramUrl(" https://ig.me/m/brand ")).toBe("https://ig.me/m/brand");
  });
});
