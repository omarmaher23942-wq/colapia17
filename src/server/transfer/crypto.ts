// crypto.ts — تشفير رابط قاعدة العميل (AES-GCM) بمفتاح مشتق من AUTH_SECRET. لا يُخزَّن الرابط نصاً أبداً.
import { env } from "@/lib/env";

const enc = new TextEncoder();
const dec = new TextDecoder();
const b64 = (u: Uint8Array) => Buffer.from(u).toString("base64url");
const unb64 = (s: string) => new Uint8Array(Buffer.from(s, "base64url"));

async function keyFor(secret: string): Promise<CryptoKey> {
  const raw = await crypto.subtle.digest("SHA-256", enc.encode(`colapia:store-db:v1:${secret}`));
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptSecret(plain: string, secret: string = env.AUTH_SECRET): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await keyFor(secret), enc.encode(plain)));
  return `v1.${b64(iv)}.${b64(ct)}`;
}

export async function decryptSecret(token: string, secret: string = env.AUTH_SECRET): Promise<string> {
  const [v, iv, ct] = token.split(".");
  if (v !== "v1" || !iv || !ct) throw new Error("تعذر فك تشفير رابط القاعدة (صيغة غير معروفة).");
  try {
    const out = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(iv) }, await keyFor(secret), unb64(ct));
    return dec.decode(out);
  } catch {
    throw new Error("تعذر فك تشفير رابط القاعدة (تغيّر مفتاح التشفير؟).");
  }
}
