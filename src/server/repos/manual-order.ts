// manual-order.ts — كتالوج «طلب من الشات»: المنتجات المنشورة بتركيباتها وأسعارها ومخزونها الحالي (للاختيار السريع).
import "server-only";
import { and, asc, eq, isNull } from "drizzle-orm";
import { getTenantDb } from "@/db/tenant";
import { products, productVariants } from "@/db/schema";

export type PickVariant = { id: string; label: string; price: number; stock: number | null; available: boolean };
export type PickProduct = { id: string; name: string; image: string | null; price: number; trackStock: boolean; stock: number | null; optionNames: string[]; variants: PickVariant[] };

export async function manualOrderCatalog(storeId: string): Promise<PickProduct[]> {
  const db = await getTenantDb(storeId);
  const [rows, vrows] = await Promise.all([
    db
      .select({ id: products.id, name: products.name, images: products.images, price: products.pricePiasters, trackStock: products.trackStock, stock: products.stock, optionNames: products.optionNames })
      .from(products)
      .where(and(eq(products.storeId, storeId), eq(products.status, "active"), isNull(products.deletedAt)))
      .orderBy(asc(products.name))
      .limit(1000),
    db
      .select({ id: productVariants.id, productId: productVariants.productId, values: productVariants.optionValues, price: productVariants.pricePiasters, stock: productVariants.stock, available: productVariants.isAvailable })
      .from(productVariants)
      .where(eq(productVariants.storeId, storeId)),
  ]);
  return rows.map((p) => ({
    id: p.id,
    name: p.name,
    image: p.images[0]?.url ?? null,
    price: p.price,
    trackStock: p.trackStock,
    stock: p.stock,
    optionNames: p.optionNames,
    variants: vrows
      .filter((v) => v.productId === p.id)
      .map((v) => ({ id: v.id, label: v.values.join(" / "), price: v.price ?? p.price, stock: v.stock, available: v.available })),
  }));
}
