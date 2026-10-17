import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { requireStore } from "@/lib/tenant";
import { searchProducts, listVisibleCategories } from "@/server/repos/catalog";
import { fetchProductsForSource } from "@/blueprint/section-data";
import { ProductCard, type ProductCardProduct } from "@/components/storefront/ProductCard";
import { OpenVisualSearchButton } from "@/components/storefront/OpenVisualSearchButton";
import { arCount, NOUN } from "@/lib/format";

// نتائج البحث صفحات رقيقة المحتوى: تُتاح للمستخدم ولا تُفهرس.
export const metadata: Metadata = { title: "البحث", robots: { index: false, follow: true } };

export default async function SearchPage({ params, searchParams }: { params: Promise<{ store: string }>; searchParams: Promise<{ q?: string }> }) {
  const { store: sub } = await params;
  const q = ((await searchParams).q ?? "").trim().slice(0, 100);
  const store = await requireStore(sub);
  const rows = q ? await searchProducts(store.id, q, 48) : [];
  // بلا كلمة بحث أو بلا نتائج: منتجات الأكثر مبيعاً (أو الأحدث) وأقسام المتجر تقود الزائر لما يشتريه.
  const [popular, cats] = !q || !rows.length ? await Promise.all([popularFor(store.id), listVisibleCategories(store.id)]) : [{ items: [], label: "" }, []];

  return (
    <div className="container-x py-6 md:py-8">
      <form action="/search" role="search" className="mx-auto mb-3 flex max-w-xl items-center rounded-full border px-4 focus-within:ring-2" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
        <Search className="size-5 shrink-0 opacity-60" aria-hidden="true" />
        <input name="q" defaultValue={q} placeholder="البحث بالاسم أو الوصف" aria-label="البحث في المتجر" enterKeyHint="search" className="h-12 min-w-0 flex-1 bg-transparent px-3 text-base outline-none" />
        <button type="submit" className="s-btn !min-h-9 shrink-0 !px-4 text-[13px]">
          بحث
        </button>
      </form>
      <div className="mb-8 text-center">
        <OpenVisualSearchButton />
      </div>

      {q ? <h1 className="mb-6 font-heading text-xl font-black">{rows.length ? `نتائج «${q}» (${arCount(rows.length, NOUN.product)})` : `لا نتائج لـ «${q}»`}</h1> : <h1 className="mb-6 font-heading text-xl font-black">ابحثوا في المتجر</h1>}

      {rows.length ? (
        <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {rows.map((p) => (
            <li key={p.id}>
              <ProductCard product={p as unknown as ProductCardProduct} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="space-y-10">
          {q ? <p className="opacity-75">جرّبوا كلمة أقصر أو مختلفة، أو تصفحوا الأقسام والمنتجات الأكثر طلباً أدناه.</p> : null}
          {cats.length ? (
            <div>
              <h2 className="mb-3 text-sm font-black">الأقسام</h2>
              <div className="flex flex-wrap gap-2">
                {cats.filter((c) => c.productCount > 0).map((c) => (
                  <Link key={c.id} href={`/c/${encodeURIComponent(c.slug)}`} className="inline-flex h-10 items-center rounded-full border px-4 text-sm font-bold" style={{ borderColor: "var(--border)" }}>
                    {c.name}
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
          {popular.items.length ? (
            <div>
              <h2 className="mb-4 font-heading text-lg font-black">{popular.label}</h2>
              <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
                {popular.items.map((p) => (
                  <li key={p.id}>
                    <ProductCard product={p as unknown as ProductCardProduct} />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

async function popularFor(storeId: string): Promise<{ items: { id: string }[]; label: string }> {
  const best = (await fetchProductsForSource(storeId, { type: "best_sellers" }, 4)).filter((p) => (p.orderCount ?? 0) > 0);
  const items = best.length ? best : await fetchProductsForSource(storeId, { type: "newest" }, 4);
  return { items, label: best.length ? "الأكثر طلباً" : "وصل حديثاً" };
}
