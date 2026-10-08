"use server";
import { revalidatePath } from "next/cache";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { conversations, messages, intakes, systemEvents } from "@/db/schema";
import { getPlatformSession } from "@/server/auth";
import { meta } from "@/channels/meta";
import { aiText } from "@/ai/providers";

async function guard() { const u = await getPlatformSession(); if (!u) throw new Error("غير مصرح"); return u; }

export async function togglePauseAction(id: string, paused: boolean) {
  const u = await guard(); const [c] = await db.select().from(conversations).where(eq(conversations.id, id)); if (!c) return;
  await db.update(conversations).set({ botPaused: paused, stage: paused ? "human" : c.stage === "human" ? "persuasion" : c.stage, updatedAt: new Date() }).where(eq(conversations.id, id));
  await db.insert(systemEvents).values({ scope: "ai", actor: `platform:${u.id}`, message: paused ? "إيقاف المساعد (Takeover)" : "إعادة تشغيل المساعد", data: { conversationId: id } });
  revalidatePath("/admin/conversations");
}
/** رد بشري: يوقف المساعد ويرسل عبر القناة (مع tag خارج النافذة) ويحفظ */
export async function humanReplyAction(id: string, text: string) {
  const u = await guard(); const [c] = await db.select().from(conversations).where(eq(conversations.id, id)); if (!c) return { error: "محادثة غير موجودة" };
  const inWindow = c.lastUserMessageAt && Date.now() - c.lastUserMessageAt.getTime() < 23.5 * 36e5;
  try { await meta.text(c.channel, c.externalId, text, inWindow ? undefined : c.channel === "messenger" ? "ACCOUNT_UPDATE" : undefined); }
  catch (e) { return { error: `فشل الإرسال: ${String(e).slice(0, 160)}` }; }
  await db.insert(messages).values({ conversationId: id, role: "human_agent", text, model: u.name });
  await db.update(conversations).set({ botPaused: true, stage: "human", lastBotMessageAt: new Date(), updatedAt: new Date() }).where(eq(conversations.id, id));
  revalidatePath("/admin/conversations"); return {};
}
export async function setStageAction(id: string, stage: string) { await guard(); await db.update(conversations).set({ stage: stage as any, botPaused: stage === "human", updatedAt: new Date() }).where(eq(conversations.id, id)); revalidatePath("/admin/conversations"); }
/** ملخص سريع بـ Groq (رخيص) */
export async function summarizeLeadAction(id: string) {
  await guard(); const ms = (await db.select().from(messages).where(eq(messages.conversationId, id)).orderBy(desc(messages.createdAt)).limit(40)).reverse(); const [i] = await db.select().from(intakes).where(eq(intakes.conversationId, id));
  const r = await aiText("fast", { system: "لخّص المحادثة لمدير المبيعات في 5 نقاط قصيرة بالعربية: من العميل وماذا يبيع، أين هو في الرحلة، اعتراضاته، ما جُمع، والخطوة المقترحة التالية (جملة عملية).", messages: [{ role: "user", content: `الرسائل:\n${ms.map((m) => `${m.role}: ${m.text ?? "[مرفق]"}`).join("\n")}\n\nالبيانات: ${JSON.stringify(i?.brief ?? {})}\nمنتجات: ${i?.products.length ?? 0}\nسياسات: ${JSON.stringify(i?.policies ?? {})}` }], maxTokens: 450, temperature: 0.2 }, { purpose: "lead_summary", conversationId: id });
  return r.text;
}
