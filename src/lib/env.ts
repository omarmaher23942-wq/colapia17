import { z } from "zod";

const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url(),
  UPLOADTHING_TOKEN: z.string().min(10),

  MORPHEUS_API_KEY: z.string().min(1),
  MORPHEUS_BASE_URL: z.string().url().default("https://api.mor.org/api/v1"),
  CLAUDE_MODEL: z.string().default("claude-sonnet-4.5"),
  CLAUDE_OPUS_MODEL: z.string().default("claude-opus-4.1"),
  GROQ_API_KEY: z.string().min(1),
  GROQ_MODEL: z.string().default("llama-3.3-70b-versatile"),
  GROQ_WHISPER_MODEL: z.string().default("whisper-large-v3-turbo"),
  GEMINI_API_KEY: z.string().min(1),
  GEMINI_MODEL: z.string().default("gemini-3.8-flash"),

  META_APP_ID: z.string().optional(),
  META_APP_SECRET: z.string().optional(),
  META_GRAPH_VERSION: z.string().default("v21.0"),
  META_VERIFY_TOKEN: z.string().optional(),
  META_PAGE_ACCESS_TOKEN: z.string().optional(),
  META_INSTAGRAM_ACCESS_TOKEN: z.string().optional(),
  META_PAGE_ID: z.string().optional(),
  META_IG_ID: z.string().optional(),

  UPSTASH_REDIS_REST_URL: z.string().url(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1),
  QSTASH_URL: z.string().url().default("https://qstash-us-east-1.upstash.io"),
  QSTASH_TOKEN: z.string().min(1),
  QSTASH_CURRENT_SIGNING_KEY: z.string().min(1),
  QSTASH_NEXT_SIGNING_KEY: z.string().min(1),
  QSTASH_INTERNAL_SECRET: z.string().min(16),

  VODAFONE_CASH_NUMBER: z.string().regex(/^01[0125]\d{8}$/),
  INSTAPAY_NUMBER: z.string().regex(/^01[0125]\d{8}$/),

  PLATFORM_BASE_PRICE_EGP: z.coerce.number().int().positive().default(8999),
  PLATFORM_PRICE_EGP: z.coerce.number().int().positive().default(899),

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
const serverParsed = isServer
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