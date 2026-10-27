// health.ts — تجميع نتيجة فحص الصحة (خالص ومختبَر). القاعدة وحدها تُسقط الجاهزية؛ الباقي يُنزلها إلى «متدهورة».
export type Probe = { ok: boolean; ms: number };
export type HealthStatus = "ok" | "degraded" | "down";

export function summarize(i: { database: Probe; redis?: Probe | null; pendingMigrations?: number | null; missingKeys?: string[] }): { status: HealthStatus; httpStatus: number; reasons: string[] } {
  const reasons: string[] = [];
  if (!i.database.ok) return { status: "down", httpStatus: 503, reasons: ["القاعدة لا تستجيب"] };
  if (i.redis && !i.redis.ok) reasons.push("الذاكرة المؤقتة لا تستجيب");
  if (i.pendingMigrations && i.pendingMigrations > 0) reasons.push(`${i.pendingMigrations} تحديث قاعدة غير مطبّق`);
  if (i.missingKeys?.length) reasons.push(`مفاتيح ناقصة: ${i.missingKeys.join("، ")}`);
  if (i.database.ms > 1500) reasons.push("القاعدة بطيئة");
  return { status: reasons.length ? "degraded" : "ok", httpStatus: 200, reasons };
}

/** المتغيرات التي بغيابها تتعطل وظيفة أساسية (أسماء فقط، بلا قيم). */
export const REQUIRED_KEYS = ["DATABASE_URL", "AUTH_SECRET", "CRON_SECRET"] as const;

export const missingKeys = (env: Record<string, string | undefined>, names: readonly string[] = REQUIRED_KEYS) => names.filter((n) => !env[n]?.trim());

/** مقارنة ثابتة الزمن لرمز الفحص العميق. */
export function tokenMatches(given: string | null | undefined, expected: string | null | undefined): boolean {
  if (!given || !expected || given.length !== expected.length) return false;
  let d = 0;
  for (let i = 0; i < given.length; i++) d |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  return d === 0;
}
