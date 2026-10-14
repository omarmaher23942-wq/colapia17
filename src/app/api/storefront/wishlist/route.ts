// /api/storefront/wishlist — منتجات المفضلة المنشورة في متجر النطاق الحالي بأحدث أسعارها وتوفرها.
// المدخل slugs فقط (محدود العدد والطول)، والمتجر يُحدَّد من رأس النطاق لا من الطلب.
import { NextResponse } from "next/server";
import { getStoreBySubdomain, isStorePubliclyVisible } from "@/lib/tenant";
import { fetchProductsForSource } from "@/blueprint/section-data";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const sub = req.headers.get("x-store-subdomain");
  const store = sub ? await getStoreBySubdomain(sub) : null;
  const headers = { "Cache-Control": "no-store" };
  if (!store || !isStorePubliclyVisible(store)) return NextResponse.json({ products: [] }, { headers });
  const slugs = (new URL(req.url).searchParams.get("slugs") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.length <= 120)
    .slice(0, 40);
  if (!slugs.length) return NextResponse.json({ products: [] }, { headers });
  const rows = await fetchProductsForSource(store.id, { type: "manual", slugs }, 24);
  const order = new Map(slugs.map((s, i) => [s, i]));
  rows.sort((a, b) => (order.get(a.slug) ?? 0) - (order.get(b.slug) ?? 0));
  return NextResponse.json({ products: rows }, { headers });
}
