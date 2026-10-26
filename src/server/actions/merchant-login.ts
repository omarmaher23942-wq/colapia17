"use server";
// merchant-login.ts — دخول صاحب المتجر وفريقه ببريد وكلمة مرور (لا Google للتجار). حدود معدل لكل شبكة وكل بريد، وقفل مؤقت
// بعد محاولات خاطئة متتالية (auth.ts). «نسيت كلمة المرور»: رمز من 6 أرقام على البريد (login-code.ts) ثم كلمة جديدة؛ وإن تعذّر
// البريد يولّد الفريق رابط إعادة تعيين من لوحة المتجر (reissueSetupLinkAction) فيُكمل صاحبه من /login/reset/<رمز>.
import { headers } from "next/headers";
import { z } from "zod";
import { safeInternalPath } from "@/lib/safe-redirect";
import { clientIp, limits } from "@/lib/ratelimit";
import { passwordIssues } from "@/lib/password-rules";
import { emailDeliveryOn, normalizeLoginEmail, sendLoginCode, verifyLoginCode } from "@/server/login-code";
import { resetPasswordAndSignIn, signInMerchantWithPassword } from "@/server/auth";
import { resolveResetToken } from "@/agent/setup-access";

type Result = { ok: true; redirect?: string; manual?: boolean } | { ok: false; error: string };
const emailSchema = z.string().trim().toLowerCase().email().max(120);

const safeRedirect = (to: unknown) => safeInternalPath(to, "/dashboard", { prefix: "/dashboard" });
const TOO_MANY = "محاولات كثيرة. انتظروا دقائق ثم أعيدوا المحاولة.";

export async function passwordLoginAction(rawEmail: string, password: string, redirectTo?: string): Promise<Result> {
  const p = emailSchema.safeParse(rawEmail);
  if (!p.success || typeof password !== "string" || !password || password.length > 128) return { ok: false, error: "اكتبوا البريد وكلمة المرور." };
  const email = normalizeLoginEmail(p.data);
  const ip = clientIp(await headers());
  if (!(await limits.login.limit(`pw-ip:${ip}`)).success) return { ok: false, error: TOO_MANY };
  const r = await signInMerchantWithPassword(email, password);
  if (!r.ok) return { ok: false, error: r.reason === "locked" ? "أُوقف الدخول مؤقتاً بعد محاولات خاطئة متكررة. جرّبوا بعد 15 دقيقة، أو اختاروا «نسيت كلمة المرور»." : "البريد أو كلمة المرور غير صحيحة." };
  return { ok: true, redirect: safeRedirect(redirectTo) };
}

/** يرسل رمز إعادة التعيين إن كان البريد معروفاً. الرد واحد دائماً؛ manual = البريد الإلكتروني غير متاح فيطلب الفريق. */
export async function requestResetCodeAction(rawEmail: string): Promise<Result> {
  const p = emailSchema.safeParse(rawEmail);
  if (!p.success) return { ok: false, error: "اكتبوا بريدكم صحيحاً." };
  const email = normalizeLoginEmail(p.data);
  if (!emailDeliveryOn()) return { ok: true, manual: true };
  const ip = clientIp(await headers());
  const [byIp, byEmail] = await Promise.all([limits.login.limit(`code-ip:${ip}`), limits.login.limit(`code-email:${email}`)]);
  if (!byIp.success || !byEmail.success) return { ok: false, error: TOO_MANY };
  await sendLoginCode(email).catch((e) => console.error("[login-code] send failed", e));
  return { ok: true };
}

export async function resetPasswordWithCodeAction(rawEmail: string, code: string, password: string, redirectTo?: string): Promise<Result> {
  const p = emailSchema.safeParse(rawEmail);
  if (!p.success || !/^\d{6}$/.test(String(code ?? "").replace(/\D/g, ""))) return { ok: false, error: "الرمز 6 أرقام." };
  const email = normalizeLoginEmail(p.data);
  const issues = passwordIssues(String(password ?? ""), { email });
  if (issues.length) return { ok: false, error: `كلمة المرور يجب أن ${issues[0]}` };
  const ip = clientIp(await headers());
  if (!(await limits.login.limit(`verify-ip:${ip}`)).success || !(await limits.login.limit(`verify-email:${email}`)).success) return { ok: false, error: TOO_MANY };
  const r = await verifyLoginCode(email, code);
  if (r === "expired") return { ok: false, error: "الرمز انتهى أو لم يُطلب. اطلبوا رمزاً جديداً." };
  if (r === "locked") return { ok: false, error: "محاولات كثيرة خاطئة. اطلبوا رمزاً جديداً." };
  if (r === "wrong") return { ok: false, error: "الرمز غير صحيح." };
  const done = await resetPasswordAndSignIn(email, password);
  if (!done) return { ok: false, error: "تعذر تغيير كلمة المرور. تواصلوا معنا." };
  return { ok: true, redirect: safeRedirect(redirectTo) };
}

/** كلمة مرور جديدة من رابط إعادة التعيين الذي ولّده الفريق (لمرة واحدة). */
export async function resetPasswordWithLinkAction(token: string, password: string): Promise<Result> {
  const ip = clientIp(await headers());
  if (!(await limits.login.limit(`reset-ip:${ip}`)).success) return { ok: false, error: TOO_MANY };
  const t = await resolveResetToken(token);
  if (!t.ok || !t.target.email) return { ok: false, error: "الرابط غير صالح أو استُعمل من قبل. اطلبوا رابطاً جديداً من الفريق." };
  const issues = passwordIssues(String(password ?? ""), { email: t.target.email });
  if (issues.length) return { ok: false, error: `كلمة المرور يجب أن ${issues[0]}` };
  const done = await resetPasswordAndSignIn(t.target.email, password);
  if (!done) return { ok: false, error: "تعذر تغيير كلمة المرور. تواصلوا معنا." };
  return { ok: true, redirect: "/dashboard" };
}
