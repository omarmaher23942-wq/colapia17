// oauth-state.ts — حالة OAuth موقّعة ومربوطة بالمتصفح.
//
// - الحالة JWT موقّع بـ AUTH_SECRET وصالح 10 دقائق. لا مسارات احتياطية غير موقّعة.
// - كل بدء تسجيل دخول يضع nonce عشوائياً في كوكي httpOnly، ويُضمَّن نفس الـ nonce
//   في الحالة. الـ callback يرفض أي حالة لا يطابق nonce فيها كوكي المتصفح نفسه،
//   فيستحيل إجبار متصفح الضحية على الدخول بحساب المهاجم (Login CSRF).
import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { env, clientEnv } from "@/lib/env";
import { secureToken } from "@/lib/ids";

const NONCE_COOKIE = "clp_oauth_nonce";
const TTL_SECONDS = 600;

export type OAuthProvider = "merchant" | "platform" | "customer";

export type OAuthStatePayload = {
  provider: OAuthProvider;
  redirectAfter?: string;
  storeSubdomain?: string;
};

type SignedState = OAuthStatePayload & { nonce: string };

function secretKey(): Uint8Array {
  return new TextEncoder().encode(env.AUTH_SECRET);
}

/** الكوكي مشترك بين النطاق الجذري ونطاقات المتاجر لأن دخول العميل يبدأ من متجره. */
function nonceCookieDomain(): string | undefined {
  const root = clientEnv.NEXT_PUBLIC_ROOT_DOMAIN.toLowerCase().split(":")[0] ?? "";
  if (!root || root === "localhost" || root === "127.0.0.1") return undefined;
  return `.${root}`;
}

export async function encodeOAuthState(payload: OAuthStatePayload): Promise<string> {
  const nonce = secureToken(16);
  const jar = await cookies();
  jar.set(NONCE_COOKIE, nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    domain: nonceCookieDomain(),
    maxAge: TTL_SECONDS,
  });

  return new SignJWT({ ...payload, nonce } satisfies SignedState)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${TTL_SECONDS}s`)
    .sign(secretKey());
}

/**
 * يتحقق من التوقيع ومن مطابقة الـ nonce لكوكي المتصفح، ثم يستهلك الكوكي.
 * يعيد null لأي حالة غير صالحة.
 */
export async function consumeOAuthState(state: string): Promise<OAuthStatePayload | null> {
  if (!state) return null;
  const jar = await cookies();
  const cookieNonce = jar.get(NONCE_COOKIE)?.value;
  jar.delete({ name: NONCE_COOKIE, path: "/", domain: nonceCookieDomain() });

  try {
    const { payload } = await jwtVerify(state, secretKey());
    const provider = payload.provider;
    if (provider !== "merchant" && provider !== "platform" && provider !== "customer") return null;
    if (!cookieNonce || payload.nonce !== cookieNonce) return null;
    return {
      provider,
      redirectAfter: typeof payload.redirectAfter === "string" ? payload.redirectAfter : undefined,
      storeSubdomain: typeof payload.storeSubdomain === "string" ? payload.storeSubdomain : undefined,
    };
  } catch {
    return null;
  }
}
