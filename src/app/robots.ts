import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { publicStoreUrl } from "@/lib/utils";
import { storeVisibility } from "@/lib/store-visibility";
import { hostingState } from "@/lib/hosting";
import { getStoreBySubdomain } from "@/lib/tenant";
import { storeRobots } from "@/lib/seo-robots";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const h = await headers();
  const sub = h.get("x-store-subdomain");

  if (!sub) {
    return {
      rules: {
        userAgent: "*",
        allow: "/",
        // /start غير محجوب هنا عمداً: كاشف روابط ميتا يحترم robots.txt، فحجبه يمنع بطاقة المعاينة في رسائل إنستجرام. الصفحة نفسها noindex.
        disallow: ["/admin/", "/dashboard/", "/api/", "/follow/"],
      },
      sitemap: `https://${process.env.NEXT_PUBLIC_ROOT_DOMAIN}/sitemap.xml`,
    };
  }

  const store = await getStoreBySubdomain(sub);
  const indexable = !!store && storeVisibility(store, hostingState(store)).indexable;
  return storeRobots({ indexable, sitemapUrl: indexable && store ? publicStoreUrl(store, "/sitemap.xml") : undefined });
}
