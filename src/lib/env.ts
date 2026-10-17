import { z } from "zod";

/**
 * متغيران اختياريان يكتبهما المالك بيده في Vercel: خطأ تنسيق فيهما لا يجوز أن يوقف التطبيق كله عند الإقلاع.
 * نطبّعهما (+20 و010 1234 5678 و«الاسم <بريد>») وإن لم يصلحا يُعاملان كغير مضبوطين بدل رمي استثناء.
 */
export const optionalWhatsapp = z.preprocess((v) => {
  if (typeof v !== "string") return undefined;
  let d = v.replace(/[^\d+]/g, "").replace(/^\+/, "");
  if (d.startsWith("0020")) d = d.slice(4);
  else if (d.startsWith("20") && d.length >= 12) d = d.slice(2);
  if (d.length === 10 && d.startsWith("1")) d = `0${d}`;
  return /^01[0125]\d{8}$/.test(d) ? d : undefined;
}, z.string().optional());

export const optionalEmail = z.preprocess((v) => {
  if (typeof v !== "string") return undefined;
  const m = /<([^<>]+)>/.exec(v);
  const e = (m?.[1] ?? v).trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) ? e : undefined;
}, z.string().optional());

/**
 * مفتاح يلصقه المالك بيده: نقبله كما يُنسخ عادةً (مسافات أو سطر جديد، بين تنصيص، «NAME=قيمة»، «Bearer …»)
 * ونحفظ القيمة النظيفة. رمز Meta بحرف زائد واحد يُرفض بخطأ «could not be decrypted».
 */
export function cleanSecretValue(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  let s = v.trim();
  s = s.replace(/^export\s+/i, "").replace(/^[A-Z][A-Z0-9_]*\s*=\s*/, "").trim();
  s = s.replace(/^(['"`])([\s\S]*)\1$/, "$2").trim();
  s = s.replace(/^Bearer\s+/i, "").replace(/\s+/g, "");
  return s || undefined;
}
const optionalSecret = z.preprocess(cleanSecretValue, z.string().optional());

const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url(),
  // UploadThing مزوّد الملفات القديم: اختياري متى ضُبطت مفاتيح R2 الأربعة (server/media-host.ts يفضّل R2).
  UPLOADTHING_TOKEN: z.string().min(10).optional().or(z.literal("").transform(() => undefined)),

  MORPHEUS_API_KEY: z.preprocess(cleanSecretValue, z.string().min(1)),
  MORPHEUS_BASE_URL: z.string().url().default("https://api.mor.org/api/v1"),
  CLAUDE_MODEL: z.string().default("claude-sonnet-4.5"),
  CLAUDE_OPUS_MODEL: z.string().default("claude-opus-4.1"),
  GROQ_API_KEY: z.preprocess(cleanSecretValue, z.string().min(1)),
  GROQ_MODEL: z.string().default("llama-3.3-70b-versatile"),
  GEMINI_API_KEY: z.preprocess(cleanSecretValue, z.string().min(1)),
  GEMINI_MODEL: z.string().default("gemini-3.8-flash"),

  META_APP_ID: z.string().optional(),
  META_APP_SECRET: optionalSecret,
  META_GRAPH_VERSION: z.string().default("v21.0"),
  META_VERIFY_TOKEN: optionalSecret,
  META_PAGE_ACCESS_TOKEN: optionalSecret,
  META_INSTAGRAM_ACCESS_TOKEN: optionalSecret,
  // سر تطبيق إنستجرام (اختياري): إن كانت رسائل إنستجرام موقّعة بسر مختلف عن META_APP_SECRET (تطبيق «Instagram Login»).
  META_INSTAGRAM_APP_SECRET: optionalSecret,
  META_PAGE_ID: optionalSecret,
  META_IG_ID: optionalSecret,

  UPSTASH_REDIS_REST_URL: z.string().url(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1),
  QSTASH_URL: z.string().url().default("https://qstash-us-east-1.upstash.io"),
  QSTASH_TOKEN: z.string().min(1),
  QSTASH_CURRENT_SIGNING_KEY: z.string().min(1),
  QSTASH_NEXT_SIGNING_KEY: z.string().min(1),
  QSTASH_INTERNAL_SECRET: z.string().min(16),

  VODAFONE_CASH_NUMBER: z.string().regex(/^01[0125]\d{8}$/),
  INSTAPAY_NUMBER: z.string().regex(/^01[0125]\d{8}$/),

  /**
   * مدة التجربة النشطة (Demo Active Window) بالدقائق.
   * 480 = 8 ساعات — وهي المدة التي يرى فيها التاجر متجره حياً بعد التسليم
   * قبل أن ينتقل إلى مرحلة "بانتظار الدفع".
   */
  TRIAL_ACTIVE_MINUTES: z.coerce.number().int().positive().default(480),
  /**
   * المدة الإجمالية للتجربة قبل التجميد (24 ساعة افتراضياً).
   */
  TRIAL_HOURS: z.coerce.number().int().positive().default(24),
  GRACE_DAYS: z.coerce.number().int().positive().default(7),
  DELIVERY_SLA_HOURS: z.coerce.number().int().positive().default(1),

  ONBOARDING_LINK_TTL_DAYS: z.coerce.number().int().positive().default(7),
  PAYMENT_INVITE_DELAY_MIN: z.coerce.number().int().positive().default(30),
  DOOM_HOURS: z.coerce.number().int().positive().default(24),

  RESEND_API_KEY: z.string().min(1),
  EMAIL_FROM: z.string().default("Colapia <hello@colapia.com>"),

  // "امتلك متجرك": تطبيق GitHub OAuth للمنصة (اختياري؛ بدونه يبقى تحميل ZIP).
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),

  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),

  AUTH_SECRET: z.string().min(32),
  MAGIC_LINK_SECRET: z.string().min(32),
  ENCRYPTION_KEY: z.string().min(32),
  BOOTSTRAP_OWNER_SECRET: z.string().min(16),
  CRON_SECRET: z.string().min(16).optional(),

  ROOT_DOMAIN: z.string().min(3),

  PLATFORM_OWNER_EMAILS: z.string().default(""),
  // بريد تنبيهات المالك (إيصال دفع جديد يحتاج مراجعة). أكثر من بريد بفاصلة.
  OWNER_ALERT_EMAILS: z.string().default("omarmaher23942@gmail.com"),
  // وسيلة تواصل الوكالة التي تظهر للعميل في صفحة الشكر والمتابعة والبريد (اختيارية؛ بدونها لا يظهر زر واتساب).
  AGENCY_WHATSAPP: optionalWhatsapp,
  // عنوان الرد على بريد العميل (اختياري؛ بدونه لا يُضبط Reply-To ولا يظهر بريد المالك الشخصي للعميل).
  INTAKE_REPLY_TO: optionalEmail,
  // التجهيز الآلي: كتابة stores/<slug>/ في فرع بناء (اختياري؛ بدونه ZIP).
  STORES_GITHUB_TOKEN: z.string().min(20).optional().or(z.literal("").transform(() => undefined)),
  VERCEL_TOKEN: z.string().min(20).optional().or(z.literal("").transform(() => undefined)),
  VERCEL_PROJECT_ID: z.string().min(3).optional().or(z.literal("").transform(() => undefined)),
  VERCEL_TEAM_ID: z.string().min(3).optional().or(z.literal("").transform(() => undefined)),
  // النطاقات الخاصة على Cloudflare (Cloudflare for SaaS): توكن بصلاحية «SSL and Certificates: Edit» على منطقة colapia.com
  // ورقم المنطقة. بدونهما يبقى الربط على Vercel (VERCEL_*) أو يدوياً. CF_SAAS_TARGET = نطاق الاستقبال الذي يشير إليه العملاء.
  CF_API_TOKEN: z.string().min(20).optional().or(z.literal("").transform(() => undefined)),
  CF_ZONE_ID: z.string().regex(/^[0-9a-f]{32}$/).optional().or(z.literal("").transform(() => undefined)),
  CF_SAAS_TARGET: z.string().min(4).optional().or(z.literal("").transform(() => undefined)),
  STORES_GITHUB_REPO: z.string().regex(/^[\w.-]+\/[\w.-]+$/).optional().or(z.literal("").transform(() => undefined)),
  // Cloudflare R2 (مساحة الملفات، PLAN 14): مفاتيح API token بصلاحية Object Read & Write على الـ bucket وحده.
  R2_ACCOUNT_ID: z.string().min(8).optional().or(z.literal("").transform(() => undefined)),
  R2_ACCESS_KEY_ID: z.string().min(8).optional().or(z.literal("").transform(() => undefined)),
  R2_SECRET_ACCESS_KEY: z.string().min(16).optional().or(z.literal("").transform(() => undefined)),
  R2_BUCKET: z.string().min(3).optional().or(z.literal("").transform(() => undefined)),
  // اختياري للتطوير المحلي فقط (بديل https://<account>.r2.cloudflarestorage.com).
  R2_ENDPOINT: z.string().url().optional().or(z.literal("").transform(() => undefined)),

});

const clientSchema = z.object({
  NEXT_PUBLIC_ROOT_DOMAIN: z.string().min(3),
  NEXT_PUBLIC_APP_URL: z.string().url(),
});

const clientEnvRaw = {
  NEXT_PUBLIC_ROOT_DOMAIN: process.env.NEXT_PUBLIC_ROOT_DOMAIN,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
};

function formatErrors(err: z.ZodError) {
  return err.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
}

const clientParsed = clientSchema.safeParse(clientEnvRaw);
if (!clientParsed.success) {
  throw new Error(
    `[env] متغيرات البيئة العامة غير صحيحة:\n${formatErrors(clientParsed.error)}`
  );
}
export const clientEnv = clientParsed.data;

const isServer = typeof window === "undefined";
// البناء (next build داخل Docker على Railway أو غيره) لا يحمل الأسرار: تُقرأ وقت التشغيل فقط.
// الصفحات كلها ديناميكية، فلا يحتاج البناء قيمها. القيم العامة NEXT_PUBLIC_* وحدها تُثبَّت وقت البناء.
const isBuild = process.env.NEXT_PHASE === "phase-production-build" || process.env.SKIP_ENV_VALIDATION === "1";
const serverParsed = isServer && !isBuild
  ? serverSchema.safeParse(process.env)
  : null;
if (serverParsed && !serverParsed.success) {
  throw new Error(
    `[env] متغيرات البيئة غير صحيحة:\n${formatErrors(serverParsed.error)}`
  );
}
export const env = (serverParsed?.data ?? {}) as z.infer<typeof serverSchema>;

if (
  serverParsed?.success &&
  env.ROOT_DOMAIN.toLowerCase() !== clientEnv.NEXT_PUBLIC_ROOT_DOMAIN.toLowerCase()
) {
  console.warn(
    `[env] ROOT_DOMAIN (${env.ROOT_DOMAIN}) لا يطابق NEXT_PUBLIC_ROOT_DOMAIN (${clientEnv.NEXT_PUBLIC_ROOT_DOMAIN})`
  );
}

/** من يصله تنبيه فوري بأي إيصال دفع جديد: OWNER_ALERT_EMAILS ثم بريد المالكين. */
export function getOwnerAlertEmails(): string[] {
  return Array.from(
    new Set(
      [...(env.OWNER_ALERT_EMAILS ?? "").split(","), ...(env.PLATFORM_OWNER_EMAILS ?? "").split(",")]
        .map((e) => e.trim().toLowerCase())
        .filter((e) => e.includes("@"))
    )
  );
}

export function getPlatformOwnerEmails(): string[] {
  return (env.PLATFORM_OWNER_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0 && e.includes("@"));
}