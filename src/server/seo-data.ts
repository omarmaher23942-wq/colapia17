import "server-only";
// seo-data.ts — تحميل بيانات المتجر لملفات البحث: خريطة الموقع وllms.txt وإخطار IndexNow.
// المنطق الخالص في lib/seo-*؛ هنا الاستعلامات فقط. كلها لمتجر ظاهر قابل للفهرسة وحده.
import { cache } from "react";
import type { MetadataRoute } from "next";
import { and, desc, eq, isNull } from "drizzle-orm";
import { getTenantDb } from "@/db/tenant";
import { products } from "@/db/schema";
import { getBlueprintOrNull, getStoreBySubdomain, type TenantStore } from "@/lib/tenant";
import { allPolicyPages } from "@/blueprint/policy-pages";
import { truthfulBlueprint } from "@/blueprint/facts";
import { getStoreFacts } from "@/server/repos/facts";
import { listVisibleCategories } from "@/server/repos/catalog";
import { isIndexable } from "@/lib/storefront-seo";
import { publicStoreUrl } from "@/lib/utils";
import { buildStoreSitemap } from "@/lib/seo-sitemap";
import { renderLlmsFull, renderLlmsTxt, type LlmsInput } from "@/lib/seo-llms";
import { storeAnswers } from "@/lib/seo-answers";
import { clipText, priceLabel, seoLocale } from "@/lib/seo-meta";
import { socialLinks } from "@/lib/store-channels";
import { feedAvailable } from "@/lib/product-feed";
import { submitIndexNow, indexNowKeyFor } from "@/lib/seo-indexnow";

/** الأقسام الظاهرة بعدد منتجاتها: استعلام واحد لكل طلب مهما استدعاه التخطيط والصفحات. */
export const loadCategories = cache((storeId: string) => listVisibleCategories(storeId));

/** المنتجات المنشورة، الأبرز أولاً (مميزة ثم الأكثر طلباً ثم الأحدث). */
async function liveProducts(storeId: string, limit: number) {
  const db = await getTenantDb(storeId);
  return db
    .select({
      slug: products.slug,
      name: products.name,
      shortDescription: products.shortDescription,
      description: products.description,
      pricePiasters: products.pricePiasters,
      compareAtPiasters: products.compareAtPiasters,
      images: products.images,
      stock: products.stock,
      trackStock: products.trackStock,
      categoryId: products.categoryId,
      isFeatured: products.isFeatured,
      updatedAt: products.updatedAt,
    })
    .from(products)
    .where(and(eq(products.storeId, storeId), eq(products.status, "active"), isNull(products.deletedAt)))
    .orderBy(desc(products.isFeatured), desc(products.orderCount), desc(products.updatedAt))
    .limit(limit);
}

/** المتجر الظاهر القابل للفهرسة مع مخططه، أو null (فلا ملف بحث لمتجر قيد الإعداد أو الموقوف). */
async function indexableStore(sub: string) {
  const store = await getStoreBySubdomain(sub);
  if (!store) return null;
  const raw = await getBlueprintOrNull(store.id);
  if (!raw || !isIndexable(store, raw)) return null;
  return { store, raw };
}

export async function sitemapForStore(sub: string): Promise<MetadataRoute.Sitemap> {
  const ctx = await indexableStore(sub);
  if (!ctx) return [];
  const { store, raw } = ctx;
  const [rows, cats, facts] = await Promise.all([liveProducts(store.id, 5000), loadCategories(store.id), getStoreFacts(store.id, raw)]);
  return buildStoreSitemap({
    url: (p) => publicStoreUrl(store, p),
    products: rows.map((r) => ({ slug: r.slug, updatedAt: r.updatedAt, images: r.images.map((i) => i.url), featured: r.isFeatured, categoryId: r.categoryId })),
    categories: cats,
    pages: allPolicyPages(raw, facts),
  });
}

/** نص llms.txt (الفهرس) أو llms-full.txt (الكامل)، أو null إن لم يكن المتجر ظاهراً. */
export async function llmsForStore(sub: string, full: boolean): Promise<string | null> {
  const ctx = await indexableStore(sub);
  if (!ctx) return null;
  const { store, raw } = ctx;
  const facts = await getStoreFacts(store.id, raw);
  const bp = truthfulBlueprint(raw, facts);
  const loc = seoLocale(bp);
  const [rows, cats] = await Promise.all([liveProducts(store.id, full ? 300 : 60), loadCategories(store.id)]);
  const catName = new Map(cats.map((c) => [c.id, c.name]));
  const u = (p: string) => publicStoreUrl(store, p);
  const c = bp.channels;
  const contact = [
    c.whatsappNumber ? `واتساب: ${c.whatsappNumber}` : null,
    c.phone && c.phone !== c.whatsappNumber ? `الهاتف: ${c.phone}` : null,
    c.email ? `البريد الإلكتروني: ${c.email}` : null,
    ...socialLinks(c)
      .filter((s) => s.key === "instagram" || s.key === "facebook" || s.key === "tiktok")
      .map((s) => `${s.label}: ${s.href}`),
  ].filter((x): x is string => !!x);

  const input: LlmsInput = {
    site: {
      name: bp.brand.name,
      url: u("/"),
      description: clipText(bp.seo.description || bp.brand.description || bp.brand.tagline, 300),
      language: loc.language,
      country: loc.country,
      currency: loc.currency,
    },
    contact,
    categories: cats.filter((x) => x.productCount > 0).map((x) => ({ name: x.name, url: u(`/c/${encodeURIComponent(x.slug)}`), productCount: x.productCount })),
    products: rows.map((r) => ({
      name: r.name,
      url: u(`/p/${encodeURIComponent(r.slug)}`),
      priceLabel: priceLabel(r.pricePiasters, loc.currency),
      wasLabel: r.compareAtPiasters && r.compareAtPiasters > r.pricePiasters ? priceLabel(r.compareAtPiasters, loc.currency) : undefined,
      description: r.shortDescription || r.description,
      category: r.categoryId ? catName.get(r.categoryId) : undefined,
      available: feedAvailable(r),
    })),
    answers: storeAnswers(bp, facts),
    pages: allPolicyPages(bp, facts).map((p) => ({ title: p.title, url: u(`/pages/${p.slug}`) })),
    links: { sitemap: u("/sitemap.xml"), feed: u("/feed.xml"), full: full ? undefined : u("/llms-full.txt") },
  };
  return full ? renderLlmsFull(input) : renderLlmsTxt(input);
}

/**
 * يخطر محركات البحث بروابط نُشرت أو تغيّرت (IndexNow). بلا إعداد أو لمتجر غير قابل للفهرسة لا يفعل شيئاً، ولا يرمي أبداً.
 * يُستدعى بعد نشر منتج: `after(() => notifyIndexNow(store, ["/p/<slug>"]))`.
 */
export async function notifyIndexNow(store: TenantStore, paths: string[]): Promise<void> {
  try {
    if (!(await indexNowKeyFor(store.id))) return;
    const bp = await getBlueprintOrNull(store.id);
    if (!bp || !isIndexable(store, bp)) return;
    const host = new URL(publicStoreUrl(store)).host;
    await submitIndexNow({ storeId: store.id, host, urls: paths.map((p) => publicStoreUrl(store, p)) });
  } catch {
    // الإخطار تحسين اختياري: فشله لا يؤثر على الحفظ.
  }
}
