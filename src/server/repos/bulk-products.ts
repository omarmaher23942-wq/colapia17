// bulk-products.ts — صفوف جدول «التعديل الجماعي»: المنتجات غير المحذوفة بأسعارها ومخزونها وتركيباتها. بيانات المتجر نفسه فقط.
import "server-only";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { getTenantDb } from "@/db/tenant";
import { products, productVariants } from "@/db/schema";
import type { BulkRow } from "@/lib/bulk-edit";

export type BulkProductRow = BulkRow & { trackStock: boolean; image: string | null };

const egp = (p: number | null) => (p === null ? "" : String(p / 100));

export async function bulkRows(storeId: string): Promise<BulkProductRow[]> {
  const db = await getTenantDb(storeId);
  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      price: products.pricePiasters,
      compareAt: products.compareAtPiasters,
      stock: products.stock,
      trackStock: products.trackStock,
      status: products.status,
      images: products.images,
    })
    .from(products)
    .where(and(eq(products.storeId, storeId), isNull(products.deletedAt)))
    .orderBy(desc(products.updatedAt))
    .limit(300);
  const variants = rows.length
    ? await db
        .select({ id: productVariants.id, productId: productVariants.productId, values: productVariants.optionValues, stock: productVariants.stock, price: productVariants.pricePiasters })
        .from(productVariants)
        .where(and(eq(productVariants.storeId, storeId), inArray(productVariants.productId, rows.map((r) => r.id))))
        .orderBy(asc(productVariants.sortOrder))
    : [];
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    price: egp(r.price),
    compareAt: egp(r.compareAt),
    stock: r.stock === null ? "" : String(r.stock),
    status: r.status,
    trackStock: r.trackStock,
    image: r.images[0]?.url ?? null,
    variants: variants
      .filter((v) => v.productId === r.id)
      .map((v) => ({ id: v.id, label: v.values.join(" / "), stock: v.stock === null ? "" : String(v.stock), price: egp(v.price) })),
  }));
}
