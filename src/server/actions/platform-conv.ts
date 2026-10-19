"use server";
import { revalidatePath } from "next/cache";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { conversations, messages, stores, systemEvents } from "@/db/schema";
import { requirePlatformCap } from "@/server/platform-guard";
import { meta, replyMode } from "@/channels/meta";
import { aiText } from "@/ai/providers";
import { isPauseChoice, pauseUntil, PAUSE_LABEL } from "@/agent/pause";
import { markSetupLinkSent, sendSetupLink } from "@/agent/setup-jobs";
import { handoffMessage, HANDOFF_TITLE, isHandoffKind } from "@/agent/handoff-messages";
import { handoffInputFor } from "@/agent/handoff-data";
import { patchMemory } from "@/agent/memory";

async function guard() { return requirePlatformCap("conversations", "غير مصرح"); }

/**
 * إيقاف الوكيل في هذه المحادثة: ساعة / 3 ساعات / 24 ساعة (يعود وحده) أو دائماً (حتى الاستئناف). قرار الفريق وحده؛ رد الموظف
 * وحده لا يوقف الوكيل.
 */
export async function pauseConversationAction(id: string, choice: string) {
  const u = await guard();
  if (!isPauseChoice(choice)) return { error: "مدة غير صالحة" };
  const [c] = await db.select().from(conversations).where(eq(conversations.id, id));
  if (!c) return { error: "محادثة غير موجودة" };
  const until = pauseUntil(choice);
  await db.update(conversations).set({ botPaused: true, botPausedUntil: until, stage: "human", updatedAt: new Date() }).where(eq(conversations.id, id));
  await patchMemory(id, { handoffBy: "team", handoffAt: new Date().toISOString() }).catch(() => {});
  await db.insert(systemEvents).values({ scope: "ai", actor: `platform:${u.id}`, message: `إيقاف المساعد (${PAUSE_LABEL[choice]})`, data: { conversationId: id } });
  revalidatePath("/admin/conversations");
  return {};
}

/** استئناف الوكيل فوراً في هذه المحادثة. */
export async function resumeConversationAction(id: string) {
  const u = await guard();
  const [c] = await db.select().from(conversations).where(eq(conversations.id, id));
  if (!c) return { error: "محادثة غير موجودة" };
  const stage = c.stage === "human" ? "persuasion" : c.stage === "handoff" ? (c.storeId ? "building" : "persuasion") : c.stage;
  await db.update(conversations).set({ botPaused: false, botPausedUntil: null, stage, updatedAt: new Date() }).where(eq(conversations.id, id));
  // استئناف يدوي لمحادثة أغلقها الوكيل بعد الموافقة: قرار الفريق، فتُمسح علامة الإغلاق.
  await patchMemory(id, { closedBy: null, handoffBy: null }).catch(() => {});
  await db.insert(systemEvents).values({ scope: "ai", actor: `platform:${u.id}`, message: "إعادة تشغيل المساعد", data: { conversationId: id } });
  revalidatePath("/admin/conversations");
  return {};
}

/** يرسل رابط الإعداد الآن بدل انتظار المهلة (أو يعيد إرساله بعد إرساله). */
export async function sendSetupLinkNowAction(storeId: string) {
  const u = await guard();
  const [s] = await db.select({ status: stores.status }).from(stores).where(eq(stores.id, storeId)).limit(1);
  if (!s) return { error: "المتجر غير موجود" };
  if (s.status !== "setup") return { error: "هذا المتجر أكمل إعداده بالفعل." };
  try {
    const r = await sendSetupLink(storeId, { force: true });
    if ("skip" in r) return { error: `لم يُرسل: ${r.skip}` };
    await db.insert(systemEvents).values({ scope: "ai", actor: `platform:${u.id}`, message: "أُرسل رابط الإعداد يدوياً", data: { storeId } });
    revalidatePath("/admin/conversations");
    return { sent: true as const, viaMeta: r.viaMeta, emailed: r.emailed };
  } catch (e) {
    return { error: String((e as Error)?.message ?? e).slice(0, 200) };
  }
}
/**
 * يرسل إحدى رسائل التسليم الجاهزة (رابط الإعداد، الدخول، المتجر جاهز) عبر القناة نفسها باسم الفريق. النص يُبنى على الخادم
 * من بيانات المتجر الحقيقية (لا نص من المتصفح). داخل 24 ساعة من آخر رسالة للعميل رسالة عادية، وحتى 7 أيام بوسم الرد البشري،
 * وبعدها ممنوع (تُنسخ وتُرسل بوسيلة أخرى). رسالة الإعداد تعلّم الرابط مُسلَّماً فتبدأ التذكيرات ومهلة الحذف.
 */
export async function sendHandoffMessageAction(conversationId: string, kind: string) {
  const u = await guard();
  if (!isHandoffKind(kind)) return { error: "رسالة غير معروفة" };
  const [c] = await db.select().from(conversations).where(eq(conversations.id, conversationId)).limit(1);
  if (!c) return { error: "محادثة غير موجودة" };
  if (!c.storeId) return { error: "لا متجر مرتبط بهذه المحادثة بعد." };
  const data = await handoffInputFor(c.storeId);
  if (!data) return { error: "المتجر غير موجود" };
  if (kind === "setup" && data.status !== "setup") return { error: "هذا المتجر أكمل إعداده؛ أرسلوا رسالة الدخول أو رابط المتجر." };
  const mode = replyMode(c.lastUserMessageAt);
  if (mode.mode === "closed") return { error: "مرّ أكثر من 7 أيام على آخر رسالة من العميل، ولا تسمح Meta بالرد الآن. انسخوا الرسالة وأرسلوها على واتساب أو البريد." };
  const text = handoffMessage(kind, data);
  try {
    await meta.text(c.channel, c.externalId, text, mode.mode === "human_agent" ? "HUMAN_AGENT" : undefined);
  } catch (e) {
    return { error: `فشل الإرسال: ${String(e).slice(0, 160)}` };
  }
  await db.insert(messages).values({ conversationId, role: "human_agent", text, model: u.name });
  await db.update(conversations).set({ lastBotMessageAt: new Date(), updatedAt: new Date() }).where(eq(conversations.id, conversationId));
  if (kind === "setup") await markSetupLinkSent(c.storeId, `platform:${u.id}`, "channel");
  await db.insert(systemEvents).values({ scope: "ai", actor: `platform:${u.id}`, message: `أُرسلت رسالة التسليم: ${HANDOFF_TITLE[kind]}`, data: { conversationId, storeId: c.storeId } });
  revalidatePath("/admin/conversations");
  revalidatePath("/admin/conversations/delivery");
  return { sent: true as const, tagged: mode.mode === "human_agent" };
}

/** بعد نسخ رسالة الإعداد وإرسالها بوسيلة أخرى: يعلّم الرابط مُسلَّماً (تبدأ التذكيرات ومهلة الحذف من الآن). */
export async function markSetupDeliveredAction(storeId: string) {
  const u = await guard();
  const r = await markSetupLinkSent(storeId, `platform:${u.id}`, "copy");
  if (!r.ok) return { error: r.error };
  revalidatePath("/admin/conversations");
  revalidatePath("/admin/conversations/delivery");
  return { ok: true as const, first: r.first };
}

/** رد بشري يرسل عبر القناة (مع tag خارج النافذة) ويحفظ. لا يوقف المساعد (قرار المالك 2026-10-12): الإيقاف بزر «أوقف المساعد» فقط. */
export async function humanReplyAction(id: string, text: string) {
  const u = await guard(); const [c] = await db.select().from(conversations).where(eq(conversations.id, id)); if (!c) return { error: "محادثة غير موجودة" };
  // رد بشري: عادي داخل 24 ساعة، وبوسم HUMAN_AGENT حتى 7 أيام (Meta)، وبعدها ممنوع.
  const mode = replyMode(c.lastUserMessageAt);
  if (mode.mode === "closed") return { error: "مرّ أكثر من 7 أيام على آخر رسالة من العميل، ولا تسمح Meta بالرد الآن. تواصل معه بوسيلة أخرى (بريد أو اتصال)." };
  try { await meta.text(c.channel, c.externalId, text, mode.mode === "human_agent" ? "HUMAN_AGENT" : undefined); }
  catch (e) { return { error: `فشل الإرسال: ${String(e).slice(0, 160)}` }; }
  await db.insert(messages).values({ conversationId: id, role: "human_agent", text, model: u.name });
  await db.update(conversations).set({ lastBotMessageAt: new Date(), updatedAt: new Date() }).where(eq(conversations.id, id));
  revalidatePath("/admin/conversations"); return {};
}
export async function setStageAction(id: string, stage: string) { await guard(); await db.update(conversations).set({ stage: stage as any, botPaused: stage === "human", botPausedUntil: null, updatedAt: new Date() }).where(eq(conversations.id, id)); revalidatePath("/admin/conversations"); }
/** ملخص سريع بـ Groq (رخيص) */
export async function summarizeLeadAction(id: string) {
  await guard(); const ms = (await db.select().from(messages).where(eq(messages.conversationId, id)).orderBy(desc(messages.createdAt)).limit(40)).reverse(); const [conv] = await db.select({ memory: conversations.memory }).from(conversations).where(eq(conversations.id, id)).limit(1);
  const r = await aiText("fast", { system: "لخّص المحادثة لمدير المبيعات في 5 نقاط قصيرة بالعربية: من العميل وماذا يبيع، أين هو في الرحلة، اعتراضاته، ما جُمع من بيانات المتجر، والخطوة المقترحة التالية (جملة عملية).", messages: [{ role: "user", content: `الرسائل:\n${ms.map((m) => `${m.role}: ${m.text ?? "[مرفق]"}`).join("\n")}\n\nما جُمع عنه: ${JSON.stringify((conv?.memory as { lead?: unknown } | null)?.lead ?? {})}` }], maxTokens: 450, temperature: 0.2 }, { purpose: "lead_summary", conversationId: id });
  return r.text;
}
