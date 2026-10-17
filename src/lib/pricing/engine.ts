// engine.ts — محرك التسعير الواحد (خالص بلا قاعدة بيانات): يستخدمه عرض السعر وإتمام الطلب والطلب اليدوي، فلا يختلف رقم
// السلة عن رقم الطلب أبداً. كل المبالغ أعداد صحيحة بالقروش.
//
// الترتيب: خصم السطر (أسعار الكمية أو الطقم، الأكبر منهما لكل سطر) ← الخصومات التلقائية (أفضل خصم إنفاق واحد + «اشترِ X
// واحصل على Y») ← كود الخصم (واحد، على الباقي بعد التلقائي، ضمن نطاقه) ← خصم الدفع المسبق ← الشحن (يُحسب دائماً، والمجاني
// بكود أو بحد أدنى على المجموع بعد الخصم، ورسوم الاستلام تبقى) ← تغليف الهدية. الهدايا المجانية أسطر بسعر صفر.
export type VolumeTier = { minQty: number; percentOff: number };
export type DiscountScope = { productIds?: string[]; categoryIds?: string[] } | null | undefined;
export type AutoRuleDef =
  | { type: "spend_percent"; minSubtotalPiasters: number; percent: number }
  | { type: "spend_amount"; minSubtotalPiasters: number; amountPiasters: number }
  | { type: "free_gift"; minSubtotalPiasters: number; productId: string; variantId?: string }
  | { type: "buy_x_get_y"; buyQty: number; getQty: number; percentOff: number };

export type EngineLine = {
  key: string;
  productId: string;
  variantId?: string | null;
  categoryId?: string | null;
  name: string;
  unit: number;
  qty: number;
  volumeTiers?: VolumeTier[];
  /** خصم الطقم الكلي لهذا السطر (محسوب مسبقاً من إعدادات المتجر). */
  bundleOff?: number;
};
export type AutoRule = { id: string; label: string; rule: AutoRuleDef; scope?: DiscountScope };
export type CouponDef = {
  id: string;
  code: string;
  type: "percentage" | "fixed" | "free_shipping";
  value: number;
  minSubtotalPiasters?: number | null;
  scope?: DiscountScope;
};
export type GiftProduct = { productId: string; variantId?: string | null; name: string; available: boolean };
export type PayMethod = "cod" | "vodafone_cash" | "instapay";

export type EngineInput = {
  lines: EngineLine[];
  autoRules?: AutoRule[];
  coupon?: CouponDef | null;
  giftProducts?: Record<string, GiftProduct>;
  paymentMethod: PayMethod;
  /** نسبة خصم الدفع المسبق (فودافون كاش/إنستاباي) من إعدادات المتجر. */
  prepaidPercent?: number;
  /** null = المحافظة لم تُحدد بعد. baseFee = رسم المنطقة أو الموحد، codExtra = رسوم الاستلام. */
  shipping: { baseFee: number; codExtra: number; freeOverPiasters: number | null } | null;
  giftWrapPiasters?: number;
  wantsGiftWrap?: boolean;
};

export type LineOut = {
  key: string;
  productId: string;
  variantId?: string | null;
  name: string;
  unit: number;
  qty: number;
  gross: number;
  /** خصم السطر (كمية أو طقم) ويُحفظ في order_items.discount_piasters. */
  lineOff: number;
  lineOffReason: "volume" | "bundle" | null;
  net: number;
  isGift: boolean;
};
export type Adjustment = { kind: "auto" | "coupon" | "prepaid"; id?: string; code?: string; label: string; amount: number };
export type Nudge = { kind: "gift" | "discount" | "free_shipping"; label: string; remainingPiasters: number };

export type EngineResult = {
  lines: LineOut[];
  gross: number;
  lineDiscounts: number;
  /** مجموع الأسطر بعد خصم السطر (هذا ما يُخزَّن subtotal). */
  subtotal: number;
  adjustments: Adjustment[];
  orderDiscount: number;
  afterDiscount: number;
  shipping: number | null;
  codFee: number;
  freeShipping: null | "coupon" | "threshold";
  giftWrap: number;
  total: number | null;
  couponError?: string;
  nudges: Nudge[];
};

const clampPct = (n: number) => Math.min(100, Math.max(0, n));
const pct = (amount: number, p: number) => Math.round((amount * clampPct(p)) / 100);

export function inScope(scope: DiscountScope, l: { productId: string; categoryId?: string | null }): boolean {
  if (!scope) return true;
  const p = scope.productIds?.length ? scope.productIds : null;
  const c = scope.categoryIds?.length ? scope.categoryIds : null;
  if (!p && !c) return true;
  return Boolean((p && p.includes(l.productId)) || (c && l.categoryId && c.includes(l.categoryId)));
}

export function bestVolumeTier(tiers: VolumeTier[] | undefined, qty: number): VolumeTier | null {
  let best: VolumeTier | null = null;
  for (const t of tiers ?? []) {
    if (t.minQty >= 2 && qty >= t.minQty && t.percentOff > 0 && (!best || t.percentOff > best.percentOff)) best = t;
  }
  return best;
}

const egp = (p: number) => `${Math.round(p / 100).toLocaleString("en-US")} ج.م`;

export function priceCart(input: EngineInput): EngineResult {
  const lines: LineOut[] = input.lines.map((l) => {
    const gross = l.unit * l.qty;
    const vol = bestVolumeTier(l.volumeTiers, l.qty);
    const volOff = vol ? pct(gross, vol.percentOff) : 0;
    const bundleOff = Math.min(gross, Math.max(0, l.bundleOff ?? 0));
    const lineOff = Math.min(gross, Math.max(volOff, bundleOff));
    return {
      key: l.key,
      productId: l.productId,
      variantId: l.variantId,
      name: l.name,
      unit: l.unit,
      qty: l.qty,
      gross,
      lineOff,
      lineOffReason: lineOff === 0 ? null : volOff >= bundleOff ? "volume" : "bundle",
      net: gross - lineOff,
      isGift: false,
    };
  });
  const catOf = new Map(input.lines.map((l) => [l.key, l.categoryId ?? null]));
  const sub = (scope?: DiscountScope) =>
    lines.reduce((a, l) => (inScope(scope, { productId: l.productId, categoryId: catOf.get(l.key) }) ? a + l.net : a), 0);

  const gross = lines.reduce((a, l) => a + l.gross, 0);
  const lineDiscounts = lines.reduce((a, l) => a + l.lineOff, 0);
  const subtotal = gross - lineDiscounts;

  const adjustments: Adjustment[] = [];
  const nudges: Nudge[] = [];
  const gifts: LineOut[] = [];

  // الخصومات التلقائية: أفضل خصم إنفاق واحد، وكل قواعد «اشترِ X» والهدايا المؤهلة.
  let bestSpend: Adjustment | null = null;
  for (const r of input.autoRules ?? []) {
    const rule = r.rule;
    if (rule.type === "spend_percent" || rule.type === "spend_amount") {
      const base = sub(r.scope);
      if (base >= rule.minSubtotalPiasters && base > 0) {
        const amount = rule.type === "spend_percent" ? pct(base, rule.percent) : Math.min(base, Math.max(0, rule.amountPiasters));
        if (amount > 0 && (!bestSpend || amount > bestSpend.amount)) bestSpend = { kind: "auto", id: r.id, label: r.label, amount };
      } else if (base > 0) {
        nudges.push({ kind: "discount", label: r.label, remainingPiasters: rule.minSubtotalPiasters - base });
      }
    } else if (rule.type === "buy_x_get_y") {
      const units: number[] = [];
      for (const l of lines) {
        if (!inScope(r.scope, { productId: l.productId, categoryId: catOf.get(l.key) })) continue;
        const perUnit = l.qty ? l.net / l.qty : 0;
        for (let i = 0; i < l.qty; i++) units.push(perUnit);
      }
      const group = rule.buyQty + rule.getQty;
      if (group > 0 && rule.getQty > 0) {
        const groups = Math.floor(units.length / group);
        const free = units.sort((a, b) => a - b).slice(0, groups * rule.getQty);
        const amount = pct(free.reduce((a, b) => a + b, 0), rule.percentOff);
        if (amount > 0) adjustments.push({ kind: "auto", id: r.id, label: r.label, amount });
      }
    } else if (rule.type === "free_gift") {
      const gp = input.giftProducts?.[rule.productId];
      const base = sub(r.scope);
      if (!gp || !gp.available) continue;
      if (base >= rule.minSubtotalPiasters && base > 0) {
        gifts.push({ key: `gift:${r.id}`, productId: gp.productId, variantId: gp.variantId, name: gp.name, unit: 0, qty: 1, gross: 0, lineOff: 0, lineOffReason: null, net: 0, isGift: true });
      } else if (base > 0) {
        nudges.push({ kind: "gift", label: `هدية: ${gp.name}`, remainingPiasters: rule.minSubtotalPiasters - base });
      }
    }
  }
  if (bestSpend) adjustments.unshift(bestSpend);
  let autoOff = Math.min(subtotal, adjustments.reduce((a, x) => a + x.amount, 0));

  // كود الخصم (واحد).
  let couponError: string | undefined;
  let couponFreeShip = false;
  const c = input.coupon;
  if (c) {
    const eligible = sub(c.scope);
    if (eligible <= 0) couponError = "هذا الكود لا ينطبق على المنتجات في السلة";
    else if (c.minSubtotalPiasters && eligible < c.minSubtotalPiasters) couponError = `الحد الأدنى لتطبيق الكود هو ${egp(c.minSubtotalPiasters)}`;
    else if (c.type === "free_shipping") couponFreeShip = true;
    else {
      const share = subtotal > 0 ? Math.round((autoOff * eligible) / subtotal) : 0;
      const base = Math.max(0, eligible - share);
      const amount = c.type === "percentage" ? pct(base, c.value) : Math.min(base, Math.max(0, c.value));
      adjustments.push({ kind: "coupon", id: c.id, code: c.code, label: `كود ${c.code}`, amount });
    }
  }
  autoOff = Math.min(subtotal, adjustments.reduce((a, x) => a + x.amount, 0));

  // الدفع المسبق.
  const prepaidP = input.prepaidPercent ?? 0;
  if (input.paymentMethod !== "cod" && prepaidP > 0) {
    const amount = pct(Math.max(0, subtotal - autoOff), prepaidP);
    if (amount > 0) adjustments.push({ kind: "prepaid", label: `خصم الدفع المسبق ${prepaidP}%`, amount });
  }
  const orderDiscount = Math.min(subtotal, adjustments.reduce((a, x) => a + x.amount, 0));
  const afterDiscount = subtotal - orderDiscount;

  // الشحن.
  let shipping: number | null = null;
  let codFee = 0;
  let freeShipping: EngineResult["freeShipping"] = null;
  if (input.shipping) {
    codFee = input.paymentMethod === "cod" ? Math.max(0, input.shipping.codExtra) : 0;
    shipping = Math.max(0, input.shipping.baseFee);
    const th = input.shipping.freeOverPiasters;
    if (couponFreeShip) {
      shipping = 0;
      freeShipping = "coupon";
    } else if (th !== null && th > 0 && afterDiscount >= th) {
      shipping = 0;
      freeShipping = "threshold";
    }
  }
  if (input.shipping?.freeOverPiasters && !freeShipping && afterDiscount > 0) {
    nudges.push({ kind: "free_shipping", label: "شحن مجاني", remainingPiasters: input.shipping.freeOverPiasters - afterDiscount });
  }

  const giftWrap = input.wantsGiftWrap ? Math.max(0, input.giftWrapPiasters ?? 0) : 0;
  const total = shipping === null ? null : afterDiscount + shipping + codFee + giftWrap;

  return {
    lines: [...lines, ...gifts],
    gross,
    lineDiscounts,
    subtotal,
    adjustments,
    orderDiscount,
    afterDiscount,
    shipping,
    codFee,
    freeShipping,
    giftWrap,
    total,
    couponError,
    nudges: nudges.filter((n) => n.remainingPiasters > 0).sort((a, b) => a.remainingPiasters - b.remainingPiasters),
  };
}

/** تقدّم الشحن المجاني للسلة: يعرف الموحد والمناطق والحد الأدنى. */
export function freeShippingProgress(opts: { freeOverPiasters: number | null; flatRatePiasters: number | null; afterDiscount: number }):
  | { kind: "none" }
  | { kind: "always" }
  | { kind: "progress"; remaining: number; percent: number }
  | { kind: "reached" } {
  const { freeOverPiasters: th, flatRatePiasters: flat, afterDiscount } = opts;
  if (flat === 0) return { kind: "always" };
  if (th === null || th <= 0) return { kind: "none" };
  if (afterDiscount >= th) return { kind: "reached" };
  return { kind: "progress", remaining: th - afterDiscount, percent: Math.max(0, Math.min(100, Math.round((afterDiscount / th) * 100))) };
}
