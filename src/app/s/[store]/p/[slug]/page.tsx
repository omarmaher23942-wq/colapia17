import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Star } from "lucide-react";
import { requireStore, getBlueprint, getStoreBySubdomain } from "@/lib/tenant";
import { getProductBySlug, frequentlyBoughtTogether, productReviews, reviewStats, answeredQuestions, deliveryZones, listVisibleCategories } from "@/server/repos/catalog";
import { ProductPurchase } from "@/components/storefront/ProductPurchase";
import { ProductGallery } from "@/components/storefront/ProductGallery";
import { ProductStickyBar } from "@/components/storefront/ProductStickyBar";
import { ProductCard } from "@/components/storefront/ProductCard";
import { Markdown } from "@/components/storefront/Markdown";
import { RecentlyViewed } from "@/components/storefront/RecentlyViewed";
import { ProductReviews } from "@/components/storefront/product/ProductReviews";
import { ProductQuestions } from "@/components/storefront/product/ProductQuestions";
import { ProductViewTracker } from "@/components/storefront/product/ProductViewTracker";
import { ShareButton } from "@/components/storefront/product/ShareButton";
import { cn } from "@/lib/utils";
import { productMetadata, productJsonLd, breadcrumbJsonLd, questionsJsonLd } from "@/lib/storefront-seo";
import { arCount, NOUN } from "@/lib/format";
import { jsonLdString } from "@/lib/json-ld";

type P = { params: Promise<{ store: string; slug: string }> };

const SW = 1.75;

function safeDecode(s: string): string {
  try { return decodeURIComponent(s); } catch { return s; }
}

const loadProduct = cache((storeId: string, slug: string) => getProductBySlug(storeId, safeDecode(slug)));

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { store: sub, slug } = await params;
  const store = await getStoreBySubdomain(sub);
  if (!store) return {};
  const p = await loadProduct(store.id, slug);
  return p ? productMetadata(p) : { title: "المنتج غير موجود", robots: { index: false } };
}

export default async function ProductPage({ params }: P) {
  const { store: sub, slug } = await params;
  const store = await requireStore(sub);
  const [bp, p] = await Promise.all([getBlueprint(store.id), loadProduct(store.id, slug)]);
  if (!p) notFound();

  const [fbt, stats, rv, qa, zones, cats] = await Promise.all([
    bp.conversion.recommendations.frequentlyBoughtTogether ? frequentlyBoughtTogether(store.id, p, 4) : { rows: [], together: false },
    bp.productPage.showReviews ? reviewStats(store.id, p.id) : { count: 0, avg: 0, dist: {} as Record<number, number> },
    bp.productPage.showReviews ? productReviews(store.id, p.id, { limit: 8 }) : [],
    answeredQuestions(store.id, p.id),
    deliveryZones(store.id),
    p.categoryId ? listVisibleCategories(store.id) : [],
  ]);
  // العدد والمتوسط من التقييمات المعتمدة الفعلية لا من عدّاد مخزّن قد يتأخر.
  const avg = stats.count ? stats.avg : p.ratingCount ? p.ratingSum / p.ratingCount : 0;
  const ratingCount = stats.count || p.ratingCount;
  const category = p.categoryId ? cats.find((c) => c.id === p.categoryId) : undefined;

  const crumbs = [
    { name: bp.brand.name, path: "/" },
    ...(category ? [{ name: category.name, path: `/c/${encodeURIComponent(category.slug)}` }] : []),
    { name: p.name, path: `/p/${encodeURIComponent(p.slug)}` },
  ];
  const answered = qa.filter((q): q is typeof q & { answer: string } => !!q.answer);
  const jsonLd = [productJsonLd(store, bp.brand.name, p, p.variants), breadcrumbJsonLd(store, crumbs), questionsJsonLd(answered)].filter(Boolean);

  return (
    <div className="container-x py-6 md:py-10" dir="rtl">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(jsonLd) }} />
      <nav aria-label="مسار التصفح" className="mb-5 flex flex-wrap items-center gap-1.5 text-[13px] opacity-75">
        {crumbs.map((c, i) => (
          <span key={c.path} className="flex items-center gap-1.5">
            {i > 0 ? <span aria-hidden="true">/</span> : null}
            {i < crumbs.length - 1 ? (
              <Link href={c.path} className="hover:underline focus-visible:outline-none focus-visible:ring-2">
                {c.name}
              </Link>
            ) : (
              <span aria-current="page" className="font-bold">
                {c.name}
              </span>
            )}
          </span>
        ))}
      </nav>
      <div className={cn("grid gap-8 md:gap-10", bp.productPage.layout !== "gallery_stacked" && "lg:grid-cols-2")}>
        
        {/* Gallery Area */}
        <div className="space-y-4">
          <ProductGallery images={p.images} videos={p.videos} name={p.name} immersive={bp.productPage.layout === "immersive"} />
        </div>

        {/* Product Details Area */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          {p.badges.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {p.badges.map((b) => (
                <span key={b} className="rounded-md border px-2 py-0.5 text-[11px] font-bold" style={{ background: "color-mix(in srgb, var(--primary) 10%, transparent)", borderColor: "color-mix(in srgb, var(--primary) 30%, transparent)", color: "var(--primary)" }}>
                  {b}
                </span>
              ))}
            </div>
          )}

          <div className="flex items-start justify-between gap-4">
            <h1 className="font-heading text-2xl font-black leading-tight tracking-tight sm:text-3xl">
              {p.name}
            </h1>
            {bp.productPage.showShareButtons ? <ShareButton title={p.name} /> : null}
          </div>

          {ratingCount > 0 && (
            <div className="mt-2 flex items-center gap-2 text-xs">
              <div className="flex text-[var(--primary)]">
                {Array.from({ length: 5 }).map((_, k) => (
                  <Star key={k} strokeWidth={SW} className={cn("size-4", k < Math.round(avg) ? "fill-current" : "opacity-25")} />
                ))}
              </div>
              <a href="#reviews-title" className="font-bold opacity-80 hover:underline">{avg.toFixed(1)} ({arCount(ratingCount, NOUN.review)})</a>
            </div>
          )}

          {p.shortDescription && (
            <p className="mt-3 text-sm leading-relaxed opacity-80">{p.shortDescription}</p>
          )}

          <ProductPurchase product={p} zones={zones} />

          {p.description && (
            <div className="mt-8 border-t pt-6" style={{ borderColor: "var(--border)" }}>
              <h2 className="mb-3 font-heading text-lg font-black">الوصف</h2>
              <Markdown text={p.description} className="prose-ar text-sm opacity-85" />
            </div>
          )}

          {bp.productPage.showAttributesTable && Array.isArray(p.attributes) && p.attributes.length ? (
            <dl className="mt-6 overflow-hidden rounded-2xl border text-sm" style={{ borderColor: "var(--border)" }}>
              {(p.attributes as { label: string; value: string }[]).map((a, i) => (
                <div key={i} className="grid grid-cols-[minmax(7rem,35%)_1fr] gap-3 px-4 py-2.5 odd:bg-[color-mix(in_srgb,var(--muted)_70%,transparent)]">
                  <dt className="font-bold opacity-70">{a.label}</dt>
                  <dd className="font-medium">{a.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
      </div>

      {fbt.rows.length ? (
        <section className="mt-14 border-t pt-10" style={{ borderColor: "var(--border)" }} aria-labelledby="fbt-title">
          <h2 id="fbt-title" className="font-heading text-xl font-black">
            {fbt.together ? "يُشترى معه عادةً" : "من نفس القسم"}
          </h2>
          <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            {fbt.rows.map((x) => (
              <ProductCard key={x.id} product={x} />
            ))}
          </div>
        </section>
      ) : null}

      {bp.productPage.showReviews ? (
        <ProductReviews
          subdomain={store.subdomain}
          productId={p.id}
          stats={stats}
          initial={rv.map((r) => ({ id: r.id, customerName: r.customerName, rating: r.rating, body: r.body, imageUrls: r.imageUrls, isVerified: r.isVerified, createdAt: r.createdAt.toISOString() }))}
        />
      ) : null}

      <ProductQuestions subdomain={store.subdomain} productId={p.id} items={answered.map((q) => ({ id: q.id, question: q.question, answer: q.answer, askerName: q.askerName }))} />

      <RecentlyViewed currentSlug={p.slug} />
      <ProductViewTracker productId={p.id} name={p.name} price={p.pricePiasters} />

      <ProductStickyBar />
    </div>
  );
}
