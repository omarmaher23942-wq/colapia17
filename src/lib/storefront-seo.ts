// storefront-seo.ts — بيانات وصفية (metadata) و JSON-LD لصفحات المتجر.
// كل ما يظهر لمحركات البحث والمتصفح على نطاق المتجر يخص المتجر وحده، لا المنصة.
// المنطق الخالص (العناوين والأوصاف وبيانات schema.org) في seo-meta وseo-schema؛ هنا الربط بالمتجر والصفحات.
import { storeVisibility } from "@/lib/store-visibility";
import { hostingState } from "@/lib/hosting";
import "server-only";
import type { Metadata, Viewport } from "next";
import type { StoreBlueprint } from "@/blueprint/schema";
import type { StoreFact } from "@/blueprint/facts";
import type { TenantStore } from "@/lib/tenant";
import { publicStoreUrl } from "@/lib/utils";
import { cleanGoogleVerification } from "@/lib/tracking";
import { storeIconLinks } from "@/lib/pwa";
import {
  categoryDescription,
  clipText,
  heroImageUrl,
  homeDescription,
  homeTitle,
  ogLocale,
  pageAlternates,
  productDescription,
  productTitle,
  composeTitle,
  seoLocale,
  type SeoLocale,
} from "@/lib/seo-meta";
import {
  brandOf,
  breadcrumbNode,
  categoriesListNode,
  collectionNode,
  faqNode,
  ldGraph,
  onlineStoreNode,
  productNode,
  siteFromBlueprint,
  webPageNode,
  websiteNode,
  absUrl,
  type LdSite,
} from "@/lib/seo-schema";

/** المتاجر قيد التجربة أو المجمّدة لا تُفهرس؛ المفعّلة فقط تظهر في البحث. */
export function isIndexable(store: TenantStore, bp: StoreBlueprint | null): boolean {
  return storeVisibility(store, hostingState(store)).indexable && !bp?.seo.noIndex;
}

/** قواعد الفهرسة لمتجر ظاهر، مع السماح بمعاينات الصور والمقتطفات الكاملة (تُقرأ بها نتائج البحث والمساعدات). */
const INDEXABLE_ROBOTS = {
  index: true,
  follow: true,
  googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 },
} satisfies Metadata["robots"];

export type StoreMetaContext = {
  /** أسماء الأقسام الظاهرة (تدخل العنوان والوصف حين لا شعار نصي) */
  categoryNames?: string[];
  facts?: StoreFact[];
  /** الصفحة الرئيسية: وحدها تحمل canonical وhreflang وعنوان og:url الجذر */
  home?: boolean;
};

export function storeMetadata(store: TenantStore, bp: StoreBlueprint | null, ctx: StoreMetaContext = {}): Metadata {
  const name = bp?.brand.name ?? store.name;
  const loc = seoLocale(bp);
  const title = bp ? homeTitle(bp, ctx.categoryNames) : name;
  const description = bp ? homeDescription(bp, ctx) : undefined;
  // صورة المشاركة: ما حدده التاجر، ثم صورة الواجهة (أوسع وأعرف من الشعار)، ثم الشعار.
  const ogImage = bp ? (bp.seo.ogImage ?? heroImageUrl(bp) ?? bp.brand.logo?.url) : undefined;
  const indexable = isIndexable(store, bp);

  return {
    metadataBase: new URL(publicStoreUrl(store)),
    title: { default: title, template: `%s | ${name}` },
    description,
    applicationName: name,
    authors: [{ name }],
    creator: name,
    publisher: name,
    icons: storeIconLinks(),
    manifest: "/manifest.webmanifest",
    alternates: ctx.home ? pageAlternates("/", loc) : undefined,
    openGraph: {
      type: "website",
      siteName: name,
      title,
      description,
      locale: ogLocale(loc),
      url: ctx.home ? "/" : undefined,
      images: ogImage ? [{ url: ogImage, alt: name }] : undefined,
    },
    twitter: { card: ogImage ? "summary_large_image" : "summary", title, description, images: ogImage ? [ogImage] : undefined },
    robots: indexable ? INDEXABLE_ROBOTS : { index: false, follow: false },
    formatDetection: { telephone: false },
    // وسم Google Search Console الذي يضعه التاجر من «التسويق» (منقّى: حروف وأرقام فقط).
    verification: (() => {
      const google = cleanGoogleVerification(bp?.seo.googleVerification);
      return google ? { google } : undefined;
    })(),
  };
}

export function storeViewport(bp: StoreBlueprint | null): Viewport {
  const palette = (bp?.theme.palette ?? {}) as { background?: string };
  return {
    themeColor: palette.background ?? "#ffffff",
    width: "device-width",
    initialScale: 1,
    viewportFit: "cover",
  };
}

export type ProductLike = {
  name: string;
  slug: string;
  shortDescription: string | null;
  description: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  pricePiasters: number;
  compareAtPiasters: number | null;
  sku: string | null;
  stock: number | null;
  trackStock: boolean;
  images: { url: string; alt?: string }[];
  ratingSum: number;
  ratingCount: number;
  attributes?: { label: string; value: string }[];
};

type SiteMeta = { name: string; image?: string | null; locale?: SeoLocale; facts?: StoreFact[] };

export function productMetadata(product: ProductLike, site?: SiteMeta): Metadata {
  const loc = site?.locale ?? seoLocale();
  const title = site ? productTitle(product, site.name) : product.seoTitle || product.name;
  const description = site
    ? productDescription(product, { siteName: site.name, currency: loc.currency, facts: site.facts })
    : clipText(product.seoDescription || product.shortDescription || product.description, 160);
  const path = `/p/${encodeURIComponent(product.slug)}`;
  const own = product.images.slice(0, 4).map((i) => ({ url: i.url, alt: i.alt || product.name }));
  // مجموعة openGraph في الصفحة تستبدل مجموعة التخطيط كاملة (لا تُدمج)، فنعيد اسم الموقع واللغة وصورة المتجر عند غياب صور المنتج.
  const images = own.length ? own : site?.image ? [{ url: site.image, alt: site.name }] : [];
  return {
    title: site ? { absolute: title } : title,
    description,
    alternates: pageAlternates(path, loc),
    openGraph: { type: "website", siteName: site?.name, locale: ogLocale(loc), title, description, url: path, images: images.length ? images : undefined },
    twitter: { card: images.length ? "summary_large_image" : "summary", title, description, images: images.length ? images.map((i) => i.url) : undefined },
  };
}

export function categoryMetadata(
  cat: { name: string; slug: string; description: string | null; imageUrl: string | null },
  site: SiteMeta,
  opts: { filtered: boolean },
): Metadata {
  const loc = site.locale ?? seoLocale();
  const path = `/c/${encodeURIComponent(cat.slug)}`;
  const title = composeTitle(cat.name, site.name);
  const description = categoryDescription(cat, { siteName: site.name, facts: site.facts });
  const image = cat.imageUrl ?? site.image;
  return {
    title: { absolute: title },
    description,
    // صفحات الفلاتر والترتيب نسخ من القسم نفسه: canonical للقسم، ولا تُفهرس.
    alternates: pageAlternates(path, loc),
    robots: opts.filtered ? { index: false, follow: true } : undefined,
    openGraph: { type: "website", siteName: site.name, locale: ogLocale(loc), title, description, url: path, images: image ? [{ url: image, alt: cat.name }] : undefined },
    twitter: { card: image ? "summary_large_image" : "summary", title, description, images: image ? [image] : undefined },
  };
}

/** صفحة عادية (سياسة، كل المنتجات…): عنوان بالقالب، canonical وhreflang ذاتيان. */
export function pageMetadata(
  page: { title: string; path: string; description?: string },
  site: SiteMeta,
  opts: { filtered?: boolean } = {},
): Metadata {
  const loc = site.locale ?? seoLocale();
  const description = page.description ? clipText(page.description, 160) : undefined;
  return {
    title: page.title,
    description,
    alternates: pageAlternates(page.path, loc),
    robots: opts.filtered ? { index: false, follow: true } : undefined,
    openGraph: { type: "website", siteName: site.name, locale: ogLocale(loc), title: page.title, description, url: page.path, images: site.image ? [{ url: site.image, alt: site.name }] : undefined },
  };
}

// ─── JSON-LD ───────────────────────────────────────────────────────────────

/** هوية المتجر لبيانات schema.org: اسمه ورابطه العام ولغته ودولته وعملته وحساباته. */
export function ldSite(store: TenantStore, bp: StoreBlueprint): LdSite {
  return siteFromBlueprint(bp, publicStoreUrl(store, "/"), seoLocale(bp));
}

/** الرئيسية: المتجر (الاسم والشعار والحسابات والتواصل ومنطقة الخدمة) والموقع بخانة بحث وقائمة الأقسام. */
export function homeLd(store: TenantStore, bp: StoreBlueprint, categories: { name: string; slug: string }[]) {
  const site = ldSite(store, bp);
  return ldGraph(
    onlineStoreNode(site, { shipping: bp.shipping, returns: bp.returns }),
    websiteNode(site),
    categoriesListNode(
      site,
      categories.map((c) => ({ name: c.name, url: publicStoreUrl(store, `/c/${encodeURIComponent(c.slug)}`) })),
    ),
  );
}

export type ProductLdInput = {
  product: ProductLike & { videos?: unknown };
  variants: { pricePiasters: number | null; isAvailable: boolean; stock: number | null }[];
  category?: { name: string; slug: string };
  rating: { avg: number; count: number };
  reviews: { customerName: string; rating: number; body: string | null; createdAt: Date | string }[];
};

/** صفحة المنتج: Product بعرض (ونطاق أسعار التركيبات) وتفاصيل الشحن والاسترجاع والتقييم الحقيقي، مع مسار التنقل. */
export function productLd(store: TenantStore, bp: StoreBlueprint, input: ProductLdInput) {
  const { product: p, variants } = input;
  const site = ldSite(store, bp);
  const url = publicStoreUrl(store, `/p/${encodeURIComponent(p.slug)}`);
  const prices = variants.map((v) => v.pricePiasters ?? p.pricePiasters);
  const inStock = !p.trackStock || p.stock === null || p.stock > 0;
  const available = variants.length ? variants.some((v) => v.isAvailable && (!p.trackStock || v.stock === null || v.stock > 0)) : inStock;
  const crumbs = [
    { name: bp.brand.name, url: publicStoreUrl(store, "/") },
    ...(input.category ? [{ name: input.category.name, url: publicStoreUrl(store, `/c/${encodeURIComponent(input.category.slug)}`) }] : []),
    { name: p.name, url },
  ];
  return ldGraph(
    productNode(
      site,
      {
        name: p.name,
        url,
        description: p.shortDescription || p.description,
        sku: p.sku,
        images: p.images.map((i) => absUrl(site.url, i.url)).filter((u): u is string => !!u),
        category: input.category?.name,
        brand: brandOf(p.attributes, bp.brand.name),
        pricePiasters: p.pricePiasters,
        priceRange: prices.length ? { low: Math.min(...prices), high: Math.max(...prices), count: variants.length } : undefined,
        available,
        attributes: p.attributes,
        rating: input.rating.count > 0 ? input.rating : undefined,
        reviews: input.reviews.map((r) => ({ author: r.customerName, rating: r.rating, body: r.body, date: r.createdAt })),
      },
      { shipping: bp.shipping, returns: bp.returns },
    ),
    breadcrumbNode(crumbs),
  );
}

/** صفحة قسم: CollectionPage بمنتجاتها ومسار التنقل. */
export function categoryLd(
  store: TenantStore,
  bp: StoreBlueprint,
  cat: { name: string; slug: string; description: string | null; imageUrl: string | null },
  products: { name: string; slug: string; images?: { url: string }[] }[],
) {
  const site = ldSite(store, bp);
  const url = publicStoreUrl(store, `/c/${encodeURIComponent(cat.slug)}`);
  return ldGraph(
    collectionNode(site, {
      name: cat.name,
      url,
      description: cat.description,
      image: cat.imageUrl,
      products: products.map((p) => ({ name: p.name, url: publicStoreUrl(store, `/p/${encodeURIComponent(p.slug)}`), image: p.images?.[0]?.url })),
    }),
    breadcrumbNode([
      { name: bp.brand.name, url: publicStoreUrl(store, "/") },
      { name: cat.name, url },
    ]),
  );
}

/** صفحة «اسألوا عن المتجر»: FAQPage بنفس الإجابات المعروضة، وspeakable للمساعدات الصوتية. */
export function answersLd(store: TenantStore, bp: StoreBlueprint, page: { title: string; slug: string; description?: string }, items: { q: string; a: string }[]) {
  const site = ldSite(store, bp);
  const url = publicStoreUrl(store, `/pages/${page.slug}`);
  return ldGraph(
    webPageNode(site, { name: page.title, url, description: page.description }),
    faqNode(items, { speakable: true }),
    breadcrumbNode([
      { name: bp.brand.name, url: publicStoreUrl(store, "/") },
      { name: page.title, url },
    ]),
  );
}
