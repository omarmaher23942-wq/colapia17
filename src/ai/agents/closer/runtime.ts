import "server-only";
import { currentPricing } from "@/server/pricing";
import { lifecycleTimings } from "@/lifecycle/timings";
import { and, desc, eq, like, sql } from "drizzle-orm";
import type { ModelMessage } from "ai";
import { db } from "@/db/client";
import { conversations, messages } from "@/db/schema";
import { meta as metaApi } from "@/channels/meta";
import { trace } from "@/lib/meta-trace";
import { aiText, extractJson } from "@/ai/providers";
import { getPrompt } from "@/ai/prompts";
import { isOn } from "@/lib/flags";
import { issueIntakeLink, type IntakePrefill } from "@/intake/link";
import { derivedToken } from "@/intake/tokens";
import { clientEnv } from "@/lib/env";
import { redis } from "@/lib/redis";
import { notifyAdmin } from "@/ai/lifecycle/notify";
import { alertAgentDegraded } from "./alerts";
import { closerTurnSchema, type CloserTurn } from "./turn";
import { LINK_REPEAT_MS, MAX_MESSAGES_PER_HOUR, RATE_NOTICE } from "./policy";

type Channel = "messenger" | "instagram";
type InboundAttachment = { type: "image" | "video" | "audio" | "file"; url?: string };
type Inbound = {
  mid: string;
  text?: string;
  quickReply?: string;
  attachments: InboundAttachment[];
  timestamp: number;
};
type Conv = typeof conversations.$inferSelect;

const AI_ATTEMPT_MS = 14_000;
const HISTORY_LIMIT = 30;
/** علامة في نص رسالة الوكيل المحفوظة تدل على أن زر الاستمارة أُرسل معها (يُستخدم لعدم تكراره). */
const LINK_MARK = "[زر الاستمارة:";
const LINK_MARK_RE = /\n?\[زر الاستمارة:[^\]]*\]/g;

async function interpolateVars(): Promise<Record<string, string>> {
  const [{ price, basePrice, renewal, remaining }, timings] = await Promise.all([currentPricing(), lifecycleTimings()]);
  const discounted = basePrice > price;
  return {
    price: String(price),
    basePrice: String(basePrice),
    // سطر السعر بصيغته الصادقة: «بدلاً من» فقط إن كان هناك سعر أعلى فعلاً.
    priceLine: discounted ? `${formatEgpNumber(price)} جنيه بدلاً من ${formatEgpNumber(basePrice)}` : `${formatEgpNumber(price)} جنيه`,
    renewal: String(renewal),
    trialHours: String(timings.trialHours),
    // ندرة حقيقية فقط: عدّاد من المدفوعات المؤكدة (فارغ إن لم يكن للسعر حد).
    remainingLine: remaining ? `باقٍ ${remaining} ${remaining === 1 ? "متجر" : remaining <= 10 ? "متاجر" : "متجراً"} فقط بهذا السعر. ` : "",
  };
}

function formatEgpNumber(n: number): string {
  return n.toLocaleString("en-US");
}

/**
 * رابط ما يحتاجه العميل الآن من هذه المحادثة: الاستمارة (مملوءة مسبقاً بما كتبه) أو صفحة متابعة طلبه إن أرسله، أو
 * null إن كان طلبه مغلقاً (سبام/مسحوب: يحال للفريق).
 */
async function linkFor(conv: Conv, channel: Channel, prefill?: IntakePrefill): Promise<{ url: string; kind: "form" | "follow" } | null> {
  const r = await issueIntakeLink({ conversationId: conv.id, source: channel, prefill });
  if (r.status === "submitted") return { url: `${clientEnv.NEXT_PUBLIC_APP_URL}/follow/${derivedToken("track", r.requestId)}`, kind: "follow" };
  if (r.status === "closed") return null;
  return { url: r.url, kind: "form" };
}

type Row = { role: string; text: string | null; at: Date };

/** سجل المحادثة للنموذج: بلا روابط الأزرار، وبلا تكرار رسالة بدل صداها، ورد الموظف يُعدّ ردّنا. */
function modelHistory(rows: Row[]): ModelMessage[] {
  const out: ModelMessage[] = [];
  for (const m of rows) {
    const text = (m.text ?? "").replace(LINK_MARK_RE, "\n[أُرسل زر الاستمارة مع هذا الرد]").trim();
    if (!text) continue;
    const role = m.role === "user" ? ("user" as const) : ("assistant" as const);
    const prev = out[out.length - 1];
    if (prev && prev.role === role && prev.content === text) continue;
    out.push({ role, content: text });
  }
  return out.length ? out : [{ role: "user", content: "مرحباً" }];
}

/** حالة المحادثة التي تُلحق بالتعليمات: ما قيل وهل أُرسل الزر وذاكرة الوكيل، حتى لا يكرر نفسه ويبني على ما عرفه. */
function stateBlock(input: { replies: number; linkSentAt: number | null; priceMentioned: boolean; summary: string; known: { business?: string; storeName?: string }; now: number }): string {
  const link =
    input.linkSentAt === null
      ? "لم يُرسل بعد"
      : `أُرسل قبل ${Math.max(1, Math.round((input.now - input.linkSentAt) / 60_000))} دقيقة (لا تعرضه ثانية إلا إن طلبه)`;
  return [
    "",
    "# حالة هذه المحادثة (للعلم، لا تذكرها في ردك):",
    `- ردودك السابقة: ${input.replies}${input.replies === 0 ? " (هذا أول رد)" : " (لا ترحب ولا تعرّف بنفسك مجدداً)"}`,
    `- زر الاستمارة: ${link}`,
    `- السعر: ${input.priceMentioned ? "ذُكر سابقاً" : "لم يُذكر بعد"}`,
    input.known.business || input.known.storeName ? `- ما عرفناه: ${[input.known.business && `نشاطه: ${input.known.business}`, input.known.storeName && `اسم متجره: ${input.known.storeName}`].filter(Boolean).join("، ")}` : "- لا نعرف نشاطه بعد",
    input.summary ? `- ذاكرتك عنه (من أدوارك السابقة، حدّثها في الحقل memory):\n${input.summary}` : "- ذاكرتك عنه: فارغة (ابدأ تدوينها في الحقل memory)",
  ].join("\n");
}

/** دور واحد مع النموذج: نص بصيغة JSON نحلله بتسامح (لا مخرجات منظمة تتعثر)، ونص عادي بلا JSON يُقبل رداً. */
async function converse(system: string, messages: ModelMessage[], conversationId?: string): Promise<{ turn: CloserTurn; provider: string }> {
  const instruction = `${system}\n\nأخرج JSON فقط بلا Markdown ولا أي نص خارجه.`;
  // ناتج صالح = رد غير فارغ أو طلب تحويل لموظف؛ غير ذلك (نص فارغ من نموذج يستهلك مخرجاته في التفكير مثلاً) يجرّب النموذج التالي.
  const parse = (raw: string) => {
    let obj: unknown = null;
    try {
      obj = extractJson(raw);
    } catch {
      obj = null;
    }
    const p = closerTurnSchema.safeParse(obj ?? { reply: raw.replace(/[{}"]/g, "") });
    return p.success && (p.data.reply || p.data.requestHuman) ? p.data : null;
  };
  const r = await aiText("chat", { system: instruction, messages, temperature: 0.7, maxTokens: 1600, timeoutMs: AI_ATTEMPT_MS, accept: (t) => parse(t.trim()) !== null }, { purpose: "closer", conversationId });
  const parsed = { success: true as const, data: parse(r.text.trim())! };
  return { turn: parsed.data, provider: r.provider };
}

const norm = (s: string) => s.replace(LINK_MARK_RE, "").replace(/\s+/g, " ").trim();

export async function handleInbound(channel: Channel, senderId: string, batch: Inbound[]) {
  const botOn = (await isOn("bot.enabled")) && (channel !== "instagram" || (await isOn("bot.instagram")));

  const conv = await getOrCreateConversation(channel, senderId);
  if (!conv) return;

  if (botOn) await metaApi.seen(channel, senderId);

  // سجل inbound messages.
  const userTexts: string[] = [];
  for (const m of batch) {
    const text = (m.quickReply ?? m.text ?? "").trim();
    if (text) userTexts.push(text);
    await db
      .insert(messages)
      .values({
        conversationId: conv.id,
        role: "user",
        externalMid: m.mid,
        text: text || "[مرفق]",
        attachments: m.attachments.filter((a): a is InboundAttachment & { url: string } => typeof a.url === "string"),
      })
      .onConflictDoNothing();
  }

  await db
    .update(conversations)
    .set({
      lastUserMessageAt: new Date(),
      unreadForAdmin: sql`${conversations.unreadForAdmin} + ${batch.length}`,
      updatedAt: new Date(),
    })
    .where(eq(conversations.id, conv.id));

  // الوكيل يتوقف في هذه المحادثة فقط إن أوقفه المالك من لوحة المحادثات (أو حوّلها الوكيل لموظف).
  if (conv.botPaused && conv.stage === "human") return;

  if (!botOn) return;

  const lastUserMessage = userTexts.join(" ").trim();

  // حد رسائل المرسل الواحد في الساعة: يحمي فاتورة الذكاء الاصطناعي من الإغراق والحلقات الآلية.
  const used = await redis
    .incr(`bot:rl:${channel}:${senderId}`)
    .then(async (n) => {
      if (n === 1) await redis.expire(`bot:rl:${channel}:${senderId}`, 3600);
      return n;
    })
    .catch(() => 0);
  if (used > MAX_MESSAGES_PER_HOUR) {
    // تنبيه واحد فقط لكل ساعة ثم صمت.
    if (used === MAX_MESSAGES_PER_HOUR + 1) await metaApi.text(channel, senderId, RATE_NOTICE).catch(() => {});
    return;
  }

  const [vars, rows, linkRow] = await Promise.all([interpolateVars(), recentRows(conv.id), lastLinkAt(conv.id)]);
  const linkSentAt = linkRow?.getTime() ?? null;
  const now = Date.now();
  const assistantTexts = rows.filter((r) => r.role !== "user").map((r) => norm(r.text ?? ""));
  const priceMentioned = rows.some((r) => r.role !== "user" && (r.text ?? "").includes(formatEgpNumber(Number(vars.price))));
  const mem = (conv.memory as Record<string, unknown> | null) ?? {};
  const known = (mem.known ?? {}) as { business?: string; storeName?: string };
  const summary = typeof mem.summary === "string" ? mem.summary : "";

  // رسالة بلا نص (صورة أو رسالة صوتية أو ملف): لا نخمّن محتواها.
  if (!lastUserMessage) {
    await sendText(channel, senderId, conv, "وصلتنا رسالتكم. ممكن تكتبوا سؤالكم نصاً عشان نرد عليكم بدقة؟");
    return;
  }

  await metaApi.typing(channel, senderId, true);

  let turn: CloserTurn;
  try {
    const system = (await getPrompt("closer.chat", vars)) + stateBlock({ replies: assistantTexts.length, linkSentAt, priceMentioned, summary, known, now });
    ({ turn } = await converse(system, modelHistory(rows), conv.id));
    if (!turn.reply && !turn.requestHuman) throw new Error("empty reply from model");
    // نفس رد سبق حرفياً (نموذج متعثر): محاولة ثانية بتنبيه صريح، فإن تكرر لا نرسله.
    if (!turn.requestHuman && assistantTexts.slice(-4).includes(norm(turn.reply))) {
      ({ turn } = await converse(system + `\n- تنبيه: ردك السابق كان بنفس هذا النص حرفياً. أجب بما هو جديد ومفيد، لا تكرر.`, modelHistory(rows), conv.id));
      if (assistantTexts.slice(-4).includes(norm(turn.reply))) throw new Error("repeated reply");
    }
  } catch (err) {
    // لا ردود احتياطية جاهزة (قرار المالك): الصمت أفضل من رد غبي. المحادثة تبقى «غير مقروءة» للفريق ويصل المالك تنبيه بالسبب.
    const why = String((err as Error)?.message ?? err);
    console.error("[closer] AI turn failed, staying silent:", why);
    await trace("ai-fail", why);
    await alertAgentDegraded(why, conv.id).catch(() => {});
    await metaApi.typing(channel, senderId, false);
    return;
  }

  // الوكيل رأى أن الموقف يحتاج إنساناً: يرد بما كتبه ثم نوقفه ونبلّغ الفريق.
  if (turn.requestHuman) {
    await handoffToHuman(channel, senderId, conv, turn.requestHuman, turn.reply);
    await metaApi.typing(channel, senderId, false);
    return;
  }

  // ذاكرة الدور: ملاحظات الوكيل المضغوطة + ما قاله العميل صراحة.
  const nextKnown = { ...known, ...(turn.business ? { business: turn.business } : {}), ...(turn.storeName ? { storeName: turn.storeName } : {}) };
  await db
    .update(conversations)
    .set({ memory: { ...mem, known: nextKnown, ...(turn.memory ? { summary: turn.memory } : {}) } })
    .where(eq(conversations.id, conv.id))
    .catch(() => {});

  // الزر: قرار الوكيل وحده، لكن لا يتكرر خلال 20 دقيقة.
  const linkRecent = linkSentAt !== null && now - linkSentAt < LINK_REPEAT_MS;
  if (turn.issueLink && !linkRecent) {
    try {
      const issued = await linkFor(conv, channel, { storeName: turn.storeName, oneLine: turn.business, social: turn.social, whatsapp: turn.whatsapp });
      if (!issued) {
        await handoffToHuman(channel, senderId, conv, "طلب سابق مغلق لنفس المحادثة", turn.reply);
        await metaApi.typing(channel, senderId, false);
        return;
      }
      const buttonTitle = issued.kind === "follow" ? "متابعة متجرك" : turn.buttonTitle || "ابدأ استمارة متجرك";
      const text = issued.kind === "follow" ? `${turn.reply}\n\nاستمارتكم وصلتنا، وتتابعوا متجركم من هنا:` : turn.reply;
      await metaApi.buttons(channel, senderId, text, [{ title: buttonTitle, url: issued.url }]);
      await db.insert(messages).values({ conversationId: conv.id, role: "assistant", text: `${text}\n${LINK_MARK} ${buttonTitle} -> ${issued.url}]` });
      await db.update(conversations).set({ stage: "link_sent", lastBotMessageAt: new Date(), updatedAt: new Date() }).where(eq(conversations.id, conv.id));
    } catch (e) {
      console.error("[closer] intake link failed:", e);
      await sendText(channel, senderId, conv, turn.reply);
    }
  } else {
    await sendText(channel, senderId, conv, turn.reply, conv.stage === "greeting" ? "discovery" : undefined);
  }

  await metaApi.typing(channel, senderId, false);
}

/**
 * تجربة كاملة للوكيل بلا إرسال ولا حفظ: نفس البرومبت ونفس المخطط ونفس سلسلة النماذج، فيظهر لمركز الجاهزية ما كان
 * سيرد به على رسالة حقيقية (أو سبب العجز بنص خطأ كل نموذج). اختبار «نموذج يرد بكلمة» وحده لا يكشف فشل المخرجات المنظمة.
 */
export async function probeAgent(text: string): Promise<{ ok: true; reply: string; issueLink: boolean; provider: string; mode: string; ms: number } | { ok: false; error: string }> {
  const t0 = Date.now();
  try {
    const vars = await interpolateVars();
    const system = (await getPrompt("closer.chat", vars)) + stateBlock({ replies: 0, linkSentAt: null, priceMentioned: false, summary: "", known: {}, now: Date.now() });
    const { turn, provider } = await converse(system, [{ role: "user", content: text.slice(0, 300) }]);
    const reply = turn.reply || (turn.requestHuman ? "(حوّل لموظف) " + turn.requestHuman : "");
    return { ok: true, reply, issueLink: turn.issueLink, provider, mode: "object", ms: Date.now() - t0 };
  } catch (e) {
    return { ok: false, error: String((e as Error)?.message ?? e).slice(0, 700) };
  }
}

/** رد نصي عادي: يُرسل ثم يُحفظ في سجل المحادثة. */
async function sendText(channel: Channel, senderId: string, conv: Conv, text: string, stage?: Conv["stage"]) {
  await metaApi.text(channel, senderId, text);
  await db.insert(messages).values({ conversationId: conv.id, role: "assistant", text });
  await db
    .update(conversations)
    .set({ lastBotMessageAt: new Date(), updatedAt: new Date(), ...(stage ? { stage } : {}) })
    .where(eq(conversations.id, conv.id));
}

/** آخر رسائل المحادثة بترتيب زمني (الأقدم أولاً). */
async function recentRows(conversationId: string): Promise<Row[]> {
  const rows = await db
    .select({ role: messages.role, text: messages.text, at: messages.createdAt })
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(desc(messages.createdAt))
    .limit(HISTORY_LIMIT);
  return rows.reverse().filter((m) => m.text && m.text.trim());
}

/** وقت آخر مرة أُرسل فيها زر الاستمارة في هذه المحادثة (أو null). */
async function lastLinkAt(conversationId: string): Promise<Date | null> {
  const [row] = await db
    .select({ at: messages.createdAt })
    .from(messages)
    .where(and(eq(messages.conversationId, conversationId), eq(messages.role, "assistant"), like(messages.text, `%${LINK_MARK}%`)))
    .orderBy(desc(messages.createdAt))
    .limit(1);
  return row?.at ?? null;
}

/** يرسل ردّ الوكيل الأخير (إن كتب)، ثم يوقفه لهذه المحادثة وينبّه المالك. تظهر بحالة «تدخل بشري» في /admin/conversations. */
async function handoffToHuman(channel: Channel, senderId: string, conv: Conv, reason: string, reply?: string) {
  const text = reply?.trim() || "تمام، هحوّل المحادثة لحد من فريق Colapia وهيرد عليكم.";
  await metaApi.text(channel, senderId, text).catch((e) => console.error("[closer] handoff reply failed", e));
  await db.insert(messages).values({ conversationId: conv.id, role: "assistant", text });
  await db.update(conversations).set({ botPaused: true, stage: "human", lastBotMessageAt: new Date(), updatedAt: new Date() }).where(eq(conversations.id, conv.id));
  await notifyAdmin(`محادثة تحتاج موظفاً بشرياً (${channel}): ${reason.slice(0, 160)}`, { conversationId: conv.id });
}

async function getOrCreateConversation(channel: Channel, senderId: string): Promise<Conv | undefined> {
  const where = and(eq(conversations.channel, channel), eq(conversations.externalId, senderId));

  const [found] = await db.select().from(conversations).where(where).limit(1);
  if (found) return found;

  const name = await metaApi.profile(channel, senderId);
  const [created] = await db
    .insert(conversations)
    .values({ channel, externalId: senderId, profileName: name ?? undefined })
    .onConflictDoNothing()
    .returning();

  return created ?? (await db.select().from(conversations).where(where).limit(1))[0];
}
