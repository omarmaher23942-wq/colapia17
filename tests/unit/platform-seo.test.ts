// اختبارات سيو المنصة وصدق نصوصها (V4): عنوان الكيان، البيانات المنظمة، robots وsitemap وllms.txt، وغياب العبارات الممنوعة.
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ABOUT, BRAND, FAQ, SERVICES, SITE_DESCRIPTION, WORKS, allCopy } from "@/lib/landing-content";
import { indexNowPayload, platformIndexNowUrls } from "@/lib/platform-indexnow";
import {
  AI_CRAWLERS,
  INDEXNOW_KEY,
  PLATFORM_DISALLOW,
  SITE_TITLE,
  demoOrigin,
  graphFor,
  jsonLdText,
  llmsFullTxt,
  llmsTxt,
  pageMetadata,
  platformRobots,
  platformSitemap,
  siteOrigin,
} from "@/lib/platform-seo";

const O = "https://colapia.com";

describe("هوية الكيان والميتاداتا", () => {
  it("العنوان يبدأ بالاسم الكامل وبطول معقول، والوصف ضمن الحد", () => {
    expect(SITE_TITLE.startsWith("Colapia | كولابيا")).toBe(true);
    expect(SITE_TITLE.length).toBeLessThanOrEqual(70);
    expect(SITE_DESCRIPTION.length).toBeLessThanOrEqual(170);
    expect(ABOUT.lead.length).toBeLessThanOrEqual(220);
  });

  it("كل صفحة: canonical مطلق وhreflang ar-EG وx-default وOpen Graph بالعربية المصرية", () => {
    const m = pageMetadata("work", { title: "أعمالنا", description: "وصف", origin: O });
    expect(m.alternates?.canonical).toBe(`${O}/work`);
    expect(m.alternates?.languages).toMatchObject({ "ar-EG": `${O}/work`, "x-default": `${O}/work` });
    expect((m.openGraph as { locale?: string }).locale).toBe("ar_EG");
    expect(pageMetadata("home", { title: SITE_TITLE, description: "x", absoluteTitle: true, origin: O }).alternates?.canonical).toBe(O);
  });

  it("أصل الموقع: https للنطاق الفعلي وhttp محلياً", () => {
    expect(siteOrigin("colapia.com")).toBe("https://colapia.com");
    expect(siteOrigin("localhost:3000")).toBe("http://localhost:3000");
    expect(siteOrigin(undefined)).toBe("https://colapia.com");
    expect(demoOrigin(O)).toBe("https://demo.colapia.com");
  });
});

describe("البيانات المنظمة", () => {
  const home = graphFor("home", O) as { "@graph": Record<string, unknown>[] };
  const types = home["@graph"].flatMap((n) => [n["@type"]].flat());

  it("الرئيسية: Organization وProfessionalService وWebSite وFAQPage وBreadcrumbList", () => {
    for (const t of ["Organization", "ProfessionalService", "WebSite", "FAQPage", "BreadcrumbList", "WebPage"]) expect(types).toContain(t);
  });

  it("Organization بـ sameAs وبريد وبلد، وFAQPage بعدد الأسئلة نفسه", () => {
    const org = home["@graph"].find((n) => n["@type"] === "Organization")!;
    expect((org.sameAs as string[]).length).toBeGreaterThan(0);
    expect(org.email).toBe(BRAND.email);
    const faq = home["@graph"].find((n) => n["@type"] === "FAQPage")!;
    expect((faq.mainEntity as unknown[]).length).toBe(FAQ.length);
  });

  it("لا أسعار ولا عروض ولا تقييم نجوم مخترع في أي رسم", () => {
    for (const page of ["home", "about", "work"] as const) {
      const text = jsonLdText(graphFor(page, O));
      expect(text).not.toMatch(/"(price|priceCurrency|ratingValue|aggregateRating|reviewRating|lowPrice)"/);
    }
  });

  it("كل @id مُشار إليه موجود في الرسم نفسه (عدا المرجع للمنظمة)", () => {
    for (const page of ["home", "about", "work"] as const) {
      const g = (graphFor(page, O) as { "@graph": Record<string, unknown>[] })["@graph"];
      const ids = new Set(g.map((n) => n["@id"]));
      const refs = [...jsonLdText(g).matchAll(/\{"@id":"([^"]+)"\}/g)].map((m) => m[1]!);
      for (const r of refs) expect(ids.has(r), `${page}: ${r}`).toBe(true);
    }
  });

  it("صفحة الأعمال: دراسة حالة لكل عمل بلا اقتباس حرفي مخترع", () => {
    const g = (graphFor("work", O) as { "@graph": Record<string, unknown>[] })["@graph"];
    const studies = g.filter((n) => JSON.stringify(n["@type"]).includes("CreativeWork"));
    expect(studies.map((s) => s.name)).toEqual(WORKS.map((w) => w.name));
    expect(jsonLdText(g)).not.toContain("reviewBody");
  });

  it("النص آمن داخل وسم script (لا إغلاق مبكر)", () => {
    expect(jsonLdText({ a: "</script><b>" })).not.toContain("</script>");
  });
});

describe("robots وsitemap وllms", () => {
  it("robots يسمح لكل زواحف الذكاء الاصطناعي صراحةً ويحجب المسارات الخاصة ويشير للخريطة", () => {
    const r = platformRobots(O);
    const rules = [r.rules].flat();
    const ai = rules.find((x) => Array.isArray(x.userAgent))!;
    for (const bot of ["GPTBot", "ClaudeBot", "PerplexityBot", "Google-Extended", "OAI-SearchBot", "Applebot-Extended", "CCBot"]) expect(ai.userAgent).toContain(bot);
    expect(AI_CRAWLERS.length).toBeGreaterThanOrEqual(15);
    for (const x of rules) {
      expect(x.allow).toBe("/");
      expect(x.disallow).toEqual(PLATFORM_DISALLOW);
    }
    expect(PLATFORM_DISALLOW).toContain("/dashboard/");
    // /start و/golden لا يُحجبان: كاشف روابط ميتا يحترم robots.
    expect(PLATFORM_DISALLOW.some((p) => p.startsWith("/start") || p.startsWith("/golden"))).toBe(false);
    expect(r.sitemap).toBe(`${O}/sitemap.xml`);
  });

  it("sitemap: روابط مطلقة من الأصل نفسه تضم الرئيسية وabout وwork والقانونية بتاريخ ثابت وhreflang", () => {
    const s = platformSitemap(O);
    const urls = s.map((e) => e.url);
    expect(urls).toEqual([O, `${O}/work`, `${O}/about`, `${O}/terms`, `${O}/privacy`]);
    for (const e of s) {
      expect(e.url.startsWith(O)).toBe(true);
      expect(e.lastModified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(e.alternates?.languages).toEqual({ "ar-EG": e.url });
    }
  });

  it("llms.txt: عنوان H1 بالاسم الكامل واقتباس تعريفي وروابط كل الصفحات وأعمالنا", () => {
    const t = llmsTxt(O);
    expect(t.startsWith("# Colapia | كولابيا")).toBe(true);
    expect(t).toContain("\n> ");
    for (const p of ["/about", "/work", "/terms", "/privacy", "/data-deletion", "/llms-full.txt"]) expect(t).toContain(`${O}${p}`);
    expect(t).toContain("https://demo.colapia.com");
    for (const w of WORKS) expect(t).toContain(w.name);
  });

  it("llms-full.txt: كل الخدمات وكل الأسئلة بإجاباتها", () => {
    const t = llmsFullTxt(O);
    for (const s of SERVICES) expect(t).toContain(s.title);
    for (const f of FAQ) {
      expect(t).toContain(f.q);
      expect(t).toContain(f.a);
    }
  });
});

describe("صدق النصوص وقواعد المالك للهبوط", () => {
  const copy = allCopy().join("\n");

  it("12 سؤالاً بإجابات مباشرة قصيرة تبدأ بالجواب", () => {
    expect(FAQ).toHaveLength(12);
    for (const f of FAQ) {
      expect(f.q.endsWith("؟")).toBe(true);
      expect(f.a.length).toBeGreaterThan(40);
      expect(f.a.length).toBeLessThanOrEqual(330);
    }
  });

  it("بلا أسعار ولا عروض ولا استضافة ولا اشتراكات ولا تجربة ولا خطط مستقبلية", () => {
    const banned = [
      "ج.م", "جنيه", "الدائرة الذهبية", "استضافة", "اشتراك", "شهري", "تجربة مجانية", "الباقة", "باقات", "عمولة",
      "مساعد صوتي", "الخليج", "أمريكا", "أوروبا", "قريباً", "مستقبلاً",
    ];
    for (const w of banned) expect(copy, w).not.toContain(w);
    expect(copy).not.toMatch(/\d{3,}\s*(ج|جنيه|EGP)/);
  });

  it("لا يُنسب البناء للذكاء الاصطناعي ولا أسماء تقنيات ولا تحديد صريح لمتاجر إنستجرام", () => {
    const banned = ["الذكاء الاصطناعي", "Claude", "Groq", "Neon", "Cloudflare", "Vercel", "ImageKit", "GitHub", "Next.js", "متاجر إنستجرام", "براندات إنستجرام", "للبراندات"];
    for (const w of banned) expect(copy, w).not.toContain(w);
  });

  it("رابط البدء هو محادثة إنستجرام الفعلية، وصورة Qima موجودة فعلاً في public", () => {
    expect(BRAND.igDm).toBe("https://ig.me/m/colapia");
    for (const w of WORKS) if (w.image) expect(existsSync(`public${w.image.src}`)).toBe(true);
  });
});

describe("IndexNow", () => {
  it("ملف المفتاح في public يطابق المفتاح بلا أسطر زائدة", () => {
    expect(readFileSync(`public/${INDEXNOW_KEY}.txt`, "utf8")).toBe(INDEXNOW_KEY);
  });

  it("الحمولة: روابط من النطاق نفسه فقط بلا تكرار ومع موقع ملف المفتاح", () => {
    const p = indexNowPayload(O, [O, `${O}/about`, `${O}/about`, "https://other.com/x", "http://colapia.com/y", "ليس رابطاً"]);
    expect(p).toEqual({ host: "colapia.com", key: INDEXNOW_KEY, keyLocation: `${O}/${INDEXNOW_KEY}.txt`, urlList: [O, `${O}/about`] });
    expect(platformIndexNowUrls(O)).toEqual(platformSitemap(O).map((e) => e.url));
  });
});
