import { describe, expect, it } from "vitest";
import { defaultBlueprint } from "@/blueprint/defaults";
import { blueprintSchema } from "@/blueprint/schema";
import { clipText, composeTitle, homeDescription, homeTitle, isFilteredQuery, nameFirst, pageAlternates, productDescription, seoLocale, preconnectOrigin } from "@/lib/seo-meta";
import { breadcrumbNode, faqNode, ldGraph, onlineStoreNode, productNode, returnPolicyNode, shippingDetailsNode, siteFromBlueprint, transitDays } from "@/lib/seo-schema";
import { storeAnswers } from "@/lib/seo-answers";
import { renderLlmsFull, renderLlmsTxt } from "@/lib/seo-llms";
import { AI_CRAWLERS, storeRobots } from "@/lib/seo-robots";
import { buildStoreSitemap } from "@/lib/seo-sitemap";
import { deriveIndexNowKey, indexNowBody, indexNowKeyFor, submitIndexNow } from "@/lib/seo-indexnow";
import { allPolicyPages } from "@/blueprint/policy-pages";

const bp = blueprintSchema.parse({ ...defaultBlueprint({ name: "نور", industry: "fashion" } as never) });
const loc = seoLocale(bp);

describe("seo-meta", () => {
  it("اسم المتجر أول العنوان دائماً", () => {
    expect(nameFirst("أفضل أحذية في مصر", "نور")).toBe("نور | أفضل أحذية في مصر");
    expect(nameFirst("أفضل أحذية - نور", "نور")).toBe("نور | أفضل أحذية");
    expect(nameFirst("نور للأزياء", "نور")).toBe("نور للأزياء");
    expect(homeTitle({ brand: { ...bp.brand, name: "نور", tagline: undefined }, seo: bp.seo }, ["ملابس", "أحذية", "حقائب"])).toBe("نور | ملابس، أحذية");
  });
  it("لا يكرر اسم المتجر ويحترم الحد", () => {
    expect(composeTitle("قميص نور", "نور")).toBe("قميص نور");
    expect(composeTitle("قميص", "نور")).toBe("قميص | نور");
    expect(composeTitle("ك".repeat(100), "نور").length).toBeLessThanOrEqual(70);
  });
  it("وصف الرئيسية من بيانات المتجر", () => {
    const d = homeDescription({ brand: { ...bp.brand, description: undefined, tagline: undefined }, seo: bp.seo }, { categoryNames: ["ملابس"] });
    expect(d).toContain("ملابس");
    expect(d.length).toBeLessThanOrEqual(160);
  });
  it("وصف المنتج يضيف السعر", () => {
    const d = productDescription({ name: "قميص", pricePiasters: 25000, shortDescription: "قميص قطن مريح." }, { siteName: "نور", currency: "EGP" });
    expect(d).toContain("قميص قطن مريح");
    expect(d).toContain("250");
  });
  it("معاملات التتبع لا تجعل الصفحة مفلترة", () => {
    expect(isFilteredQuery({ utm_source: "ig", fbclid: "x", promo: "A" })).toBe(false);
    expect(isFilteredQuery({ sort: "price" })).toBe(true);
  });
  it("hreflang من locale", () => {
    expect(pageAlternates("/", { language: "ar", country: "SA", currency: "SAR" }).languages["ar-SA"]).toBe("/");
    expect(clipText("كلمة ".repeat(60), 50).endsWith("…")).toBe(true);
    expect(preconnectOrigin("https://cdn.x.com/a.jpg", "https://s.colapia.com")).toBe("https://cdn.x.com");
    expect(preconnectOrigin("/a.jpg", "https://s.colapia.com")).toBeUndefined();
  });
});

describe("seo-schema", () => {
  const site = siteFromBlueprint(bp, "https://nour.colapia.com", loc);
  it("المنتج: لا تقييم بلا تقييمات حقيقية، وعرض مفرد", () => {
    const n = productNode(site, { name: "قميص", url: "https://nour.colapia.com/p/x", images: [], pricePiasters: 10000, available: true });
    expect(n.aggregateRating).toBeUndefined();
    expect(n.review).toBeUndefined();
    expect((n.offers as { price: string }).price).toBe("100.00");
  });
  it("المنتج: تقييم ومراجعات وAggregateOffer", () => {
    const n = productNode(site, { name: "قميص", url: "https://x/p", images: ["https://x/a.jpg"], pricePiasters: 10000, priceRange: { low: 10000, high: 15000, count: 3 }, available: false, rating: { avg: 4.5, count: 2 }, reviews: [{ author: "منى", rating: 5, body: "ممتاز", date: "2026-01-02" }, { author: "", rating: 5 }, { author: "س", rating: 9 }] });
    expect((n.offers as { "@type": string })["@type"]).toBe("AggregateOffer");
    expect((n.aggregateRating as { reviewCount: number }).reviewCount).toBe(2);
    expect((n.review as unknown[]).length).toBe(1);
    expect(JSON.stringify(n.offers)).toContain("OutOfStock");
  });
  it("الشحن والاسترجاع من السياسة فقط", () => {
    expect(shippingDetailsNode({ ...bp.shipping, freeOverPiasters: null, flatRatePiasters: null }, 5000, loc)).toBeUndefined();
    const free = shippingDetailsNode({ ...bp.shipping, freeOverPiasters: 0, generalEta: "من ٢ إلى ٤ أيام" }, 5000, loc) as { shippingRate: { value: number }; deliveryTime: { transitTime: { maxValue: number } } };
    expect(free.shippingRate.value).toBe(0);
    expect(free.deliveryTime.transitTime.maxValue).toBe(4);
    expect(transitDays("بدون أرقام")).toBeNull();
    expect(returnPolicyNode({ ...bp.returns, windowDays: 0 }, "EG")).toBeUndefined();
    expect((returnPolicyNode({ ...bp.returns, windowDays: 14, allowRefund: true }, "EG") as { merchantReturnDays: number }).merchantReturnDays).toBe(14);
  });
  it("منطقة الخدمة من locale لا ثابتة", () => {
    const s = onlineStoreNode({ ...site, locale: { language: "ar", country: "SA", currency: "SAR" } });
    expect(JSON.stringify(s)).toContain("SAR");
    expect((s.areaServed as { name: string }).name).not.toBe("EG");
  });
  it("الرسم البياني يسقط الفارغ", () => {
    const g = ldGraph(breadcrumbNode([{ name: "أ", url: "https://x/" }]), faqNode([]), null) as { "@graph": unknown[] };
    expect(g["@graph"].length).toBe(1);
    expect(faqNode([{ q: "س؟", a: "ج" }], { speakable: true })?.speakable).toBeDefined();
  });
});

describe("AEO وllms", () => {
  const answers = storeAnswers(bp);
  it("إجابات من السياسة، أولها جواب مباشر", () => {
    const ids = answers.map((a) => a.id);
    expect(ids).toContain("delivery-time");
    expect(ids).toContain("payment");
    expect(answers.find((a) => a.id === "delivery-time")!.a).toContain(bp.shipping.generalEta);
    expect(storeAnswers({ ...bp, shipping: { ...bp.shipping, pickupEnabled: false } }).some((a) => a.id === "pickup")).toBe(false);
  });
  it("صفحة faq مولَّدة ومرئية في الفوتر", () => {
    expect(allPolicyPages(bp).some((p) => p.slug === "faq")).toBe(true);
  });
  const input = {
    site: { name: "نور", url: "https://nour.colapia.com/", description: "متجر", language: "ar", country: "EG", currency: "EGP" },
    contact: ["واتساب: 01012345678"],
    categories: [{ name: "قمصان [جديد]", url: "https://nour.colapia.com/c/a", productCount: 2 }],
    products: [{ name: "قميص", url: "https://nour.colapia.com/p/a", priceLabel: "100 ج.م", description: "وصف", available: true }],
    answers,
    pages: [{ title: "الشحن", url: "https://nour.colapia.com/pages/shipping" }],
    links: { sitemap: "https://nour.colapia.com/sitemap.xml", full: "https://nour.colapia.com/llms-full.txt" },
  };
  it("llms.txt بالصيغة المعيارية", () => {
    const t = renderLlmsTxt(input);
    expect(t.startsWith("# نور\n\n> متجر")).toBe(true);
    expect(t).toContain("## أهم المنتجات");
    expect(t).toContain("## Optional");
    expect(t).not.toContain("[جديد]");
    expect(renderLlmsFull(input)).toContain("### ");
  });
});

describe("robots وsitemap", () => {
  it("المتجر الظاهر يسمح لزواحف الذكاء الاصطناعي ويمنع الخاص", () => {
    const r = storeRobots({ indexable: true, sitemapUrl: "https://x/sitemap.xml" });
    const rules = r.rules as { userAgent: string | string[]; disallow?: string[] }[];
    expect(rules.length).toBe(2);
    expect((rules[1]!.userAgent as string[])).toContain(AI_CRAWLERS[0]);
    expect(rules[0]!.disallow).toContain("/checkout");
    expect(storeRobots({ indexable: false }).rules).toEqual({ userAgent: "*", disallow: "/" });
  });
  it("خريطة الموقع: صور وأولويات وآخر تعديل حقيقي", () => {
    const d = new Date("2026-03-01T00:00:00Z");
    const s = buildStoreSitemap({
      url: (p) => `https://x.test${p}`,
      products: [{ slug: "a b", updatedAt: d, images: ["https://i.test/1.jpg", "data:x"], featured: true, categoryId: "c1" }],
      categories: [{ id: "c1", slug: "c", productCount: 1 }, { id: "c2", slug: "empty", productCount: 0 }],
      pages: [{ slug: "faq" }, { slug: "terms" }],
    });
    expect(s[0]!.priority).toBe(1);
    expect(s[0]!.lastModified).toEqual(d);
    expect(s.some((e) => e.url.includes("empty"))).toBe(false);
    const p = s.find((e) => e.url.includes("/p/"))!;
    expect(p.url).toBe("https://x.test/p/a%20b");
    expect(p.images).toEqual(["https://i.test/1.jpg"]);
    expect(s.find((e) => e.url.endsWith("/pages/faq"))!.priority).toBeGreaterThan(s.find((e) => e.url.endsWith("/pages/terms"))!.priority!);
  });
});

describe("IndexNow", () => {
  it("معطّل بلا إعداد", async () => {
    expect(await indexNowKeyFor("s1", {})).toBeNull();
    expect((await submitIndexNow({ storeId: "s1", host: "x.test", urls: ["https://x.test/p/a"], env: {} })).reason).toBe("disabled");
  });
  it("مفتاح ثابت أو مشتق لكل متجر", async () => {
    expect(await indexNowKeyFor("s1", { INDEXNOW_KEY: "abcdefgh12345678" })).toBe("abcdefgh12345678");
    expect(await indexNowKeyFor("s1", { INDEXNOW_KEY: "bad key" })).toBeNull();
    const a = await deriveIndexNowKey("secret", "s1");
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(a).not.toBe(await deriveIndexNowKey("secret", "s2"));
  });
  it("الجسم يقبل روابط المضيف نفسه فقط", () => {
    const b = indexNowBody({ host: "x.test", key: "k".repeat(10), urls: ["https://x.test/a", "https://x.test/a", "https://evil.test/b", "nope"] });
    expect(b.urlList).toEqual(["https://x.test/a"]);
    expect(b.keyLocation).toBe("https://x.test/indexnow-key.txt");
  });
  it("يرسل عبر fetcher ولا يرمي عند الفشل", async () => {
    const ok = await submitIndexNow({ storeId: "s", host: "x.test", urls: ["https://x.test/a"], env: { INDEXNOW_KEY: "abcdefgh12345678" }, fetcher: (async () => new Response(null, { status: 200 })) as typeof fetch });
    expect(ok.sent).toBe(true);
    const bad = await submitIndexNow({ storeId: "s", host: "x.test", urls: ["https://x.test/a"], env: { INDEXNOW_KEY: "abcdefgh12345678" }, fetcher: (async () => { throw new Error("x"); }) as typeof fetch });
    expect(bad.sent).toBe(false);
  });
});
