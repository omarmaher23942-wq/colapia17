import "server-only";
// catalog-stats.ts — إحصاءات الكتالوج الفعلية التي يبني عليها المخرج الفني شكل الصفحة الرئيسية.
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { getTenantDb } from "@/db/tenant";
import { categories, products } from "@/db/schema";
import type { CatalogStats } from "./art-director";

export async function catalogStats(storeId: string): Promise<CatalogStats> {
  const tdb = await getTenantDb(storeId);
  const [liveProducts, catCounts] = await Promise.all([
    tdb
      .select({
        slug: products.slug,
        name: products.name,
        images: products.images,
        isFeatured: products.isFeatured,
        price: products.pricePiasters,
        compareAt: products.compareAtPiasters,
        categoryId: products.categoryId,
      })
      .from(products)
      .where(and(eq(products.storeId, storeId), isNull(products.deletedAt), eq(products.status, "active")))
      .orderBy(asc(products.sortOrder))
      .limit(200),
    tdb
      .select({
        id: categories.id,
        slug: categories.slug,
        name: categories.name,
        count: sql<number>`(select count(*)::int from ${products} p where p.category_id = ${categories.id} and p.deleted_at is null and p.status = 'active')`,
      })
      .from(categories)
      .where(and(eq(categories.storeId, storeId), eq(categories.isVisible, true))),
  ]);
  const catById = new Map(catCounts.map((c) => [c.id, c]));
  return {
    products: liveProducts.map((p) => ({
      slug: p.slug,
      name: p.name,
      image: Array.isArray(p.images) ? (p.images as { url?: string }[])[0]?.url : undefined,
      bestSeller: p.isFeatured,
      onSale: Boolean(p.compareAt && p.compareAt > p.price),
      category: p.categoryId ? catById.get(p.categoryId)?.slug : undefined,
    })),
    categories: catCounts.map((c) => ({ slug: c.slug, name: c.name, count: Number(c.count) || 0 })),
  };
}
