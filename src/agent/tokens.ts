import "server-only";
// tokens.ts — روابط الوكيل السرية المشتقة بـ HMAC من سر المنصة: تُعاد إرسالها دون تخزينها. الشكل «<معرّف المتجر مضغوطاً>.<توقيع>»:
// المعرّف عشوائي لا يُخمَّن، والتوقيع يمنع اختلاق رابط لمتجر آخر. التحقق يعيد معرّف المتجر.
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

type Purpose = "setup";

const TOKEN_RE = /^([0-9a-f]{32})\.([A-Za-z0-9_-]{22})$/;
const sign = (purpose: Purpose, compact: string) => createHmac("sha256", env.AUTH_SECRET).update(`agent:${purpose}:${compact}`).digest("base64url").slice(0, 22);

export function derivedToken(purpose: Purpose, id: string): string {
  const compact = id.replace(/-/g, "").toLowerCase();
  return `${compact}.${sign(purpose, compact)}`;
}

/** معرّف المتجر من الرمز إن كان التوقيع سليماً، وإلا null. */
export function verifyDerivedToken(purpose: Purpose, token: unknown): string | null {
  if (typeof token !== "string") return null;
  const m = TOKEN_RE.exec(token);
  if (!m) return null;
  const a = Buffer.from(sign(purpose, m[1]!));
  const b = Buffer.from(m[2]!);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const c = m[1]!;
  return `${c.slice(0, 8)}-${c.slice(8, 12)}-${c.slice(12, 16)}-${c.slice(16, 20)}-${c.slice(20)}`;
}

/** رابط الإعداد الذي يصل التاجر (المنصة على النطاق الرئيسي، لا على نطاق المتجر). */
export function setupLink(storeId: string): string {
  const root = (env.ROOT_DOMAIN || "").trim();
  const origin = !root || root.startsWith("localhost") ? "http://localhost:3100" : `https://${root}`;
  return `${origin}/setup?t=${derivedToken("setup", storeId)}`;
}
