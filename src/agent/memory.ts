import "server-only";
// memory.ts — كتابة ذاكرة المحادثة بدمج jsonb ذري (`memory || patch`): لا يمحو ما كتبه مسار آخر بين القراءة والكتابة.
import { eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { conversations } from "@/db/schema";

export async function patchMemory(conversationId: string, patch: Record<string, unknown>): Promise<void> {
  await db
    .update(conversations)
    .set({ memory: sql`${conversations.memory} || ${JSON.stringify(patch)}::jsonb`, updatedAt: new Date() })
    .where(eq(conversations.id, conversationId));
}
