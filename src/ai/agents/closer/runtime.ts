import "server-only";
import { currentPricing } from "@/server/pricing";
import { lifecycleTimings } from "@/lifecycle/timings";
import { and, desc, eq, sql } from "drizzle-orm";
import type { ModelMessage } from "ai";
import { db } from "@/db/client";
import { conversations, messages } from "@/db/schema";
import { meta as metaApi } from "@/channels/meta";
import { aiObjectWithMeta } from "@/ai/providers";
import { getPrompt } from "@/ai/prompts";
import { isOn } from "@/lib/flags";
import { issueIntakeLink, type IntakePrefill } from "@/intake/link";
import { derivedToken } from "@/intake/tokens";
import { clientEnv } from "@/lib/env";
import { redis } from "@/lib/redis";
import { notifyAdmin } from "@/ai/lifecycle/notify";
import { markOutreachReplied } from "@/server/ig-outreach";
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

async function interpolateVars(): Promise<Record<string, string>> {
  const [{ price, basePrice, renewal, remaining, ladder }, timings] = await Promise.all([currentPricing(), lifecycleTimings()]);
  const discounted = basePrice > price;
  return {
    price: String(price),
    basePrice: String(basePrice),
    // سطر السعر بصيغته الصادقة: «بدلاً من» فقط إن كان هناك سعر أعلى فعلاً.
    priceLine: discounted ? `${formatEgpNumber(price)} جنيه بدلاً من ${formatEgpNumber(basePrice)}` : `${formatEgpNumber(price)} جنيه`,
    goldenPrice: String(ladder.golden.price),
    goldenCode: ladder.golden.code,
    renewal: String(renewal),
    trialHours: String(timings.trialHours),
    // ندرة حقيقية فقط: عدّاد من المدفوعات المؤكدة (فارغ إن لم يكن للسعر حد).
    remainingLine: remaining ? `باقٍ ${remaining} ${remaining === 1 ? "متجر" : remaining <= 10 ? "متاجر" : "متجراً"} فقط بهذا السعر. ` : "",
  };
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

function formatEgpNumber(n: number): string {
  return n.toLocaleString("en-US");
}

// ─── الرسالة الطارئة بدون رابط (المستوى الأخير) ────────────────────────────
function emergencyReply(vars: Record<string, string>): string {
  return `أهلاً بيك في Colapia. فريقنا بيبني لك متجر إلكتروني كامل لنشاطك ويستضيفه، وتجربه ${vars.trialHours} ساعة قبل ما تدفع. الباقة ${formatEgpNumber(Number(vars.price))} ج وتشمل سنة استضافة. ابعتلي اسم نشاطك وأبعتلك رابط الاستمارة.`;
}

// ─── الرسالة الافتراضية مع زر الاستمارة ────────────────────────────────────
function fallbackWithLink(vars: Record<string, string>, url: string, kind: "form" | "follow" = "form") {
  if (kind === "follow") return { text: "استمارتك وصلتنا، ومن الرابط ده تتابع متجرك مرحلة بمرحلة وموعد تسليمه:", buttonTitle: "تابع متجرك", url };
  const text = `أهلاً بيك في Colapia. فريقنا بيصمم ويبني لك متجر إلكتروني لنشاطك ويستضيفه، وتجربه ${vars.trialHours} ساعة بعد التسليم قبل ما تدفع. الباقة ${vars.priceLine} وتشمل سنة استضافة، بلا عمولة على مبيعاتك. ${vars.remainingLine ?? ""}اضغط الزر واملأ الاستمارة في دقيقتين:`;
  return { text, buttonTitle: "ابدأ استمارة متجرك", url };
}

/** محادثة بدأها فريقنا برسالة افتتاحية لبراند (webhooks/meta handleEcho): لها برومبت وقواعد رابط مختلفة. */
type Outreach = { at?: string; text?: string; closed?: boolean };
function outreachOf(conv: Conv): Outreach | null {
  const o = (conv.memory as Record<string, unknown> | null)?.outreach;
  return o && typeof o === "object" ? (o as Outreach) : null;
}
const EXPLICIT_LINK_RE = /(ابعت|ابعتلي|ابعتيلي|هات|فين)\s*(الفورم|الرابط|اللينك|الاستمارة)|(نبدأ|نبدا|يلا\s*بينا|موافق|مهتمين|مهتم)/i;

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

  if (outreachOf(conv)) await markOutreachReplied(conv.id).catch((e) => console.error("[closer] outreach reply mark failed", e));

  // الوكيل يتوقف في هذه المحادثة فقط إن أوقفه المالك من لوحة المحادثات (أو حوّلها الوكيل لموظف).
  if (conv.botPaused && conv.stage === "human") return;

  if (!botOn) return;

  const outreach = outreachOf(conv);
  // المشرف رفض بأدب ورددنا مرة: لا نعاود الكلام إلا إن أعاد المالك تشغيل الوكيل لهذه المحادثة.
  if (outreach?.closed) return;

  const vars = await interpolateVars();
  const lastUserMessage = userTexts.join(" ").trim();
  // في محادثات الدائرة الذهبية لا يكفي ذكر «ملابس» أو «بكام» لإرسال الفورم: لا نرسلها قبل معرفة من يكلمنا.
  const userTriggeredLink = outreach ? EXPLICIT_LINK_RE.test(lastUserMessage) && conv.stage !== "greeting" : START_INTENT_RE.test(lastUserMessage);

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

  const system = await getPrompt(outreach ? "closer.outreach" : "closer.agency", vars);
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
    if (outreach) {
      // رد عام بالفورم قد يصل لمشرف لا لصاحب البراند: الصمت أسلم، وننبّه المالك ليرد بنفسه.
      await notifyAdmin("تعذر رد الوكيل في محادثة «الدائرة الذهبية»، رد بنفسك من لوحة المحادثات.", { conversationId: conv.id }).catch(() => {});
      await metaApi.typing(channel, senderId, false);
      return;
    }
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
    !outreach && /(الزر|الزرار|الرابط|اللينك|الاستمارة|استمارة|التسجيل)/i.test(turn.reply);
  const shouldSendLink =
    !turn.close && (turn.issueLink || userTriggeredLink || mentionsLinkOrButton);

  if (shouldSendLink) {
    try {
      const issued = await linkFor(conv, channel, { storeName: turn.storeName, oneLine: turn.business, social: turn.social, whatsapp: turn.whatsapp });
      if (!issued) {
        await handoffToHuman(channel, senderId, conv, "طلب سابق مغلق لنفس المحادثة");
        await metaApi.typing(channel, senderId, false);
        return;
      }
      const buttonTitle = issued.kind === "follow" ? "تابع متجرك" : turn.buttonTitle || "ابدأ استمارة متجرك";

      let replyText = issued.kind === "follow" ? `${turn.reply}\n\nاستمارتك وصلتنا، وتقدر تتابع متجرك من هنا:` : turn.reply;

      // إن كانت ردود النموذج عامة، عززها.
      const genericSmell = /(قولي أكتر|احكيلي أكتر|بتبيع إيه|إيه نشاطك|ايه نشاطك)/i.test(
        replyText
      );
      if (genericSmell && issued.kind === "form" && !outreach) {
        replyText = `تمام. فريقنا هيبني لك متجر بصور منتجاتك والمقاسات والدفع عند الاستلام، وتجربه ${vars.trialHours} ساعة بعد التسليم قبل ما تدفع. الباقة ${formatEgpNumber(Number(vars.price))} ج وتشمل سنة استضافة. ${vars.remainingLine ?? ""}املأ الاستمارة من الزر:`;
      } else if (!mentionsLinkOrButton && issued.kind === "form" && !outreach) {
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
      console.error("[closer] intake link failed:", e);
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
      .set({
        lastBotMessageAt: new Date(),
        updatedAt: new Date(),
        ...(outreach && turn.close ? { memory: { ...(conv.memory ?? {}), outreach: { ...outreach, closed: true } }, lostReason: "رفض المشرف" } : {}),
        ...(outreach && conv.stage === "greeting" && !turn.close ? { stage: "discovery" as const } : {}),
      })
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
    const issued = await linkFor(conv, channel);
    if (!issued) throw new Error("closed request");
    const f = fallbackWithLink(vars, issued.url, issued.kind);
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