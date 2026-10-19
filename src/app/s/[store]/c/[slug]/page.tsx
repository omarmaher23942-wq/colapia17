import { breadcrumbJsonLd } from "@/lib/storefront-seo";
import { jsonLdString } from "@/lib/json-ld";
import { publicStoreUrl } from "@/lib/utils";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireStore, getStoreBySubdomain } from "@/lib/tenant";
import { getCategoryBySlug } from "@/server/repos/catalog";
import { collectionFacets, queryCollection, subcategories } from "@/server/repos/collection";
import { CollectionBrowser } from "@/components/storefront/CollectionBrowser";
import { Breadcrumbs } from "@/components/storefront/Breadcrumbs";
import { filtersToQuery, parseFilters } from "@/lib/collection-filters";
import type { ProductCardProduct } from "@/components/storefront/ProductCard";

type P = { params: Promise<{ store: string; slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

const safe = (s: string) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

export async function generateMetadata({ params, searchParams }: P): Promise<Metadata> {
  const { store: sub, slug } = await params;
  const sp = await searchParams;
  const store = await getStoreBySubdomain(sub);
  const cat = store ? await getCategoryBySlug(store.id, safe(slug)) : null;
  if (!cat || !cat.isVisible) return { robots: { index: false } };
  const path = `/c/${encodeURIComponent(cat.slug)}`;
  // صفحات الفلاتر والترتيب نسخ من القسم نفسه: canonical للقسم، ولا تُفهرس.
  const filtered = Object.keys(sp).length > 0;
  return {
    title: cat.name,
    description: cat.description ?? undefined,
    alternates: { canonical: path },
    robots: filtered ? { index: false, follow: true } : undefined,
    openGraph: { type: "website", siteName: store?.name, locale: "ar_EG", title: cat.name, url: path, images: cat.imageUrl ? [cat.imageUrl] : undefined },
  };
}

export default async function CategoryPage({ params, searchParams }: P) {
  const { store: sub, slug } = await params;
  const store = await requireStore(sub);
  const cat = await getCategoryBySlug(store.id, safe(slug));
  // القسم الذي أخفاه التاجر لا تُفتح صفحته (منتجاته تبقى ظاهرة في المتجر).
  if (!cat || !cat.isVisible) notFound();

  const filters = parseFilters(await searchParams);
  const scope = { type: "category" as const, id: cat.id };
  const [{ rows, total }, facets, subs] = await Promise.all([queryCollection(store.id, scope, filters), collectionFacets(store.id, scope), subcategories(store.id, cat.id)]);
  const path = `/c/${encodeURIComponent(cat.slug)}`;

  const ld = [
    breadcrumbJsonLd(store, [
      { name: store.name, path: "/" },
      { name: cat.name, path },
    ]),
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: cat.name,
      itemListElement: rows.slice(0, 30).map((p, i) => ({ "@type": "ListItem", position: i + 1, url: publicStoreUrl(store, `/p/${encodeURIComponent(p.slug)}`), name: p.name })),
    },
  ];

  return (
    <div className="container-x py-6 md:py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(ld) }} />
      <Breadcrumbs items={[{ name: store.name, href: "/" }, { name: cat.name }]} />
      <h1 className="font-heading text-2xl font-black md:text-3xl">{cat.name}</h1>
      {cat.description ? <p className="mt-1 max-w-2xl opacity-75">{cat.description}</p> : null}
      <div className="mt-5">
        <CollectionBrowser
          key={filtersToQuery(filters)}
          basePath={path}
          categorySlug={cat.slug}
          initial={rows as unknown as ProductCardProduct[]}
          total={total}
          facets={facets}
          filters={filters}
          subs={subs.filter((s) => s.productCount > 0)}
        />
      </div>
    </div>
  );
}
