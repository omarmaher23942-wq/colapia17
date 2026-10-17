// owner-pass.ts — «تمرير المالك»: رمز موقّع قصير العمر يفتح متجر صاحبه (أو فريقه) على نطاق المتجر نفسه بصفة معاينة:
// يتجاوز بوابة «قيد التجهيز/متوقف» ويجعل الطلبات تجريبية ولا يحسب الزيارات. خالص (Web Crypto) فيعمل في middleware وNode.
//
// الشكل: base64url(JSON payload) + "." + base64url(HMAC-SHA256). الحمولة: المتجر (id والنطاق الفرعي) والتاجر وانتهاء الصلاحية.
// الرمز يمرّ مرة في الرابط (دقيقتان) ثم يُحفظ في كوكي مرتبط بالمضيف نفسه 12 ساعة.
export const OWNER_COOKIE = "clp_own";
export const OWNER_LINK_TTL_S = 120;
export const OWNER_COOKIE_TTL_S = 12 * 3600;

export type OwnerPass = { s: string; u: string; m: string; exp: number };

const enc = new TextEncoder();
const b64 = (bytes: Uint8Array) => {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const unb64 = (v: string) => {
  const p = v.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(p + "=".repeat((4 - (p.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

async function hmac(secret: string, data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
}

const safeEq = (a: Uint8Array, b: Uint8Array) => {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a[i]! ^ b[i]!;
  return d === 0;
};

export async function signOwnerPass(input: { storeId: string; sub: string; merchantId: string; ttlSeconds: number }, secret: string, nowMs = Date.now()): Promise<string> {
  const payload: OwnerPass = { s: input.storeId, u: input.sub, m: input.merchantId, exp: Math.floor(nowMs / 1000) + input.ttlSeconds };
  const body = b64(enc.encode(JSON.stringify(payload)));
  return `${body}.${b64(await hmac(secret, `owner-pass:${body}`))}`;
}

/** يعيد الحمولة إن كان التوقيع سليماً والرمز غير منتهٍ (وللنطاق الفرعي المطلوب إن مُرّر). */
export async function verifyOwnerPass(token: string | null | undefined, secret: string, opts: { sub?: string; nowMs?: number } = {}): Promise<OwnerPass | null> {
  if (!token || token.length > 600 || !secret) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  try {
    if (!safeEq(await hmac(secret, `owner-pass:${body}`), unb64(sig))) return null;
    const p = JSON.parse(new TextDecoder().decode(unb64(body))) as Partial<OwnerPass>;
    if (typeof p.s !== "string" || typeof p.u !== "string" || typeof p.m !== "string" || typeof p.exp !== "number") return null;
    if (p.exp * 1000 < (opts.nowMs ?? Date.now())) return null;
    if (opts.sub && p.u !== opts.sub) return null;
    return p as OwnerPass;
  } catch {
    return null;
  }
}

/** وجهة آمنة داخل المتجر: مسار نسبي فقط (لا بروتوكول ولا //). */
export function safeLandingPath(to: string | null | undefined): string {
  const v = typeof to === "string" ? to.trim() : "";
  if (!v.startsWith("/") || v.startsWith("//") || v.includes("\\") || /[\u0000-\u001f]/.test(v)) return "/";
  return v.slice(0, 300);
}
