import type { Metadata } from "next";
import { requireStore } from "@/lib/tenant";
import { collectionFacets, queryCollection } from "@/server/repos/collection";
import { CollectionBrowser } from "@/components/storefront/CollectionBrowser";
import { Breadcrumbs } from "@/components/storefront/Breadcrumbs";
import { filtersToQuery, parseFilters } from "@/lib/collection-filters";
import type { ProductCardProduct } from "@/components/storefront/ProductCard";

type P = { params: Promise<{ store: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

// صفحة كل المنتجات قابلة للفهرسة (بلا فلاتر)؛ نسخ الفلاتر والترتيب تشير إليها كـ canonical ولا تُفهرس.
export async function generateMetadata({ searchParams }: P): Promise<Metadata> {
  const filtered = Object.keys(await searchParams).length > 0;
  return { title: "كل المنتجات", alternates: { canonical: "/all" }, robots: filtered ? { index: false, follow: true } : undefined };
}

export default async function AllProductsPage({ params, searchParams }: P) {
  const { store: sub } = await params;
  const store = await requireStore(sub);
  const filters = parseFilters(await searchParams);
  const scope = { type: "all" as const };
  const [{ rows, total }, facets] = await Promise.all([queryCollection(store.id, scope, filters), collectionFacets(store.id, scope)]);

  return (
    <div className="container-x py-6 md:py-8">
      <Breadcrumbs items={[{ name: store.name, href: "/" }, { name: "كل المنتجات" }]} />
      <h1 className="font-heading text-2xl font-black md:text-3xl">كل المنتجات</h1>
      <div className="mt-5">
        <CollectionBrowser key={filtersToQuery(filters)} basePath="/all" initial={rows as unknown as ProductCardProduct[]} total={total} facets={facets} filters={filters} />
      </div>
    </div>
  );
}
