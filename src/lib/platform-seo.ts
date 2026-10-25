// platform-seo.ts — كل ما يخص ظهور colapia.com في البحث ومحركات الإجابة (خالص، بلا خادم ولا قاعدة):
// الميتاداتا، والبيانات المنظمة (JSON-LD)، وrobots وsitemap لنطاق المنصة، وllms.txt وllms-full.txt.
// المصدر الوحيد للنصوص هو lib/landing-content.ts. المتاجر لها طبقتها الخاصة (blueprint/seo) ولا تمر من هنا.
import type { Metadata, MetadataRoute } from "next";
import { ABOUT, BRAND, DEFINITION, FAQ, QIMA_URL, SERVICES, SITE_DESCRIPTION, STEPS, WHY, WORKS } from "@/lib/landing-content";

/** مفتاح IndexNow: مفتاح عام بتصميمه، وملفه في public/<المفتاح>.txt على جذر نطاق المنصة. */
export const INDEXNOW_KEY = "6548c1ad7a51e956a3c80f345d5df28b";

/** آخر تحديث فعلي لمحتوى صفحات المنصة (يُحدَّث يدوياً مع كل تعديل جوهري، فلا نكذب بـ new Date()). */
export const PLATFORM_LAST_MODIFIED = "2026-10-24";

export const SITE_TITLE = `${BRAND.fullName} — ${BRAND.tagline}`;

/** أصل المنصة بلا شرطة أخيرة. محلياً (localhost) يكون http. */
export function siteOrigin(root: string | undefined = process.env.NEXT_PUBLIC_ROOT_DOMAIN): string {
  const host = (root ?? "").trim().toLowerCase() || "colapia.com";
  return `${/^(localhost|127\.|\[::1\])/.test(host) ? "http" : "https"}://${host}`;
}

/** نطاق متجر العرض من النطاق الرئيسي. */
export function demoOrigin(origin: string): string {
  return origin.replace(/^(https?:\/\/)/, "$1demo.");
}

export type PlatformPage = "home" | "about" | "work" | "terms" | "privacy" | "deletion";

export const PAGE_PATHS: Record<PlatformPage, string> = {
  home: "/",
  about: "/about",
  work: "/work",
  terms: "/terms",
  privacy: "/privacy",
  deletion: "/data-deletion",
};

export const PAGE_NAMES: Record<PlatformPage, string> = {
  home: "الرئيسية",
  about: "من نحن",
  work: "أعمالنا",
  terms: "الشروط والأحكام",
  privacy: "سياسة الخصوصية",
  deletion: "تعليمات حذف البيانات",
};

export const pageUrl = (origin: string, page: PlatformPage) => (page === "home" ? origin : `${origin}${PAGE_PATHS[page]}`);

/** ميتاداتا صفحة: canonical وhreflang وOpen Graph وTwitter. الصورة تأتي من opengraph-image الثابت في (platform). */
export function pageMetadata(page: PlatformPage, o: { title: string; description: string; absoluteTitle?: boolean; origin?: string }): Metadata {
  const origin = o.origin ?? siteOrigin();
  const url = pageUrl(origin, page);
  const title = o.absoluteTitle ? { absolute: o.title } : o.title;
  const shown = o.absoluteTitle ? o.title : `${o.title} | ${BRAND.name}`;
  return {
    title,
    description: o.description,
    alternates: { canonical: url, languages: { "ar-EG": url, "x-default": url } },
    openGraph: { type: "website", locale: "ar_EG", url, siteName: BRAND.fullName, title: shown, description: o.description },
    twitter: { card: "summary_large_image", title: shown, description: o.description },
  };
}

export const HOME_META = { title: SITE_TITLE, description: SITE_DESCRIPTION, absoluteTitle: true } as const;

// ─── البيانات المنظمة ─────────────────────────────────────────────────────────

type Json = Record<string, unknown>;

/** يحوّل كائناً إلى نص آمن داخل وسم script (بلا إغلاق مبكر). */
export const jsonLdText = (data: unknown) => JSON.stringify(data).replace(/</g, "\\u003c");

export function organizationNode(origin: string): Json {
  return {
    "@type": "Organization",
    "@id": `${origin}/#org`,
    name: BRAND.name,
    alternateName: [BRAND.nameAr, BRAND.fullName],
    url: origin,
    logo: { "@type": "ImageObject", url: `${origin}/logo.png` },
    image: `${origin}/logo.png`,
    description: DEFINITION,
    email: BRAND.email,
    sameAs: [...BRAND.sameAs],
    address: { "@type": "PostalAddress", addressCountry: BRAND.country },
    contactPoint: [
      { "@type": "ContactPoint", contactType: "customer support", email: BRAND.email, url: BRAND.igDm, availableLanguage: ["ar"] },
    ],
    knowsAbout: SERVICES.map((s) => s.title),
  };
}

export function professionalServiceNode(origin: string): Json {
  return {
    "@type": "ProfessionalService",
    "@id": `${origin}/#service`,
    name: BRAND.fullName,
    description: SITE_DESCRIPTION,
    url: origin,
    image: `${origin}/logo.png`,
    email: BRAND.email,
    sameAs: [...BRAND.sameAs],
    serviceType: SERVICES.map((s) => s.title),
    areaServed: { "@type": "Country", name: BRAND.countryName },
    address: { "@type": "PostalAddress", addressCountry: BRAND.country },
    provider: { "@id": `${origin}/#org` },
    knowsLanguage: "ar",
    // كتالوج الخدمات بلا أي أسعار (قاعدة المالك).
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "خدمات Colapia",
      itemListElement: SERVICES.map((s) => ({
        "@type": "Offer",
        itemOffered: { "@type": "Service", name: s.title, description: `${s.definition} مثال: ${s.example}` },
      })),
    },
  };
}

export function websiteNode(origin: string): Json {
  return {
    "@type": "WebSite",
    "@id": `${origin}/#website`,
    url: origin,
    name: BRAND.name,
    alternateName: BRAND.fullName,
    inLanguage: "ar",
    publisher: { "@id": `${origin}/#org` },
  };
}

export function breadcrumbNode(origin: string, page: PlatformPage): Json {
  const items = [{ name: PAGE_NAMES.home, url: origin }, ...(page === "home" ? [] : [{ name: PAGE_NAMES[page], url: pageUrl(origin, page) }])];
  return {
    "@type": "BreadcrumbList",
    "@id": `${pageUrl(origin, page)}#breadcrumb`,
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: it.url })),
  };
}

export function webPageNode(origin: string, page: PlatformPage, type: "WebPage" | "AboutPage" | "CollectionPage" = "WebPage"): Json {
  const url = pageUrl(origin, page);
  return {
    "@type": type,
    "@id": `${url}#webpage`,
    url,
    name: page === "home" ? SITE_TITLE : `${PAGE_NAMES[page]} | ${BRAND.fullName}`,
    inLanguage: "ar",
    isPartOf: { "@id": `${origin}/#website` },
    about: { "@id": `${origin}/#org` },
    breadcrumb: { "@id": `${url}#breadcrumb` },
    primaryImageOfPage: { "@type": "ImageObject", url: `${origin}/logo.png` },
  };
}

export function faqNode(origin: string): Json {
  return {
    "@type": "FAQPage",
    "@id": `${origin}/#faq`,
    inLanguage: "ar",
    mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
}

/** رابط عمل من أعمالنا (متجر العرض على نطاق المنصة الفرعي). */
export const workUrl = (origin: string, id: (typeof WORKS)[number]["id"]) => (id === "qima" ? QIMA_URL : demoOrigin(origin));

/** دراسة حالة: عمل منفَّذ موصوف بما هو موجود فعلاً. بلا تقييم نجوم ولا اقتباس حرفي مخترع. */
export function caseStudyNodes(origin: string): Json[] {
  return WORKS.map((w) => ({
    "@type": ["CreativeWork", "WebSite"],
    "@id": `${origin}/work#${w.id}`,
    name: w.name,
    alternateName: w.kind,
    url: workUrl(origin, w.id),
    description: [w.summary, ...w.details, w.clientNote ?? ""].filter(Boolean).join(" "),
    inLanguage: w.id === "qima" ? ["ar", "en"] : "ar",
    creator: { "@id": `${origin}/#org` },
    ...(w.image ? { image: `${origin}${w.image.src}` } : {}),
  }));
}

/** رسم JSON-LD كاملاً للصفحة. */
export function graphFor(page: "home" | "about" | "work", origin = siteOrigin()): Json {
  const nodes: Json[] = [organizationNode(origin), websiteNode(origin)];
  if (page === "home") nodes.push(professionalServiceNode(origin), webPageNode(origin, "home"), breadcrumbNode(origin, "home"), faqNode(origin));
  if (page === "about") nodes.push(professionalServiceNode(origin), webPageNode(origin, "about", "AboutPage"), breadcrumbNode(origin, "about"));
  if (page === "work") {
    const studies = caseStudyNodes(origin);
    nodes.push(webPageNode(origin, "work", "CollectionPage"), breadcrumbNode(origin, "work"), ...studies, {
      "@type": "ItemList",
      "@id": `${origin}/work#list`,
      itemListElement: studies.map((s, i) => ({ "@type": "ListItem", position: i + 1, item: { "@id": s["@id"] } })),
    });
  }
  return { "@context": "https://schema.org", "@graph": nodes };
}

// ─── robots وsitemap ─────────────────────────────────────────────────────────

/** زواحف الذكاء الاصطناعي ومحركات الإجابة المسموح لها صراحةً (بقرار المالك). */
export const AI_CRAWLERS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-User",
  "Claude-SearchBot",
  "anthropic-ai",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "GoogleOther",
  "Applebot",
  "Applebot-Extended",
  "Bingbot",
  "DuckAssistBot",
  "Amazonbot",
  "CCBot",
  "Meta-ExternalAgent",
  "MistralAI-User",
  "cohere-ai",
  "YouBot",
] as const;

/** مسارات المنصة الخاصة. /start و/golden غير محجوبين عمداً: كاشف روابط ميتا يحترم robots.txt فيحجب بطاقة المعاينة في الرسائل (الصفحتان noindex بنفسيهما). */
export const PLATFORM_DISALLOW = ["/admin/", "/dashboard/", "/api/", "/follow/", "/login", "/signup", "/setup", "/onboarding", "/claim", "/design-lab", "/no-store"];

export function platformRobots(origin = siteOrigin()): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: PLATFORM_DISALLOW },
      { userAgent: [...AI_CRAWLERS], allow: "/", disallow: PLATFORM_DISALLOW },
    ],
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  };
}

const SITEMAP_PAGES: { page: PlatformPage; changeFrequency: "weekly" | "monthly" | "yearly"; priority: number }[] = [
  { page: "home", changeFrequency: "weekly", priority: 1 },
  { page: "work", changeFrequency: "monthly", priority: 0.8 },
  { page: "about", changeFrequency: "monthly", priority: 0.7 },
  { page: "terms", changeFrequency: "yearly", priority: 0.4 },
  { page: "privacy", changeFrequency: "yearly", priority: 0.4 },
];

export function platformSitemap(origin = siteOrigin()): MetadataRoute.Sitemap {
  return SITEMAP_PAGES.map(({ page, changeFrequency, priority }) => {
    const url = pageUrl(origin, page);
    return { url, lastModified: PLATFORM_LAST_MODIFIED, changeFrequency, priority, alternates: { languages: { "ar-EG": url } } };
  });
}

// ─── llms.txt ────────────────────────────────────────────────────────────────

export function llmsTxt(origin = siteOrigin()): string {
  const demo = demoOrigin(origin);
  return [
    `# ${BRAND.fullName}`,
    "",
    `> ${DEFINITION}`,
    "",
    "## الصفحات",
    `- [الرئيسية](${origin}): ${SITE_DESCRIPTION}`,
    `- [من نحن](${pageUrl(origin, "about")}): من نحن وكيف نعمل وقيمنا.`,
    `- [أعمالنا](${pageUrl(origin, "work")}): مشاريع منفَّذة موصوفة بما فيها فعلاً.`,
    `- [الشروط والأحكام](${pageUrl(origin, "terms")}): اتفاق المشروع والدفع وانتقال ملكية الكود والتعديلات.`,
    `- [سياسة الخصوصية](${pageUrl(origin, "privacy")}): ما نجمعه من بيانات وكيف نحميه.`,
    `- [تعليمات حذف البيانات](${pageUrl(origin, "deletion")}): كيف تطلبون حذف بياناتكم.`,
    "",
    "## أعمال",
    ...WORKS.map((w) => `- [${w.name}](${workUrl(origin, w.id)}): ${w.kind}. ${w.summary}`),
    "",
    "## للتواصل",
    `- إنستجرام (بدء مشروع): ${BRAND.igDm}`,
    `- البريد: ${BRAND.email}`,
    `- لوحة العميل: ${origin}/dashboard`,
    "",
    "## Optional",
    `- [نسخة موسّعة لمحركات الذكاء الاصطناعي](${origin}/llms-full.txt): كل محتوى الموقع في صفحة نصية واحدة.`,
    `- [متجر العرض](${demo}): متجر إلكتروني تجريبي يمكن تصفحه.`,
    "",
  ].join("\n");
}

export function llmsFullTxt(origin = siteOrigin()): string {
  const demo = demoOrigin(origin);
  const lines: string[] = [
    `# ${BRAND.fullName} — ${BRAND.tagline}`,
    "",
    `> ${DEFINITION}`,
    "",
    "## ما هي Colapia؟",
    ...ABOUT.what.map((w) => `- ${w}`),
    `- الموقع: ${origin}`,
    `- البريد: ${BRAND.email}`,
    `- بدء مشروع: ${BRAND.igDm}`,
    "",
    "## ما الذي نبنيه",
  ];
  for (const s of SERVICES) lines.push(`### ${s.title}`, s.definition, `مثال: ${s.example}`, "");
  lines.push("## كيف نعمل");
  STEPS.forEach((s, i) => lines.push(`${i + 1}. ${s.title}: ${s.text}`));
  lines.push("", "## لماذا Colapia");
  for (const w of WHY) lines.push(`- ${w.title}: ${w.text}`);
  lines.push("", "## أعمالنا");
  for (const w of WORKS) {
    lines.push(`### ${w.name} — ${w.kind}`, w.summary, ...w.details.map((d) => `- ${d}`));
    if (w.clientNote) lines.push(w.clientNote);
    lines.push(`الرابط: ${workUrl(origin, w.id)}`, "");
  }
  lines.push("## الأسئلة الشائعة");
  for (const f of FAQ) lines.push(`### ${f.q}`, f.a, "");
  lines.push(
    "## الاتفاق باختصار",
    "- يُتفق على النطاق والسعر والموعد قبل بدء العمل، ويُدفع المبلغ قبل تسليم المشروع.",
    "- عند التسليم ينتقل الكود والمستودع إلى حسابات العميل ويصبح ملكه.",
    `- التفاصيل الكاملة: ${pageUrl(origin, "terms")}`,
    "",
    "## روابط",
    `- ${origin}/about`,
    `- ${origin}/work`,
    `- ${demo}`,
    `- ${QIMA_URL}`,
    "",
  );
  return lines.join("\n");
}
