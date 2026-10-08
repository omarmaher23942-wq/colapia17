import { describe, expect, it } from "vitest";
import { onboardingSubmissionSchema } from "@/onboarding/schema";
import { submissionToIntake } from "@/onboarding/to-intake";

const base = {
  store: { storeName: "بيت الأناقة", desiredSubdomain: "beit", industry: "fashion", phone: "01012345678", instagramHandle: "@beit" },
  products: {
    sections: [{ id: "s1", name: "حريمي" }],
    products: [
      { id: "a", name: "فستان", priceEgp: 1450, categoryName: "حريمي", images: [{ id: "i1", url: "https://x.ufs.sh/f/a" }], stock: null },
      {
        id: "b",
        name: "تيشيرت",
        priceEgp: 300,
        images: [],
        options: [{ id: "o1", name: "المقاس", kind: "size", values: [{ id: "m", label: "M" }, { id: "l", label: "L" }] }],
        variants: [
          { key: { o1: "m" }, priceEgp: null, stock: 4, available: true, imageIds: [] },
          { key: { o1: "l" }, priceEgp: 320, stock: 0, available: false, imageIds: [] },
        ],
      },
    ],
  },
  launch: {
    shippingMode: "zones",
    zones: [
      { governorate: "cairo", feeEgp: 60, etaMinDays: 1, etaMaxDays: 2, active: true },
      { governorate: "aswan", feeEgp: 120, etaMinDays: 4, etaMaxDays: 6, active: false },
    ],
    codFeeEgp: 15,
    freeOverEgp: 1000,
    returnDays: 7,
    allowExchange: true,
    allowRefund: false,
    returnShippingPaidBy: "customer",
    returnConditionsList: ["أن يكون المنتج بحالته الأصلية، غير مستخدم وغير مغسول."],
    nonReturnable: "الملابس الداخلية ولبس البحر",
    vodafoneCashEnabled: true,
    vodafoneCash: "01098765432",
    features: { stickyAddToCart: false, socialProofToasts: true },
  },
  adaptive: {},
};

describe("onboarding → intake", () => {
  const sub = onboardingSubmissionSchema.parse(base);
  const intake = submissionToIntake(sub);
  const pol = intake.policies as Record<string, unknown>;

  it("keeps per-governorate shipping, inactive governorates and the COD fee", () => {
    expect(pol.shippingZones).toEqual([
      { governorate: "cairo", feeEgp: 60, etaMinDays: 1, etaMaxDays: 2, active: true },
      { governorate: "aswan", feeEgp: 120, etaMinDays: 4, etaMaxDays: 6, active: false },
    ]);
    expect(pol.codFeeEgp).toBe(15);
    expect(pol.freeShippingOverEgp).toBe(1000);
    expect(pol.vodafoneCashNumber).toBe("01098765432");
  });

  it("carries the exact return policy", () => {
    expect(pol).toMatchObject({ returnDays: 7, allowExchange: true, allowRefund: false, returnShippingPaidBy: "customer", nonReturnable: "الملابس الداخلية ولبس البحر" });
    expect(pol.returnConditionsList).toHaveLength(1);
  });

  it("maps unlimited stock, variants, categories, socials and features", () => {
    const [dress, tee] = intake.products;
    expect(dress?.unlimitedStock).toBe(true);
    expect(dress?.stock).toBeUndefined();
    expect(dress?.category).toBe("حريمي");
    expect(tee?.variants).toHaveLength(2);
    expect(tee?.variants?.[1]).toMatchObject({ pricePiasters: 32000, available: false, optionValues: ["L"] });
    expect(intake.brief.instagramHandle).toBe("beit");
    expect((intake.brief.features as Record<string, boolean>).stickyAddToCart).toBe(false);
  });
});
