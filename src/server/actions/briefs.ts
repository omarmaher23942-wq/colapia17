"use server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { clientBriefs } from "@/db/schema";
import { requirePlatformCap } from "@/server/platform-guard";
import { isBriefStatus } from "@/briefs/realestate";
import { drainBriefFallbacks } from "@/server/briefs";

const ID = /^[0-9a-f-]{36}$/i;

/** حالة الاستمارة وملاحظة الفريق (للمالك وفريق المبيعات). */
export async function setBriefStatusAction(id: string, status: string, note: string): Promise<{ error?: string }> {
  await requirePlatformCap("leads", "غير مصرح");
  if (!ID.test(id) || !isBriefStatus(status)) return { error: "طلب غير صالح" };
  await drainBriefFallbacks().catch(() => 0);
  const rows = await db.update(clientBriefs).set({ status, note: note.trim().slice(0, 1000) || null, updatedAt: new Date() }).where(eq(clientBriefs.id, id)).returning({ id: clientBriefs.id }).catch(() => []);
  if (!rows.length) return { error: "الاستمارة غير موجودة في الجدول بعد (شغّلوا npm run db:migrate)" };
  revalidatePath("/admin/briefs");
  return {};
}

/** حذف استمارة (للمالك فقط، مثل حذف الاستمارات التجريبية). */
export async function deleteBriefAction(id: string): Promise<{ error?: string }> {
  await requirePlatformCap("team.manage", "غير مصرح");
  if (!ID.test(id)) return { error: "طلب غير صالح" };
  await db.delete(clientBriefs).where(eq(clientBriefs.id, id)).catch(() => {});
  revalidatePath("/admin/briefs");
  return {};
}
