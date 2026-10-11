"use server";
// platform-team.ts — إدارة فريق الوكالة (للمالك وحده): إضافة عضو بالبريد والدور (يدخل بعدها بحساب Google بنفس
// البريد، بلا كلمة مرور)، تغيير الدور، الإيقاف وإعادة التفعيل. إيقاف عضو أو تغيير دوره يُنهي جلساته فوراً.
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { platformUsers, sessions } from "@/db/schema";
import { storeRequests } from "@/db/schema/agency";
import { requirePlatformCap } from "@/server/platform-guard";
import { ASSIGNABLE_ROLES, ROLE_INFO } from "@/agency/roles";
import { logActivity } from "@/agency/activity";
import { sendEmail } from "@/lib/email";
import { clientEnv } from "@/lib/env";

type Result = { ok: true; emailed?: boolean } | { ok: false; error: string };

const roleSchema = z.enum(ASSIGNABLE_ROLES as [string, ...string[]]);
const memberSchema = z.object({
  email: z.string().trim().toLowerCase().email("بريد غير صالح").max(120),
  name: z.string().trim().min(2, "اكتب الاسم").max(80),
  role: roleSchema,
});

const owner = () => requirePlatformCap("team.manage", "إدارة الفريق للمالك فقط.");

/** إنهاء كل جلسات عضو من فريق المنصة (لا يمس جلسات التجار أو العملاء). */
async function revokePlatformSessions(userId: string) {
  await db.delete(sessions).where(and(eq(sessions.subjectId, userId), eq(sessions.subjectType, "platform")));
}

const refresh = () => {
  revalidatePath("/admin/team");
  revalidatePath("/admin/requests");
};

export async function addMemberAction(raw: z.input<typeof memberSchema>): Promise<Result> {
  const me = await owner().catch(() => null);
  if (!me) return { ok: false, error: "إدارة الفريق للمالك فقط." };
  const p = memberSchema.safeParse(raw);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "بيانات غير صالحة" };
  const d = p.data;

  const [existing] = await db.select().from(platformUsers).where(eq(platformUsers.email, d.email)).limit(1);
  if (existing?.isActive) return { ok: false, error: "هذا البريد عضو في الفريق بالفعل." };
  if (existing?.role === "owner") return { ok: false, error: "هذا بريد مالك؛ يُدار من إعدادات المنصة." };

  let id: string;
  if (existing) {
    // عضو سابق موقوف: يعود بالدور الجديد.
    await db.update(platformUsers).set({ isActive: true, name: d.name, role: d.role as never, invitedBy: me.id, updatedAt: new Date() }).where(eq(platformUsers.id, existing.id));
    id = existing.id;
  } else {
    const [row] = await db
      .insert(platformUsers)
      // لا كلمة مرور: الدخول بـ Google فقط. القيمة عشوائية لا تطابق أي تجزئة (العمود إلزامي تاريخياً).
      .values({ email: d.email, name: d.name, role: d.role as never, passwordHash: `google-oauth-${crypto.randomUUID()}`, invitedBy: me.id })
      .returning({ id: platformUsers.id });
    id = row!.id;
  }

  const login = new URL("/admin/login", clientEnv.NEXT_PUBLIC_APP_URL).toString();
  const emailed = await sendEmail({
    to: d.email,
    subject: "انضممت لفريق Colapia",
    headline: `أهلاً ${d.name}`,
    paragraphs: [
      `${me.name} أضافك لفريق Colapia بدور «${ROLE_INFO[d.role as keyof typeof ROLE_INFO].label}»: ${ROLE_INFO[d.role as keyof typeof ROLE_INFO].hint}`,
      `ادخل بحساب Google المسجّل بهذا البريد نفسه (${d.email}). لا توجد كلمة مرور.`,
    ],
    buttons: [{ title: "ادخل لوحة الفريق", url: login }],
  }).catch(() => false);

  await logActivity(me.id, "member.added", `member:${id}`, { email: d.email, role: d.role, emailed });
  refresh();
  return { ok: true, emailed };
}

const roleChange = z.object({ id: z.string().uuid(), role: roleSchema });

export async function changeMemberRoleAction(raw: z.input<typeof roleChange>): Promise<Result> {
  const me = await owner().catch(() => null);
  if (!me) return { ok: false, error: "إدارة الفريق للمالك فقط." };
  const p = roleChange.safeParse(raw);
  if (!p.success) return { ok: false, error: "بيانات غير صالحة" };
  if (p.data.id === me.id) return { ok: false, error: "لا تغيّر دورك أنت." };
  const [u] = await db.select().from(platformUsers).where(eq(platformUsers.id, p.data.id)).limit(1);
  if (!u) return { ok: false, error: "العضو غير موجود." };
  if (u.role === "owner") return { ok: false, error: "دور المالك لا يُغيَّر من اللوحة." };
  if (u.role === p.data.role) return { ok: true };
  await db.update(platformUsers).set({ role: p.data.role as never, updatedAt: new Date() }).where(eq(platformUsers.id, u.id));
  // الدور الجديد قد لا يسمح بما أُسند إليه: نفك الإسناد غير المتوافق حتى لا يبقى طلب معلقاً على من لا يستطيع العمل عليه.
  if (p.data.role !== "builder" && p.data.role !== "admin") {
    await db.update(storeRequests).set({ builderId: null, production: "new", productionChangedAt: new Date() }).where(and(eq(storeRequests.builderId, u.id), eq(storeRequests.production, "assigned")));
    await db.update(storeRequests).set({ builderId: null }).where(and(eq(storeRequests.builderId, u.id), ne(storeRequests.production, "delivered")));
  }
  if (p.data.role !== "reviewer" && p.data.role !== "admin") {
    await db.update(storeRequests).set({ reviewerId: null }).where(and(eq(storeRequests.reviewerId, u.id), ne(storeRequests.production, "delivered")));
  }
  await revokePlatformSessions(u.id);
  await logActivity(me.id, "member.role", `member:${u.id}`, { from: u.role, to: p.data.role });
  refresh();
  return { ok: true };
}

const toggle = z.object({ id: z.string().uuid(), active: z.boolean() });

export async function toggleMemberAction(raw: z.input<typeof toggle>): Promise<Result> {
  const me = await owner().catch(() => null);
  if (!me) return { ok: false, error: "إدارة الفريق للمالك فقط." };
  const p = toggle.safeParse(raw);
  if (!p.success) return { ok: false, error: "بيانات غير صالحة" };
  if (p.data.id === me.id) return { ok: false, error: "لا يمكنك إيقاف حسابك." };
  const [u] = await db.select().from(platformUsers).where(eq(platformUsers.id, p.data.id)).limit(1);
  if (!u) return { ok: false, error: "العضو غير موجود." };
  if (u.role === "owner") return { ok: false, error: "المالك لا يُوقف من اللوحة." };
  await db.update(platformUsers).set({ isActive: p.data.active, updatedAt: new Date() }).where(eq(platformUsers.id, u.id));
  if (!p.data.active) {
    await revokePlatformSessions(u.id);
    // الطلبات المسندة إليه تعود للطابور ليعيد المدير إسنادها.
    // «مُسند» يعود «جديد»، و«قيد البناء» يبقى بحالته بلا منفّذ (يظهر في اللوحة ليعاد إسناده دون ضياع التقدم).
    await db.update(storeRequests).set({ builderId: null, production: "new", productionChangedAt: new Date() }).where(and(eq(storeRequests.builderId, u.id), eq(storeRequests.production, "assigned")));
    await db.update(storeRequests).set({ builderId: null }).where(and(eq(storeRequests.builderId, u.id), ne(storeRequests.production, "delivered")));
    await db.update(storeRequests).set({ reviewerId: null }).where(and(eq(storeRequests.reviewerId, u.id), ne(storeRequests.production, "delivered")));
  }
  await logActivity(me.id, p.data.active ? "member.enabled" : "member.disabled", `member:${u.id}`);
  refresh();
  return { ok: true };
}
