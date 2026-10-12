import "server-only";
// ig-outreach.ts — خادم قائمة تواصل Colapia مع البراندات (/admin/outreach): صياغة الرسالة الافتتاحية المخصصة بحدود
// صارمة، وتوزيع الطابور على الجدول اليومي، وربط الحساب بمحادثته حين يصل صدى رسالتنا أو ردّهم.
import { and, eq, inArray, isNotNull, isNull, or, gte, asc } from "drizzle-orm";
import { db } from "@/db/client";
import { igLeads } from "@/db/schema";
import { getFlag } from "@/lib/flags";
import { aiText } from "@/ai/providers";
import { meta } from "@/channels/meta";
import { cleanOpener, fallbackOpener, nextSlots, outreachSettingsFrom, PENDING_STATUSES, type OutreachSettings } from "@/lib/ig-outreach";

export const OUTREACH_FLAG = "outreach";

export async function outreachSettings(): Promise<OutreachSettings> {
  const f = await getFlag<Record<string, unknown>>(OUTREACH_FLAG).catch(() => ({ enabled: true, config: null }));
  return outreachSettingsFrom(f.config);
}

/** حدود الصياغة: مكتوبة هنا لا في لوحة قابلة للتعديل، حتى لا تخرج رسالة تعرّض الحساب للحظر أو تعد بما لا نقدمه. */
const OPENER_SYSTEM = `أنت تكتب رسالة أولى قصيرة على إنستجرام من حساب Colapia الرسمي إلى براند ملابس مصري لم يتواصل معنا من قبل.
الهدف الوحيد: أن يوصلونا بصاحب البراند أو المسؤول عن المبيعات. لا تبيع ولا تشرح العرض في هذه الرسالة.

البنية (3 أسطر قصيرة):
1. تحية باسم البراند ("مساء الخير يا {الاسم}") إن ذُكر اسم البراند، وإلا «مساء الخير» فقط (لا تنادِ باسم الحساب اللاتيني)، وإيموجي واحد خفيف كحد أقصى.
2. مدح محدد وصادق مبني فقط على ملاحظة المالك إن وُجدت (نوع المنتجات، الستايل)، وإلا مدح عام مهذب للكولكشن. لا تخترع تفاصيل لم تُذكر.
3. «عندنا عرض لصاحب البراند أو المسؤول عن المبيعات ممكن يفرق معاكم في الطلبات من إنستجرام» ثم طلب مهذب: «ممكن توصّلونا بيه هنا في الشات؟».

قواعد قطعية:
- عامية مصرية راقية، مخاطبة بصيغة الجمع (حضرتكم/معاكم).
- بين 180 و420 حرفاً.
- ممنوع: أي سعر أو رقم، أي رابط، اسم أي تقنية، الذكاء الاصطناعي، «عرض لفترة محدودة» أو أي ضغط أو ندرة، وعود بأرقام مبيعات.
- لا تكرر نفس الصياغة حرفياً لكل براند: نوّع الكلمات مع الحفاظ على البنية.
- أخرج نص الرسالة فقط، بلا علامات تنصيص ولا شرح.`;

/** يصوغ رسالة مخصصة للحساب، وإن فشلت الصياغة أو خالفت الحدود يرجع للرسالة الاحتياطية. */
export async function draftOpener(lead: { handle: string; brandName: string | null; note: string | null; category: string | null }): Promise<{ text: string; source: "ai" | "template" }> {
  const facts = [
    `اسم الحساب: @${lead.handle}`,
    lead.brandName ? `اسم البراند: ${lead.brandName}` : null,
    lead.category ? `النوع: ${lead.category}` : null,
    lead.note ? `ملاحظة المالك: ${lead.note}` : null,
  ]
    .filter(Boolean)
    .join("\n");
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await aiText(
        "chat",
        { system: OPENER_SYSTEM, messages: [{ role: "user", content: facts }], maxTokens: 260, temperature: 0.8, timeoutMs: 12_000 },
        { purpose: "outreach_opener" }
      );
      const clean = cleanOpener(r.text);
      if (clean) return { text: clean, source: "ai" };
    } catch (e) {
      console.error("[outreach] draft failed", e);
    }
  }
  return { text: fallbackOpener(lead), source: "template" };
}

/** يعطي مواعيد لكل حساب في الطابور بلا موعد، ضمن الحد اليومي (ما أُرسل اليوم يُحسب). */
export async function scheduleQueue(now = new Date()): Promise<number> {
  const s = await outreachSettings();
  const waiting = await db
    .select({ id: igLeads.id })
    .from(igLeads)
    .where(and(inArray(igLeads.status, PENDING_STATUSES), isNull(igLeads.scheduledFor)))
    .orderBy(asc(igLeads.createdAt));
  if (!waiting.length) return 0;
  const since = new Date(now.getTime() - 36 * 3_600_000);
  const takenRows = await db
    .select({ at: igLeads.scheduledFor, sentAt: igLeads.sentAt, status: igLeads.status })
    .from(igLeads)
    .where(or(and(inArray(igLeads.status, PENDING_STATUSES), isNotNull(igLeads.scheduledFor)), gte(igLeads.sentAt, since)));
  const taken = takenRows.map((r) => (r.sentAt ?? r.at)!).filter(Boolean);
  const slots = nextSlots(now, waiting.length, taken, s);
  for (let i = 0; i < waiting.length && i < slots.length; i++) {
    await db.update(igLeads).set({ scheduledFor: slots[i], updatedAt: new Date() }).where(eq(igLeads.id, waiting[i]!.id));
  }
  return Math.min(waiting.length, slots.length);
}

/** يعيد توزيع كل ما لم يُرسل بعد (بعد تغيير الحد اليومي أو النافذة). */
export async function rescheduleAll(now = new Date()): Promise<number> {
  await db.update(igLeads).set({ scheduledFor: null }).where(inArray(igLeads.status, PENDING_STATUSES));
  return scheduleQueue(now);
}

/**
 * صدى رسالتنا الافتتاحية وصل (webhooks/meta): نربط المحادثة بالحساب في القائمة باسم المستخدم، ونعدّها «أُرسلت»
 * حتى لو نسي المالك الضغط على «أرسلتها».
 */
export async function linkOutreachConversation(conversationId: string, channel: "messenger" | "instagram", externalId: string): Promise<void> {
  const username = await meta.username(channel, externalId);
  if (!username) return;
  await db
    .update(igLeads)
    .set({ conversationId, sentAt: new Date(), status: "sent", updatedAt: new Date() })
    .where(and(eq(igLeads.handle, username), isNull(igLeads.conversationId), inArray(igLeads.status, ["queued", "ready", "sent"])));
}

/** أول رد منهم على محادثة مربوطة بحساب في القائمة. */
export async function markOutreachReplied(conversationId: string): Promise<void> {
  await db
    .update(igLeads)
    .set({ status: "replied", repliedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(igLeads.conversationId, conversationId), eq(igLeads.status, "sent")));
}
