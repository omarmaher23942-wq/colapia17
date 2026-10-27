import { describe, expect, it } from "vitest";
import { blueprintSchema } from "@/blueprint/schema";
import { buildRequestData } from "@/agent/build-request";
import { blueprintFromRequest, chooseSlug, isBuildData, pickSource, productionAfterProvision, themeFromStyle, zonesFromSelling } from "@/agency/provision-plan";

const data = (over: Record<string, unknown> = {}) =>
  buildRequestData({
    lead: { storeName: "نور للملابس", niche: "ملابس", instagram: "https://instagram.com/nour.wear", whatsapp: "01012345678", email: "a@b.com", styleNotes: "أسود فخم", selling: "القاهرة والجيزة 60، بقية المحافظات 80، التوصيل 2-4 أيام", ...over } as never,
    declined: [],
    offer: { golden: false },
    notes: "",
  });

describe("chooseSlug", () => {
  it("يقبل المطلوب الصالح ويرفض المأخوذ والمحجوز", () => {
    expect(chooseSlug({ requested: "Nour-Wear", code: "R1" }, () => false)).toEqual({ ok: true, slug: "nour-wear" });
    expect(chooseSlug({ requested: "nour", code: "R1" }, (s) => s === "nour").ok).toBe(false);
    expect(chooseSlug({ requested: "www", code: "R1" }, () => false).ok).toBe(false);
  });
  it("يقترح من الاسم ويتفادى التصادم", () => {
    const a = chooseSlug({ storeName: "نور للملابس", code: "R-100" }, () => false);
    expect(a).toEqual({ ok: true, slug: "nour-wear" });
    const b = chooseSlug({ storeName: "نور للملابس", code: "R-100" }, (s) => s === "nour-wear");
    expect(b.ok && b.slug).not.toBe("nour-wear");
  });
});

describe("المخطط الافتراضي", () => {
  it("صالح مقابل Zod ويحمل الاسم", () => {
    const bp = blueprintFromRequest(data());
    expect(blueprintSchema.safeParse(bp).success).toBe(true);
    expect(JSON.stringify(bp)).toContain("نور للملابس");
  });
  it("صالح بلا أي إجابات اختيارية", () => {
    const bp = blueprintFromRequest(data({ niche: undefined, instagram: undefined, whatsapp: undefined, email: undefined, styleNotes: undefined, selling: undefined }));
    expect(blueprintSchema.safeParse(bp).success).toBe(true);
  });
  it("المظهر من الذوق", () => {
    expect(themeFromStyle("أسود فخم")).toBe("noir-gold");
    expect(themeFromStyle("")).toBe("midnight-mercury");
    expect(themeFromStyle("شيء غير واضح")).toBe("midnight-mercury");
  });
});

describe("مناطق الشحن", () => {
  it("تفعّل كل المحافظات حين لا تُذكر محافظات", () => {
    expect(zonesFromSelling("شحن لكل مكان").every((z) => z.isActive)).toBe(true);
    expect(zonesFromSelling(null).every((z) => z.isActive)).toBe(true);
  });
  it("تفعّل المذكورة وتقرأ الأسعار", () => {
    const z = zonesFromSelling("القاهرة والجيزة 60");
    expect(z.filter((x) => x.isActive).map((x) => x.governorate).sort()).toEqual(["cairo", "giza"]);
    expect(z.find((x) => x.governorate === "cairo")!.feePiasters).toBe(6000);
  });
});

describe("المصدر والإنتاج وعدم التكرار", () => {
  it("المجلد يعطي المراجعة والافتراضي قيد التجهيز", () => {
    expect(pickSource({ blueprint: null, seed: null })).toBe("default");
    expect(pickSource({ blueprint: {}, seed: null })).toBe("folder");
    expect(productionAfterProvision("folder")).toBe("review");
    expect(productionAfterProvision("default")).toBe("building");
  });
  it("لا يُجهَّز إلا طلب الوكيل v5", () => {
    expect(isBuildData(data())).toBe(true);
    expect(isBuildData({ store: { name: "x" } })).toBe(false);
    expect(isBuildData(null)).toBe(false);
  });
});
