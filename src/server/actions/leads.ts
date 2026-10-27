"use server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { conversations } from "@/db/schema";
import { requirePlatformCap } from "@/server/platform-guard";
import { isLeadStatus, leadRecordOf } from "@/agent/lead-capture";
import { patchMemory } from "@/agent/memory";

/** تغيير حالة الليد وملاحظة الفريق (للمالك وفريق المبيعات). */
export async function setLeadStatusAction(conversationId: string, status: string, note: string): Promise<{ error?: string }> {
  await requirePlatformCap("leads", "غير مصرح");
  if (!isLeadStatus(status)) return { error: "حالة غير صالحة" };
  const [c] = await db.select({ memory: conversations.memory }).from(conversations).where(eq(conversations.id, conversationId)).limit(1);
  const rec = leadRecordOf(c?.memory);
  if (!rec) return { error: "الليد غير موجود" };
  await patchMemory(conversationId, { v6Lead: { ...rec, status, note: note.trim().slice(0, 500) || undefined } });
  revalidatePath("/admin/leads");
  return {};
}
