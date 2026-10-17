// signed-token.ts — رموز HMAC قصيرة لروابط الطلبات (خالصة: السر يُمرَّر). تُستخدم لـ«رابط طلباتي» الموقّع.
import { createHmac, timingSafeEqual } from "node:crypto";

export function signParts(secret: string, scope: string, ...parts: string[]): string {
  return createHmac("sha256", secret).update(`${scope}:${parts.join(":")}`).digest("base64url").slice(0, 32);
}

export function verifyParts(secret: string, token: string | null | undefined, scope: string, ...parts: string[]): boolean {
  if (!token || token.length > 64) return false;
  const expected = Buffer.from(signParts(secret, scope, ...parts));
  const received = Buffer.from(token);
  return received.length === expected.length && timingSafeEqual(received, expected);
}

/** معرّف جهاز عشوائي من الخادم (لا بصمة): d- ثم 32 خانة ست عشرية. */
export const DEVICE_ID_RE = /^d-[0-9a-f]{32}$/;
export const newDeviceId = () => `d-${crypto.randomUUID().replace(/-/g, "")}`;
