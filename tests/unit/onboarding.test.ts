import { describe, expect, it } from "vitest";
import { defaultBlueprint } from "@/blueprint/defaults";
import { blueprintSchema } from "@/blueprint/schema";
import { contrastRatio } from "@/blueprint/palette";
import {
  BRAND_SWATCHES,
  brandPalette,
  etaText,
  FONT_PAIRS,
  mergeProgress,
  nextStep,
  normalizeHex,
  parseOnboarding,
  paymentMethodsReady,
  pairIdFor,
  planFromZones,
  prevStep,
  progressPercent,
  publishReadiness,
  returnsFromTemplate,
  STEP_IDS,
  templateFromReturns,
  zonesFromPlan,
} from "@/lib/onboarding";
import { contentBox, fitInto, padBox, worthCropping } from "@/lib/image-prep";

const bp = () => blueprintSchema.parse(defaultBlueprint({ name: "متجر" }));

describe("تقدم الإعداد", () => {
  it("يقرأ حالة فارغة أو تالفة بتسامح", () => {
    expect(parseOnboarding({})).toMatchObject({ step: "identity", done: [], dmImages: [] });
    expect(parseOnboarding(null).step).toBe("identity");
    expect(parseOnboarding({ step: "nope", done: ["payment", "x", "payment"], dmImages: ["http://a", "https://ok/1.jpg", 5] })).toMatchObject({ done: ["payment"], dmImages: ["https://ok/1.jpg"] });
  });
  it("الخطوة الافتراضية أول خطوة غير منجزة", () => {
    expect(parseOnboarding({ done: ["identity", "products"] }).step).toBe("payment");
  });
  it("الدمج يحفظ صور المحادثة وبقية الحقول", () => {
    const m = mergeProgress({ dmImages: ["https://a/1.jpg"], niche: "ملابس", done: ["identity"] }, { step: "products", markDone: "products" });
    expect(m).toMatchObject({ dmImages: ["https://a/1.jpg"], niche: "ملابس", step: "products", done: ["identity", "products"] });
    expect(typeof m.startedAt).toBe("string");
  });
  it("التراجع عن إنجاز خطوة", () => {
    expect((mergeProgress({ done: ["identity", "payment"] }, { unmark: "payment" }).done as string[])).toEqual(["identity"]);
  });
  it("التنقل والنسبة", () => {
    expect(nextStep("identity")).toBe("products");
    expect(nextStep("publish")).toBe("publish");
    expect(prevStep("identity")).toBe("identity");
    expect(prevStep("payment")).toBe("products");
    expect(progressPercent([])).toBe(0);
    expect(progressPercent([...STEP_IDS])).toBe(100);
  });
});

describe("الهوية", () => {
  it("normalizeHex", () => {
    expect(normalizeHex("#ABC")).toBe("#aabbcc");
    expect(normalizeHex("1f3a5f")).toBe("#1f3a5f");
    expect(normalizeHex("red")).toBeNull();
  });
  it("كل ألوان العلامة الثمانية تنتج لوحة بتباين AA", () => {
    expect(BRAND_SWATCHES).toHaveLength(8);
    for (const s of BRAND_SWATCHES) {
      for (const dark of [false, true]) {
        const p = brandPalette(s.hex, dark);
        expect(contrastRatio(p.foreground, p.background)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(p.primaryForeground, p.primary)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(p.accentForeground, p.accent)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
  it("لون مخصص فاتح جداً لا يكسر القراءة", () => {
    const p = brandPalette("#ffee88");
    expect(contrastRatio(p.primaryForeground, p.primary)).toBeGreaterThanOrEqual(4.5);
    expect(blueprintSchema.shape.theme.shape.palette.safeParse(p).success).toBe(true);
  });
  it("ثلاثة أزواج خطوط وتعرّف الحالي", () => {
    expect(FONT_PAIRS).toHaveLength(3);
    expect(pairIdFor("el_messiri", "tajawal")).toBe("elegant");
    expect(pairIdFor("unknown", "unknown")).toBe(FONT_PAIRS[0]!.id);
  });
});

describe("الشحن", () => {
  it("سعر موحد: 27 محافظة كلها فعالة", () => {
    const z = zonesFromPlan({ kind: "flat", fee: 60 }, { min: 2, max: 4 });
    expect(z).toHaveLength(27);
    expect(z.every((r) => r.isActive && r.fee === 60 && r.etaMin === 2 && r.etaMax === 4)).toBe(true);
  });
  it("القاهرة والجيزة بسعر والباقي بسعر", () => {
    const z = zonesFromPlan({ kind: "cairo_giza", cairoFee: 50, restFee: 80 }, { min: 1, max: 3 }, 15);
    expect(z.find((r) => r.governorate === "cairo")!.fee).toBe(50);
    expect(z.find((r) => r.governorate === "giza")!.fee).toBe(50);
    expect(z.find((r) => r.governorate === "aswan")!.fee).toBe(80);
    expect(z.every((r) => r.codExtra === 15)).toBe(true);
  });
  it("مخصص: مجموعة بلا سعر غير مخدومة", () => {
    const z = zonesFromPlan({ kind: "custom", groups: { gc: 50, alex: 60, delta: 65, canal: null, upper: 80, remote: null } }, { min: 2, max: 5 });
    expect(z.find((r) => r.governorate === "suez")).toMatchObject({ isActive: false });
    expect(z.find((r) => r.governorate === "luxor")).toMatchObject({ isActive: true, fee: 80 });
  });
  it("استعادة القالب من الصفوف المحفوظة", () => {
    const rows = (plan: Parameters<typeof zonesFromPlan>[0]) => zonesFromPlan(plan, { min: 2, max: 4 }).map((z) => ({ governorate: z.governorate, feePiasters: z.fee * 100, isActive: z.isActive, etaMinDays: z.etaMin, etaMaxDays: z.etaMax }));
    expect(planFromZones(rows({ kind: "cairo_giza", cairoFee: 50, restFee: 75 }), null)).toMatchObject({ plan: { kind: "cairo_giza", cairoFee: 50, restFee: 75 }, etaMin: 2, etaMax: 4 });
    expect(planFromZones(rows({ kind: "flat", fee: 60 }), 6000)!.plan).toEqual({ kind: "flat", fee: 60 });
    expect(planFromZones(rows({ kind: "custom", groups: { gc: 50, alex: 60, delta: 65, canal: 70, upper: 80, remote: 100 } }), null)!.plan.kind).toBe("custom");
    expect(planFromZones([], null)).toBeNull();
  });
  it("نص المدة", () => {
    expect(etaText(2, 4)).toBe("من 2 إلى 4 أيام عمل");
    expect(etaText(3, 3)).toBe("3 أيام عمل");
  });
});

describe("الاستبدال", () => {
  it("القوالب الثلاثة", () => {
    const prev = bp().returns;
    expect(returnsFromTemplate({ kind: "none" }, prev)).toMatchObject({ windowDays: 0, allowExchange: false, allowRefund: false });
    expect(returnsFromTemplate({ kind: "exchange", days: 7, paidBy: "customer" }, prev)).toMatchObject({ windowDays: 7, allowExchange: true, allowRefund: false, returnShippingPaidBy: "customer" });
    expect(returnsFromTemplate({ kind: "exchange_refund", days: 99, paidBy: "store" }, prev)).toMatchObject({ windowDays: 60, allowRefund: true });
  });
  it("ذهاب وإياب بين القالب والسياسة", () => {
    const prev = bp().returns;
    for (const t of [{ kind: "none" }, { kind: "exchange", days: 10, paidBy: "store_if_defect" }, { kind: "exchange_refund", days: 14, paidBy: "customer" }] as const) {
      expect(templateFromReturns(returnsFromTemplate(t, prev))).toEqual(t);
    }
  });
});

describe("جاهزية التفعيل", () => {
  const payments = bp().payments;
  const facts = { activePricedProducts: 3, draftProducts: 0, payments, activeZones: 27, whatsapp: "01012345678", storeName: "متجر" };
  it("كل شيء جاهز", () => {
    const r = publishReadiness(facts);
    expect(r.ok).toBe(true);
    expect(r.blockers).toEqual([]);
  });
  it("بلا منتج بسعر: يذكر المسودات", () => {
    const r = publishReadiness({ ...facts, activePricedProducts: 0, draftProducts: 4 });
    expect(r.ok).toBe(false);
    expect(r.blockers[0]).toMatchObject({ id: "products", step: "products" });
    expect(r.blockers[0]!.hint).toContain("4");
  });
  it("وسيلة تحويل مفعّلة بلا رقم لا تُحسب", () => {
    const p = { ...payments, cod: { ...payments.cod, enabled: false }, vodafoneCash: { ...payments.vodafoneCash, enabled: true, number: undefined } };
    expect(paymentMethodsReady(p)).toMatchObject({ any: false, incomplete: ["فودافون كاش"] });
    expect(publishReadiness({ ...facts, payments: p }).blockers.map((b) => b.id)).toEqual(["payment"]);
    const ok = { ...p, vodafoneCash: { ...p.vodafoneCash, number: "01012345678" } };
    expect(paymentMethodsReady(ok).any).toBe(true);
  });
  it("الدفع عند الاستلام وحده يكفي، لكن وسيلة مفعّلة ناقصة تمنع", () => {
    const mixed = { ...payments, instapay: { ...payments.instapay, enabled: true, address: undefined, number: undefined } };
    expect(publishReadiness({ ...facts, payments: mixed }).ok).toBe(false);
  });
  it("بلا شحن أو واتساب", () => {
    expect(publishReadiness({ ...facts, activeZones: 0, whatsapp: undefined }).blockers.map((b) => b.id)).toEqual(["shipping", "contact"]);
  });
});

describe("تجهيز الصور في المتصفح", () => {
  // صورة 40x40 بيضاء، فيها مربع داكن 10x10 عند (15,15).
  const img = (w = 40, h = 40) => {
    const d = new Uint8ClampedArray(w * h * 4).fill(255);
    for (let y = 15; y < 25; y++) for (let x = 15; x < 25; x++) d.set([20, 20, 20, 255], (y * w + x) * 4);
    return d;
  };
  it("يجد حدود المنتج على خلفية موحدة", () => {
    const b = contentBox(img(), 40, 40)!;
    expect(b.x).toBeLessThanOrEqual(16);
    expect(b.x + b.w).toBeGreaterThanOrEqual(24);
    expect(b.w).toBeLessThan(20);
  });
  it("صورة بيئة (زوايا مختلفة) لا تُقص", () => {
    const d = img();
    d.set([0, 0, 0, 255], (1 * 40 + 1) * 4);
    d.set([255, 0, 0, 255], (1 * 40 + 38) * 4);
    d.set([0, 255, 0, 255], (38 * 40 + 1) * 4);
    expect(contentBox(d, 40, 40)).toBeNull();
  });
  it("صورة فارغة بلا محتوى", () => {
    expect(contentBox(new Uint8ClampedArray(40 * 40 * 4).fill(255), 40, 40)).toBeNull();
  });
  it("هامش وقيود وأبعاد", () => {
    const p = padBox({ x: 15, y: 15, w: 10, h: 10 }, 40, 40, 0.2);
    expect(p).toEqual({ x: 13, y: 13, w: 14, h: 14 });
    expect(worthCropping({ x: 0, y: 0, w: 40, h: 40 }, 40, 40)).toBe(false);
    expect(worthCropping({ x: 10, y: 10, w: 20, h: 20 }, 40, 40)).toBe(true);
    expect(fitInto({ w: 600, h: 300 }, 1200)).toMatchObject({ w: 900, h: 450 });
  });
});
