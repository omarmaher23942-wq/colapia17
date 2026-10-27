"use server";
// أدوات الفريق على المحادثات: إسناد، موعد متابعة، ملاحظات داخلية، وإدارة الردود المحفوظة. كلها بصلاحية «conversations»
// وتُسجَّل في سجل النشاط. الملاحظات داخلية ولا تصل العميل أبداً.
import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { conversations } from "@/db/schema";
import { requirePlatformCap } from "@/server/platform-guard";
import { logActivity } from "@/agency/activity";
import { patchMemory } from "@/agent/memory";
import { getFlag, setFlag } from "@/lib/flags";
import { MAX_REPLIES, SAVED_REPLIES_KEY, parseReplies, validateReply, type SavedReply } from "@/agency/saved-replies";

const guard = () => requirePlatformCap("conversations", "غير مصرح");
const uuid = /^[0-9a-f-]{36}$/i;

async function exists(id: string) {
  if (!uuid.test(id)) return false;
  const [c] = await db.select({ id: conversations.id }).from(conversations).where(eq(conversations.id, id)).limit(1);
  return !!c;
}

/** إسناد المحادثة لنفسي أو إلغاء الإسناد. */
export async function assignConversationAction(id: string, mine: boolean) {
  const u = await guard();
  if (!(await exists(id))) return { error: "محادثة غير موجودة" };
  await patchMemory(id, { assigneeId: mine ? u.id : null, assigneeName: mine ? u.name : null });
  await logActivity(u.id, "conversation.assign", `conversation:${id}`, { mine });
  revalidatePath("/admin/conversations");
  return { ok: true as const };
}

/** موعد متابعة (ISO) أو null للإلغاء. لا يقبل ماضياً بعيداً ولا أبعد من سنة. */
export async function setFollowUpAction(id: string, iso: string | null) {
  const u = await guard();
  if (!(await exists(id))) return { error: "محادثة غير موجودة" };
  let at: string | null = null;
  if (iso) {
    const d = new Date(iso);
    const now = Date.now();
    if (Number.isNaN(d.getTime()) || d.getTime() < now - 3600_000 || d.getTime() > now + 366 * 86400_000) return { error: "موعد غير صالح." };
    at = d.toISOString();
  }
  await patchMemory(id, { followUpAt: at });
  await logActivity(u.id, "conversation.followup", `conversation:${id}`, { at });
  revalidatePath("/admin/conversations");
  return { ok: true as const };
}

/** ملاحظة داخلية تُضاف ذرياً (آخر 30). */
export async function addNoteAction(id: string, raw: string) {
  const u = await guard();
  const text = String(raw ?? "").replace(/\s+/g, " ").trim().slice(0, 600);
  if (!text) return { error: "اكتبوا الملاحظة أولاً." };
  if (!(await exists(id))) return { error: "محادثة غير موجودة" };
  const note = JSON.stringify([{ by: u.name, at: new Date().toISOString(), text }]);
  await db
    .update(conversations)
    .set({
      memory: sql`jsonb_set(${conversations.memory}, '{notes}', (select coalesce(jsonb_agg(e order by n), '[]'::jsonb) from (select e, n from jsonb_array_elements(coalesce(${conversations.memory}->'notes', '[]'::jsonb) || ${note}::jsonb) with ordinality as t(e, n) order by n desc limit 30) s), true)`,
    })
    .where(eq(conversations.id, id));
  await logActivity(u.id, "conversation.note", `conversation:${id}`);
  revalidatePath("/admin/conversations");
  return { ok: true as const };
}

export async function listRepliesAction(): Promise<SavedReply[]> {
  await guard();
  return parseReplies((await getFlag(SAVED_REPLIES_KEY)).config);
}

/** يحفظ ردّاً جديداً أو يعدّل ردّاً قائماً (id) أو يحذفه (text فارغ مع remove). */
export async function saveReplyAction(input: { id?: string; title?: string; text?: string; remove?: boolean }) {
  const u = await guard();
  const cur = parseReplies((await getFlag(SAVED_REPLIES_KEY)).config);
  let next: SavedReply[];
  if (input.remove) next = cur.filter((r) => r.id !== input.id);
  else {
    const v = validateReply(input);
    if (!v.ok) return { error: v.error };
    if (input.id && cur.some((r) => r.id === input.id)) next = cur.map((r) => (r.id === input.id ? { ...r, title: v.title, text: v.text } : r));
    else {
      if (cur.length >= MAX_REPLIES) return { error: `الحد الأقصى ${MAX_REPLIES} رداً.` };
      next = [...cur, { id: crypto.randomUUID().slice(0, 8), title: v.title, text: v.text }];
    }
  }
  await setFlag(SAVED_REPLIES_KEY, true, { items: next });
  await logActivity(u.id, "replies.update", null, { count: next.length });
  revalidatePath("/admin/conversations");
  return { ok: true as const, items: next };
}
