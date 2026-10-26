// GET /api/storefront/suggest?q= — اقتراحات بحث فورية (حتى 6 منتجات و3 أقسام مطابقة) في متجر النطاق الحالي. نفس بحث المتجر المتسامح
// مع العربية، بحد معدل لكل شبكة، ولا يُرجع إلا ما يلزم العرض (الاسم والصورة والسعر).
import { NextResponse } from "next/server";
import { getStoreBySubdomain, isStorePubliclyVisible } from "@/lib/tenant";
import { allow, clientIp } from "@/lib/ratelimit";
import { searchProducts, listVisibleCategories } from "@/server/repos/catalog";
import { foldTerm } from "@/lib/search-ui";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const headers = { "Cache-Control": "no-store" };
  const sub = req.headers.get("x-store-subdomain");
  const store = sub ? await getStoreBySubdomain(sub) : null;
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 60);
  if (!store || !isStorePubliclyVisible(store) || q.length < 2) return NextResponse.json({ items: [] }, { headers });
  if (!(await allow("search", clientIp(req.headers)))) return NextResponse.json({ items: [] }, { status: 429, headers });
  const [rows, cats] = await Promise.all([searchProducts(store.id, q, 6), listVisibleCategories(store.id).catch(() => [])]);
  // أقسام يطابق اسمها الكلمة (بعد توحيد الهمزات والتاء المربوطة)، وفيها منتجات فعلاً.
  const fq = foldTerm(q);
  const categories = cats
    .filter((c) => c.productCount > 0 && foldTerm(c.name).includes(fq))
    .slice(0, 3)
    .map((c) => ({ slug: c.slug, name: c.name, count: c.productCount }));
  const items = rows.map((p) => ({
    slug: p.slug,
    name: p.name,
    price: p.pricePiasters,
    compareAt: p.compareAtPiasters,
    image: (p.images as { url: string }[] | null)?.[0]?.url ?? null,
  }));
  return NextResponse.json({ items, categories }, { headers });
}
