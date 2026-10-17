import "server-only";
// cart-check.ts — التحقق الحي من السلة: السلة على الجهاز تقدير، وهذا ما يقوله الخادم الآن (توفر، سعر، كمية، خصومات تلقائية،
// تقدّم الشحن المجاني، واقتراحات «أكملوا الإطلالة»). تُستدعى عند فتح السلة وصفحة الدفع.
import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";
import type { StoreBlueprint } from "@/blueprint/schema";
import { getTenantDb } from "@/db/tenant";
import { products, productVariants } from "@/db/schema";
import { CheckoutError, quoteCart } from "@/server/order-lines";
import { frequentlyBoughtTogether } from "@/server/repos/catalog";
import type { QuoteLine } from "@/server/actions/checkout";
import { freeShippingProgress } from "@/lib/pricing/engine";

export const cartCheckSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        variantId: z.string().uuid().optional(),
        qty: z.number().int().min(1).max(50),
        unitPiasters: z.number().int().min(0).max(1_000_000_000).optional(),
        bundleId: z.string().max(64).optional(),
      })
    )
    .max(50),
  governorate: z.string().max(40).optional(),
  discountCode: z.string().trim().toUpperCase().max(20).optional(),
});

export type LineStatus = "ok" | "removed" | "unavailable" | "out_of_stock" | "qty_limited" | "price_changed";
export type LineCheck = { key: string; status: LineStatus; unit?: number; maxQty?: number | null; name?: string };
export type Suggestion = { id: string; slug: string; name: string; pricePiasters: number; imageUrl?: string; hasOptions: boolean };

export type CartCheckResult = {
  lines: LineCheck[];
  quote: {
    lines: QuoteLine[];
    subtotal: number;
    afterDiscount: number;
    discount: number;
    adjustments: { kind: "auto" | "coupon" | "prepaid"; label: string; amount: number }[];
    nudges: { kind: "gift" | "discount" | "free_shipping"; label: string; remainingPiasters: number }[];
    couponError?: string;
    shipping: number | null;
    freeShipping: null | "coupon" | "threshold";
    progress: ReturnType<typeof freeShippingProgress>;
  } | null;
  suggestions: Suggestion[];
};

const keyOf = (i: { productId: string; variantId?: string; bundleId?: string }) => `${i.productId}:${i.variantId ?? ""}${i.bundleId ? `:${i.bundleId}` : ""}`;

export async function cartCheck(storeId: string, bp: StoreBlueprint, raw: z.infer<typeof cartCheckSchema>): Promise<CartCheckResult> {
  const db = await getTenantDb(storeId);
  const ids = [...new Set(raw.items.map((i) => i.productId))];
  const vids = [...new Set(raw.items.map((i) => i.variantId).filter((x): x is string => Boolean(x)))];
  const [prods, vars] = await Promise.all([
    ids.length ? db.select().from(products).where(and(eq(products.storeId, storeId), inArray(products.id, ids))) : Promise.resolve([] as (typeof products.$inferSelect)[]),
    vids.length ? db.select().from(productVariants).where(and(eq(productVariants.storeId, storeId), inArray(productVariants.id, vids))) : Promise.resolve([] as (typeof productVariants.$inferSelect)[]),
  ]);

  const lines: LineCheck[] = [];
  const valid: { productId: string; variantId?: string; qty: number; bundleId?: string }[] = [];
  for (const i of raw.items) {
    const key = keyOf(i);
    const p = prods.find((x) => x.id === i.productId);
    if (!p || p.status !== "active" || p.deletedAt) {
      lines.push({ key, status: "removed", name: p?.name });
      continue;
    }
    const v = i.variantId ? vars.find((x) => x.id === i.variantId && x.productId === p.id) : undefined;
    if ((i.variantId && !v) || (v && !v.isAvailable)) {
      lines.push({ key, status: "unavailable", name: p.name });
      continue;
    }
    if (p.optionNames.length && !v) {
      lines.push({ key, status: "unavailable", name: p.name });
      continue;
    }
    const stock = v ? v.stock : p.stock;
    const unit = v?.pricePiasters ?? p.pricePiasters;
    const limited = p.trackStock && stock !== null;
    if (limited && stock! <= 0) {
      lines.push({ key, status: "out_of_stock", name: p.name, maxQty: 0 });
      continue;
    }
    const maxQty = limited ? stock! : null;
    const qty = maxQty !== null ? Math.min(i.qty, maxQty) : i.qty;
    const status: LineStatus = qty < i.qty ? "qty_limited" : i.unitPiasters !== undefined && i.unitPiasters !== unit ? "price_changed" : "ok";
    lines.push({ key, status, unit, maxQty, name: p.name });
    valid.push({ productId: i.productId, variantId: i.variantId, qty, bundleId: i.bundleId });
  }

  let quote: CartCheckResult["quote"] = null;
  if (valid.length) {
    try {
      const base = { items: valid, paymentMethod: "cod" as const };
      let cq;
      try {
        cq = await quoteCart(storeId, bp, { ...base, governorate: raw.governorate, discountCode: raw.discountCode });
      } catch (e) {
        if (!(e instanceof CheckoutError) || e.field !== "governorate") throw e;
        cq = await quoteCart(storeId, bp, { ...base, discountCode: raw.discountCode });
      }
      const r = cq.result;
      quote = {
        lines: r.lines.map((l) => ({ key: l.key, productId: l.productId, variantId: l.variantId ?? undefined, name: l.name, unit: l.unit, qty: l.qty, net: l.net, lineOff: l.lineOff, reason: l.lineOffReason, isGift: l.isGift })),
        subtotal: r.subtotal,
        afterDiscount: r.afterDiscount,
        discount: r.orderDiscount,
        adjustments: r.adjustments.map((a) => ({ kind: a.kind, label: a.label, amount: a.amount })),
        nudges: r.nudges,
        couponError: cq.couponError,
        shipping: r.shipping,
        freeShipping: r.freeShipping,
        progress: freeShippingProgress({ freeOverPiasters: bp.shipping.freeOverPiasters, flatRatePiasters: bp.shipping.flatRatePiasters, afterDiscount: r.afterDiscount }),
      };
    } catch {
      quote = null;
    }
  }

  // «أكملوا الإطلالة»: مما يُشترى مع أول منتج في السلة، بلا ما هو فيها أصلاً.
  let suggestions: Suggestion[] = [];
  const first = prods.find((p) => p.id === valid[0]?.productId);
  if (first) {
    const { rows } = await frequentlyBoughtTogether(storeId, first, 6);
    suggestions = rows
      .filter((r) => !ids.includes(r.id) && (!r.trackStock || r.stock === null || r.stock > 0))
      .slice(0, 4)
      .map((r) => ({ id: r.id, slug: r.slug, name: r.name, pricePiasters: r.pricePiasters, imageUrl: r.images[0]?.url, hasOptions: r.optionNames.length > 0 }));
  }
  return { lines, quote, suggestions };
}
