import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { sitemapForStore } from "@/server/seo-data";
import { platformSitemap } from "@/lib/platform-seo";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const h = await headers();
  const sub = h.get("x-store-subdomain");

  // نطاق المنصة: الرئيسية و/about و/work والقانونية (lib/platform-seo.ts).
  if (!sub) return platformSitemap();

  // المتجر: الصور وآخر تعديل وأولويات الصفحات (lib/seo-sitemap.ts)، ولمتجر ظاهر قابل للفهرسة فقط.
  return sitemapForStore(sub);
}
