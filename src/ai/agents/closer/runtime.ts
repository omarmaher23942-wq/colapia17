import "server-only";
import { platformPricing } from "@/lib/platform-pricing";
import { and, desc, eq, sql } from "drizzle-orm";
import type { ModelMessage } from "ai";
import { db } from "@/db/client";
import { conversations, messages } from "@/db/schema";
import { meta as metaApi } from "@/channels/meta";
import { aiObjectWithMeta } from "@/ai/providers";
import { getPrompt } from "@/ai/prompts";
import { env } from "@/lib/env";
import { isOn } from "@/lib/flags";
import { issueOnboardingSession } from "@/onboarding/sessions";
import { redis } from "@/lib/redis";
import { notifyAdmin } from "@/ai/lifecycle/notify";
import { closerTurnSchema, type CloserTurn } from "./turn";
import { HANDOFF_REPLY, MAX_MESSAGES_PER_HOUR, RATE_NOTICE, needsDisclosure, wantsHuman, withDisclosure } from "./policy";

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

// ─── نية البدء (تشمل العامية المصرية الشائعة) ───────────────────────────────
const START_INTENT_RE = new RegExp(
  [
    // تجربة وبدء
    "ازاي\\s*(اجرب|أجرب|ابدأ|ابدا)",
    "عا(يز|وز)\\s*(اجرب|أجرب|ابدأ|ابدا)",
    "طريقة\\s*التجربة",
    "(نجرب|نبدأ|نبدا)\\s*ازاي",
    "(يلا|تمام|ماشي|موافق)\\s*(نبدأ|نبدا|بينا)",
    "ابعت\\s*(لي|ليا|ليّ)?\\s*(الرابط|اللينك)",
    "فين\\s*(الرابط|اللينك)",
    "رابط\\s*(الاستمارة|التسجيل)",
    "عا(يز|وز)\\s*(رابط|لينك)",
    "(الخطوة|الخطوه)\\s*(الجاية|الجديده|التالية)",
    "اعمل(ولي|ليا)\\s*المتجر",
    // سعر وعرض
    "(بكام|السعر|التكلفة|الثمن)",
    "(1,?999|7,?999|1,?299)",
    "(خصم|عرض|اوفر|أوفر)",
    // ذكر النشاط (يحفّز إرسال الرابط فوراً)
    "ملابس|أزياء|ازياء|فساتين|عبايات|طرح",
    "احذية|أحذية|كوتشي|شنط|ساعات|نظارات",
    "(اكسسوار|إكسسوار)",
    "(عطور|برفان|ميك\\s*اب|ميكب|مكياج)",
    "(الكترونيات|إلكترونيات|موبايلات|لابتوب|اكسسوارات\\s*موبايل)",
    "(ادوات\\s*منزلية|أدوات\\s*منزلية|مطبخ)",
    "(اكسسوار|اكسسوارات)",
    "(محل|براند|شغال\\s*في|ببيع|بشتغل)",
    "(منتجات|بضاعة|بضاعه)",
  ].join("|"),
  "i"
);

function interpolateVars(): Record<string, string> {
  const { price, basePrice, renewal } = platformPricing();
  return {
    price: String(price),
    basePrice: String(basePrice),
    renewal: String(renewal),
    trialHours: String(env.TRIAL_HOURS ?? 24),
  };
}

function formatEgpNumber(n: number): string {
  return n.toLocaleString("en-US");
}

// ─── الرسالة الطارئة بدون رابط (المستوى الأخير) ────────────────────────────
function emergencyReply(vars: Record<string, string>): string {
  return `أهلاً بيك في كولابيا. بنبني متجرك الإلكتروني الكامل بمنتجاتك وتجربة مجانية ${vars.trialHours} ساعة، والباقة ${formatEgpNumber(Number(vars.price))} ج بدلاً من ${formatEgpNumber(Number(vars.basePrice))} ج (عرض لفترة محدودة) وتشمل سنة استضافة. ابعتلي اسم نشاطك وهجهّزلك رابط البدء فوراً.`;
}

// ─── الرسالة الافتراضية مع زر الاستمارة ────────────────────────────────────
function fallbackWithLink(vars: Record<string, string>, url: string) {
  const text = `أهلاً بيك في كولابيا. بنبني لك متجر إلكتروني فاخر بمنتجاتك في دقائق وتجربة مجانية ${vars.trialHours} ساعة، والباقة ${formatEgpNumber(Number(vars.price))} ج بدلاً من ${formatEgpNumber(Number(vars.basePrice))} ج لفترة محدودة، وتشمل المتجر وسنة استضافة كاملة، بلا عمولة على مبيعاتك. اضغط الزر وابدأ استمارتك في دقيقتين:`;
  const buttonTitle = "ابدأ استمارة متجرك الآن";
  return { text, buttonTitle, url };
}

export async function handleInbound(
  channel: Channel,
  senderId: string,
  batch: Inbound[]
) {
  const botOn =
    (await isOn("bot.enabled")) &&
    (channel !== "instagram" || (await isOn("bot.instagram")));

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
        attachments: m.attachments.filter(
          (a): a is InboundAttachment & { url: string } =>
            typeof a.url === "string"
        ),
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

  // تجاوز الـ bot إذا التاجر مسك المحادثة.
  if (conv.botPaused && conv.stage === "human") return;

  if (!botOn) return;

  const vars = interpolateVars();
  const lastUserMessage = userTexts.join(" ").trim();
  const userTriggeredLink = START_INTENT_RE.test(lastUserMessage);

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

  // طلب صريح لموظف: نوقف الوكيل ونحوّل لفريقنا، ولا نحاول البيع.
  if (wantsHuman(lastUserMessage)) {
    await handoffToHuman(channel, senderId, conv, "طلب العميل موظفاً");
    return;
  }

  const disclose = await shouldDisclose(conv.id);

  const system = await getPrompt("closer.system", vars);
  const history = await buildHistory(conv.id);

  await metaApi.typing(channel, senderId, true);

  let turn: CloserTurn;
  try {
    const r = await aiObjectWithMeta(
      "chat",
      {
        schema: closerTurnSchema,
        schemaName: "CloserTurn",
        system,
        messages: history,
        temperature: 0.6,
        maxTokens: 600,
        timeoutMs: AI_ATTEMPT_MS,
      },
      { purpose: "closer", conversationId: conv.id }
    );
    turn = r.object;
  } catch (err) {
    console.error(
      "[closer] AI call failed, applying guaranteed button fallback:",
      err
    );
    await sendFallbackWithLink(channel, senderId, conv, vars, disclose);
    await metaApi.typing(channel, senderId, false);
    return;
  }

  // الذكاء الاصطناعي نفسه رأى أن الموقف يحتاج إنساناً (شكوى، استفسار خارج نطاقنا...).
  if (turn.requestHuman) {
    await handoffToHuman(channel, senderId, conv, turn.requestHuman);
    await metaApi.typing(channel, senderId, false);
    return;
  }

  // ─── قواعد تفعيل الرابط ────────────────────────────────────────────────
  const mentionsLinkOrButton =
    /(الزر|الزرار|الرابط|اللينك|الاستمارة|استمارة|التسجيل)/i.test(turn.reply);
  const shouldSendLink =
    turn.issueLink || userTriggeredLink || mentionsLinkOrButton;

  if (shouldSendLink) {
    try {
      const issued = await issueOnboardingSession(conv.id);
      const buttonTitle = turn.buttonTitle || "ابدأ استمارة متجرك الآن";

      let replyText = turn.reply;

      // إن كانت ردود النموذج عامة، عززها.
      const genericSmell = /(قولي أكتر|احكيلي أكتر|بتبيع إيه|إيه نشاطك|ايه نشاطك)/i.test(
        replyText
      );
      if (genericSmell) {
        replyText = `عظيم ومجال مطلوب في مصر. بنبني لك متجر كامل بالصور والمقاسات والدفع عند الاستلام، وتجربة ${vars.trialHours} ساعة مجانية، والباقة ${formatEgpNumber(Number(vars.price))} ج بدلاً من ${formatEgpNumber(Number(vars.basePrice))} ج لفترة محدودة وتشمل سنة استضافة. اضغط الزر وابدأ استمارتك:`;
      } else if (!mentionsLinkOrButton) {
        replyText = `${replyText}\n\nاضغط الزر وابدأ استمارتك في دقيقتين:`;
      }

      replyText = withDisclosure(replyText, disclose);
      await metaApi.buttons(channel, senderId, replyText, [
        { title: buttonTitle, url: issued.url },
      ]);
      await db.insert(messages).values({
        conversationId: conv.id,
        role: "assistant",
        text: `${replyText}\n[زر الاستمارة: ${buttonTitle} -> ${issued.url}]`,
      });
      await db
        .update(conversations)
        .set({
          stage: "link_sent",
          lastBotMessageAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(conversations.id, conv.id));
    } catch (e) {
      console.error("[closer] issueOnboardingSession failed:", e);
      await sendFallbackWithLink(channel, senderId, conv, vars, disclose);
    }
  } else {
    const reply = withDisclosure(turn.reply, disclose);
    await metaApi.text(channel, senderId, reply);
    await db.insert(messages).values({
      conversationId: conv.id,
      role: "assistant",
      text: reply,
    });
    await db
      .update(conversations)
      .set({ lastBotMessageAt: new Date(), updatedAt: new Date() })
      .where(eq(conversations.id, conv.id));
  }

  await metaApi.typing(channel, senderId, false);
}

/** هل يُفصح الوكيل أنه آلي في هذا الرد؟ (بداية المحادثة، أو بعد انقطاع 24 ساعة، أو بعد تدخل بشري). */
async function shouldDisclose(conversationId: string): Promise<boolean> {
  const [lastBot] = await db
    .select({ at: messages.createdAt })
    .from(messages)
    .where(and(eq(messages.conversationId, conversationId), eq(messages.role, "assistant")))
    .orderBy(desc(messages.createdAt))
    .limit(1);
  const [lastHuman] = await db
    .select({ at: messages.createdAt })
    .from(messages)
    .where(and(eq(messages.conversationId, conversationId), eq(messages.role, "human_agent")))
    .orderBy(desc(messages.createdAt))
    .limit(1);
  return needsDisclosure({
    lastBotMessageAt: lastBot?.at ?? null,
    hasAnyBotMessage: Boolean(lastBot),
    resumedFromHuman: Boolean(lastHuman && (!lastBot || lastHuman.at > lastBot.at)),
  });
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

// ─── Fallback حتمي: يحاول الرابط، ثم يتراجع لرسالة نصية ────────────────────
async function sendFallbackWithLink(
  channel: Channel,
  senderId: string,
  conv: Conv,
  vars: Record<string, string>,
  disclose: boolean
) {
  try {
    const issued = await issueOnboardingSession(conv.id);
    const f = fallbackWithLink(vars, issued.url);
    const text = withDisclosure(f.text, disclose);
    const { buttonTitle, url } = f;
    await metaApi.buttons(channel, senderId, text, [
      { title: buttonTitle, url },
    ]);
    await db.insert(messages).values({
      conversationId: conv.id,
      role: "assistant",
      text: `${text}\n[زر الاستمارة: ${buttonTitle} -> ${url}]`,
    });
    await db
      .update(conversations)
      .set({
        stage: "link_sent",
        lastBotMessageAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(conversations.id, conv.id));
    return;
  } catch (e) {
    console.error("[closer] fallback-with-link failed, sending emergency text:", e);
  }

  // المستوى الأخير: نص بدون رابط (لا يسقط أبداً).
  try {
    const emergency = withDisclosure(emergencyReply(vars), disclose);
    await metaApi.text(channel, senderId, emergency);
    await db.insert(messages).values({
      conversationId: conv.id,
      role: "assistant",
      text: emergency,
    });
    await db
      .update(conversations)
      .set({ lastBotMessageAt: new Date(), updatedAt: new Date() })
      .where(eq(conversations.id, conv.id));
  } catch (finalErr) {
    console.error("[closer] emergency text failed too:", finalErr);
  }
}

async function buildHistory(conversationId: string): Promise<ModelMessage[]> {
  const rows = await db
    .select({ role: messages.role, text: messages.text })
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(desc(messages.createdAt))
    .limit(HISTORY_LIMIT);

  const history: ModelMessage[] = rows
    .reverse()
    .filter((m) => m.text && m.text.trim())
    .map((m) => ({
      role: m.role === "user" ? ("user" as const) : ("assistant" as const),
      content: m.text!,
    }));

  return history.length ? history : [{ role: "user", content: "مرحباً" }];
}

async function getOrCreateConversation(
  channel: Channel,
  senderId: string
): Promise<Conv | undefined> {
  const where = and(
    eq(conversations.channel, channel),
    eq(conversations.externalId, senderId)
  );

  const [found] = await db
    .select()
    .from(conversations)
    .where(where)
    .limit(1);
  if (found) return found;

  const name = await metaApi.profile(channel, senderId);
  const [created] = await db
    .insert(conversations)
    .values({ channel, externalId: senderId, profileName: name ?? undefined })
    .onConflictDoNothing()
    .returning();

  return (
    created ??
    (await db.select().from(conversations).where(where).limit(1))[0]
  );
}