"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { platformUsers } from "@/db/schema";
import { env } from "@/lib/env";
import { startPlatformSession, logout } from "@/server/auth";
import { hashPassword, verifyPassword, secretsEqual, MIN_PASSWORD_LENGTH } from "@/server/passwords";
import { limits, clientIp } from "@/lib/ratelimit";
import { encodeOAuthState } from "@/server/oauth-state";
import { getGoogleAuthUrl } from "@/server/google-oauth";

export async function bootstrapOwnerAction(_: unknown, fd: FormData) {
  const { success } = await limits.login.limit("bootstrap:" + clientIp(await headers()));
  if (!success) return { error: "محاولات كثيرة" };

  const [row] = await db
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(platformUsers);
  if ((row?.n ?? 0) > 0) return { error: "تمت التهيئة من قبل" };

  if (!secretsEqual(String(fd.get("secret") ?? ""), env.BOOTSTRAP_OWNER_SECRET))
    return { error: "السر غير صحيح" };

  const email = String(fd.get("email")).toLowerCase().trim(),
    password = String(fd.get("password"));
  if (password.length < MIN_PASSWORD_LENGTH)
    return { error: `كلمة المرور ${MIN_PASSWORD_LENGTH} حرفاً على الأقل` };

  const [u] = await db
    .insert(platformUsers)
    .values({
      email,
      name: String(fd.get("name") || "المالك"),
      passwordHash: await hashPassword(password),
      role: "owner",
    })
    .returning();

  await startPlatformSession(u!.id);
  redirect("/admin");
}

export async function platformLoginAction(_: unknown, fd: FormData) {
  const { success } = await limits.login.limit("p:" + clientIp(await headers()));
  if (!success) return { error: "محاولات كثيرة" };

  const [u] = await db
    .select()
    .from(platformUsers)
    .where(eq(platformUsers.email, String(fd.get("email")).toLowerCase().trim()))
    .limit(1);

  if (!u?.isActive || !(await verifyPassword(String(fd.get("password")), u.passwordHash)))
    return { error: "بيانات غير صحيحة" };

  await db
    .update(platformUsers)
    .set({ lastLoginAt: new Date() })
    .where(eq(platformUsers.id, u.id));

  await startPlatformSession(u.id);
  redirect("/admin");
}

export async function platformLogoutAction() {
  await logout("platform");
  redirect("/admin/login");
}

export async function initiatePlatformGoogleAuthAction(redirectAfter = "/admin") {
  const safe =
    redirectAfter.startsWith("/admin") && !redirectAfter.startsWith("//") ? redirectAfter : "/admin";
  const state = await encodeOAuthState({ provider: "platform", redirectAfter: safe });
  redirect(getGoogleAuthUrl(state));
}