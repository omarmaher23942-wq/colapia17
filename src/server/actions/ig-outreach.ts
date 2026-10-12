"use server";
// ig-outreach.ts — إجراءات قائمة تواصل Colapia مع البراندات (/admin/outreach). صلاحية «leads» (المالك والمدير والمبيعات).
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { igLeads } from "@/db/schema";
import { setFlag } from "@/lib/flags";
import { platformUser } from "@/server/platform-guard";
import { LEAD_STATUSES, parseLeadLines, PENDING_STATUSES, outreachSettingsFrom } from "@/lib/ig-outreach";
import { draftOpener, OUTREACH_FLAG, rescheduleAll, scheduleQueue } from "@/server/ig-outreach";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };
const PAGE = "/admin/outreach";
const MAX_PER_ADD = 40;
const guard = () => platformUser({ cap: "leads" });

/** يصوغ رسائل الحسابات الجديدة ثلاثاً ثلاثاً (لا ضغط على مزود الذكاء الاصطناعي). */
async function draftAll(ids: string[]): Promise<void> {
  const rows = await db.select().from(igLeads).where(inArray(igLeads.id, ids));
  for (let i = 0; i < rows.length; i += 3) {
    await Promise.all(
      rows.slice(i, i + 3).map(async (l) => {
        const d = await draftOpener(l);
        await db
          .update(igLeads)
          .set({ message: d.text, messageSource: d.source, status: "ready", updatedAt: new Date() })
          .where(and(eq(igLeads.id, l.id), eq(igLeads.status, "queued")));
      })
    );
  }
}

const addSchema = z.object({ text: z.string().max(20_000), category: z.string().trim().max(60).optional() });

export async function addLeadsAction(raw: z.input<typeof addSchema>): Promise<Result<{ added: number; skipped: string[]; invalid: string[] }>> {
  const u = await guard();
  if (!u) return { ok: false, error: "غير مصرح." };
  const p = addSchema.safeParse(raw);
  if (!p.success) return { ok: false, error: "النص طويل جداً." };
  const { leads, invalid } = parseLeadLines(p.data.text);
  if (!leads.length) return { ok: false, error: invalid.length ? "لم أفهم أي رابط حساب. الصق روابط إنستجرام أو @اسم، حساب في كل سطر." : "الصق رابطاً واحداً على الأقل." };
  if (leads.length > MAX_PER_ADD) return { ok: false, error: `أضف حتى ${MAX_PER_ADD} حساباً في المرة.` };
  const existing = await db.select({ handle: igLeads.handle }).from(igLeads).where(inArray(igLeads.handle, leads.map((l) => l.handle)));
  const have = new Set(existing.map((e) => e.handle));
  const fresh = leads.filter((l) => !have.has(l.handle));
  const inserted = fresh.length
    ? await db
        .insert(igLeads)
        // ترتيب الطابور = ترتيب اللصق (فرق مللي ثانية في وقت الإضافة).
        .values(fresh.map((l, i) => ({ handle: l.handle, note: l.note, category: p.data.category || null, createdBy: u.id, createdAt: new Date(Date.now() + i) })))
        .onConflictDoNothing()
        .returning({ id: igLeads.id })
    : [];
  await scheduleQueue();
  // الصياغة بعد الرد (قد تأخذ ثواني لكل حساب)؛ الصفحة تعرض «جارٍ تجهيز الرسالة» حتى تصل.
  const ids = inserted.map((r) => r.id);
  if (ids.length) after(() => draftAll(ids).catch((e) => console.error("[outreach] drafting failed", e)));
  revalidatePath(PAGE);
  return { ok: true, added: inserted.length, skipped: [...have], invalid };
}

const idSchema = z.string().uuid();

export async function regenerateMessageAction(id: string): Promise<Result<{ message: string }>> {
  if (!(await guard())) return { ok: false, error: "غير مصرح." };
  if (!idSchema.safeParse(id).success) return { ok: false, error: "طلب غير صالح." };
  const [l] = await db.select().from(igLeads).where(eq(igLeads.id, id)).limit(1);
  if (!l) return { ok: false, error: "الحساب غير موجود." };
  const d = await draftOpener(l);
  await db.update(igLeads).set({ message: d.text, messageSource: d.source, ...(l.status === "queued" ? { status: "ready" } : {}), updatedAt: new Date() }).where(eq(igLeads.id, id));
  revalidatePath(PAGE);
  return { ok: true, message: d.text };
}

const editSchema = z.object({
  id: z.string().uuid(),
  message: z.string().trim().min(20).max(900).optional(),
  brandName: z.string().trim().max(80).nullable().optional(),
  note: z.string().trim().max(300).nullable().optional(),
  category: z.string().trim().max(60).nullable().optional(),
});

export async function updateLeadAction(raw: z.input<typeof editSchema>): Promise<Result> {
  if (!(await guard())) return { ok: false, error: "غير مصرح." };
  const p = editSchema.safeParse(raw);
  if (!p.success) return { ok: false, error: "الرسالة بين 20 و900 حرف." };
  const { id, ...rest } = p.data;
  await db
    .update(igLeads)
    .set({ ...rest, ...(rest.message ? { messageSource: "edited" } : {}), updatedAt: new Date() })
    .where(eq(igLeads.id, id));
  revalidatePath(PAGE);
  return { ok: true };
}

const statusSchema = z.object({ id: z.string().uuid(), status: z.enum(LEAD_STATUSES) });

export async function setLeadStatusAction(raw: z.input<typeof statusSchema>): Promise<Result> {
  if (!(await guard())) return { ok: false, error: "غير مصرح." };
  const p = statusSchema.safeParse(raw);
  if (!p.success) return { ok: false, error: "حالة غير صالحة." };
  const { id, status } = p.data;
  const now = new Date();
  const [l] = await db.select().from(igLeads).where(eq(igLeads.id, id)).limit(1);
  if (!l) return { ok: false, error: "الحساب غير موجود." };
  await db
    .update(igLeads)
    .set({
      status,
      ...(status === "sent" && !l.sentAt ? { sentAt: now } : {}),
      ...(["replied", "owner"].includes(status) && !l.repliedAt ? { repliedAt: now } : {}),
      // التخطي أو الإعادة للطابور يحرّر الموعد ليُعاد توزيعه.
      ...(status === "skipped" || PENDING_STATUSES.includes(status) ? { scheduledFor: null } : {}),
      updatedAt: now,
    })
    .where(eq(igLeads.id, id));
  if (PENDING_STATUSES.includes(status)) await scheduleQueue();
  revalidatePath(PAGE);
  return { ok: true };
}

export async function deleteLeadAction(id: string): Promise<Result> {
  if (!(await guard())) return { ok: false, error: "غير مصرح." };
  if (!idSchema.safeParse(id).success) return { ok: false, error: "طلب غير صالح." };
  await db.delete(igLeads).where(eq(igLeads.id, id));
  revalidatePath(PAGE);
  return { ok: true };
}

const settingsSchema = z.object({ dailyCap: z.number().int(), startHour: z.number().int(), endHour: z.number().int() });

export async function saveOutreachSettingsAction(raw: z.input<typeof settingsSchema>): Promise<Result<{ moved: number }>> {
  const u = await platformUser({ cap: "leads", write: true });
  if (!u) return { ok: false, error: "تعديل الجدول للمالك والمدير." };
  const p = settingsSchema.safeParse(raw);
  if (!p.success) return { ok: false, error: "قيم غير صالحة." };
  const s = outreachSettingsFrom(p.data);
  await setFlag(OUTREACH_FLAG, true, s, "جدول رسائل التواصل مع البراندات (/admin/outreach)");
  const moved = await rescheduleAll();
  revalidatePath(PAGE);
  return { ok: true, moved };
}
