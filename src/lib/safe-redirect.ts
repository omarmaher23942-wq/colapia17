// safe-redirect.ts — وجهة إعادة التوجيه الداخلية الآمنة (خالص ومختبَر): مسار نسبي على موقعنا فقط.
// المتصفح و WHATWG URL يعاملان «/\evil.com» كـ «//evil.com»، وعلامات التحكم تُخفي نطاقاً بعد الشرطة، فتُرفض كلها.
export function safeInternalPath(input: unknown, fallback: string, opts: { prefix?: string } = {}): string {
  if (typeof input !== "string") return fallback;
  const v = input.trim();
  if (!v.startsWith("/") || v.startsWith("//") || v.length > 512) return fallback;
  if (v.includes("\\") || /[\u0000-\u001f\u007f]/.test(v)) return fallback;
  if (opts.prefix && !(v === opts.prefix || v.startsWith(`${opts.prefix}/`) || v.startsWith(`${opts.prefix}?`) || v.startsWith(`${opts.prefix}#`))) return fallback;
  return v;
}
