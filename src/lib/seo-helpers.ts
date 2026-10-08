export function generateStoreJsonLd(
  storeName: string,
  url: string,
  logoUrl?: string
) {
  return {
    "@context": "https://schema.org",
    "@type": "Store",
    name: storeName,
    url: url,
    image: logoUrl,
    paymentAccepted: "Cash, Credit Card",
    priceRange: "$$",
  };
}

export function generateFaqJsonLd(faqs: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: f.a,
      },
    })),
  };
}

export function generateBreadcrumbJsonLd(
  items: { name: string; url: string }[]
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}