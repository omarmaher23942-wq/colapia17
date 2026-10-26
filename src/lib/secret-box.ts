// secret-box.ts — تشفير أسرار الربط (AES-256-GCM) قبل حفظها (خالص: المفتاح يُشتق من سر يُمرَّر). لا تُعاد القيمة للواجهة أبداً.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const PREFIX = "enc:v1:";
const keyFrom = (secret: string) => createHash("sha256").update(`secret-box:${secret}`).digest();

export function sealSecret(secret: string, plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", keyFrom(secret), iv);
  const body = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return PREFIX + Buffer.concat([iv, c.getAuthTag(), body]).toString("base64url");
}

/** null لقيمة بغير هذه الصيغة أو مفتاح خاطئ أو بيانات معبوث بها. */
export function openSecret(secret: string, sealed: unknown): string | null {
  if (typeof sealed !== "string" || !sealed.startsWith(PREFIX)) return null;
  try {
    const raw = Buffer.from(sealed.slice(PREFIX.length), "base64url");
    const d = createDecipheriv("aes-256-gcm", keyFrom(secret), raw.subarray(0, 12));
    d.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}
