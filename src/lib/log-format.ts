// log-format.ts — سطر سجل JSON منظّم بمعرّف الطلب مع إخفاء الأسرار (خالص ومختبَر؛ يستخدمه logger.ts).
const SECRET_KEY = /(pass(word)?|secret|token|authorization|api[-_]?key|cookie|signature|otp|code_hash)/i;
const SECRET_VALUE: RegExp[] = [
  /\bgsk_[A-Za-z0-9]{16,}\b/g,
  /\bAIza[0-9A-Za-z_-]{20,}\b/g,
  /\bsk-[A-Za-z0-9_-]{20,}\b/g,
  /\bghp_[A-Za-z0-9]{20,}\b/g,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g,
  /\bre_[A-Za-z0-9]{20,}\b/g,
  /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}/gi,
  /\b(postgres(?:ql)?:\/\/)[^\s"']+/gi,
];

export function redactText(s: string): string {
  let out = s;
  for (const re of SECRET_VALUE) out = out.replace(re, (m) => (m.toLowerCase().startsWith("postgres") ? "postgres://[محجوب]" : "[محجوب]"));
  return out;
}

/** ينسخ القيمة مع إخفاء المفاتيح الحساسة والقيم الشبيهة بالأسرار، بعمق محدود. */
export function redact(v: unknown, depth = 4): unknown {
  if (typeof v === "string") return redactText(v).slice(0, 2000);
  if (v === null || typeof v !== "object") return v;
  if (depth <= 0) return "[مقطوع]";
  if (Array.isArray(v)) return v.slice(0, 50).map((x) => redact(x, depth - 1));
  const out: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>).slice(0, 60)) out[k] = SECRET_KEY.test(k) ? "[محجوب]" : redact(val, depth - 1);
  return out;
}

export type LogLine = { t: string; level: string; scope: string; event: string; req: string; msg?: string; ctx?: Record<string, unknown> };

/** سطر JSON واحد (يسهل البحث فيه في سجلات الاستضافة). */
export function formatLogLine(i: { level: string; scope: string; event: string; reqId: string; message?: string; ctx?: Record<string, unknown>; at?: Date }): string {
  const line: LogLine = { t: (i.at ?? new Date()).toISOString(), level: i.level, scope: i.scope, event: i.event, req: i.reqId };
  if (i.message) line.msg = redactText(i.message).slice(0, 500);
  if (i.ctx && Object.keys(i.ctx).length) line.ctx = redact(i.ctx) as Record<string, unknown>;
  return JSON.stringify(line);
}
