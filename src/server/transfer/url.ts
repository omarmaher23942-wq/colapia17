// url.ts — التحقق من رابط قاعدة العميل (خالص). Postgres فقط، SSL إلزامي، ولا مضيفات خاصة أو محلية.

export type UrlCheck = { ok: true; url: string; host: string } | { ok: false; error: string };

const PRIVATE_V4 = [/^10\./, /^127\./, /^169\.254\./, /^192\.168\./, /^172\.(1[6-9]|2\d|3[01])\./, /^0\./, /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./];

export function isPrivateHost(hostRaw: string): boolean {
  const h = hostRaw.toLowerCase().replace(/^\[|\]$/g, "");
  if (!h || h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal") || h.endsWith(".lan")) return true;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) return PRIVATE_V4.some((r) => r.test(h));
  if (h.includes(":")) return true; // عناوين IPv6 الحرفية لا تُقبل
  if (/^\d+$/.test(h) || /^0x[0-9a-f]+$/i.test(h)) return true; // صيغ رقمية ملتبسة للعنوان
  return !h.includes(".");
}

/** يقبل postgres:// أو postgresql:// بمضيف Neon عام وبوضع ssl. يعيد الرابط منظفاً. */
export function validateDatabaseUrl(raw: unknown): UrlCheck {
  const text = typeof raw === "string" ? raw.trim().replace(/^psql\s+/i, "").replace(/^['"]+|['"]+$/g, "").trim() : "";
  if (!text) return { ok: false, error: "الصقوا رابط قاعدة البيانات أولاً." };
  let u: URL;
  try {
    u = new URL(text);
  } catch {
    return { ok: false, error: "الرابط غير صالح. يبدأ رابط القاعدة بـ postgresql:// ويُنسخ كاملاً من لوحة Neon." };
  }
  if (u.protocol !== "postgres:" && u.protocol !== "postgresql:") return { ok: false, error: "نقبل روابط PostgreSQL فقط (تبدأ بـ postgresql://)." };
  if (!u.username || !u.password) return { ok: false, error: "الرابط ناقص: يلزم اسم المستخدم وكلمة المرور كما في لوحة Neon." };
  if (isPrivateHost(u.hostname)) return { ok: false, error: "مضيف القاعدة غير مقبول. استخدموا رابط Neon العام." };
  if (!/(^|\.)neon\.(tech|build)$/i.test(u.hostname)) return { ok: false, error: "النقل مدعوم حالياً إلى قواعد Neon فقط (مضيف ينتهي بـ neon.tech)." };
  const ssl = u.searchParams.get("sslmode");
  if (ssl && !["require", "verify-full", "verify-ca"].includes(ssl)) return { ok: false, error: "يلزم اتصال مشفّر (sslmode=require)." };
  if (u.port && u.port !== "5432") return { ok: false, error: "منفذ غير مقبول. استخدموا الرابط كما تعرضه لوحة Neon." };
  if (!ssl) u.searchParams.set("sslmode", "require");
  return { ok: true, url: u.toString(), host: u.hostname };
}

/** نص خطأ آمن للعرض والسجل: يحذف أي رابط أو كلمة مرور قد يحملها. */
export function safeError(e: unknown): string {
  const msg = String((e as { message?: unknown })?.message ?? e ?? "");
  return msg
    .replace(/postgres(?:ql)?:\/\/\S+/gi, "[رابط]")
    .replace(/password[^,;\n]*/gi, "[سر]")
    .slice(0, 300);
}

export function hostHint(host: string): string {
  const parts = host.split(".");
  const first = parts[0] ?? "";
  return `${first.slice(0, 6)}…${parts.slice(-2).join(".")}`;
}
