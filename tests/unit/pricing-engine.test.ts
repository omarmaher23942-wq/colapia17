import { describe, expect, it } from "vitest";
import { bestVolumeTier, freeShippingProgress, inScope, priceCart, type EngineInput, type EngineLine } from "@/lib/pricing/engine";

const line = (o: Partial<EngineLine> & { key: string }): EngineLine => ({ productId: o.key, name: o.key, unit: 10000, qty: 1, ...o });
const base = (lines: EngineLine[], extra: Partial<EngineInput> = {}): EngineInput => ({
  lines,
  paymentMethod: "cod",
  shipping: { baseFee: 5000, codExtra: 1500, freeOverPiasters: null },
  ...extra,
});

describe("priceCart: الأسطر وأسعار الكمية", () => {
  it("يحسب المجموع بلا خصم", () => {
    const r = priceCart(base([line({ key: "a", qty: 2 })]));
    expect(r.gross).toBe(20000);
    expect(r.subtotal).toBe(20000);
    expect(r.total).toBe(20000 + 5000 + 1500);
  });
  it("أفضل شريحة كمية فقط", () => {
    expect(bestVolumeTier([{ minQty: 2, percentOff: 5 }, { minQty: 3, percentOff: 10 }], 3)?.percentOff).toBe(10);
    expect(bestVolumeTier([{ minQty: 3, percentOff: 10 }], 2)).toBeNull();
  });
  it("خصم الكمية يُحفظ على السطر", () => {
    const r = priceCart(base([line({ key: "a", qty: 3, volumeTiers: [{ minQty: 3, percentOff: 10 }] })]));
    expect(r.lines[0]).toMatchObject({ lineOff: 3000, net: 27000, lineOffReason: "volume" });
    expect(r.subtotal).toBe(27000);
  });
  it("الطقم والكمية لا يتراكمان: الأكبر منهما", () => {
    const r = priceCart(base([line({ key: "a", qty: 3, bundleOff: 5000, volumeTiers: [{ minQty: 3, percentOff: 10 }] })]));
    expect(r.lines[0]!.lineOff).toBe(5000);
    expect(r.lines[0]!.lineOffReason).toBe("bundle");
  });
});

describe("priceCart: الخصومات التلقائية", () => {
  const spend = (id: string, min: number, percent: number) => ({ id, label: id, rule: { type: "spend_percent" as const, minSubtotalPiasters: min, percent } });
  it("يطبق أفضل خصم إنفاق واحد فقط", () => {
    const r = priceCart(base([line({ key: "a", unit: 100000 })], { autoRules: [spend("r1", 50000, 5), spend("r2", 80000, 10)] }));
    expect(r.adjustments.filter((a) => a.kind === "auto")).toHaveLength(1);
    expect(r.orderDiscount).toBe(10000);
  });
  it("تلميح عند القرب من الحد", () => {
    const r = priceCart(base([line({ key: "a", unit: 30000 })], { autoRules: [spend("r1", 50000, 10)] }));
    expect(r.orderDiscount).toBe(0);
    expect(r.nudges.find((n) => n.kind === "discount")?.remainingPiasters).toBe(20000);
  });
  it("مبلغ ثابت لا يتجاوز المجموع", () => {
    const r = priceCart(base([line({ key: "a", unit: 3000 })], { autoRules: [{ id: "r", label: "r", rule: { type: "spend_amount", minSubtotalPiasters: 1000, amountPiasters: 9000 } }] }));
    expect(r.orderDiscount).toBe(3000);
    expect(r.afterDiscount).toBe(0);
  });
  it("هدية مجانية عند الحد وبسعر صفر، وتلميح قبله", () => {
    const rule = { id: "g", label: "g", rule: { type: "free_gift" as const, minSubtotalPiasters: 40000, productId: "gift" } };
    const gp = { gift: { productId: "gift", name: "شنطة", available: true } };
    const on = priceCart(base([line({ key: "a", unit: 40000 })], { autoRules: [rule], giftProducts: gp }));
    expect(on.lines.filter((l) => l.isGift)).toHaveLength(1);
    expect(on.lines.find((l) => l.isGift)).toMatchObject({ unit: 0, net: 0, qty: 1 });
    expect(on.subtotal).toBe(40000);
    const off = priceCart(base([line({ key: "a", unit: 10000 })], { autoRules: [rule], giftProducts: gp }));
    expect(off.lines.some((l) => l.isGift)).toBe(false);
    expect(off.nudges.some((n) => n.kind === "gift")).toBe(true);
    const gone = priceCart(base([line({ key: "a", unit: 40000 })], { autoRules: [rule], giftProducts: { gift: { productId: "gift", name: "x", available: false } } }));
    expect(gone.lines.some((l) => l.isGift)).toBe(false);
  });
  it("اشترِ 2 واحصل على 1 مجاناً: الأرخص", () => {
    const r = priceCart(
      base([line({ key: "a", unit: 10000, qty: 2 }), line({ key: "b", unit: 6000, qty: 1 })], { autoRules: [{ id: "b", label: "b", rule: { type: "buy_x_get_y", buyQty: 2, getQty: 1, percentOff: 100 } }] })
    );
    expect(r.orderDiscount).toBe(6000);
  });
  it("اشترِ X يحترم النطاق", () => {
    const r = priceCart(
      base([line({ key: "a", unit: 10000, qty: 3, categoryId: "c1" }), line({ key: "b", unit: 1000, qty: 3, categoryId: "c2" })], {
        autoRules: [{ id: "b", label: "b", scope: { categoryIds: ["c2"] }, rule: { type: "buy_x_get_y", buyQty: 2, getQty: 1, percentOff: 50 } }],
      })
    );
    expect(r.orderDiscount).toBe(500);
  });
});

describe("priceCart: كود الخصم", () => {
  const pct = { id: "c", code: "SAVE10", type: "percentage" as const, value: 10 };
  it("نسبة على المجموع", () => {
    const r = priceCart(base([line({ key: "a", unit: 20000 })], { coupon: pct }));
    expect(r.orderDiscount).toBe(2000);
    expect(r.adjustments[0]).toMatchObject({ kind: "coupon", code: "SAVE10" });
  });
  it("يُحسب على الباقي بعد الخصم التلقائي", () => {
    const r = priceCart(base([line({ key: "a", unit: 100000 })], { coupon: pct, autoRules: [{ id: "r", label: "r", rule: { type: "spend_amount", minSubtotalPiasters: 1, amountPiasters: 20000 } }] }));
    expect(r.orderDiscount).toBe(20000 + 8000);
  });
  it("النطاق: لا ينطبق على منتجات خارجه", () => {
    const r = priceCart(base([line({ key: "a", categoryId: "x" })], { coupon: { ...pct, scope: { categoryIds: ["y"] } } }));
    expect(r.couponError).toBeTruthy();
    expect(r.orderDiscount).toBe(0);
  });
  it("النطاق: يخصم من المطابق وحده", () => {
    const r = priceCart(base([line({ key: "a", unit: 10000, categoryId: "x" }), line({ key: "b", unit: 10000, categoryId: "y" })], { coupon: { ...pct, scope: { productIds: ["a"] } } }));
    expect(r.orderDiscount).toBe(1000);
  });
  it("الحد الأدنى", () => {
    const r = priceCart(base([line({ key: "a", unit: 5000 })], { coupon: { ...pct, minSubtotalPiasters: 10000 } }));
    expect(r.couponError).toContain("الحد الأدنى");
    expect(r.orderDiscount).toBe(0);
  });
  it("المبلغ الثابت لا يتجاوز المجموع", () => {
    const r = priceCart(base([line({ key: "a", unit: 3000 })], { coupon: { id: "c", code: "X", type: "fixed", value: 99999 } }));
    expect(r.orderDiscount).toBe(3000);
  });
});

describe("priceCart: الشحن", () => {
  it("كود الشحن المجاني يبقي رسوم الاستلام (لا تجاوز)", () => {
    const r = priceCart(base([line({ key: "a" })], { coupon: { id: "c", code: "FS", type: "free_shipping", value: 0 } }));
    expect(r.shipping).toBe(0);
    expect(r.codFee).toBe(1500);
    expect(r.freeShipping).toBe("coupon");
    expect(r.total).toBe(10000 + 1500);
  });
  it("الحد المجاني على المجموع بعد الخصم", () => {
    const sh = { baseFee: 5000, codExtra: 0, freeOverPiasters: 50000 };
    const a = priceCart(base([line({ key: "a", unit: 52000 })], { shipping: sh, coupon: { id: "c", code: "P", type: "percentage", value: 10 } }));
    expect(a.afterDiscount).toBe(46800);
    expect(a.shipping).toBe(5000);
    const b = priceCart(base([line({ key: "a", unit: 60000 })], { shipping: sh }));
    expect(b.shipping).toBe(0);
    expect(b.freeShipping).toBe("threshold");
  });
  it("رسوم الاستلام للدفع عند الاستلام فقط", () => {
    const r = priceCart(base([line({ key: "a" })], { paymentMethod: "instapay" }));
    expect(r.codFee).toBe(0);
  });
  it("بلا محافظة: الشحن والإجمالي null", () => {
    const r = priceCart(base([line({ key: "a" })], { shipping: null }));
    expect(r.shipping).toBeNull();
    expect(r.total).toBeNull();
  });
  it("تلميح الشحن المجاني", () => {
    const r = priceCart(base([line({ key: "a", unit: 30000 })], { shipping: { baseFee: 5000, codExtra: 0, freeOverPiasters: 50000 } }));
    expect(r.nudges.find((n) => n.kind === "free_shipping")?.remainingPiasters).toBe(20000);
  });
});

describe("priceCart: الدفع المسبق والهدية", () => {
  it("خصم الدفع المسبق للتحويل فقط", () => {
    const t = priceCart(base([line({ key: "a", unit: 20000 })], { paymentMethod: "vodafone_cash", prepaidPercent: 5 }));
    expect(t.adjustments.find((a) => a.kind === "prepaid")?.amount).toBe(1000);
    const c = priceCart(base([line({ key: "a", unit: 20000 })], { paymentMethod: "cod", prepaidPercent: 5 }));
    expect(c.adjustments.some((a) => a.kind === "prepaid")).toBe(false);
  });
  it("يتراكم مع كود واحد", () => {
    const r = priceCart(base([line({ key: "a", unit: 20000 })], { paymentMethod: "instapay", prepaidPercent: 10, coupon: { id: "c", code: "A", type: "percentage", value: 10 } }));
    expect(r.orderDiscount).toBe(2000 + 1800);
  });
  it("رسوم تغليف الهدية", () => {
    const r = priceCart(base([line({ key: "a" })], { wantsGiftWrap: true, giftWrapPiasters: 2500 }));
    expect(r.giftWrap).toBe(2500);
    expect(r.total).toBe(10000 + 5000 + 1500 + 2500);
  });
  it("الخصم الكلي لا يتجاوز المجموع", () => {
    const r = priceCart(base([line({ key: "a", unit: 1000 })], { paymentMethod: "instapay", prepaidPercent: 30, coupon: { id: "c", code: "A", type: "fixed", value: 5000 } }));
    expect(r.afterDiscount).toBe(0);
  });
});

describe("نطاق الخصم وتقدم الشحن", () => {
  it("inScope", () => {
    expect(inScope(null, { productId: "a" })).toBe(true);
    expect(inScope({}, { productId: "a" })).toBe(true);
    expect(inScope({ productIds: ["a"] }, { productId: "b", categoryId: "c" })).toBe(false);
    expect(inScope({ productIds: ["a"], categoryIds: ["c"] }, { productId: "b", categoryId: "c" })).toBe(true);
  });
  it("freeShippingProgress", () => {
    expect(freeShippingProgress({ freeOverPiasters: null, flatRatePiasters: null, afterDiscount: 5 })).toEqual({ kind: "none" });
    expect(freeShippingProgress({ freeOverPiasters: null, flatRatePiasters: 0, afterDiscount: 5 })).toEqual({ kind: "always" });
    expect(freeShippingProgress({ freeOverPiasters: 1000, flatRatePiasters: 50, afterDiscount: 500 })).toEqual({ kind: "progress", remaining: 500, percent: 50 });
    expect(freeShippingProgress({ freeOverPiasters: 1000, flatRatePiasters: null, afterDiscount: 1000 })).toEqual({ kind: "reached" });
  });
});
