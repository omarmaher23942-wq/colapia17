import { describe, expect, it } from "vitest";
import { DEFAULT_PRICING } from "@/lib/platform-pricing";
import { buildFeeText, changesLabel, fmtPrice, instagramUrl, planCards, startingText } from "@/lib/landing-pricing";

describe("landing-pricing", () => {
  it("ثلاث بطاقات بالسعر الشهري والمميَّزة وأبرز الحدود الحقيقية", () => {
    const cards = planCards(DEFAULT_PRICING);
    expect(cards.map((c) => c.id)).toEqual(["basic", "growth", "pro"]);
    expect(cards.filter((c) => c.featured).map((c) => c.id)).toEqual(["growth"]);
    expect(cards[0]!.price).toBe(199);
    expect(cards[0]!.priceText).toBe(fmtPrice(199));
    expect(cards[1]!.highlights.join(" ")).toContain("2,000");
  });

  it("سطر التجهيز والمدد ونص البداية", () => {
    expect(buildFeeText(DEFAULT_PRICING)).toContain(fmtPrice(2999));
    expect(buildFeeText(DEFAULT_PRICING)).toContain("سنة");
    expect(startingText(DEFAULT_PRICING)).toContain(fmtPrice(199));
  });

  it("لا تظهر الدائرة الذهبية في البطاقات", () => {
    expect(JSON.stringify(planCards(DEFAULT_PRICING))).not.toContain("GOLDEN");
  });

  it("عدد طلبات التعديل بصيغة عربية صحيحة", () => {
    expect(changesLabel(1)).toBe("طلب تعديل واحد");
    expect(changesLabel(2)).toBe("طلبا تعديل");
    expect(changesLabel(5)).toContain("طلبات");
    expect(changesLabel(12)).toContain("طلب تعديل");
  });

  it("رابط إنستجرام https فقط مع بديل افتراضي", () => {
    expect(instagramUrl(undefined)).toBe("https://ig.me/m/colapia");
    expect(instagramUrl("javascript:alert(1)")).toBe("https://ig.me/m/colapia");
    expect(instagramUrl("http://x.com")).toBe("https://ig.me/m/colapia");
    expect(instagramUrl(" https://ig.me/m/brand ")).toBe("https://ig.me/m/brand");
  });
});
