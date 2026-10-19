"use server";

import { redirect } from "next/navigation";
import { safeInternalPath } from "@/lib/safe-redirect";
import { getGoogleAuthUrl } from "@/server/google-oauth";
import { encodeOAuthState } from "@/server/oauth-state";
import { getMerchantSession, logout } from "@/server/auth";

const sanitizeRedirect = (input: string | undefined | null): string => safeInternalPath(input, "/dashboard");

export async function initiateMerchantGoogleAuthAction(
  redirectTo: string = "/dashboard"
) {
  const target = sanitizeRedirect(redirectTo);
  const state = await encodeOAuthState({
    provider: "merchant",
    redirectAfter: target,
  });

  const url = getGoogleAuthUrl(state);
  redirect(url);
}

/**
 * «تبديل الحساب»: يُنهي جلسة التاجر الحالية (إن وُجدت) ثم يفتح شاشة اختيار حساب Google، ليعود المستخدم بالحساب الصحيح.
 * الوجهة بعد النجاح تبقى كما كانت.
 */
export async function switchMerchantAccountAction(redirectTo: string = "/dashboard") {
  const target = sanitizeRedirect(redirectTo);
  if (await getMerchantSession().catch(() => null)) await logout("merchant");
  const state = await encodeOAuthState({ provider: "merchant", redirectAfter: target });
  redirect(getGoogleAuthUrl(state, { forceSelect: true }));
}
