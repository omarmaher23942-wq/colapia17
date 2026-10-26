// link-token.ts — روابط سرية موقّعة بـ HMAC تُعاد توليدها دون تخزين (خالص: السر يُمرَّر ولا يُقرأ من البيئة).
// الشكل: «<معرّف مضغوط>.<انتهاء بالثواني base36>.<توقيع>». التوقيع يغطي الغرض والمعرّف والانتهاء وبصمة اختيارية (fp):
//  - رابط الإعداد (setup): 14 يوماً، وبصمته فارغة؛ يُرفض بعد تعيين كلمة المرور من الخادم (حالة التاجر لا الرمز).
//  - رابط إعادة التعيين (reset): يومان، وبصمته جزء من تجزئة كلمة المرور الحالية فيبطل بمجرد تغييرها (لمرة واحدة).
import { createHmac, timingSafeEqual } from "node:crypto";

export type LinkPurpose = "setup" | "reset";

export const LINK_TTL_DAYS: Record<LinkPurpose, number> = { setup: 14, reset: 2 };

const TOKEN_RE = /^([0-9a-f]{32})\.([0-9a-z]{1,10})\.([A-Za-z0-9_-]{22})$/;

const sign = (secret: string, purpose: LinkPurpose, compact: string, exp: number, fp: string) =>
  createHmac("sha256", secret).update(`link:${purpose}:${compact}:${exp}:${fp}`).digest("base64url").slice(0, 22);

const toUuid = (c: string) => `${c.slice(0, 8)}-${c.slice(8, 12)}-${c.slice(12, 16)}-${c.slice(16, 20)}-${c.slice(20)}`;

export function issueLinkToken(secret: string, purpose: LinkPurpose, id: string, opts: { now?: number; fp?: string } = {}): string {
  const compact = id.replace(/-/g, "").toLowerCase();
  const exp = Math.floor(((opts.now ?? Date.now()) + LINK_TTL_DAYS[purpose] * 86_400_000) / 1000);
  return `${compact}.${exp.toString(36)}.${sign(secret, purpose, compact, exp, opts.fp ?? "")}`;
}

/** المعرّف المضمَّن في الرمز دون تحقق من التوقيع (لنعرف أي سجل نقرأ بصمته قبل التحقق). */
export function peekLinkId(token: unknown): string | null {
  if (typeof token !== "string") return null;
  const m = TOKEN_RE.exec(token);
  return m ? toUuid(m[1]!) : null;
}

export type LinkCheck = { ok: true; id: string; expiresAt: Date } | { ok: false; reason: "invalid" | "expired" };

export function checkLinkToken(secret: string, purpose: LinkPurpose, token: unknown, opts: { now?: number; fp?: string } = {}): LinkCheck {
  if (typeof token !== "string") return { ok: false, reason: "invalid" };
  const m = TOKEN_RE.exec(token);
  if (!m) return { ok: false, reason: "invalid" };
  const compact = m[1]!;
  const exp = parseInt(m[2]!, 36);
  if (!Number.isFinite(exp)) return { ok: false, reason: "invalid" };
  const want = Buffer.from(sign(secret, purpose, compact, exp, opts.fp ?? ""));
  const got = Buffer.from(m[3]!);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return { ok: false, reason: "invalid" };
  if (exp * 1000 < (opts.now ?? Date.now())) return { ok: false, reason: "expired" };
  return { ok: true, id: toUuid(compact), expiresAt: new Date(exp * 1000) };
}
