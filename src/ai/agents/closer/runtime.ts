import "server-only";
import { currentPricing } from "@/server/pricing";
import { lifecycleTimings } from "@/lifecycle/timings";
import { and, desc, eq, like, sql } from "drizzle-orm";
import type { ModelMessage } from "ai";
import { db } from "@/db/client";
import { conversations, messages } from "@/db/schema";
import { meta as metaApi } from "@/channels/meta";
import { trace } from "@/lib/meta-trace";
import { aiObjectWithMeta } from "@/ai/providers";
import { getPrompt } from "@/ai/prompts";
import { isOn } from "@/lib/flags";
import { issueIntakeLink, type IntakePrefill } from "@/intake/link";
import { derivedToken } from "@/intake/tokens";
import { clientEnv } from "@/lib/env";
import { redis } from "@/lib/redis";
import { notifyAdmin } from "@/ai/lifecycle/notify";
import { alertAgentDegraded } from "./alerts";
import { closerTurnSchema, type CloserTurn } from "./turn";
import { ASK_BOT_REPLY, HANDOFF_REPLY, LINK_REPEAT_MS, MAX_MESSAGES_PER_HOUR, RATE_NOTICE, asksIfBot, wantsHuman } from "./policy";
import { ruleReply, type ReplyVars } from "./replies";

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
const HISTORY_LIMIT = 16;
/** علامة في نص رسالة الوكيل المحفوظة تدل على أن زر الاستمارة أُرسل معها (يُستخدم لعدم تكراره). */
const LINK_MARK = "[زر الاستمارة:";
const LINK_MARK_RE = /\n?\[زر الاستمارة:[^\]]*\]/g;
const EXPLICIT_LINK_RE = /(ابعت|ابعتلي|ابعتيلي|هات|فين)\s*(الفورم|الرابط|اللينك|الاستمارة|الزر)|(نبدأ|نبدا|يلا\s*بينا|موافق|ابعته|ابعتها)/i;
const MENTIONS_LINK_RE = /(الزر|الزرار|الرابط|اللينك|الاستمارة|استمارة|التسجيل)/i;

async function interpolateVars(): Promise<Record<string, string> & ReplyVars> {
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

/** حالة المحادثة التي تُلحق بالتعليمات: ما قيل وهل أُرسل الزر، حتى لا يكرر الوكيل نفسه. */
function stateBlock(input: { replies: number; linkSentAt: number | null; priceMentioned: boolean; known: { business?: string; storeName?: string }; now: number }): string {
  const link =
    input.linkSentAt === null
      ? "لم يُرسل بعد"
      : `أُرسل قبل ${Math.max(1, Math.round((input.now - input.linkSentAt) / 60_000))} دقيقة (لا تطلبه ثانية ولا تذكر الزر إلا إن طلبه العميل)`;
  return [
    "",
    "# حالة هذه المحادثة (للعلم، لا تذكرها في ردك):",
    `- ردودك السابقة: ${input.replies}${input.replies === 0 ? " (هذا أول رد: ترحيب بجملة واحدة)" : " (لا ترحب ولا تعرّف بنفسك مجدداً)"}`,
    `- زر الاستمارة: ${link}`,
    `- السعر: ${input.priceMentioned ? "ذُكر سابقاً (لا تعد ذكره إلا إن سأل)" : "لم يُذكر بعد"}`,
    input.known.business || input.known.storeName ? `- ما عرفناه عنه: ${[input.known.business && `نشاطه: ${input.known.business}`, input.known.storeName && `اسم متجره: ${input.known.storeName}`].filter(Boolean).join("، ")}` : "- لا نعرف نشاطه بعد",
  ].join("\n");
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

  // «انت بوت ولا إنسان؟»: جواب صادق بلا ذكاء اصطناعي ولا تحويل. وطلب صريح لموظف: نوقف الوكيل ونحوّل لفريقنا.
  if (lastUserMessage && asksIfBot(lastUserMessage)) {
    await sendText(channel, senderId, conv, ASK_BOT_REPLY);
    return;
  }
  if (lastUserMessage && wantsHuman(lastUserMessage)) {
    await handoffToHuman(channel, senderId, conv, "طلب العميل موظفاً");
    return;
  }

  const [vars, rows, linkRow] = await Promise.all([interpolateVars(), recentRows(conv.id), lastLinkAt(conv.id)]);
  const linkSentAt = linkRow?.getTime() ?? null;
  const now = Date.now();
  // ما قلناه سابقاً (ردود الوكيل وردود الموظفين) لمنع التكرار.
  const before = rows;
  const assistantTexts = before.filter((r) => r.role !== "user").map((r) => norm(r.text ?? ""));
  const priceMentioned = before.some((r) => r.role !== "user" && (r.text ?? "").includes(formatEgpNumber(Number(vars.price))));
  const known = ((conv.memory as Record<string, unknown> | null)?.known ?? {}) as { business?: string; storeName?: string };

  await metaApi.typing(channel, senderId, true);

  // رسالة بلا نص (صورة أو رسالة صوتية أو ملف): لا نخمّن محتواها.
  if (!lastUserMessage) {
    await sendText(channel, senderId, conv, "وصلتنا رسالتكم. ممكن تكتبوا سؤالكم نصاً عشان نرد عليكم بدقة؟");
    await metaApi.typing(channel, senderId, false);
    return;
  }

  type Decision = { reply: string; issueLink: boolean; buttonTitle: string; requestHuman?: string | null; prefill: IntakePrefill; source: "ai" | "rules" };
  let decision: Decision;
  let turn: CloserTurn | null = null;
  try {
    const system =
      (await getPrompt("closer.chat", vars)) +
      stateBlock({ replies: assistantTexts.length, linkSentAt, priceMentioned, known, now });
    const r = await aiObjectWithMeta(
      "chat",
      {
        schema: closerTurnSchema,
        schemaName: "CloserTurn",
        system,
        messages: modelHistory(rows),
        temperature: 0.6,
        maxTokens: 600,
        timeoutMs: AI_ATTEMPT_MS,
      },
      { purpose: "closer", conversationId: conv.id }
    );
    turn = r.object;
    if (!turn.reply && !turn.requestHuman) throw new Error("empty reply from model");
    decision = {
      reply: turn.reply,
      issueLink: turn.issueLink,
      buttonTitle: turn.buttonTitle,
      requestHuman: turn.requestHuman,
      prefill: { storeName: turn.storeName, oneLine: turn.business, social: turn.social, whatsapp: turn.whatsapp },
      source: "ai",
    };
    // نفس رد سبق حرفياً: لا نعيده (يحدث مع نموذج متعثر)؛ ردّ القواعد يختار صيغة جديدة.
    if (!decision.requestHuman && assistantTexts.slice(-4).includes(norm(decision.reply))) throw new Error("repeated reply");
  } catch (err) {
    const why = String((err as Error)?.message ?? err);
    console.error("[closer] AI turn unusable, using rule-based reply:", why);
    await trace("ai-fail", why);
    // ننبّه المالك فقط حين يكون السبب تعطل الذكاء الاصطناعي لا تكرار رد.
    if (!/repeated reply/.test(why)) await alertAgentDegraded(why, conv.id).catch(() => {});
    const r = ruleReply({
      text: lastUserMessage,
      history: before.map((x) => ({ role: x.role === "user" ? ("user" as const) : ("assistant" as const), text: x.text ?? "" })),
      linkSentAt,
      now,
      vars,
    });
    decision = { reply: r.reply, issueLink: r.issueLink, buttonTitle: r.buttonTitle, requestHuman: r.requestHuman, prefill: {}, source: "rules" };
  }

  // الذكاء الاصطناعي (أو القواعد) رأى أن الموقف يحتاج إنساناً.
  if (decision.requestHuman) {
    await handoffToHuman(channel, senderId, conv, decision.requestHuman);
    await metaApi.typing(channel, senderId, false);
    return;
  }

  // ما عرفناه من كلامه يُحفظ لدور لاحق (النشاط والاسم).
  if (decision.prefill.oneLine || decision.prefill.storeName) {
    const nextKnown = { ...known, ...(decision.prefill.oneLine ? { business: decision.prefill.oneLine } : {}), ...(decision.prefill.storeName ? { storeName: decision.prefill.storeName } : {}) };
    await db
      .update(conversations)
      .set({ memory: { ...((conv.memory as Record<string, unknown> | null) ?? {}), known: nextKnown } })
      .where(eq(conversations.id, conv.id))
      .catch(() => {});
  }

  // ─── قواعد تفعيل الرابط: مرة، ولا يتكرر إلا بطلب صريح ────────────────────
  const explicit = EXPLICIT_LINK_RE.test(lastUserMessage);
  const linkRecent = linkSentAt !== null && now - linkSentAt < LINK_REPEAT_MS;
  // رد يعد بزر/رابط دون أن نرسله يربك العميل: إن ذكر الرد الرابط والنموذج لم يطلبه نرسله (إلا إن أُرسل قبل قليل).
  const promisesLink = decision.source === "ai" && MENTIONS_LINK_RE.test(decision.reply);
  const sendLink = (decision.issueLink || explicit || promisesLink) && (!linkRecent || explicit);

  if (sendLink) {
    try {
      const issued = await linkFor(conv, channel, decision.prefill);
      if (!issued) {
        await handoffToHuman(channel, senderId, conv, "طلب سابق مغلق لنفس المحادثة");
        await metaApi.typing(channel, senderId, false);
        return;
      }
      const buttonTitle = issued.kind === "follow" ? "متابعة متجرك" : decision.buttonTitle || "ابدأ استمارة متجرك";
      const text = issued.kind === "follow" ? `${decision.reply}\n\nاستمارتكم وصلتنا، وتتابعوا متجركم من هنا:` : decision.reply;
      await metaApi.buttons(channel, senderId, text, [{ title: buttonTitle, url: issued.url }]);
      await db.insert(messages).values({ conversationId: conv.id, role: "assistant", text: `${text}\n${LINK_MARK} ${buttonTitle} -> ${issued.url}]` });
      await db
        .update(conversations)
        .set({ stage: "link_sent", lastBotMessageAt: new Date(), updatedAt: new Date() })
        .where(eq(conversations.id, conv.id));
    } catch (e) {
      console.error("[closer] intake link failed:", e);
      await sendText(channel, senderId, conv, decision.reply);
    }
  } else {
    await sendText(channel, senderId, conv, decision.reply, conv.stage === "greeting" ? "discovery" : undefined);
  }

  await metaApi.typing(channel, senderId, false);
}

/**
 * تجربة كاملة للوكيل بلا إرسال ولا حفظ: نفس البرومبت ونفس المخطط ونفس سلسلة النماذج، فيظهر لمركز الجاهزية ما كان
 * سيرد به على رسالة حقيقية (أو سبب العجز بنص خطأ كل نموذج). اختبار «نموذج يرد بكلمة» وحده لا يكشف فشل المخرجات المنظمة.
 */
export async function probeAgent(text: string): Promise<{ ok: true; reply: string; issueLink: boolean; provider: string; mode: string; ms: number } | { ok: false; error: string }> {
  try {
    const vars = await interpolateVars();
    const system = (await getPrompt("closer.chat", vars)) + stateBlock({ replies: 0, linkSentAt: null, priceMentioned: false, known: {}, now: Date.now() });
    const r = await aiObjectWithMeta(
      "chat",
      { schema: closerTurnSchema, schemaName: "CloserTurn", system, messages: [{ role: "user", content: text.slice(0, 300) }], temperature: 0.6, maxTokens: 600, timeoutMs: AI_ATTEMPT_MS },
      { purpose: "closer_probe" }
    );
    const reply = r.object.reply || (r.object.requestHuman ? "(حوّل لموظف) " + r.object.requestHuman : "");
    return { ok: true, reply, issueLink: r.object.issueLink, provider: r.provider, mode: r.mode, ms: r.latencyMs };
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

/** يوقف الوكيل لهذه المحادثة، يخبر العميل، وينبّه المالك. المحادثة تظهر في /admin/conversations بحالة «تدخل بشري». */
async function handoffToHuman(channel: Channel, senderId: string, conv: Conv, reason: string) {
  await db
    .update(conversations)
    .set({ botPaused: true, stage: "human", lastBotMessageAt: new Date(), updatedAt: new Date() })
    .where(eq(conversations.id, conv.id));
  await metaApi.text(channel, senderId, HANDOFF_REPLY).catch((e) => console.error("[closer] handoff reply failed", e));
  await db.insert(messages).values({ conversationId: conv.id, role: "assistant", text: HANDOFF_REPLY });
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
