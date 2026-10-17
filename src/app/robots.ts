import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { publicStoreUrl } from "@/lib/utils";
import { storeVisibility } from "@/lib/store-visibility";
import { hostingState } from "@/lib/hosting";
import { getStoreBySubdomain } from "@/lib/tenant";

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
  const allow = store && storeVisibility(store, hostingState(store)).indexable;

  return {
    rules: allow
      ? {
          userAgent: "*",
          allow: "/",
          disallow: [
            "/admin/",
            "/account/",
            "/cart",
            "/checkout",
            "/track",
            "/confirm",
            "/review",
            "/go/",
            "/api/",
          ],
        }
      : {
          userAgent: "*",
          disallow: "/",
        },
    sitemap: allow && store ? publicStoreUrl(store, "/sitemap.xml") : undefined,
  };
}