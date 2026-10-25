// seo-robots.ts — robots.txt لمتجر (منطق خالص مختبَر).
// المتجر الظاهر يسمح بالفهرسة لمحركات البحث ولزواحف مساعدي الذكاء الاصطناعي صراحةً (ليقتبسوا منتجاته وسياساته)، ويمنع المسارات
// الخاصة بالزبون. غير الظاهر (قيد الإعداد أو موقوف) يمنع الجميع.
import type { MetadataRoute } from "next";

/** زواحف المساعدات والبحث الذكي المعروفة (التدريب والبحث والجلب بطلب مستخدم). */
export const AI_CRAWLERS = [
  "GPTBot",
  "ChatGPT-User",
  "OAI-SearchBot",
  "ClaudeBot",
  "Claude-User",
  "Claude-SearchBot",
  "anthropic-ai",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Applebot-Extended",
  "Amazonbot",
  "Meta-ExternalAgent",
  "Meta-ExternalFetcher",
  "DuckAssistBot",
  "MistralAI-User",
  "cohere-ai",
  "CCBot",
] as const;

/** صفحات خاصة بالزبون أو بلا محتوى للفهرسة. صفحات الفلاتر والبحث تبقى قابلة للزحف ليقرأ المحرك noindex وcanonical فيها. */
export const PRIVATE_PATHS = ["/admin/", "/cart", "/checkout", "/track", "/confirm", "/review", "/go/", "/order/", "/wishlist", "/api/"];

export function storeRobots(opts: { indexable: boolean; sitemapUrl?: string }): MetadataRoute.Robots {
  if (!opts.indexable) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: [...PRIVATE_PATHS] },
      { userAgent: [...AI_CRAWLERS], allow: "/", disallow: [...PRIVATE_PATHS] },
    ],
    sitemap: opts.sitemapUrl,
  };
}
