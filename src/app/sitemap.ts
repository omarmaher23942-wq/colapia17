import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { sitemapForStore } from "@/server/seo-data";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const h = await headers();
  const sub = h.get("x-store-subdomain");

  if (!sub) {
    const baseUrl = `https://${process.env.NEXT_PUBLIC_ROOT_DOMAIN}`;
    return [
      {
        url: baseUrl,
        lastModified: new Date(),
        changeFrequency: "daily",
        priority: 1,
      },
      {
        url: `${baseUrl}/privacy`,
        lastModified: new Date(),
        changeFrequency: "yearly",
        priority: 0.5,
      },
      {
        url: `${baseUrl}/terms`,
        lastModified: new Date(),
        changeFrequency: "yearly",
        priority: 0.5,
      },
    ];
  }

  // المتجر: الصور وآخر تعديل وأولويات الصفحات (lib/seo-sitemap.ts)، ولمتجر ظاهر قابل للفهرسة فقط.
  return sitemapForStore(sub);
}
