// GET /api/storefront/suggest?q= — اقتراحات بحث فورية (حتى 6 منتجات) في متجر النطاق الحالي. نفس بحث المتجر المتسامح
// مع العربية، بحد معدل لكل شبكة، ولا يُرجع إلا ما يلزم العرض (الاسم والصورة والسعر).
import { NextResponse } from "next/server";
import { getStoreBySubdomain, isStorePubliclyVisible } from "@/lib/tenant";
import { allow, clientIp } from "@/lib/ratelimit";
import { searchProducts } from "@/server/repos/catalog";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const headers = { "Cache-Control": "no-store" };
  const sub = req.headers.get("x-store-subdomain");
  const store = sub ? await getStoreBySubdomain(sub) : null;
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 60);
  if (!store || !isStorePubliclyVisible(store) || q.length < 2) return NextResponse.json({ items: [] }, { headers });
  if (!(await allow("search", clientIp(req.headers)))) return NextResponse.json({ items: [] }, { status: 429, headers });
  const rows = await searchProducts(store.id, q, 6);
  const items = rows.map((p) => ({
    slug: p.slug,
    name: p.name,
    price: p.pricePiasters,
    compareAt: p.compareAtPiasters,
    image: (p.images as { url: string }[] | null)?.[0]?.url ?? null,
  }));
  return NextResponse.json({ items }, { headers });
}
