import "server-only";
// tokens.ts — روابط طلب المتجر السرية. يُخزَّن في القاعدة تجزئتها فقط.
//
// - رابط التعديل لزائر الويب: عشوائي (192 بت).
// - روابط مشتقة بـ HMAC من سر المنصة: رابط المتابعة (من معرّف الطلب)، ورابط مسودة محادثة الوكيل (من معرّف
//   المحادثة)، ورابط تأكيد البريد. الاشتقاق يسمح بإعادة إرسال نفس الرابط (من اللوحة أو الوكيل) دون إلغاء القديم
//   ودون تخزين الرابط نفسه.
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

export const randomToken = (): string => randomBytes(24).toString("base64url");

export const hashToken = (token: string): string => createHash("sha256").update(token).digest("hex");

export const isWellFormedToken = (t: unknown): t is string => typeof t === "string" && /^[A-Za-z0-9_-]{32}$/.test(t);

type Purpose = "track" | "agent-draft" | "confirm";

export function derivedToken(purpose: Purpose, id: string): string {
  return createHmac("sha256", env.AUTH_SECRET).update(`intake:${purpose}:${id}`).digest("base64url").slice(0, 32);
}

export function derivedTokenMatches(purpose: Purpose, id: string, token: unknown): boolean {
  if (!isWellFormedToken(token)) return false;
  const a = Buffer.from(derivedToken(purpose, id));
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** تجزئة عنوان IP بسر المنصة (للتحليل والحدود، لا يُخزَّن العنوان نفسه). */
export const hashIp = (ip: string): string => createHmac("sha256", env.AUTH_SECRET).update(`ip:${ip}`).digest("hex").slice(0, 32);
