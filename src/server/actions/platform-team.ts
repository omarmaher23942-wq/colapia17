"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { platformUsers, sessions } from "@/db/schema";
import { getPlatformSession } from "@/server/auth";
import { hashPassword, MIN_PASSWORD_LENGTH } from "@/server/passwords";

const owner = async () => {
  const u = await getPlatformSession();
  if (u?.role !== "owner") throw new Error("للمالك فقط");
  return u;
};

const passwordSchema = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `كلمة المرور ${MIN_PASSWORD_LENGTH} حرفاً على الأقل`)
  .max(200);

const memberSchema = z.object({
  email: z.string().trim().toLowerCase().email("بريد غير صالح"),
  name: z.string().trim().min(2).max(80),
  role: z.enum(["admin", "reviewer"]),
  password: passwordSchema,
});

/** إنهاء كل جلسات عضو من فريق المنصة (لا يمس جلسات التجار أو العملاء). */
async function revokePlatformSessions(userId: string) {
  await db
    .delete(sessions)
    .where(and(eq(sessions.subjectId, userId), eq(sessions.subjectType, "platform")));
}

export async function addMemberAction(fd: FormData) {
  await owner();
  const parsed = memberSchema.safeParse({
    email: fd.get("email"),
    name: fd.get("name"),
    role: fd.get("role") === "reviewer" ? "reviewer" : "admin",
    password: fd.get("password"),
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "بيانات غير صالحة");
  const d = parsed.data;
  await db.insert(platformUsers).values({
    email: d.email,
    name: d.name,
    role: d.role,
    passwordHash: await hashPassword(d.password),
  });
  revalidatePath("/admin/team");
}

export async function toggleMemberAction(id: string, active: boolean) {
  const me = await owner();
  const userId = z.string().uuid().parse(id);
  if (userId === me.id && !active) throw new Error("لا يمكنك إيقاف حسابك");
  await db.update(platformUsers).set({ isActive: active }).where(eq(platformUsers.id, userId));
  if (!active) await revokePlatformSessions(userId);
  revalidatePath("/admin/team");
}

export async function resetMemberPasswordAction(id: string, pw: string) {
  await owner();
  const userId = z.string().uuid().parse(id);
  const password = passwordSchema.parse(pw);
  await db
    .update(platformUsers)
    .set({ passwordHash: await hashPassword(password) })
    .where(eq(platformUsers.id, userId));
  await revokePlatformSessions(userId);
}
