import "server-only";
// collection.ts — استعلام صفحات المنتجات (الأقسام و/all) بالفلاتر: يعيد الصفحة المطلوبة والعدد الكلي وأوجه الفلترة،
// كلها مقيّدة بمتجر واحد ومن البيانات الفعلية (مقاسات وألوان التركيبات المتاحة، وحدود الأسعار).
import { and, asc, desc, eq, inArray, isNull, sql, type SQL } from "drizzle-orm";
import { getTenantDb } from "@/db/tenant";
import { categories, products } from "@/db/schema";
import { buildFacets, PAGE_SIZE, type CollectionFilters, type Facets } from "@/lib/collection-filters";
import { withCardData } from "@/blueprint/section-data";

export type CollectionScope = { type: "all" } | { type: "category"; id: string };

/** القسم وأبناؤه المباشرون (المنتجات تُعرض في القسم الأب مع منتجات فروعه). */
async function scopeCategoryIds(storeId: string, scope: CollectionScope): Promise<string[] | null> {
  if (scope.type === "all") return null;
  const db = await getTenantDb(storeId);
  const kids = await db.select({ id: categories.id }).from(categories).where(and(eq(categories.storeId, storeId), eq(categories.parentId, scope.id), eq(categories.isVisible, true)));
  return [scope.id, ...kids.map((k) => k.id)];
}

function baseWhere(storeId: string, catIds: string[] | null, f: CollectionFilters, subId: string | null): SQL[] {
  const w: SQL[] = [eq(products.storeId, storeId), eq(products.status, "active"), isNull(products.deletedAt)];
  if (subId) w.push(eq(products.categoryId, subId));
  else if (catIds) w.push(inArray(products.categoryId, catIds));
  if (f.min !== null) w.push(sql`${products.pricePiasters} >= ${f.min}`);
  if (f.max !== null) w.push(sql`${products.pricePiasters} <= ${f.max}`);
  if (f.sale) w.push(sql`${products.compareAtPiasters} > ${products.pricePiasters}`);
  // null = متاح دائماً، ومخزون المنتج ذي التركيبات مجموع تركيباته.
  if (f.inStock) w.push(sql`(${products.trackStock} = false or ${products.stock} is null or ${products.stock} > 0)`);
  for (const group of [f.sizes, f.colors]) {
    if (!group.length) continue;
    const any = group.map((v) => sql`pv.option_values @> ${JSON.stringify([v])}::jsonb`);
    w.push(sql`exists (select 1 from product_variants pv where pv.product_id = ${products.id} and pv.is_available and (${sql.join(any, sql` or `)}))`);
  }
  return w;
}

export async function queryCollection(storeId: string, scope: CollectionScope, f: CollectionFilters, opts: { offset?: number; limit?: number } = {}) {
  const db = await getTenantDb(storeId);
  const catIds = await scopeCategoryIds(storeId, scope);
  let subId: string | null = null;
  if (f.sub) {
    const [sub] = await db.select({ id: categories.id }).from(categories).where(and(eq(categories.storeId, storeId), eq(categories.slug, f.sub))).limit(1);
    // قسم فرعي لا ينتمي لنطاق الصفحة يُتجاهل بدل إظهار نتائج خارجها.
    if (sub && (!catIds || catIds.includes(sub.id))) subId = sub.id;
  }
  const where = and(...baseWhere(storeId, catIds, f, subId));
  const order =
    f.sort === "price_asc" ? [asc(products.pricePiasters)] : f.sort === "price_desc" ? [desc(products.pricePiasters)] : f.sort === "newest" ? [desc(products.createdAt)] : f.sort === "rating" ? [sql`(${products.ratingSum}::float / nullif(${products.ratingCount}, 0)) desc nulls last`, desc(products.ratingCount)] : f.sort === "discount" ? [sql`(case when ${products.compareAtPiasters} > ${products.pricePiasters} then (${products.compareAtPiasters} - ${products.pricePiasters})::float / ${products.compareAtPiasters} else 0 end) desc`] : [desc(products.orderCount), asc(products.sortOrder)];
  const [rows, [count]] = await Promise.all([
    db.select().from(products).where(where).orderBy(...order, asc(products.id)).limit(opts.limit ?? PAGE_SIZE).offset(opts.offset ?? 0),
    db.select({ n: sql<number>`count(*)::int` }).from(products).where(where),
  ]);
  return { rows: await withCardData(storeId, rows), total: count?.n ?? 0 };
}

/** أوجه الفلترة للنطاق كله (بلا فلاتر التاجر الحالية، فيرى الزائر كل الخيارات الممكنة). */
export async function collectionFacets(storeId: string, scope: CollectionScope): Promise<Facets> {
  const db = await getTenantDb(storeId);
  const catIds = await scopeCategoryIds(storeId, scope);
  const scoped = catIds ? sql` and p.category_id in (${sql.join(catIds.map((i) => sql`${i}::uuid`), sql`, `)})` : sql``;
  const live = sql`p.store_id = ${storeId} and p.status = 'active' and p.deleted_at is null`;
  const [opts, price] = await Promise.all([
    db.execute(sql`
      select p.option_names ->> (o.ord::int - 1) as opt, o.val as val, count(distinct p.id)::int as n
      from products p
      join product_variants v on v.product_id = p.id and v.is_available
      cross join lateral jsonb_array_elements_text(v.option_values) with ordinality as o(val, ord)
      where ${live}${scoped}
      group by 1, 2`),
    db.execute(sql`select min(p.price_piasters)::int as lo, max(p.price_piasters)::int as hi from products p where ${live}${scoped}`),
  ]);
  const rowsOf = <T,>(res: unknown): T[] => (Array.isArray(res) ? res : ((res as { rows?: T[] }).rows ?? [])) as T[];
  const optRows = rowsOf<{ opt: string | null; val: string; n: number }>(opts);
  const priceRow = rowsOf<{ lo: number | null; hi: number | null }>(price)[0] ?? { lo: null, hi: null };
  return buildFacets(optRows, { min: priceRow.lo, max: priceRow.hi });
}

/** أقسام فرعية مرئية لقسم (مع عدد منتجات كل منها) لشرائح التصفية. */
export async function subcategories(storeId: string, parentId: string) {
  const db = await getTenantDb(storeId);
  return db
    .select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      productCount: sql<number>`(select count(*) from products p where p.category_id = categories.id and p.status = 'active' and p.deleted_at is null)`.mapWith(Number),
    })
    .from(categories)
    .where(and(eq(categories.storeId, storeId), eq(categories.parentId, parentId), eq(categories.isVisible, true)))
    .orderBy(asc(categories.sortOrder), asc(categories.name));
}
