// env.ts — متغيرات بيئة هذا المشروع. المطلوب لتشغيل المتجر واحد فقط: DATABASE_URL (قاعدة Neon). الباقي اختياري
// ويُفعّل ميزة بعينها (ImageKit لرفع الصور، GROQ_API_KEY للميزات الذكية، RESEND_API_KEY للبريد).
// تُقرأ القيم عند كل استخدام من process.env (على Cloudflare تُملأ المتغيرات عند أول طلب، لا عند تحميل الوحدة).
import { createHash } from "node:crypto";
import { STORE } from "@/store.config";

/** مفتاح يلصقه المالك بيده: يُقبل كما يُنسخ (مسافات، تنصيص، «NAME=قيمة»، «Bearer …») والقيمة النظيفة هي ما يُستخدم. */
export function cleanSecretValue(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  let s = v.trim();
  s = s.replace(/^export\s+/i, "").replace(/^[A-Z][A-Z0-9_]*\s*=\s*/, "").trim();
  s = s.replace(/^(['"`])([\s\S]*)\1$/, "$2").trim();
  s = s.replace(/^Bearer\s+/i, "").replace(/\s+/g, "");
  return s || undefined;
}

const isPostgres = (v: string | undefined): v is string => typeof v === "string" && /^postgres(ql)?:\/\//i.test(v.trim());

/** رابط القاعدة: DATABASE_URL أولاً ثم الأسماء الشائعة التي تضيفها Neon. */
export function resolveDatabaseUrl(source: Record<string, string | undefined> = process.env): string {
  for (const k of ["DATABASE_URL", "POSTGRES_URL", "NEON_DATABASE_URL"]) {
    if (isPostgres(source[k])) return source[k]!.trim();
  }
  return "";
}

/** عنوان الموقع العام (بلا / أخيرة): APP_URL ثم NEXT_PUBLIC_APP_URL. فارغ إن لم يُضبط بعد. */
export function siteOrigin(): string {
  const raw = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "").trim().replace(/\/+$/, "");
  return /^https?:\/\//i.test(raw) ? raw : "";
}

function authSecret(): string {
  const explicit = process.env.AUTH_SECRET?.trim();
  if (explicit && explicit.length >= 32) return explicit;
  // مشتق ثابتاً من رابط قاعدتك (سري أصلاً): يبقى واحداً في كل نسخ الخادم دون ضبط متغير إضافي.
  return createHash("sha256").update(`store-auth:${STORE.slug}:${resolveDatabaseUrl() || "local-dev"}`).digest("base64url");
}

type Env = {
  NODE_ENV: "development" | "test" | "production";
  DATABASE_URL: string;
  AUTH_SECRET: string;
  ROOT_DOMAIN: string;
  RESEND_API_KEY: string;
  EMAIL_FROM: string;
  GROQ_API_KEY: string;
  OWNER_ALERT_EMAILS: string;
  PLATFORM_OWNER_EMAILS: string;
  [key: string]: string | undefined;
};

const derived: Record<string, () => string | undefined> = {
  NODE_ENV: () => process.env.NODE_ENV ?? "production",
  DATABASE_URL: resolveDatabaseUrl,
  AUTH_SECRET: authSecret,
  ROOT_DOMAIN: () => (siteOrigin() ? new URL(siteOrigin()).host : "localhost:3000"),
  GROQ_API_KEY: () => cleanSecretValue(process.env.GROQ_API_KEY) ?? "",
  RESEND_API_KEY: () => cleanSecretValue(process.env.RESEND_API_KEY) ?? "",
  OWNER_ALERT_EMAILS: () => process.env.OWNER_ALERT_EMAILS?.trim() || STORE.ownerEmail,
  PLATFORM_OWNER_EMAILS: () => "",
  EMAIL_FROM: () => process.env.EMAIL_FROM?.trim() ?? "",
};

export const env: Env = new Proxy({} as Env, {
  get: (_t, key) => (typeof key === "string" ? (derived[key] ? derived[key]!() : process.env[key]) : undefined),
});

/** القيم العامة التي يقرؤها الخادم عند الطلب؛ الواجهات في المتصفح تقع على window.location إن لم يُضبط APP_URL. */
export const clientEnv = {
  get NEXT_PUBLIC_APP_URL(): string {
    return siteOrigin() || "http://localhost:3000";
  },
  get NEXT_PUBLIC_ROOT_DOMAIN(): string {
    return new URL(siteOrigin() || "http://localhost:3000").host;
  },
};

/** بريد صاحب المتجر (ومن يضيفه OWNER_ALERT_EMAILS) لتنبيهات الطلبات. */
export function getOwnerAlertEmails(): string[] {
  return Array.from(
    new Set(
      (env.OWNER_ALERT_EMAILS ?? "")
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter((e) => e.includes("@"))
    )
  );
}

export function getPlatformOwnerEmails(): string[] {
  return [];
}
