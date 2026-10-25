import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { publicStoreUrl } from "@/lib/utils";
import { storeVisibility } from "@/lib/store-visibility";
import { hostingState } from "@/lib/hosting";
import { getStoreBySubdomain } from "@/lib/tenant";
import { platformRobots } from "@/lib/platform-seo";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const h = await headers();
  const sub = h.get("x-store-subdomain");

  // نطاق المنصة: قواعد وخريطة من lib/platform-seo.ts (تسمح لزواحف الذكاء الاصطناعي صراحةً).
  if (!sub) return platformRobots();

  const store = await getStoreBySubdomain(sub);
  const allow = store && storeVisibility(store, hostingState(store)).indexable;

  return {
    rules: allow
      ? {
          userAgent: "*",
          allow: "/",
          disallow: [
            "/admin/",
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