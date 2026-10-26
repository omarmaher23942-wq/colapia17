"use server";
// actions.ts — دخول صاحب المتجر بالبريد وكلمة المرور، واسترجاعه برمز الاسترجاع. حدود محاولات لكل شبكة ولكل بريد،
// والرد واحد لأي خطأ (لا يُكشف إن كان البريد صحيحاً).
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { signInOwner } from "@/server/auth";
import { recoverOwner } from "@/server/setup/owner";
import { allow, clientIp } from "@/lib/ratelimit";
import { safeInternalPath } from "@/lib/safe-redirect";

export type LoginState = { error: string | null };
export type RecoverState = { error: string | null; recoveryCode?: string };

export async function signInAction(_prev: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const to = safeInternalPath(String(form.get("redirect") ?? ""), "/dashboard");
  if (!email || !password) return { error: "اكتبوا البريد وكلمة المرور." };
  const ip = clientIp(await headers());
  if (!(await allow("login", `ip:${ip}`)) || !(await allow("login", `email:${email}`))) return { error: "محاولات كثيرة. انتظروا دقائق ثم أعيدوا المحاولة." };
  const ok = await signInOwner(email, password).catch(() => false);
  if (!ok) return { error: "البريد أو كلمة المرور غير صحيحة." };
  redirect(to);
}

export async function recoverAction(_prev: RecoverState, form: FormData): Promise<RecoverState> {
  const code = String(form.get("code") ?? "");
  const password = String(form.get("password") ?? "");
  const confirm = String(form.get("confirm") ?? "");
  if (!code.trim()) return { error: "اكتبوا رمز الاسترجاع." };
  if (password !== confirm) return { error: "كلمتا المرور غير متطابقتين." };
  const ip = clientIp(await headers());
  if (!(await allow("login", `recover-ip:${ip}`))) return { error: "محاولات كثيرة. انتظروا دقائق ثم أعيدوا المحاولة." };
  const r = await recoverOwner({ code, password }).catch(() => ({ ok: false as const, error: "تعذّر الاسترجاع الآن. أعيدوا المحاولة." }));
  return r.ok ? { error: null, recoveryCode: r.recoveryCode } : { error: r.error };
}
