"use server";
// actions.ts — دخول صاحب المتجر من رابط الإعداد. البريد يُقرأ من القاعدة على الخادم من الرمز الموقّع، ولا يمر عبر أي رابط
// أو نموذج في المتصفح. الرمز: Google (login_hint بالبريد) أو رمز من 6 أرقام على البريد نفسه. بعد النجاح ← /onboarding.
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { resolveSetupToken } from "@/agent/setup-access";
import { getGoogleAuthUrl } from "@/server/google-oauth";
import { encodeOAuthState } from "@/server/oauth-state";
import { getMerchantSession, logout, signInMerchantByEmail } from "@/server/auth";
import { sendLoginCode, verifyLoginCode } from "@/server/login-code";
import { clientIp, limits } from "@/lib/ratelimit";

type Result = { ok: true; redirect?: string } | { ok: false; error: string };

const AFTER_LOGIN = "/onboarding";

/** «الدخول بحساب Google» (أو «تبديل الحساب» عند switchAccount): login_hint بالبريد المسجّل، وبعد الدخول ← الإعداد. */
export async function startSetupGoogleAction(token: string, switchAccount: boolean) {
  const t = await resolveSetupToken(token);
  if (!t || t.status !== "setup") redirect(`/setup?t=${encodeURIComponent(String(token ?? ""))}`);
  if (switchAccount && (await getMerchantSession().catch(() => null))) await logout("merchant");
  const state = await encodeOAuthState({ provider: "merchant", redirectAfter: AFTER_LOGIN, setupToken: token });
  redirect(getGoogleAuthUrl(state, { loginHint: t.email ?? undefined, forceSelect: switchAccount }));
}

/** يرسل رمز الدخول إلى البريد المسجّل للمتجر. الرد واحد دائماً (لا يكشف البريد). */
export async function requestSetupCodeAction(token: string): Promise<Result> {
  const t = await resolveSetupToken(token);
  if (!t?.email || t.status !== "setup") return { ok: false, error: "الرابط غير صالح أو انتهت صلاحيته." };
  const ip = clientIp(await headers());
  const [byIp, byStore] = await Promise.all([limits.login.limit(`setup-code-ip:${ip}`), limits.login.limit(`setup-code-store:${t.storeId}`)]);
  if (!byIp.success || !byStore.success) return { ok: false, error: "طلبات كثيرة. انتظروا دقائق ثم جرّبوا." };
  await sendLoginCode(t.email.trim().toLowerCase()).catch((e) => console.error("[setup] code send failed", e));
  return { ok: true };
}

export async function verifySetupCodeAction(token: string, code: string): Promise<Result> {
  const t = await resolveSetupToken(token);
  if (!t?.email || t.status !== "setup") return { ok: false, error: "الرابط غير صالح أو انتهت صلاحيته." };
  if (!/^\d{6}$/.test(String(code ?? "").replace(/\D/g, ""))) return { ok: false, error: "الرمز 6 أرقام." };
  const ip = clientIp(await headers());
  if (!(await limits.login.limit(`setup-verify-ip:${ip}`)).success || !(await limits.login.limit(`setup-verify-store:${t.storeId}`)).success) return { ok: false, error: "محاولات كثيرة. انتظروا دقائق." };
  const email = t.email.trim().toLowerCase();
  const r = await verifyLoginCode(email, code);
  if (r === "expired") return { ok: false, error: "الرمز انتهى أو لم يُطلب. اطلبوا رمزاً جديداً." };
  if (r === "locked") return { ok: false, error: "محاولات كثيرة خاطئة. اطلبوا رمزاً جديداً." };
  if (r === "wrong") return { ok: false, error: "الرمز غير صحيح." };
  const done = await signInMerchantByEmail(email, { storeId: t.storeId });
  if (!done || done.merchant.id !== t.merchantId) return { ok: false, error: "تعذّر الدخول. تواصلوا معنا." };
  return { ok: true, redirect: AFTER_LOGIN };
}
