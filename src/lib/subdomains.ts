/**
 * نطاقات فرعية محجوزة لا يُسمح لأي متجر باستخدامها.
 * ملف مستقل بدون تبعيات حتى يستورده الـ middleware (Edge) وكود السيرفر معًا.
 */
export const RESERVED_SUBDOMAINS = new Set([
  "www", "admin", "api", "app", "mail", "cdn", "static", "assets", "help", "docs", "status",
  "colapia", "support", "blog", "dev", "staging", "test", "dashboard", "auth", "login",
]);

export function isReservedSubdomain(sub: string): boolean {
  return RESERVED_SUBDOMAINS.has(sub.trim().toLowerCase());
}
