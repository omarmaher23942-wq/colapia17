import "server-only";
// store-counts.ts — أعداد بيانات المتجر لحدود الباقة (server/usage.ts)، عبر getTenantDb وحده (حارس العزل).
import { and, count, eq, isNull } from "drizzle-orm";
import { getTenantDb } from "@/db/tenant";
import { products } from "@/db/schema";

/** عدد منتجات المتجر غير المحذوفة (منشورة أو مخفية). */
export async function productsCount(storeId: string): Promise<number> {
  const tdb = await getTenantDb(storeId);
  const [r] = await tdb
    .select({ n: count() })
    .from(products)
    .where(and(eq(products.storeId, storeId), isNull(products.deletedAt)))
    .catch(() => []);
  return Number(r?.n ?? 0);
}
