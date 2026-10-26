// seo-sitemap.ts — خريطة موقع المتجر (منطق خالص مختبَر): الصور وآخر تعديل وأولويات تعكس أهمية الصفحة.
// آخر تعديل من بيانات فعلية (تحديث المنتجات) لا «الآن» دائماً، فلا يتعلم الزاحف تجاهله. حد الخريطة الواحدة 50 ألف رابط.
import type { MetadataRoute } from "next";
import { absUrl } from "./seo-schema";

export type SitemapProduct = { slug: string; updatedAt: Date | string | null; images: string[]; featured?: boolean; categoryId?: string | null };
export type SitemapCategory = { id: string; slug: string; imageUrl?: string | null; productCount: number };

export const SITEMAP_LIMIT = 50_000;

/** الصفحات النصية: الأسئلة أعلاها لأنها الأكثر اقتباساً، والقانونية أدناها. */
const PAGE_PRIORITY: Record<string, number> = { faq: 0.7, about: 0.5, shipping: 0.5, returns: 0.5, contact: 0.4, privacy: 0.2, terms: 0.2 };

const asDate = (d: Date | string | null | undefined) => {
  if (!d) return undefined;
  const x = new Date(d);
  return Number.isNaN(x.getTime()) ? undefined : x;
};
const latest = (dates: (Date | undefined)[]) => dates.reduce<Date | undefined>((m, d) => (d && (!m || d > m) ? d : m), undefined);

export function buildStoreSitemap(input: {
  /** مسار ← رابط عام مطلق */
  url: (path: string) => string;
  products: SitemapProduct[];
  categories: SitemapCategory[];
  pages: { slug: string }[];
}): MetadataRoute.Sitemap {
  const home = input.url("/");
  const imgs = (list: (string | null | undefined)[], max = 5) => list.map((u) => absUrl(home, u)).filter((u): u is string => !!u).slice(0, max);
  const modifiedOf = input.products.map((p) => asDate(p.updatedAt));

  const out: MetadataRoute.Sitemap = [{ url: home, lastModified: latest(modifiedOf), changeFrequency: "daily", priority: 1 }];

  if (input.products.length) out.push({ url: input.url("/all"), lastModified: latest(modifiedOf), changeFrequency: "daily", priority: 0.6 });

  for (const c of input.categories) {
    if (c.productCount <= 0) continue;
    const images = imgs([c.imageUrl], 1);
    out.push({
      url: input.url(`/c/${encodeURIComponent(c.slug)}`),
      lastModified: latest(input.products.filter((p) => p.categoryId === c.id).map((p) => asDate(p.updatedAt))),
      changeFrequency: "weekly",
      priority: 0.8,
      images: images.length ? images : undefined,
    });
  }

  for (const p of input.products) {
    const images = imgs(p.images);
    out.push({
      url: input.url(`/p/${encodeURIComponent(p.slug)}`),
      lastModified: asDate(p.updatedAt),
      changeFrequency: "weekly",
      priority: p.featured ? 0.9 : 0.7,
      images: images.length ? images : undefined,
    });
  }

  for (const pg of input.pages) {
    out.push({ url: input.url(`/pages/${encodeURIComponent(pg.slug)}`), changeFrequency: "monthly", priority: PAGE_PRIORITY[pg.slug] ?? 0.3 });
  }
  return out.slice(0, SITEMAP_LIMIT);
}
