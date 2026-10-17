import "server-only";
// order-lines.ts — قواعد تسعير الطلب المشتركة بين دفع المتجر (`actions/checkout.ts`) والطلب اليدوي من الشات
// (`actions/manual-order.ts`): أسعار الأصناف والمخزون من القاعدة، والشحن من جدول المناطق، وكود الخصم. ملف خادم
// عادي (لا "use server") حتى لا تصبح هذه الدوال نقاط استدعاء عامة.
import { z } from "zod";
import { and, eq, ne, sql, inArray, isNull } from "drizzle-orm";
import type { StoreBlueprint } from "@/blueprint/schema";
import { priceCart, type AutoRule, type CouponDef, type EngineInput, type EngineResult, type GiftProduct, type PayMethod } from "@/lib/pricing/engine";
import { autoRuleLabel } from "@/lib/discounts";
import { applyBundleDiscounts } from "@/server/pricing/bundles";
import { getTenantDb } from "@/db/tenant";
import { orders, products, productVariants, discounts, shippingZones } from "@/db/schema";
import { GOVERNORATES } from "@/lib/egypt";

export class CheckoutError extends Error {
  constructor(message: string, readonly field?: string) {
    super(message);
    this.name = "CheckoutError";
  }
}

export const GOV_CODES = GOVERNORATES.map((g) => g.code) as unknown as [
  string,
  ...string[]
];
export const isGovernorate = (v: string) =>
  (GOV_CODES as readonly string[]).includes(v);

export const cartItemsSchema = z
  .array(
    z.object({
      productId: z.string().uuid(),
      variantId: z.string().uuid().optional(),
      qty: z.number().int().min(1).max(50),
      bundleId: z.string().max(64).optional(),
    })
  )
  .min(1, "السلة فارغة")
  .max(50, "عدد المنتجات بالطلب كبير");

export type PricedLine = {
  p: typeof products.$inferSelect;
  v?: typeof productVariants.$inferSelect;
  qty: number;
  unit: number;
  total: number;
  /** خصم الطقم على هذا السطر (قروش)؛ المحرك يطبّقه مع أسعار الكمية. */
  bundleOff: number;
};

export async function priceLines(
  storeId: string,
  input: z.infer<typeof cartItemsSchema>,
  bp?: Pick<StoreBlueprint, "home">
): Promise<{ lines: PricedLine[]; subtotal: number }> {
  const db = await getTenantDb(storeId);
  const merged = new Map<
    string,
    { productId: string; variantId?: string; qty: number }
  >();
  for (const i of input) {
    const k = `${i.productId}:${i.variantId ?? ""}`;
    const ex = merged.get(k);
    merged.set(k, ex ? { ...ex, qty: ex.qty + i.qty } : { ...i });
  }
  const items = Array.from(merged.values());
  const ids = Array.from(new Set(items.map((i) => i.productId)));
  const vids = Array.from(
    new Set(items.map((i) => i.variantId).filter((x): x is string => !!x))
  );

  const [rows, vrows] = await Promise.all([
    db
      .select()
      .from(products)
      .where(
        and(
          eq(products.storeId, storeId),
          inArray(products.id, ids),
          eq(products.status, "active"),
          isNull(products.deletedAt)
        )
      ),
    vids.length
      ? db
          .select()
          .from(productVariants)
          .where(
            and(
              eq(productVariants.storeId, storeId),
              inArray(productVariants.id, vids)
            )
          )
      : Promise.resolve([] as (typeof productVariants.$inferSelect)[]),
  ]);

  const lines: PricedLine[] = items.map((i) => {
    const p = rows.find((r) => r.id === i.productId);
    if (!p) throw new CheckoutError("منتج في سلتك لم يعد متوفراً حالياً");
    const v = i.variantId
      ? vrows.find((x) => x.id === i.variantId && x.productId === p.id)
      : undefined;
    if (p.optionNames.length && !v)
      throw new CheckoutError(`يرجى تحديد خيارات المنتج ${p.name}`);
    if (v && !v.isAvailable)
      throw new CheckoutError(
        `المقاس أو اللون المطلوب من ${p.name} غير متوفر حالياً`
      );

    const currentStock = v ? v.stock : p.stock;
    if (p.trackStock && currentStock !== null && currentStock < i.qty) {
      throw new CheckoutError(
        currentStock <= 0
          ? `عذراً، نفدت كمية ${p.name}`
          : `الكمية المتاحة من ${p.name} هي ${currentStock} فقط`
      );
    }
    const unit = v?.pricePiasters ?? p.pricePiasters;
    return { p, v, qty: i.qty, unit, total: unit * i.qty, bundleOff: 0 };
  });

  if (bp) {
    applyBundleDiscounts(lines, input, bp);
    // خصم الطقم يُنقل إلى bundleOff ويبقى total سعر السطر قبل الخصم: المحرك (lib/pricing) هو من يخصم.
    for (const l of lines) {
      l.bundleOff = Math.max(0, l.unit * l.qty - l.total);
      l.total = l.unit * l.qty;
    }
  }
  return { lines, subtotal: lines.reduce((a, l) => a + l.total, 0) };
}

export async function computeShipping(
  storeId: string,
  bp: {
    shipping: {
      freeOverPiasters: number | null;
      flatRatePiasters: number | null;
    };
  },
  governorate: string,
  subtotal: number,
  method: string
) {
  const db = await getTenantDb(storeId);
  if (!isGovernorate(governorate))
    throw new CheckoutError("اختر المحافظة أولاً", "governorate");

  // جدول المناطق هو المرجع دائماً: يحدد المحافظات المتاحة ورسوم الدفع عند الاستلام،
  // حتى حين يكون سعر الشحن موحداً أو مجانياً.
  const [z] = await db
    .select()
    .from(shippingZones)
    .where(and(eq(shippingZones.storeId, storeId), eq(shippingZones.governorate, governorate)))
    .limit(1);
  if (z && !z.isActive)
    throw new CheckoutError("الشحن غير متوفر لهذه المحافظة حالياً", "governorate");

  const codExtra = method === "cod" ? Math.max(0, z?.codExtraPiasters ?? 0) : 0;
  if (bp.shipping.freeOverPiasters !== null && subtotal >= bp.shipping.freeOverPiasters)
    return { fee: 0, codExtra };
  if (bp.shipping.flatRatePiasters !== null) return { fee: bp.shipping.flatRatePiasters, codExtra };
  if (!z) throw new CheckoutError("الشحن غير متوفر لهذه المحافظة حالياً", "governorate");
  return { fee: Math.max(0, z.feePiasters), codExtra };
}

/** شحن المحافظة: يتحقق دائماً من المنطقة (حتى مع الشحن الموحد أو كود الشحن المجاني) ويعيد الرسم الأساسي ورسوم الاستلام. */
export async function resolveShipping(
  storeId: string,
  bp: { shipping: { flatRatePiasters: number | null } },
  governorate: string,
  method: string
): Promise<{ baseFee: number; codExtra: number }> {
  const db = await getTenantDb(storeId);
  if (!isGovernorate(governorate)) throw new CheckoutError("اختاروا المحافظة أولاً", "governorate");
  const [z] = await db
    .select()
    .from(shippingZones)
    .where(and(eq(shippingZones.storeId, storeId), eq(shippingZones.governorate, governorate)))
    .limit(1);
  if (z && !z.isActive) throw new CheckoutError("الشحن غير متوفر لهذه المحافظة حالياً", "governorate");
  if (!z && bp.shipping.flatRatePiasters === null) throw new CheckoutError("الشحن غير متوفر لهذه المحافظة حالياً", "governorate");
  return {
    baseFee: bp.shipping.flatRatePiasters ?? Math.max(0, z?.feePiasters ?? 0),
    codExtra: method === "cod" ? Math.max(0, z?.codExtraPiasters ?? 0) : 0,
  };
}

type DiscountRow = typeof discounts.$inferSelect;

/** الخصومات الجارية الآن (تلقائية وكود) بعد فحص الوقت والاستهلاك؛ والكود يُفحص أيضاً لكل رقم موبايل. */
export async function loadDiscountContext(
  storeId: string,
  code: string | undefined,
  phone: string
): Promise<{ autoRules: AutoRule[]; autoIds: string[]; coupon: CouponDef | null; couponRow: DiscountRow | null; couponError?: string; giftProducts: Record<string, GiftProduct> }> {
  const db = await getTenantDb(storeId);
  const now = Date.now();
  const rows = await db.select().from(discounts).where(and(eq(discounts.storeId, storeId), eq(discounts.isActive, true)));
  const live = (d: DiscountRow) =>
    (!d.startsAt || d.startsAt.getTime() <= now) && (!d.endsAt || d.endsAt.getTime() >= now) && (!d.maxUses || d.usedCount < d.maxUses);

  const autos = rows.filter((d) => d.isAutoApply && d.rule && live(d));
  const autoRules: AutoRule[] = autos.map((d) => ({ id: d.id, label: autoRuleLabel(d.rule!), rule: d.rule!, scope: d.scope }));

  const giftIds = [...new Set(autos.flatMap((d) => (d.rule!.type === "free_gift" ? [d.rule!.productId] : [])))];
  const giftProducts: Record<string, GiftProduct> = {};
  if (giftIds.length) {
    const gp = await db
      .select()
      .from(products)
      .where(and(eq(products.storeId, storeId), inArray(products.id, giftIds), eq(products.status, "active"), isNull(products.deletedAt)));
    for (const p of gp) giftProducts[p.id] = { productId: p.id, name: p.name, available: !p.trackStock || p.stock === null || p.stock > 0 };
  }

  let coupon: CouponDef | null = null;
  let couponRow: DiscountRow | null = null;
  let couponError: string | undefined;
  if (code) {
    const d = rows.find((x) => x.code === code && !x.isAutoApply);
    if (!d) couponError = "كود الخصم غير صحيح";
    else if (d.startsAt && d.startsAt.getTime() > now) couponError = "كود الخصم لم يبدأ بعد";
    else if (d.endsAt && d.endsAt.getTime() < now) couponError = "كود الخصم منتهي الصلاحية";
    else if (d.maxUses && d.usedCount >= d.maxUses) couponError = "تم استهلاك كود الخصم بالكامل";
    else {
      if (d.perCustomerLimit && phone) {
        const [row] = await db
          .select({ c: sql<number>`count(*)`.mapWith(Number) })
          .from(orders)
          .where(and(eq(orders.storeId, storeId), eq(orders.customerPhone, phone), eq(orders.discountCode, code), ne(orders.status, "cancelled")));
        if ((row?.c ?? 0) >= d.perCustomerLimit) couponError = "استخدمتم هذا الكود من قبل بالفعل";
      }
      if (!couponError) {
        couponRow = d;
        coupon = { id: d.id, code: d.code, type: d.type, value: d.value, minSubtotalPiasters: d.minSubtotalPiasters, scope: d.scope };
      }
    }
  }
  return { autoRules, autoIds: autos.map((d) => d.id), coupon, couponRow, couponError, giftProducts };
}

export type CartQuote = {
  lines: PricedLine[];
  result: EngineResult;
  couponRow: DiscountRow | null;
  couponError?: string;
  autoIds: string[];
  /** الأسطر المرسلة لمحرك التسعير بنفس ترتيب lines (الهدايا بعدها). */
  engineKeys: string[];
};

/** عرض سعر كامل لسلة: يُستدعى من عرض السعر وإتمام الطلب بنفس المدخلات فيتطابق الرقمان دائماً. */
export async function quoteCart(
  storeId: string,
  bp: StoreBlueprint,
  q: {
    items: z.infer<typeof cartItemsSchema>;
    governorate?: string;
    paymentMethod: PayMethod;
    discountCode?: string;
    phone?: string;
    giftWrap?: boolean;
  }
): Promise<CartQuote> {
  const { lines } = await priceLines(storeId, q.items, bp);
  const ctx = await loadDiscountContext(storeId, q.discountCode, q.phone ?? "");
  let shipping: EngineInput["shipping"] = null;
  if (q.governorate && isGovernorate(q.governorate)) {
    const s = await resolveShipping(storeId, bp, q.governorate, q.paymentMethod);
    shipping = { baseFee: s.baseFee, codExtra: s.codExtra, freeOverPiasters: bp.shipping.freeOverPiasters };
  } else if (q.governorate) {
    throw new CheckoutError("اختاروا المحافظة أولاً", "governorate");
  }
  const engineKeys = lines.map((l) => `${l.p.id}:${l.v?.id ?? ""}`);
  const result = priceCart({
    lines: lines.map((l, i) => ({
      key: engineKeys[i]!,
      productId: l.p.id,
      variantId: l.v?.id,
      categoryId: l.p.categoryId,
      name: l.p.name,
      unit: l.unit,
      qty: l.qty,
      volumeTiers: l.p.volumeTiers,
      bundleOff: l.bundleOff,
    })),
    autoRules: ctx.autoRules,
    coupon: ctx.coupon,
    giftProducts: ctx.giftProducts,
    paymentMethod: q.paymentMethod,
    prepaidPercent: bp.payments.prepaidDiscountPercent ?? 0,
    shipping,
    wantsGiftWrap: q.giftWrap,
    giftWrapPiasters: bp.shipping.giftWrapPiasters ?? 0,
  });
  return { lines, result, couponRow: ctx.couponRow, couponError: ctx.couponError ?? result.couponError, autoIds: ctx.autoIds, engineKeys };
}

