"use server";
// agency-changes.ts — الفريق يدير طلبات تعديل التجار (/admin/changes): الإسناد، الحالة، والرد الظاهر للتاجر، وبريد له عند
// الانتهاء. المنفّذ يعمل على ما أُسند إليه، والمدير على الكل.
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { merchants, storeChangeRequests, stores } from "@/db/schema";
import { getPlatformSession } from "@/server/auth";
import { can } from "@/agency/roles";
import { CHANGE_STATUSES } from "@/lib/change-requests";
import { sendEmail } from "@/lib/email";
import { clientEnv } from "@/lib/env";
import { logActivity } from "@/agency/activity";

const schema = z.object({
  id: z.string().uuid(),
  status: z.enum(CHANGE_STATUSES).optional(),
  teamNote: z.string().trim().max(1000).optional(),
  assignedTo: z.string().uuid().nullable().optional(),
});

export async function updateChangeRequestAction(raw: z.input<typeof schema>): Promise<{ ok: true } | { ok: false; error: string }> {
  const u = await getPlatformSession();
  if (!u) return { ok: false, error: "غير مصرح" };
  const p = schema.safeParse(raw);
  if (!p.success) return { ok: false, error: "بيانات غير صالحة" };
  const [row] = await db.select().from(storeChangeRequests).where(eq(storeChangeRequests.id, p.data.id)).limit(1);
  if (!row) return { ok: false, error: "الطلب غير موجود" };
  const manager = can(u.role, "requests.assign");
  const mine = row.assignedTo === u.id && can(u.role, "requests.work");
  if (!manager && !mine) return { ok: false, error: "هذا الطلب ليس لك." };
  if (p.data.assignedTo !== undefined && !manager) return { ok: false, error: "الإسناد للمدير." };
  if (p.data.status === "declined" && !p.data.teamNote && !row.teamNote) return { ok: false, error: "اكتب للتاجر سبب عدم التنفيذ." };

  const done = p.data.status === "done" && row.status !== "done";
  await db
    .update(storeChangeRequests)
    .set({
      ...(p.data.status ? { status: p.data.status } : {}),
      ...(p.data.teamNote !== undefined ? { teamNote: p.data.teamNote || null } : {}),
      ...(p.data.assignedTo !== undefined ? { assignedTo: p.data.assignedTo } : {}),
      ...(done ? { doneAt: new Date() } : {}),
      updatedAt: new Date(),
    })
    .where(eq(storeChangeRequests.id, row.id));

  if (done || (p.data.status === "declined" && row.status !== "declined")) {
    const [s] = await db.select({ name: stores.name, email: merchants.email }).from(stores).innerJoin(merchants, eq(merchants.id, stores.merchantId)).where(eq(stores.id, row.storeId)).limit(1);
    if (s?.email) {
      await sendEmail({
        to: s.email,
        subject: done ? `تم تعديل متجرك ${s.name}` : `بخصوص طلب التعديل في ${s.name}`,
        headline: done ? "نفّذنا طلب التعديل" : "طلب التعديل",
        paragraphs: [`طلبك: ${row.body.slice(0, 300)}`, p.data.teamNote || row.teamNote || (done ? "التعديل ظاهر في متجرك الآن." : "")].filter(Boolean),
        buttons: [{ title: "افتح طلباتك", url: new URL("/dashboard/requests", clientEnv.NEXT_PUBLIC_APP_URL).toString() }],
      }).catch(() => false);
    }
  }
  await logActivity(u.id, "change.update", `store:${row.storeId}`, { status: p.data.status ?? null });
  revalidatePath("/admin/changes");
  return { ok: true };
}
