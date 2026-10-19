"use server";
// merchant-login.ts — دخول لوحة المتجر برمز على البريد (بديل Google). حدود معدل لكل بريد ولكل شبكة.
import { safeInternalPath } from "@/lib/safe-redirect";
import { headers } from "next/headers";
import { z } from "zod";
import { limits, clientIp } from "@/lib/ratelimit";
import { normalizeLoginEmail, sendLoginCode, verifyLoginCode } from "@/server/login-code";
import { signInMerchantByEmail } from "@/server/auth";

type Result = { ok: true; redirect?: string } | { ok: false; error: string };
const emailSchema = z.string().trim().toLowerCase().email().max(120);

const safeRedirect = (to: unknown) => safeInternalPath(to, "/dashboard", { prefix: "/dashboard" });

export async function requestLoginCodeAction(rawEmail: string): Promise<Result> {
  const p = emailSchema.safeParse(rawEmail);
  if (!p.success) return { ok: false, error: "اكتب بريدك صحيحاً." };
  const email = normalizeLoginEmail(p.data);
  const ip = clientIp(await headers());
  const [byIp, byEmail] = await Promise.all([limits.login.limit(`code-ip:${ip}`), limits.login.limit(`code-email:${email}`)]);
  if (!byIp.success || !byEmail.success) return { ok: false, error: "طلبات كثيرة. انتظر دقائق ثم جرّب." };
  await sendLoginCode(email).catch((e) => console.error("[login-code] send failed", e));
  // نفس الرد دائماً: لا نكشف إن كان البريد مسجّلاً.
  return { ok: true };
}

export async function verifyLoginCodeAction(rawEmail: string, code: string, redirectTo?: string): Promise<Result> {
  const p = emailSchema.safeParse(rawEmail);
  if (!p.success || !/^\d{6}$/.test(code.replace(/\D/g, ""))) return { ok: false, error: "الرمز 6 أرقام." };
  const email = normalizeLoginEmail(p.data);
  const ip = clientIp(await headers());
  if (!(await limits.login.limit(`verify-ip:${ip}`)).success) return { ok: false, error: "محاولات كثيرة. انتظر دقائق." };
  if (!(await limits.login.limit(`verify-email:${email}`)).success) return { ok: false, error: "محاولات كثيرة. انتظر دقائق." };
  const r = await verifyLoginCode(email, code);
  if (r === "expired") return { ok: false, error: "الرمز انتهى أو لم يُطلب. اطلب رمزاً جديداً." };
  if (r === "locked") return { ok: false, error: "محاولات كثيرة خاطئة. اطلب رمزاً جديداً." };
  if (r === "wrong") return { ok: false, error: "الرمز غير صحيح." };
  const done = await signInMerchantByEmail(email);
  if (!done) return { ok: false, error: "تعذر الدخول. تواصل معنا." };
  return { ok: true, redirect: safeRedirect(redirectTo) };
}
