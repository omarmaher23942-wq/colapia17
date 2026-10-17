import "server-only";
import { and, desc, eq, inArray, isNull, sql, gt, ne } from "drizzle-orm";
import { getTenantDb } from "@/db/tenant";
import { categories, products, productVariants, reviews, orderItems, orders, productQuestions, shippingZones } from "@/db/schema";
import { normalizeQuery } from "@/lib/arabic";
import { bayesianScore } from "@/lib/utils";
import type { z } from "zod";
import type { productSourceSchema } from "@/blueprint/schema";
import { withCardData } from "@/blueprint/section-data";

export type Product = typeof products.$inferSelect;
export type Variant = typeof productVariants.$inferSelect;
export type Category = typeof categories.$inferSelect;
type Source = z.infer<typeof productSourceSchema>;

const live = (storeId: string) => and(eq(products.storeId, storeId), eq(products.status, "active"), isNull(products.deletedAt));

export async function listVisibleCategories(storeId: string) {
  const db = await getTenantDb(storeId);
  return db
    .select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      imageUrl: categories.imageUrl,
      parentId: categories.parentId,
      // مرجع صريح للجدول الخارجي (categories.id): Drizzle يكتب ${categories.id} هنا بلا اسم جدوله فيُقرأ كـ p.id ويصير العدد صفراً.
      productCount: sql<number>`(select count(*) from products p where p.category_id = categories.id and p.status = 'active' and p.deleted_at is null)`.mapWith(Number),
    })
    .from(categories)
    .where(and(eq(categories.storeId, storeId), eq(categories.isVisible, true)))
    .orderBy(categories.sortOrder, categories.name);
}

export async function getCategoryBySlug(storeId: string, slug: string) {
  const db = await getTenantDb(storeId);
  const [c] = await db
    .select()
    .from(categories)
    .where(and(eq(categories.storeId, storeId), eq(categories.slug, slug)))
    .limit(1);
  return c ?? null;
}

export async function productsBySource(storeId: string, source: Source, limit: number): Promise<Product[]> {
  const db = await getTenantDb(storeId);
  const base = db.select().from(products);
  switch (source.type) {
    case "featured":
      return base.where(and(live(storeId), eq(products.isFeatured, true))).orderBy(products.sortOrder, desc(products.createdAt)).limit(limit);
    case "newest":
      return base.where(live(storeId)).orderBy(desc(products.createdAt)).limit(limit);
    case "on_sale":
      return base.where(and(live(storeId), sql`${products.compareAtPiasters} > ${products.pricePiasters}`)).orderBy(desc(products.updatedAt)).limit(limit);
    case "tag":
      return base.where(and(live(storeId), sql`${products.tags} ? ${source.tag}`)).limit(limit);
    case "category": {
      const cat = await getCategoryBySlug(storeId, source.slug);
      if (!cat) return [];
      return base.where(and(live(storeId), eq(products.categoryId, cat.id))).orderBy(products.sortOrder).limit(limit);
    }
    case "manual": {
      if (!source.slugs.length) return [];
      const rows = await base.where(and(live(storeId), inArray(products.slug, source.slugs)));
      return source.slugs.map((s) => rows.find((r) => r.slug === s)).filter(Boolean) as Product[];
    }
    case "best_sellers": {
      const rows = await base.where(live(storeId)).limit(200);
      return rows
        .map((p) => ({
          p,
          s: p.orderCount * 3 + p.viewCount * 0.02 + bayesianScore(p.ratingSum, p.ratingCount) * 2 + (Date.now() - p.createdAt.getTime() < 14 * 864e5 ? 1.5 : 0),
        }))
        .sort((a, b) => b.s - a.s)
        .slice(0, limit)
        .map((x) => x.p);
    }
  }
}

export async function getProductBySlug(storeId: string, slug: string) {
  const db = await getTenantDb(storeId);
  const [p] = await db
    .select()
    .from(products)
    .where(and(live(storeId), eq(products.slug, slug)))
    .limit(1);
  if (!p) return null;
  const variants = p.optionNames.length
    ? await db
        .select()
        .from(productVariants)
        .where(eq(productVariants.productId, p.id))
        .orderBy(productVariants.sortOrder, productVariants.createdAt)
    : [];
  return { ...p, variants };
}

export async function listProductsByCategory(storeId: string, categoryId: string, sort: string, page: number, perPage = 24) {
  const db = await getTenantDb(storeId);
  const order =
    sort === "price_asc"
      ? products.pricePiasters
      : sort === "price_desc"
      ? desc(products.pricePiasters)
      : sort === "newest"
      ? desc(products.createdAt)
      : desc(products.orderCount);
  return db
    .select()
    .from(products)
    .where(and(live(storeId), eq(products.categoryId, categoryId)))
    .orderBy(order, products.sortOrder)
    .limit(perPage)
    .offset((page - 1) * perPage);
}

export async function searchProducts(storeId: string, q: string, limit = 24) {
  const db = await getTenantDb(storeId);
  const nq = normalizeQuery(q);
  const rows = !nq
    ? await db.select().from(products).where(live(storeId)).orderBy(desc(products.orderCount)).limit(limit)
    : await db
        .select()
        .from(products)
        .where(and(live(storeId), sql`(${products.searchText} % ${nq} OR ${products.searchText} ILIKE ${"%" + nq + "%"})`))
        .orderBy(sql`similarity(${products.searchText}, ${nq}) desc`, desc(products.orderCount))
        .limit(limit);
  return withCardData(storeId, rows);
}

/** عدّ التقييمات المعتمدة وتوزيع النجوم بـ GROUP BY (لا من الصفحة المحمّلة فقط). */
export async function reviewStats(storeId: string, productId: string): Promise<{ count: number; avg: number; dist: Record<number, number> }> {
  const db = await getTenantDb(storeId);
  const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  try {
    const rows = await db
      .select({ rating: reviews.rating, c: sql<number>`count(*)::int` })
      .from(reviews)
      .where(and(eq(reviews.storeId, storeId), eq(reviews.productId, productId), eq(reviews.isApproved, true)))
      .groupBy(reviews.rating);
    let count = 0;
    let sum = 0;
    for (const r of rows) {
      dist[r.rating] = r.c;
      count += r.c;
      sum += r.rating * r.c;
    }
    return { count, avg: count ? sum / count : 0, dist };
  } catch {
    return { count: 0, avg: 0, dist };
  }
}

/** أسئلة المنتج التي أجاب عنها التاجر (تظهر للزوار فقط بعد الإجابة). */
export async function answeredQuestions(storeId: string, productId: string, limit = 20) {
  const db = await getTenantDb(storeId);
  try {
    return await db
      .select({ id: productQuestions.id, question: productQuestions.question, answer: productQuestions.answer, askerName: productQuestions.askerName, answeredAt: productQuestions.answeredAt })
      .from(productQuestions)
      .where(and(eq(productQuestions.storeId, storeId), eq(productQuestions.productId, productId), eq(productQuestions.status, "answered")))
      .orderBy(desc(productQuestions.answeredAt))
      .limit(limit);
  } catch {
    return [];
  }
}

/** مدد التوصيل لكل محافظة مفعّلة، لحساب موعد وصول حقيقي في صفحة المنتج. */
export async function deliveryZones(storeId: string) {
  const db = await getTenantDb(storeId);
  try {
    return await db
      .select({ governorate: shippingZones.governorate, min: shippingZones.etaMinDays, max: shippingZones.etaMaxDays })
      .from(shippingZones)
      .where(and(eq(shippingZones.storeId, storeId), eq(shippingZones.isActive, true)));
  } catch {
    return [];
  }
}

export async function productReviews(storeId: string, productId: string, opts: { limit?: number; offset?: number } = {}) {
  const db = await getTenantDb(storeId);
  try {
    return await db
      .select({
        id: reviews.id,
        customerName: reviews.customerName,
        rating: reviews.rating,
        body: reviews.body,
        imageUrls: reviews.imageUrls,
        isApproved: reviews.isApproved,
        // «موثّق» فقط لتقييم جاء من طلب حقيقي (التقييمات القديمة كانت موثّقة افتراضياً بلا طلب).
        isVerified: sql<boolean>`(${reviews.isVerified} and ${reviews.orderId} is not null)`,
        createdAt: reviews.createdAt,
      })
      .from(reviews)
      .where(and(eq(reviews.storeId, storeId), eq(reviews.productId, productId), eq(reviews.isApproved, true)))
      .orderBy(desc(reviews.createdAt))
      .limit(opts.limit ?? 8)
      .offset(opts.offset ?? 0);
  } catch {
    return [];
  }
}

/**
 * «يُشترى معه عادةً»: منتجات اشتراها فعلاً عملاء هذا المنتج في نفس الطلب (آخر 180 يوماً، بلا الطلبات التجريبية
 * والملغاة). `together=false` يعني أنه لا شراء مشترك كافٍ بعد، والمعروض منتجات من نفس القسم (ويتغير العنوان لذلك).
 */
export async function frequentlyBoughtTogether(storeId: string, product: Product, limit = 4): Promise<{ rows: Product[]; together: boolean }> {
  const db = await getTenantDb(storeId);
  try {
    const since = new Date(Date.now() - 180 * 86400_000);
    const co = await db
      .select({ productId: orderItems.productId, n: sql<number>`count(distinct ${orderItems.orderId})`.mapWith(Number) })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .where(
        and(
          eq(orderItems.storeId, storeId),
          eq(orders.storeId, storeId),
          eq(orders.isTest, false),
          sql`${orders.status} not in ('cancelled','returned')`,
          gt(orders.createdAt, since),
          ne(orderItems.productId, product.id),
          sql`${orderItems.orderId} in (select oi.order_id from order_items oi where oi.store_id = ${storeId} and oi.product_id = ${product.id})`
        )
      )
      .groupBy(orderItems.productId)
      .orderBy(desc(sql`count(distinct ${orderItems.orderId})`))
      .limit(limit * 2);
    const ids = co.filter((c) => c.productId && c.n >= 2).map((c) => c.productId!);
    const bought = ids.length ? await db.select().from(products).where(and(live(storeId), inArray(products.id, ids))) : [];
    const together = bought.sort((x, y) => ids.indexOf(x.id) - ids.indexOf(y.id)).filter((r) => r.name.toLowerCase() !== product.name.toLowerCase());
    if (together.length >= 2) return { rows: together.slice(0, limit), together: true };

    if (!product.categoryId) return { rows: [], together: false };
    const same = await db
      .select()
      .from(products)
      .where(and(live(storeId), eq(products.categoryId, product.categoryId), ne(products.id, product.id)))
      .orderBy(desc(products.orderCount))
      .limit(limit);
    const rows = same.filter((r) => r.name.toLowerCase() !== product.name.toLowerCase());
    return { rows: rows.length >= 2 ? rows : [], together: false };
  } catch {
    return { rows: [], together: false };
  }
}

export async function recentOrderProof(storeId: string, lookbackHours: number, minOrders: number) {
  const db = await getTenantDb(storeId);
  const since = new Date(Date.now() - lookbackHours * 36e5);
  const rows = await db
    .select({
      gov: orders.governorate,
      at: orders.createdAt,
      name: orderItems.name,
      img: orderItems.imageUrl,
      slug: products.slug,
    })
    .from(orders)
    .innerJoin(orderItems, eq(orderItems.orderId, orders.id))
    .leftJoin(products, eq(products.id, orderItems.productId))
    .where(and(eq(orders.storeId, storeId), gt(orders.createdAt, since), ne(orders.status, "cancelled"), eq(orders.isTest, false)))
    .orderBy(desc(orders.createdAt))
    .limit(20);
  return rows.length >= minOrders ? rows : [];
}