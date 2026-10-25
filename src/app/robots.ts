import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { publicStoreUrl } from "@/lib/utils";
import { storeVisibility } from "@/lib/store-visibility";
import { hostingState } from "@/lib/hosting";
import { getStoreBySubdomain } from "@/lib/tenant";
import { platformRobots } from "@/lib/platform-seo";
import { storeRobots } from "@/lib/seo-robots";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const h = await headers();
  const sub = h.get("x-store-subdomain");

  // نطاق المنصة: قواعد وخريطة من lib/platform-seo.ts (تسمح لزواحف الذكاء الاصطناعي صراحةً).
  if (!sub) return platformRobots();

  const store = await getStoreBySubdomain(sub);
  const indexable = !!store && storeVisibility(store, hostingState(store)).indexable;
  return storeRobots({ indexable, sitemapUrl: indexable && store ? publicStoreUrl(store, "/sitemap.xml") : undefined });
}
