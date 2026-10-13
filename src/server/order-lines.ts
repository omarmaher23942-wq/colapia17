import "server-only";
// order-lines.ts — قواعد تسعير الطلب المشتركة بين دفع المتجر (`actions/checkout.ts`) والطلب اليدوي من الشات
// (`actions/manual-order.ts`): أسعار الأصناف والمخزون من القاعدة، والشحن من جدول المناطق، وكود الخصم. ملف خادم
// عادي (لا "use server") حتى لا تصبح هذه الدوال نقاط استدعاء عامة.
import { z } from "zod";
import { and, eq, ne, sql, inArray, isNull } from "drizzle-orm";
import type { StoreBlueprint } from "@/blueprint/schema";
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
    return { p, v, qty: i.qty, unit, total: unit * i.qty };
  });

  if (bp) applyBundleDiscounts(lines, input, bp);
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

export async function validateDiscount(
  storeId: string,
  code: string,
  subtotal: number,
  phone: string
) {
  const db = await getTenantDb(storeId);
  const [d] = await db
    .select()
    .from(discounts)
    .where(
      and(
        eq(discounts.storeId, storeId),
        eq(discounts.code, code),
        eq(discounts.isActive, true)
      )
    )
    .limit(1);

  if (!d) return { error: "كود الخصم غير صحيح" } as const;
  const now = Date.now();
  if (d.startsAt && d.startsAt.getTime() > now)
    return { error: "كود الخصم لم يبدأ بعد" } as const;
  if (d.endsAt && d.endsAt.getTime() < now)
    return { error: "كود الخصم منتهي الصلاحية" } as const;
  if (d.maxUses && d.usedCount >= d.maxUses)
    return { error: "تم استهلاك كود الخصم بالكامل" } as const;
  if (d.minSubtotalPiasters && subtotal < d.minSubtotalPiasters) {
    return {
      error: `الحد الأدنى لتطبيق الخصم هو ${
        d.minSubtotalPiasters / 100
      } ج.م`,
    } as const;
  }
  if (d.perCustomerLimit && phone) {
    const [row] = await db
      .select({ c: sql<number>`count(*)`.mapWith(Number) })
      .from(orders)
      .where(
        and(
          eq(orders.storeId, storeId),
          eq(orders.customerPhone, phone),
          eq(orders.discountCode, code),
          // الطلب الملغي لا يستهلك حق العميل في الكود.
          ne(orders.status, "cancelled")
        )
      );
    if ((row?.c ?? 0) >= d.perCustomerLimit)
      return { error: "استخدمت هذا الكود من قبل بالفعل" } as const;
  }

  const amount =
    d.type === "percentage"
      ? Math.min(
          subtotal,
          Math.round(
            (subtotal * Math.min(100, Math.max(0, d.value))) / 100
          )
        )
      : d.type === "fixed"
      ? Math.min(Math.max(0, d.value), subtotal)
      : 0;

  return { discount: d, amount, freeShipping: d.type === "free_shipping" } as const;
}
