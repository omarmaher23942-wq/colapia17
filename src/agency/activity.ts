import "server-only";
// activity.ts — سجل نشاط فريق الوكالة (platform_activity). الكتابة ثانوية: فشلها لا يُفشل الإجراء الأصلي.
import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { platformActivity } from "@/db/schema/agency";

export async function logActivity(actorId: string | null, action: string, target?: string | null, meta?: Record<string, unknown>): Promise<void> {
  await db
    .insert(platformActivity)
    .values({ actorId, action, target: target ?? null, meta: meta ?? null })
    .catch((e) => console.error("[agency] activity log failed", action, e));
}

export async function recentActivity(limit = 50, actorId?: string) {
  return db
    .select()
    .from(platformActivity)
    .where(actorId ? eq(platformActivity.actorId, actorId) : undefined)
    .orderBy(desc(platformActivity.createdAt))
    .limit(limit)
    .catch(() => []);
}
