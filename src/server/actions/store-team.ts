"use server";
// store-team.ts — فريق التاجر (المرحلة 6): صاحب المتجر يدعو بريداً بدور جاهز أو صلاحيات مخصصة، ويغيّرها، ويلغي
// الوصول فوراً (الجلسة تُعاد حسابها مع كل طلب، فالإلغاء يسري في الطلب التالي). الفريق والاشتراك لصاحب المتجر وحده.
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { merchants, storeActivity, storeMembers } from "@/db/schema";
import { storeFor } from "@/server/merchant-guard";
import { STORE_AREAS, STORE_ROLES, STORE_ROLE_LABEL, permsFor } from "@/lib/store-perms";
import { sendEmail } from "@/lib/email";
import { clientEnv } from "@/lib/env";

type Result = { ok: true; emailed?: boolean } | { ok: false; error: string };

const permsSchema = z.record(z.enum(STORE_AREAS), z.enum(["none", "view", "manage"])).optional();
const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email("بريد غير صالح").max(120),
  name: z.string().trim().max(80).optional(),
  role: z.enum(STORE_ROLES),
  perms: permsSchema,
});

const owner = () => storeFor("team", "manage");
const log = (storeId: string, merchantId: string, action: string, target?: string) =>
  db.insert(storeActivity).values({ storeId, merchantId, action, target: target ?? null }).catch(() => {});

export async function inviteMemberAction(raw: z.input<typeof inviteSchema>): Promise<Result> {
  const s = await owner();
  if (!s) return { ok: false, error: "إدارة الفريق لصاحب المتجر." };
  const p = inviteSchema.safeParse(raw);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "بيانات غير صالحة" };
  const d = p.data;
  if (d.email === s.merchant.email?.toLowerCase()) return { ok: false, error: "هذا بريدك أنت (صاحب المتجر)." };
  const [storeOwner] = await db.select({ email: merchants.email }).from(merchants).where(eq(merchants.id, s.store.merchantId)).limit(1);
  if (storeOwner?.email?.toLowerCase() === d.email) return { ok: false, error: "هذا بريد صاحب المتجر." };
  const custom = d.role === "custom" ? permsFor("custom", d.perms) : null;
  if (custom && !STORE_AREAS.some((a) => custom[a] !== "none")) return { ok: false, error: "اختر صلاحية واحدة على الأقل." };

  const [existing] = await db.select().from(storeMembers).where(and(eq(storeMembers.storeId, s.storeId), eq(storeMembers.email, d.email))).limit(1);
  if (existing?.status === "active") return { ok: false, error: "هذا البريد في فريقك بالفعل." };
  const [known] = await db.select({ id: merchants.id }).from(merchants).where(eq(merchants.email, d.email)).limit(1);
  const values = { role: d.role, perms: custom, name: d.name || null, status: "active" as const, invitedBy: s.merchantId, merchantId: known?.id ?? null, updatedAt: new Date() };
  if (existing) await db.update(storeMembers).set(values).where(eq(storeMembers.id, existing.id));
  else await db.insert(storeMembers).values({ storeId: s.storeId, email: d.email, ...values });

  const login = new URL("/login", clientEnv.NEXT_PUBLIC_APP_URL).toString();
  const emailed = await sendEmail({
    to: d.email,
    subject: `دعوة لفريق متجر ${s.store.name}`,
    headline: `${s.merchant.displayName} دعاك لفريق متجر ${s.store.name}`,
    paragraphs: [
      `دورك: «${STORE_ROLE_LABEL[d.role]}». ستجد في لوحة المتجر ما يسمح به دورك فقط.`,
      `ادخل بحساب Google المسجّل بهذا البريد (${d.email})، أو اطلب رمز دخول على بريدك من صفحة الدخول.`,
    ],
    buttons: [{ title: "ادخل لوحة المتجر", url: login }],
  }).catch(() => false);
  await log(s.storeId, s.merchantId, "member.invited", d.email);
  revalidatePath("/dashboard/team");
  return { ok: true, emailed };
}

const updateSchema = z.object({ id: z.string().uuid(), role: z.enum(STORE_ROLES), perms: permsSchema });

export async function updateMemberAction(raw: z.input<typeof updateSchema>): Promise<Result> {
  const s = await owner();
  if (!s) return { ok: false, error: "إدارة الفريق لصاحب المتجر." };
  const p = updateSchema.safeParse(raw);
  if (!p.success) return { ok: false, error: "بيانات غير صالحة" };
  const custom = p.data.role === "custom" ? permsFor("custom", p.data.perms) : null;
  const [row] = await db
    .update(storeMembers)
    .set({ role: p.data.role, perms: custom, updatedAt: new Date() })
    .where(and(eq(storeMembers.id, p.data.id), eq(storeMembers.storeId, s.storeId), eq(storeMembers.status, "active")))
    .returning({ email: storeMembers.email });
  if (!row) return { ok: false, error: "العضو غير موجود." };
  await log(s.storeId, s.merchantId, "member.updated", row.email);
  revalidatePath("/dashboard/team");
  return { ok: true };
}

const removeSchema = z.object({ id: z.string().uuid() });

export async function removeMemberAction(raw: z.input<typeof removeSchema>): Promise<Result> {
  const s = await owner();
  if (!s) return { ok: false, error: "إدارة الفريق لصاحب المتجر." };
  const p = removeSchema.safeParse(raw);
  if (!p.success) return { ok: false, error: "بيانات غير صالحة" };
  const [row] = await db
    .update(storeMembers)
    .set({ status: "removed", updatedAt: new Date() })
    .where(and(eq(storeMembers.id, p.data.id), eq(storeMembers.storeId, s.storeId)))
    .returning({ email: storeMembers.email });
  if (!row) return { ok: false, error: "العضو غير موجود." };
  await log(s.storeId, s.merchantId, "member.removed", row.email);
  revalidatePath("/dashboard/team");
  return { ok: true };
}
