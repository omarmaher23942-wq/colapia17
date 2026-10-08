import "server-only";
import { env, clientEnv } from "@/lib/env";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

export function getGoogleAuthUrl(state: string): string {
  if (!env.GOOGLE_CLIENT_ID) {
    throw new Error("GOOGLE_CLIENT_ID is not configured");
  }

  const redirectUri = `${clientEnv.NEXT_PUBLIC_APP_URL}/api/auth/callback/google`;
  
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    access_type: "online",
    state,
    prompt: "select_account",
  });

  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export type GoogleUser = { id: string; email: string; emailVerified: boolean; name: string; picture?: string };

export async function verifyGoogleCode(code: string): Promise<GoogleUser> {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    throw new Error("Google OAuth credentials are not configured");
  }

  const redirectUri = `${clientEnv.NEXT_PUBLIC_APP_URL}/api/auth/callback/google`;

  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
  });

  if (!tokenRes.ok) {
    throw new Error(`Failed to exchange code: ${await tokenRes.text()}`);
  }

  const tokenData = await tokenRes.json();

  const userRes = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  if (!userRes.ok) {
    throw new Error(`Failed to fetch user info: ${await userRes.text()}`);
  }

  const userData = await userRes.json();

  return {
    id: String(userData.id ?? ""),
    email: String(userData.email ?? ""),
    // نقطة userinfo v2 تعيد verified_email؛ لا نقبل بريداً غير موثّق لربط الحسابات.
    emailVerified: userData.verified_email === true,
    name: String(userData.name ?? ""),
    picture: typeof userData.picture === "string" ? userData.picture : undefined,
  };
}