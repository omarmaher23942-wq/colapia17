// section-data.ts — بيانات أقسام المتجر من القاعدة، مقيّدة دائماً بمتجر واحد (storeId يأتي من الخادم).
// يستخدمها موزّع الأقسام (registry.tsx) وواجهة كود المتاجر الخاصة (stores-kit/server.ts) نفسها، فلا يحصل
// مكوّن متجر خاص على منتجات بطريقة تختلف عما تعرضه أقسام النواة.
import { and, asc, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { getTenantDb } from "@/db/tenant";
import { products, categories as categoriesTable } from "@/db/schema/catalog";
import { reviews } from "@/db/schema";

// ─── Product fetching by source ────────────────────────────────────────────
export type ProductSource =
  | { type: "featured" }
  | { type: "newest" }
  | { type: "best_sellers" }
  | { type: "on_sale" }
  | { type: "category"; slug: string }
  | { type: "manual"; slugs: string[] }
  | { type: "tag"; tag: string };

export async function fetchProductsForSource(
  storeId: string,
  source: ProductSource | undefined,
  limit: number
): Promise<any[]> {
  const db = await getTenantDb(storeId);
  const base = and(
    eq(products.storeId, storeId),
    eq(products.status, "active"),
    isNull(products.deletedAt)
  );

  let q = db.select().from(products).$dynamic();

  switch (source?.type) {
    case "featured":
      q = q.where(and(base, eq(products.isFeatured, true))).orderBy(asc(products.sortOrder));
      break;
    case "best_sellers":
      q = q.where(base).orderBy(desc(products.orderCount));
      break;
    case "newest":
      q = q.where(base).orderBy(desc(products.createdAt));
      break;
    case "on_sale":
      q = q
        .where(and(base, sql`${products.compareAtPiasters} > ${products.pricePiasters}`))
        .orderBy(asc(products.sortOrder));
      break;
    case "category": {
      const [cat] = await db
        .select({ id: categoriesTable.id })
        .from(categoriesTable)
        .where(
          and(
            eq(categoriesTable.storeId, storeId),
            eq(categoriesTable.slug, source.slug)
          )
        )
        .limit(1);
      if (!cat) return [];
      q = q.where(and(base, eq(products.categoryId, cat.id)));
      break;
    }
    case "manual": {
      const slugs = Array.isArray(source.slugs) ? source.slugs : [];
      if (slugs.length === 0) return [];
      q = q.where(and(base, inArray(products.slug, slugs)));
      break;
    }
    case "tag": {
      q = q.where(and(base, sql`${products.tags} @> ${JSON.stringify([source.tag])}::jsonb`));
      break;
    }
    default:
      q = q.where(base).orderBy(asc(products.sortOrder));
  }

  return q.limit(Math.max(1, Math.min(limit, 24)));
}

// ─── Categories fetching ───────────────────────────────────────────────────
export async function fetchCategoriesForSection(
  storeId: string,
  slugs: string[] | undefined
): Promise<
  Array<{
    id: string;
    name: string;
    slug: string;
    productCount: number;
    firstProductImage: string | null;
  }>
> {
  const db = await getTenantDb(storeId);
  const base = and(
    eq(categoriesTable.storeId, storeId),
    eq(categoriesTable.isVisible, true)
  );

  // استعلام واحد: العدد وصورة الغلاف لكل قسم بـ subquery بدل استعلامين لكل قسم. الغلاف صورة القسم إن رفعها التاجر،
  // وإلا صورة أول منتج منشور فيه.
  const live = sql`p.store_id = ${storeId} and p.category_id = categories.id and p.status = 'active' and p.deleted_at is null`;
  const rows = await db
    .select({
      id: categoriesTable.id,
      name: categoriesTable.name,
      slug: categoriesTable.slug,
      imageUrl: categoriesTable.imageUrl,
      productCount: sql<number>`(select count(*) from products p where ${live})`.mapWith(Number),
      firstImage: sql<string | null>`(select p.images->0->>'url' from products p where ${live} and jsonb_array_length(p.images) > 0 order by p.sort_order asc limit 1)`,
    })
    .from(categoriesTable)
    .where(
      Array.isArray(slugs) && slugs.length > 0
        ? and(base, inArray(categoriesTable.slug, slugs))
        : base
    )
    .orderBy(asc(categoriesTable.sortOrder))
    .limit(12);

  return rows.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    productCount: c.productCount,
    firstProductImage: c.imageUrl || c.firstImage || null,
  }));
}

// ─── Reviews ───────────────────────────────────────────────────────────────
/** تقييمات المشترين المعتمدة بنص (نفس ما يعرضه قسم الآراء). «موثق» فقط لتقييم جاء من طلب فعلي. */
export async function fetchApprovedReviews(storeId: string, limit: number) {
  const db = await getTenantDb(storeId);
  const rows = await db
    .select({ name: reviews.customerName, text: reviews.body, rating: reviews.rating, orderId: reviews.orderId, isVerified: reviews.isVerified })
    .from(reviews)
    .where(and(eq(reviews.storeId, storeId), eq(reviews.isApproved, true), isNotNull(reviews.body)))
    .orderBy(desc(reviews.rating), desc(reviews.createdAt))
    .limit(Math.max(1, Math.min(limit, 24)));
  return rows
    .filter((r) => r.text?.trim())
    .map((r) => ({ name: r.name, text: r.text!.trim(), rating: r.rating, verified: r.isVerified && Boolean(r.orderId) }));
}
