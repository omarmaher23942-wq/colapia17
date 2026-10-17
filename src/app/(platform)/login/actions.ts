"use server";

import { redirect } from "next/navigation";
import { getGoogleAuthUrl } from "@/server/google-oauth";
import { encodeOAuthState } from "@/server/oauth-state";
import { getMerchantSession, logout } from "@/server/auth";

function sanitizeRedirect(input: string | undefined | null): string {
  if (!input || typeof input !== "string") return "/dashboard";
  if (!input.startsWith("/")) return "/dashboard";
  if (input.startsWith("//")) return "/dashboard";
  if (input.includes("\\")) return "/dashboard";
  if (input.length > 512) return "/dashboard";
  return input;
}

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
