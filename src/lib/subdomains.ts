/**
 * نطاقات فرعية محجوزة لا يُسمح لأي متجر باستخدامها.
 * ملف مستقل بدون تبعيات حتى يستورده الـ middleware (Edge) وكود السيرفر معًا.
 */
export const RESERVED_SUBDOMAINS = new Set([
  "www", "admin", "api", "app", "mail", "cdn", "static", "assets", "help", "docs", "status",
  "colapia", "support", "blog", "dev", "staging", "test", "dashboard", "auth", "login",
  // مضيفات الملفات والفيديو (media.<النطاق> يخدم صور المتاجر من R2).
  "demo", "setup", "start", "onboarding",
  "media", "img", "images", "files", "uploads", "video", "videos", "stream",
]);

/** متجر العرض التجريبي (demo.colapia.com): محجوز عن التجار لكن الوسيط يخدمه كمتجر عادي. */
export const DEMO_SUBDOMAIN = "demo";

export function isReservedSubdomain(sub: string): boolean {
  return RESERVED_SUBDOMAINS.has(sub.trim().toLowerCase());
}

/** صيغة النطاق الفرعي للمتجر: 3–30 حرفاً لاتينياً صغيراً وأرقاماً وشرطات، لا تبدأ ولا تنتهي بشرطة ولا شرطتان متتاليتان. */
export const SUBDOMAIN_RE = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;

export function isValidSubdomain(sub: string): boolean {
  return SUBDOMAIN_RE.test(sub) && !sub.includes("--") && !isReservedSubdomain(sub);
}
