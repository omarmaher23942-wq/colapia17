// contact.ts — تطبيع وسائل التواصل (خالص): البريد وصيغته القانونية، ورقم واتساب المصري. مصدر واحد لكل من يحتاجها.
import { normalizeEgyptianPhone } from "@/lib/phone";

export { normalizeEgyptianPhone };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** بريد صالح بحروف صغيرة، أو null. */
export const normalizeEmail = (raw: string | undefined | null): string | null => {
  const s = (raw ?? "").trim().toLowerCase();
  return EMAIL_RE.test(s) && s.length <= 120 ? s : null;
};

/**
 * صيغة موحّدة للبريد للمطابقة ومنع التكرار: تُسقط وسم `+x` ونقاط gmail، وتوحّد googlemail مع gmail
 * (a.b+1@gmail.com = ab@gmail.com). تُخزَّن في merchants.email_canonical، ولا تُرسل إليها رسائل.
 */
export function canonicalEmail(email: string): string {
  const [local = "", domain = ""] = email.trim().toLowerCase().split("@");
  const d = domain === "googlemail.com" ? "gmail.com" : domain;
  const base = local.split("+")[0] ?? local;
  return `${d === "gmail.com" ? base.replace(/\./g, "") : base}@${d}`;
}

/** يخفي وسط البريد للعرض: om***@gmail.com */
export function maskEmail(email: string): string {
  const [local = "", domain = ""] = email.split("@");
  if (!domain) return "***";
  const head = local.slice(0, Math.min(2, Math.max(1, local.length - 1)));
  return `${head}${"*".repeat(Math.max(3, local.length - head.length))}@${domain}`;
}
