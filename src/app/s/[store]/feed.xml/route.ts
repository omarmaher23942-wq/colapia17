// /feed.xml على نطاق المتجر — كتالوج المنتجات المنشورة لمدير التجارة في ميتا وGoogle Merchant Center (يُجلب دورياً).
// عام بطبيعته (نفس ما يراه أي زائر)، ولا يعمل لمتجر خلف البوابة أو متوقف.
import { and, asc, eq, isNull } from "drizzle-orm";
import { getStoreBySubdomain, getBlueprintOrNull, isStorePubliclyVisible } from "@/lib/tenant";
import { getTenantDb } from "@/db/tenant";
import { categories, products } from "@/db/schema";
import { renderProductFeed } from "@/lib/product-feed";
import { storeUrl } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<unknown> }) {
  const { store: sub } = (await ctx.params) as { store: string };
  const store = await getStoreBySubdomain(sub);
  if (!store || !isStorePubliclyVisible(store)) return new Response("Not found", { status: 404 });
  const [bp, db] = await Promise.all([getBlueprintOrNull(store.id), getTenantDb(store.id)]);
  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      slug: products.slug,
      description: products.description,
      shortDescription: products.shortDescription,
      pricePiasters: products.pricePiasters,
      compareAtPiasters: products.compareAtPiasters,
      images: products.images,
      stock: products.stock,
      trackStock: products.trackStock,
      sku: products.sku,
      category: categories.name,
    })
    .from(products)
    .leftJoin(categories, and(eq(categories.id, products.categoryId), eq(categories.storeId, store.id)))
    .where(and(eq(products.storeId, store.id), eq(products.status, "active"), isNull(products.deletedAt)))
    .orderBy(asc(products.createdAt))
    .limit(5000);
  const xml = renderProductFeed({
    storeName: bp?.brand.name ?? store.name,
    storeUrl: storeUrl(store.subdomain),
    description: bp?.brand.description,
    products: rows.map((r) => ({ ...r, description: r.description || r.shortDescription })),
  });
  return new Response(xml, { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=900" } });
}
