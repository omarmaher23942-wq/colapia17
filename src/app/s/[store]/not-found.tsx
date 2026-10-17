import Link from "next/link";
import { headers } from "next/headers";
import { Search } from "lucide-react";
import { getStoreBySubdomain } from "@/lib/tenant";
import { fetchProductsForSource } from "@/blueprint/section-data";
import { ProductCard, type ProductCardProduct } from "@/components/storefront/ProductCard";

/**
 * 404 بهوية المتجر: يُعرض داخل تخطيط المتجر (رأسه وتذييله وألوانه)، فلا يرى الزائر صفحة المنصة أبداً.
 * يقترح الأكثر طلباً (أو الأحدث) كي لا تكون نهاية الطريق.
 */
export default async function StoreNotFound() {
  const sub = (await headers()).get("x-store-subdomain");
  const store = sub ? await getStoreBySubdomain(sub).catch(() => null) : null;
  let items: Awaited<ReturnType<typeof fetchProductsForSource>> = [];
  let label = "الأكثر طلباً";
  if (store) {
    items = (await fetchProductsForSource(store.id, { type: "best_sellers" }, 4).catch(() => [])).filter((p) => (p.orderCount ?? 0) > 0);
    if (!items.length) {
      items = await fetchProductsForSource(store.id, { type: "newest" }, 4).catch(() => []);
      label = "وصل حديثاً";
    }
  }
  return (
    <div className="container-x py-12 text-center md:py-16">
      <div className="mx-auto w-full max-w-md">
        <p className="s-eyebrow">404</p>
        <h1 className="s-display mt-2 text-2xl">لم نجد هذه الصفحة</h1>
        <p className="s-sub mt-2">قد يكون الرابط قديماً أو المنتج لم يعد متاحاً. جرّبوا البحث أو العودة للرئيسية.</p>
        <form action="/search" role="search" className="mt-6 flex items-center rounded-full border px-4 focus-within:ring-2" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
          <Search className="size-5 shrink-0 opacity-60" aria-hidden="true" />
          <input name="q" aria-label="البحث في المتجر" placeholder="ابحثوا عن منتج" className="h-12 min-w-0 flex-1 bg-transparent px-3 text-base outline-none" />
        </form>
        <Link href="/" className="s-btn mt-5 inline-flex">
          العودة للرئيسية
        </Link>
      </div>
      {items.length ? (
        <section className="mt-14 text-start" aria-labelledby="nf-title">
          <h2 id="nf-title" className="mb-4 font-heading text-lg font-black">
            {label}
          </h2>
          <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {items.map((p) => (
              <li key={p.id}>
                <ProductCard product={p as unknown as ProductCardProduct} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
