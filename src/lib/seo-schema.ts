// seo-schema.ts — بيانات schema.org المنظمة (JSON-LD) لصفحات المتجر (منطق خالص مختبَر).
//
// قواعد الصدق: لا تقييم إلا من تقييمات معتمدة فعلية، ولا تفاصيل شحن أو استرجاع إلا حين تحددها سياسة المتجر،
// ولا منطقة خدمة ثابتة: الدولة والعملة واللغة من locale الـ Blueprint. الناتج كله يُدمج في @graph واحد لكل صفحة.
import type { StoreBlueprint } from "@/blueprint/schema";
import { socialLinks } from "./store-channels";
import { e164Egypt } from "./tracking";
import { clipText, plainText, type SeoLocale } from "./seo-meta";

export type LdNode = Record<string, unknown>;

export type LdSite = {
  name: string;
  /** رابط الصفحة الرئيسية المطلق (بلا مسار إضافي) */
  url: string;
  locale: SeoLocale;
  description?: string;
  logo?: string;
  sameAs: string[];
  phone?: string;
  email?: string;
  payments?: string[];
};

export type LdPolicies = { shipping: StoreBlueprint["shipping"]; returns: StoreBlueprint["returns"] };

const SCHEMA = "https://schema.org";
const root = (url: string) => `${url.replace(/\/+$/, "")}/`;

/** رابط مطلق http/https أو undefined (data: وغيرها مرفوضة). */
export function absUrl(base: string, u: string | null | undefined): string | undefined {
  if (!u) return undefined;
  try {
    const url = new URL(u, base);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

const money = (piasters: number) => (piasters / 100).toFixed(2);

function displayName(type: "region" | "language", code: string, lang: string): string {
  try {
    return new Intl.DisplayNames([lang], { type }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** كل ما يحتاجه بناة JSON-LD عن المتجر، من الـ Blueprint ورابطه العام. */
export function siteFromBlueprint(bp: StoreBlueprint, url: string, locale: SeoLocale): LdSite {
  const phone = e164Egypt(bp.channels.phone ?? bp.channels.whatsappNumber ?? "");
  const p = bp.payments;
  return {
    name: bp.brand.name,
    url: root(url),
    locale,
    description: clipText(bp.seo.description || bp.brand.description || bp.brand.tagline, 300) || undefined,
    logo: bp.brand.logo?.url,
    sameAs: socialLinks(bp.channels)
      .filter((s) => s.key !== "whatsapp" && s.key !== "messenger")
      .map((s) => s.href),
    phone: phone ? `+${phone}` : undefined,
    email: bp.channels.email,
    payments: [p.cod.enabled ? "الدفع عند الاستلام" : null, p.vodafoneCash.enabled ? "فودافون كاش" : null, p.instapay.enabled ? "إنستاباي" : null].filter((x): x is string => !!x),
  };
}

export const storeId = (site: LdSite) => `${site.url}#store`;
export const websiteId = (site: LdSite) => `${site.url}#website`;

/** «من 2 إلى 4 أيام» ← {min: 2, max: 4}؛ رقم واحد ← مدة ثابتة؛ بلا أرقام ← null. */
export function transitDays(eta: string | null | undefined): { min: number; max: number } | null {
  const latin = (eta ?? "").replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
  const nums = (latin.match(/\d+/g) ?? []).map(Number).filter((n) => n > 0 && n < 60);
  if (!nums.length) return null;
  return { min: Math.min(...nums), max: Math.max(...nums) };
}

/** سياسة الاسترجاع كما حددها المتجر؛ لا تُكتب إن لم يكن الاسترجاع أو الاستبدال متاحاً أصلاً. */
export function returnPolicyNode(returns: StoreBlueprint["returns"], country: string): LdNode | undefined {
  if (returns.windowDays <= 0 || !(returns.allowExchange || returns.allowRefund)) return undefined;
  return {
    "@type": "MerchantReturnPolicy",
    applicableCountry: country,
    returnPolicyCategory: `${SCHEMA}/MerchantReturnFiniteReturnWindow`,
    merchantReturnDays: returns.windowDays,
    returnFees: returns.returnShippingPaidBy === "store" ? `${SCHEMA}/FreeReturn` : `${SCHEMA}/ReturnShippingFees`,
    refundType: returns.allowRefund ? `${SCHEMA}/FullRefund` : `${SCHEMA}/ExchangeRefund`,
  };
}

/** تفاصيل الشحن للعرض؛ لا تُكتب إن كان السعر يختلف حسب المحافظة (لا نخمّنه). */
export function shippingDetailsNode(shipping: StoreBlueprint["shipping"], priceForThreshold: number, locale: SeoLocale): LdNode | undefined {
  let rate: number | null = null;
  if (shipping.freeOverPiasters === 0) rate = 0;
  else if (shipping.freeOverPiasters && priceForThreshold >= shipping.freeOverPiasters) rate = 0;
  else if (shipping.flatRatePiasters !== null && shipping.flatRatePiasters !== undefined) rate = shipping.flatRatePiasters;
  if (rate === null) return undefined;
  const days = transitDays(shipping.generalEta);
  return {
    "@type": "OfferShippingDetails",
    shippingRate: { "@type": "MonetaryAmount", value: Number(money(rate)), currency: locale.currency },
    shippingDestination: { "@type": "DefinedRegion", addressCountry: locale.country },
    deliveryTime: days
      ? { "@type": "ShippingDeliveryTime", transitTime: { "@type": "QuantitativeValue", minValue: days.min, maxValue: days.max, unitCode: "DAY" } }
      : undefined,
  };
}

// ─── المتجر والموقع ────────────────────────────────────────────────────────

/** المتجر نفسه: الاسم والشعار وحساباته ووسائل التواصل ومنطقة الخدمة ووسائل الدفع وسياسة الاسترجاع. */
export function onlineStoreNode(site: LdSite, policies?: LdPolicies): LdNode {
  const lang = displayName("language", site.locale.language, "en");
  const logo = absUrl(site.url, site.logo);
  const contacts: LdNode[] = [];
  if (site.phone) contacts.push({ "@type": "ContactPoint", telephone: site.phone, contactType: "customer service", areaServed: site.locale.country, availableLanguage: lang });
  if (site.email) contacts.push({ "@type": "ContactPoint", email: site.email, contactType: "customer service", areaServed: site.locale.country, availableLanguage: lang });
  return {
    "@type": "OnlineStore",
    "@id": storeId(site),
    name: site.name,
    url: site.url,
    description: site.description,
    logo: logo ? { "@type": "ImageObject", url: logo } : undefined,
    image: logo,
    sameAs: site.sameAs.length ? site.sameAs : undefined,
    contactPoint: contacts.length ? contacts : undefined,
    areaServed: { "@type": "Country", name: displayName("region", site.locale.country, site.locale.language) },
    currenciesAccepted: site.locale.currency,
    paymentAccepted: site.payments?.length ? site.payments.join("، ") : undefined,
    hasMerchantReturnPolicy: policies ? returnPolicyNode(policies.returns, site.locale.country) : undefined,
  };
}

/** الموقع بخانة بحث تظهر في نتائج جوجل. */
export function websiteNode(site: LdSite): LdNode {
  return {
    "@type": "WebSite",
    "@id": websiteId(site),
    name: site.name,
    url: site.url,
    inLanguage: site.locale.language,
    publisher: { "@id": storeId(site) },
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${site.url}search?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  };
}

/** قائمة الأقسام الظاهرة: تُعرّف محركات البحث والمساعدين بهيكل المتجر. */
export function categoriesListNode(site: LdSite, cats: { name: string; url: string }[]): LdNode | undefined {
  if (!cats.length) return undefined;
  return {
    "@type": "ItemList",
    name: `أقسام ${site.name}`,
    itemListElement: cats.slice(0, 50).map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, url: c.url })),
  };
}

// ─── المنتج ────────────────────────────────────────────────────────────────

export type LdProductInput = {
  name: string;
  url: string;
  description?: string | null;
  sku?: string | null;
  images: string[];
  category?: string;
  brand?: string;
  pricePiasters: number;
  /** نطاق أسعار التركيبات إن اختلفت */
  priceRange?: { low: number; high: number; count: number };
  available: boolean;
  attributes?: { label: string; value: string }[];
  rating?: { avg: number; count: number };
  reviews?: { author: string; rating: number; body?: string | null; date?: Date | string | null }[];
};

const BRAND_LABEL = /^(الماركة|العلامة التجارية|brand)$/i;

/** ماركة المنتج من مواصفاته إن ذكرها التاجر؛ وإلا اسم المتجر (متاجر العلامات الخاصة). */
export function brandOf(attributes: { label: string; value: string }[] | undefined, fallback: string): string {
  return attributes?.find((a) => BRAND_LABEL.test(a.label.trim()) && a.value.trim())?.value.trim() ?? fallback;
}

export function productNode(site: LdSite, p: LdProductInput, policies?: LdPolicies): LdNode {
  const cur = site.locale.currency;
  const shipping = policies ? shippingDetailsNode(policies.shipping, p.pricePiasters, site.locale) : undefined;
  const returnPolicy = policies ? returnPolicyNode(policies.returns, site.locale.country) : undefined;
  const common = {
    url: p.url,
    priceCurrency: cur,
    availability: `${SCHEMA}/${p.available ? "InStock" : "OutOfStock"}`,
    itemCondition: `${SCHEMA}/NewCondition`,
    seller: { "@type": "Organization", name: site.name, url: site.url },
    shippingDetails: shipping,
    hasMerchantReturnPolicy: returnPolicy,
  };
  const range = p.priceRange && p.priceRange.low !== p.priceRange.high ? p.priceRange : null;
  const offers = range
    ? { "@type": "AggregateOffer", ...common, lowPrice: money(range.low), highPrice: money(range.high), offerCount: range.count }
    : { "@type": "Offer", ...common, price: money(p.pricePiasters) };
  const reviews = (p.reviews ?? [])
    .filter((r) => r.rating >= 1 && r.rating <= 5 && r.author.trim())
    .slice(0, 5)
    .map((r) => {
      const when = r.date ? new Date(r.date) : null;
      return {
      "@type": "Review",
      author: { "@type": "Person", name: r.author.trim() },
      reviewRating: { "@type": "Rating", ratingValue: r.rating, bestRating: 5, worstRating: 1 },
      reviewBody: clipText(r.body, 400) || undefined,
      datePublished: when && !Number.isNaN(when.getTime()) ? when.toISOString().slice(0, 10) : undefined,
      };
    });
  const props = (p.attributes ?? []).filter((a) => a.label.trim() && a.value.trim()).slice(0, 12);
  return {
    "@type": "Product",
    "@id": `${p.url}#product`,
    name: p.name,
    description: clipText(p.description, 500) || undefined,
    sku: p.sku || undefined,
    image: p.images.length ? p.images.slice(0, 10) : undefined,
    category: p.category,
    brand: { "@type": "Brand", name: p.brand ?? site.name },
    url: p.url,
    inLanguage: site.locale.language,
    additionalProperty: props.length ? props.map((a) => ({ "@type": "PropertyValue", name: a.label.trim(), value: a.value.trim() })) : undefined,
    offers,
    // التقييم الإجمالي من تقييمات معتمدة فعلية فقط؛ بلا تقييم لا يُكتب شيء.
    aggregateRating: p.rating && p.rating.count > 0 ? { "@type": "AggregateRating", ratingValue: Number(p.rating.avg.toFixed(1)), reviewCount: p.rating.count, bestRating: 5, worstRating: 1 } : undefined,
    review: reviews.length ? reviews : undefined,
  };
}

// ─── التنقل والأسئلة والأقسام ───────────────────────────────────────────────

export function breadcrumbNode(items: { name: string; url: string }[]): LdNode {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: it.url })),
  };
}

export const SPEAKABLE_SELECTORS = ["[data-speakable] h1", "[data-speakable] h2", "[data-speakable] p"];

/** FAQPage من أسئلة وأجوبة معروضة فعلاً في الصفحة (شرط جوجل)، مع علامة speakable للمساعدات الصوتية. */
export function faqNode(items: { q: string; a: string }[], opts: { speakable?: boolean } = {}): LdNode | undefined {
  const rows = items.filter((i) => i.q.trim() && plainText(i.a)).slice(0, 25);
  if (!rows.length) return undefined;
  return {
    "@type": "FAQPage",
    mainEntity: rows.map((i) => ({ "@type": "Question", name: i.q.trim(), acceptedAnswer: { "@type": "Answer", text: plainText(i.a) } })),
    speakable: opts.speakable ? { "@type": "SpeakableSpecification", cssSelector: SPEAKABLE_SELECTORS } : undefined,
  };
}

/** صفحة قسم: CollectionPage بقائمة منتجاتها. */
export function collectionNode(site: LdSite, c: { name: string; url: string; description?: string | null; image?: string | null; products: { name: string; url: string; image?: string | null }[] }): LdNode {
  return {
    "@type": "CollectionPage",
    "@id": `${c.url}#collection`,
    name: c.name,
    url: c.url,
    description: clipText(c.description, 300) || undefined,
    image: absUrl(site.url, c.image),
    inLanguage: site.locale.language,
    isPartOf: { "@id": websiteId(site) },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: c.products.length,
      itemListElement: c.products.slice(0, 30).map((p, i) => ({ "@type": "ListItem", position: i + 1, url: p.url, name: p.name, image: absUrl(site.url, p.image) })),
    },
  };
}

/** صفحة عادية (سياسة أو أسئلة…) باسمها ورابطها. */
export function webPageNode(site: LdSite, p: { name: string; url: string; description?: string }, opts: { speakable?: boolean } = {}): LdNode {
  return {
    "@type": "WebPage",
    "@id": `${p.url}#webpage`,
    name: p.name,
    url: p.url,
    description: p.description,
    inLanguage: site.locale.language,
    isPartOf: { "@id": websiteId(site) },
    speakable: opts.speakable ? { "@type": "SpeakableSpecification", cssSelector: SPEAKABLE_SELECTORS } : undefined,
  };
}

/** مستند JSON-LD واحد بعدة عقد. العقد الفارغة تُسقط. */
export function ldGraph(...nodes: (LdNode | null | undefined | false)[]): LdNode {
  return { "@context": SCHEMA, "@graph": nodes.filter((n): n is LdNode => !!n) };
}
