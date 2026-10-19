import "server-only";
// runtime.ts — وكيل الرسائل V3 على إنستجرام وفيسبوك: مستشار مبيعات يقنع ويجمع بيانات العميل بلطف، والكود وحده يتحقق منها
// ويقرر إنشاء المتجر (agent/create-store). النموذج يقترح (lead, confirmCreate, speaker)، والكود يقرر. بعد الإنشاء يرسل الكود
// رسالة التأكيد النهائية ثم **يغلق الوكيل نفسه نهائياً في المحادثة** (botPaused بلا موعد، memory.closedBy = "agent_done")
// ويحوّلها للمالك (إشعار + بريد)، والتسليم يدوي برسائل جاهزة في صفحة المحادثة؛ لا يُرسل رابط الإعداد آلياً.
// لا ردود جاهزة عند تعذر الذكاء الاصطناعي: صمت + تنبيه للمالك. طلب موظف يوقف الوكيل مؤقتاً (يعود وحده) ويُنبَّه المالك فوراً.
import { currentPricing, goldenStatus } from "@/server/pricing";
import { agentPricingFacts } from "@/lib/platform-pricing";
import { lifecycleTimings } from "@/lifecycle/timings";
import { and, desc, eq, sql } from "drizzle-orm";
import type { ModelMessage } from "ai";
import { db } from "@/db/client";
import { conversations, messages } from "@/db/schema";
import { meta as metaApi } from "@/channels/meta";
import { trace } from "@/lib/meta-trace";
import { aiText } from "@/ai/providers";
import { getPrompt } from "@/ai/prompts";
import { isOn } from "@/lib/flags";
import { env } from "@/lib/env";
import { redis } from "@/lib/redis";
import { getOwnerAlertEmails } from "@/lib/env";
import { sendEmail } from "@/lib/email";
import { notifyAdmin } from "@/ai/lifecycle/notify";
import { alertAgentDegraded, alertAgentSilent } from "./alerts";
import { parseCloserTurn, type CloserTurn } from "./turn";
import { AI_MAX_REPEAT_WINDOW, MAX_MESSAGES_PER_HOUR, RATE_NOTICE } from "./policy";
import { agentConfig, demoUrl } from "@/agent/settings";
import { CREATE_ACK, START_QUICK_REPLY, decideCreate, groundLeadInput, isLeadComplete, mergeLead, type Lead, type LeadInvalid } from "@/agent/lead";
import { stateBlock } from "@/agent/state";
import { detectMentions, goldenLine, plansLine, renewalLine } from "@/agent/offers";
import { handoffUntil, pauseState } from "@/agent/pause";
import { createStoreFromConversation } from "@/agent/create-store";
import { patchMemory } from "@/agent/memory";
import { appendDmImages, rehostDmImages, MAX_DM_IMAGES } from "@/agent/attachments";

type Channel = "messenger" | "instagram";
type InboundAttachment = { type: string; url?: string };
type Referral = { source?: string; type?: string; ref?: string; adId?: string; adTitle?: string };
type Inbound = {
  mid: string;
  text?: string;
  quickReply?: string;
  attachments: InboundAttachment[];
  timestamp: number;
  referral?: Referral;
};
type Conv = typeof conversations.$inferSelect;
type Speaker = "owner" | "moderator" | "unknown";
type Mem = Record<string, unknown> & { lead?: Lead; leadInvalid?: LeadInvalid; summary?: string; igUsername?: string; mentions?: { demo?: boolean; golden?: boolean }; attribution?: unknown; handoffBy?: string; speaker?: Speaker; closedBy?: string };


const AI_ATTEMPT_MS = 9_000;
const AI_BUDGET_MS = 24_000; // كل النماذج تُجرَّب ضمن هذا الحد الكلي (المعالجة داخل after() محدودة بنحو 30 ث)
const HISTORY_LIMIT = 30;

const memOf = (c: Conv): Mem => ((c.memory as Mem | null) ?? {}) as Mem;

async function interpolateVars(): Promise<{ vars: Record<string, string>; goldenAvailable: boolean; goldenPrice: number; demoHost: string }> {
  const [pricing, timings, golden, demo] = await Promise.all([currentPricing(), lifecycleTimings(), goldenStatus().catch(() => null), demoUrl()]);
  const available = Boolean(golden?.available);
  let host = demo;
  try {
    host = new URL(demo).host;
  } catch {
    /* يبقى الرابط كما هو */
  }
  const legacy = () => [`${plansLine(pricing)}.`, `${renewalLine(pricing)}.`, available && golden ? goldenLine(pricing.golden, golden.seatsLeft) : ""].filter(Boolean).join(" ");
  let pricingFacts = "";
  try {
    // تعذر قراءة المقاعد: لا نعرض الدائرة الذهبية (أفضل من وعد بمقعد قد لا يوجد).
    pricingFacts = agentPricingFacts(pricing, golden ? golden.seatsUsed : pricing.golden.seats);
  } catch {
    pricingFacts = legacy();
  }
  return {
    vars: {
      trialHours: String(timings.trialHours),
      pricingFacts: pricingFacts || legacy(),
      demoUrl: demo,
    },
    goldenAvailable: available,
    goldenPrice: pricing.golden.buildPrice,
    demoHost: host,
  };
}

type Row = { role: string; text: string | null; at: Date };

/** سجل المحادثة للنموذج: بلا تكرار رسالة بدل صداها، ورد الموظف يُعدّ ردّنا. */
function modelHistory(rows: Row[]): ModelMessage[] {
  const out: ModelMessage[] = [];
  for (const m of rows) {
    const text = (m.text ?? "").trim();
    if (!text) continue;
    const role = m.role === "user" ? ("user" as const) : ("assistant" as const);
    const prev = out[out.length - 1];
    if (prev && prev.role === role && prev.content === text) continue;
    out.push({ role, content: text });
  }
  return out.length ? out : [{ role: "user", content: "مرحباً" }];
}

/** دور واحد مع النموذج: JSON صارم. ناتج بلا reply صالح يُرفض فيُجرَّب النموذج التالي (لا يصل نص خام للعميل أبداً). */
async function converse(system: string, msgs: ModelMessage[], conversationId?: string): Promise<{ turn: CloserTurn; provider: string }> {
  const instruction = `${system}\n\nأخرج JSON فقط بلا Markdown ولا أي نص خارجه.`;
  const r = await aiText("chat", { system: instruction, messages: msgs, temperature: 0.7, maxTokens: 1600, timeoutMs: AI_ATTEMPT_MS, budgetMs: AI_BUDGET_MS, accept: (t) => parseCloserTurn(t) !== null }, { purpose: "closer", conversationId });
  const turn = parseCloserTurn(r.text);
  if (!turn) throw new Error("no valid reply from model");
  return { turn, provider: r.provider };
}

const norm = (s: string) => s.replace(/\s+/g, " ").trim();

/** صور المحادثة: الأصل يُستبدل برابط مُعاد الاستضافة حين ينجح، ويبقى الأصل في السجل إن فشل. */
async function ingestAttachments(conv: Conv, batch: Inbound[]): Promise<{ batch: Inbound[]; hosted: string[] }> {
  const imageUrls = batch.flatMap((m) => m.attachments.filter((a) => a.type === "image" && typeof a.url === "string").map((a) => a.url as string));
  if (!imageUrls.length) return { batch, hosted: [] };
  const existing = (memOf(conv).lead?.assets ?? []).length;
  const room = Math.max(0, MAX_DM_IMAGES - existing);
  const hosted = room ? await rehostDmImages(imageUrls.slice(0, room), conv.id).catch(() => []) : [];
  const map = new Map(imageUrls.slice(0, hosted.length).map((u, i) => [u, hosted[i]!] as const));
  return { batch: batch.map((m) => ({ ...m, attachments: m.attachments.map((a) => (a.url && map.has(a.url) ? { ...a, url: map.get(a.url)! } : a)) })), hosted };
}

export async function handleInbound(channel: Channel, senderId: string, batch0: Inbound[]) {
  const botOn = (await isOn("bot.enabled")) && (channel !== "instagram" || (await isOn("bot.instagram")));

  const conv0 = await getOrCreateConversation(channel, senderId);
  if (!conv0) return;
  let conv: Conv = conv0;

  if (botOn) await metaApi.seen(channel, senderId);

  // مصدر الإعلان (أول لمسة تُحفظ، وآخر لمسة تُحدَّث).
  const referral = batch0.find((m) => m.referral)?.referral;
  if (referral) {
    const prev = (memOf(conv).attribution ?? null) as { first?: unknown } | null;
    await patchMemory(conv.id, { attribution: { first: prev?.first ?? { ...referral, at: new Date().toISOString() }, last: { ...referral, at: new Date().toISOString() } } }).catch(() => {});
  }

  // صور المنتجات: تُعاد استضافتها وتُحفظ في الذاكرة (ثم في المتجر متى وُجد).
  const { batch, hosted } = await ingestAttachments(conv, batch0);
  if (hosted.length) {
    const lead = memOf(conv).lead ?? {};
    const assets = [...new Set([...(lead.assets ?? []), ...hosted])].slice(0, MAX_DM_IMAGES);
    await patchMemory(conv.id, { lead: { ...lead, assets } }).catch(() => {});
    // نسخة المحادثة المحلية تتبع ما كُتب، حتى لا يمحو دمج البيانات لاحقاً روابط الصور المحفوظة.
    conv = { ...conv, memory: { ...memOf(conv), lead: { ...lead, assets } } };
    if (conv.storeId) await appendDmImages(conv.storeId, hosted).catch(() => {});
  }

  // سجل inbound messages.
  const userTexts: string[] = [];
  for (const m of batch) {
    const text = (m.quickReply ?? m.text ?? "").trim();
    if (text) userTexts.push(text);
    const hasImage = m.attachments.some((a) => a.type === "image");
    await db
      .insert(messages)
      .values({
        conversationId: conv.id,
        role: "user",
        externalMid: m.mid,
        text: text || (hasImage ? "[صورة]" : "[مرفق]"),
        attachments: m.attachments.filter((a): a is InboundAttachment & { url: string } => typeof a.url === "string").map((a) => ({ type: (["image", "audio", "video", "file"].includes(a.type) ? a.type : "file") as "image" | "audio" | "video" | "file", url: a.url })),
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

  // كل خروج بلا رد يُسجَّل في الأثر ويُبلَّغ به المالك بسببه (عدا الإيقاف اليدوي المقصود): لا صمت بلا تفسير.
  const silent = async (kind: string, why: string) => {
    await trace("skip", `${kind}: ${why}`);
    await alertAgentSilent(kind, why, conv.id).catch(() => {});
  };

  // إيقاف الوكيل في هذه المحادثة: دائم، أو مؤقت ينتهي وحده فيعود.
  const ps = pauseState(conv);
  if (ps === "paused") {
    await trace("skip", `paused: ${conv.profileName ?? senderId} (إيقاف مقصود من الفريق أو تحويل لموظف)`);
    return;
  }
  if (ps === "expired") {
    await db.update(conversations).set({ botPaused: false, botPausedUntil: null, stage: conv.stage === "human" ? "persuasion" : conv.stage, updatedAt: new Date() }).where(eq(conversations.id, conv.id));
    conv = { ...conv, botPaused: false, botPausedUntil: null, stage: conv.stage === "human" ? "persuasion" : conv.stage };
    await trace("resume", "انتهى الإيقاف المؤقت فعاد الوكيل");
  }

  if (!botOn) {
    await silent("disabled", "الوكيل مطفأ من /admin/flags (المفتاح bot.enabled أو bot.instagram). فعّله ليعود الرد.");
    return;
  }

  // حد رسائل المرسل الواحد في الساعة: يحمي فاتورة الذكاء الاصطناعي من الإغراق والحلقات الآلية.
  const used = await redis
    .incr(`bot:rl:${channel}:${senderId}`)
    .then(async (n) => {
      if (n === 1) await redis.expire(`bot:rl:${channel}:${senderId}`, 3600);
      return n;
    })
    .catch(() => 0);
  if (used > MAX_MESSAGES_PER_HOUR) {
    if (used === MAX_MESSAGES_PER_HOUR + 1) await metaApi.text(channel, senderId, RATE_NOTICE).catch(() => {});
    await silent("rate", `المرسل تجاوز ${MAX_MESSAGES_PER_HOUR} رسالة في الساعة فتوقف الوكيل معه ساعة (حماية من الإغراق).`);
    return;
  }

  // حساب إنستجرام: يُلتقط من ملف المحادثة مرة واحدة ويُحفظ.
  let mem = memOf(conv);
  if (channel === "instagram" && !mem.igUsername) {
    const prof = await metaApi.profile(channel, senderId).catch(() => null);
    if (prof?.username) {
      await patchMemory(conv.id, { igUsername: prof.username }).catch(() => {});
      mem = { ...mem, igUsername: prof.username };
    }
  }

  const [cfgVars, rows, cfg] = await Promise.all([interpolateVars(), recentRows(conv.id), agentConfig()]);
  const assistantTexts = rows.filter((r) => r.role !== "user").map((r) => norm(r.text ?? ""));
  const userHistory = rows.filter((r) => r.role === "user").map((r) => r.text ?? "");
  const lastQuick = batch.map((m) => m.quickReply).filter(Boolean).pop();
  const explicitStart = lastQuick === START_QUICK_REPLY;

  await metaApi.typing(channel, senderId, true);

  const lead0: Lead = mem.lead ?? {};
  const prevMentions = detectMentions(assistantTexts, { demoHost: cfgVars.demoHost, goldenPrice: cfgVars.goldenPrice });
  const mentions = { demo: prevMentions.demo || Boolean(mem.mentions?.demo), golden: prevMentions.golden || Boolean(mem.mentions?.golden) };

  let turn: CloserTurn;
  try {
    const system =
      (await getPrompt("closer.v3", cfgVars.vars)) +
      stateBlock({
        replies: assistantTexts.length,
        channel,
        lead: lead0,
        invalid: mem.leadInvalid ?? {},
        mentions,
        storeExists: Boolean(conv.storeId),
        imagesReceived: (lead0.assets ?? []).length,
        summary: typeof mem.summary === "string" ? mem.summary : "",
        goldenAvailable: cfgVars.goldenAvailable,
        speaker: mem.speaker,
      });
    const history = modelHistory(rows);
    ({ turn } = await converse(system, history, conv.id));
    // نفس رد سبق حرفياً (نموذج متعثر): محاولة ثانية بتنبيه صريح، فإن تكرر لا نرسله.
    if (!turn.requestHuman && assistantTexts.slice(-AI_MAX_REPEAT_WINDOW).includes(norm(turn.reply))) {
      ({ turn } = await converse(system + `\n- تنبيه: ردك السابق كان بنفس هذا النص حرفياً. أجب بما هو جديد ومفيد، لا تكرر.`, history, conv.id));
      if (assistantTexts.slice(-AI_MAX_REPEAT_WINDOW).includes(norm(turn.reply))) throw new Error("repeated reply");
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

  // دمج البيانات: الكود يتحقق، ولا يُقبل بريد أو رقم لم يكتبه العميل فعلاً.
  const grounded = groundLeadInput(turn.lead, [...userHistory, ...userTexts]);
  const merged = mergeLead(lead0, grounded, { profileInstagram: channel === "instagram" ? (mem.igUsername ?? null) : null, prevInvalid: mem.leadInvalid });
  const newMentions = detectMentions([turn.reply], { demoHost: cfgVars.demoHost, goldenPrice: cfgVars.goldenPrice });
  // من يكتب: آخر تقدير واضح يبقى (unknown لا يمحو تقديراً سابقاً).
  const speaker: Speaker = turn.speaker !== "unknown" ? turn.speaker : (mem.speaker ?? "unknown");
  await patchMemory(conv.id, {
    lead: merged.lead,
    leadInvalid: merged.invalid,
    mentions: { demo: mentions.demo || newMentions.demo, golden: mentions.golden || newMentions.golden },
    speaker,
    ...(turn.memory ? { summary: turn.memory } : {}),
  }).catch(() => {});

  // الوكيل رأى أن الموقف يحتاج إنساناً.
  if (turn.requestHuman) {
    if (await sendIfStillActive(channel, senderId, conv, turn.reply)) await handoffToHuman(channel, conv, turn.requestHuman, cfg.handoffPauseHours);
    await metaApi.typing(channel, senderId, false);
    return;
  }

  // V3: لا إعادة إرسال آلية لرابط الإعداد (المالك يسلّم يدوياً). طلب الرابط بعد الإنشاء يصل الفريق تنبيهاً.
  if (turn.resendLink && conv.storeId) {
    await notifyAdmin(`عميل يطلب رابط إعداد متجره من المحادثة: ${conv.profileName ?? "عميل"}. أرسلوه من صفحة المحادثة.`, { conversationId: conv.id, storeId: conv.storeId }).catch(() => {});
  }

  // البدء يحتاج صاحب القرار: موافقة مشرف الصفحة لا تنشئ متجراً (يطلب الوكيل حضور صاحب القرار).
  const decision0 = decideCreate({ lead: merged.lead, confirmCreate: turn.confirmCreate, explicitStart, storeExists: Boolean(conv.storeId) });
  const decision = decision0 === "create" && speaker === "moderator" && !explicitStart ? "wait_confirm" : decision0;

  try {
    if (decision === "create") {
      const r = await createStoreFromConversation(conv.id);
      await trace("create", r.status);
      if (r.status === "created" || r.status === "exists") {
        // يُغلق الوكيل نفسه في كل الأحوال (حتى لو أوقفه الفريق لحظة الإرسال): وإلا عاد بعد انتهاء إيقاف مؤقت يرد على عميل وافق.
        await sendIfStillActive(channel, senderId, conv, CREATE_ACK, "building");
        await closeAfterAgreement(channel, conv, r.storeId, merged.lead, r.status === "created" ? "created" : "exists");
      } else if (r.status === "setup_open") {
        await sendIfStillActive(channel, senderId, conv, "عندنا بالفعل متجر قيد التجهيز مسجّل بنفس البريد، وسيتابع الفريق معكم هنا خلال يوم إلى 4 أيام عمل كحد أقصى، وغالباً أسرع.");
        await closeAfterAgreement(channel, conv, r.storeId, merged.lead, "setup_open");
      } else if (r.status === "capped") {
        if (await sendIfStillActive(channel, senderId, conv, "الطلبات كثيرة اليوم، وسيتواصل معكم أحد الفريق قريباً لإكمال تجهيز متجركم.")) await handoffToHuman(channel, conv, "بلغ السقف اليومي لإنشاء المتاجر آلياً", cfg.handoffPauseHours);
      } else if (r.status === "busy") {
        await trace("skip", "create busy: دور آخر ينشئ المتجر الآن");
      } else {
        await sendIfStillActive(channel, senderId, conv, "حدث خلل بسيط أثناء تجهيز المتجر، وسيتابع معكم أحد الفريق خلال وقت قصير.");
        await handoffToHuman(channel, conv, `فشل إنشاء المتجر: ${"error" in r ? r.error : r.status}`, cfg.handoffPauseHours);
      }
    } else {
      // البيانات كاملة ولم يُؤكَّد البدء بعد: زر سريع يجعل الموافقة ضغطة واحدة.
      const offerStart = decision === "wait_confirm" && isLeadComplete(merged.lead);
      await sendIfStillActive(channel, senderId, conv, turn.reply, conv.stage === "greeting" ? "discovery" : undefined, offerStart ? [START_QUICK_REPLY] : undefined);
    }
    await trace("reply-sent", `${channel} …${String(senderId).slice(-4)}`);
  } catch (e) {
    const why = String((e as Error)?.message ?? e);
    await silent("send", `الذكاء الاصطناعي كتب الرد لكن إرساله إلى Meta فشل: ${why}. الغالب رمز الصفحة أو صلاحية instagram_manage_messages.`);
  }
  await metaApi.typing(channel, senderId, false).catch(() => {});
}

/**
 * يرسل الرد بعد إعادة قراءة حالة الإيقاف (قد يوقف الفريق المحادثة أثناء تفكير النموذج). يعيد false إن كانت موقوفة فلا يُرسل شيء.
 */
async function sendIfStillActive(channel: Channel, senderId: string, conv: Conv, text: string, stage?: Conv["stage"], quick?: string[]): Promise<boolean> {
  const [fresh] = await db.select({ botPaused: conversations.botPaused, until: conversations.botPausedUntil }).from(conversations).where(eq(conversations.id, conv.id)).limit(1);
  if (fresh && pauseState({ botPaused: fresh.botPaused, botPausedUntil: fresh.until }) === "paused") {
    await trace("skip", "paused-before-send: أوقف الفريق المحادثة قبل الإرسال");
    return false;
  }
  if (quick?.length) await metaApi.quickReplies(channel, senderId, text, quick);
  else await metaApi.text(channel, senderId, text);
  await db.insert(messages).values({ conversationId: conv.id, role: "assistant", text });
  await db
    .update(conversations)
    .set({ lastBotMessageAt: new Date(), updatedAt: new Date(), ...(stage ? { stage } : {}) })
    .where(eq(conversations.id, conv.id));
  return true;
}

/**
 * تجربة كاملة للوكيل بلا إرسال ولا حفظ: نفس البرومبت ونفس المخطط الصارم ونفس سلسلة النماذج، فيظهر لمركز الجاهزية ما كان
 * سيرد به على رسالة حقيقية (أو سبب العجز بنص خطأ كل نموذج).
 */
export async function probeAgent(text: string): Promise<{ ok: true; reply: string; confirmCreate: boolean; leadFound: string; provider: string; ms: number } | { ok: false; error: string }> {
  const t0 = Date.now();
  try {
    const v = await interpolateVars();
    const system =
      (await getPrompt("closer.v3", v.vars)) +
      stateBlock({ replies: 0, channel: "instagram", lead: {}, invalid: {}, mentions: { demo: false, golden: false }, storeExists: false, imagesReceived: 0, summary: "", goldenAvailable: v.goldenAvailable });
    const { turn, provider } = await converse(system, [{ role: "user", content: text.slice(0, 300) }]);
    const found = Object.entries(turn.lead).filter(([, x]) => x).map(([k]) => k).join("، ");
    return { ok: true, reply: turn.reply || (turn.requestHuman ? `(حوّل لموظف) ${turn.requestHuman}` : ""), confirmCreate: turn.confirmCreate, leadFound: found, provider, ms: Date.now() - t0 };
  } catch (e) {
    return { ok: false, error: String((e as Error)?.message ?? e).slice(0, 700) };
  }
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

/**
 * يوقف الوكيل في المحادثة مؤقتاً (يعود وحده بعد المدة) ويبلّغ الفريق: إشعار في اللوحة + بريد فوري للمالك (مرة كل 30 دقيقة
 * لكل محادثة). الرد على العميل يُرسل قبل هذه الدالة.
 */
async function handoffToHuman(channel: Channel, conv: Conv, reason: string, pauseHours: number) {
  const until = handoffUntil(pauseHours);
  await db
    .update(conversations)
    .set({ botPaused: true, botPausedUntil: until, stage: "human", unreadForAdmin: sql`${conversations.unreadForAdmin} + 1`, updatedAt: new Date() })
    .where(eq(conversations.id, conv.id));
  await patchMemory(conv.id, { handoffBy: "ai", handoffAt: new Date().toISOString(), handoffReason: reason.slice(0, 200) }).catch(() => {});
  await trace("handoff", reason.slice(0, 120));
  await notifyAdmin(`محادثة تحتاج موظفاً بشرياً (${channel}): ${reason.slice(0, 160)}`, { conversationId: conv.id });
  const first = await redis.set(`agent:handoff-mail:${conv.id}`, 1, { nx: true, ex: 1800 }).catch(() => "OK");
  const to = getOwnerAlertEmails();
  if (first && to.length) {
    const origin = env.ROOT_DOMAIN.startsWith("localhost") ? "http://localhost:3100" : `https://${env.ROOT_DOMAIN}`;
    await sendEmail({
      to,
      subject: "عميل يطلب التحدث مع موظف",
      headline: "محادثة تنتظر موظفاً",
      paragraphs: [`${conv.profileName ?? "عميل"} على ${channel === "instagram" ? "إنستجرام" : "ماسنجر"}: ${reason.slice(0, 200)}`, `أوقفنا الوكيل في هذه المحادثة لمدة ${pauseHours} ساعات ثم يعود وحده، أو استأنفوه فوراً من صفحة المحادثة.`],
      buttons: [{ title: "افتحوا المحادثة", url: `${origin}/admin/conversations?id=${conv.id}` }],
    }).catch(() => {});
  }
}

/**
 * بعد موافقة العميل وإنشاء متجره: يغلق الوكيل نفسه في هذه المحادثة نهائياً (لا يعود إلا باستئناف يدوي من الفريق)، ويحوّلها
 * للمالك: إشعار في /admin/conversations وبريد فوري على عناوين التنبيه، مع رابط المحادثة وقائمة «بانتظار التسليم».
 */
async function closeAfterAgreement(channel: Channel, conv: Conv, storeId: string, lead: Lead, how: "created" | "exists" | "setup_open") {
  await db
    .update(conversations)
    .set({
      botPaused: true,
      botPausedUntil: null,
      stage: "handoff",
      ...(conv.storeId ? {} : { storeId }),
      unreadForAdmin: sql`${conversations.unreadForAdmin} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(conversations.id, conv.id));
  await patchMemory(conv.id, { closedBy: "agent_done", closedAt: new Date().toISOString(), handoffBy: "agent_done" }).catch(() => {});
  await trace("closed", `agent_done: ${how} (محادثة …${conv.id.slice(-4)})`);
  const who = conv.profileName ?? "عميل";
  const store = lead.storeName ?? "متجر جديد";
  await notifyAdmin(`وافق ${who} وأُغلق الوكيل في المحادثة: «${store}» بانتظار التسليم. انسخوا رسالة الإعداد من صفحة المحادثة.`, { conversationId: conv.id, storeId }).catch(() => {});
  const to = getOwnerAlertEmails();
  if (!to.length) return;
  const origin = env.ROOT_DOMAIN.startsWith("localhost") ? "http://localhost:3100" : `https://${env.ROOT_DOMAIN}`;
  await sendEmail({
    to,
    subject: `متجر جديد بانتظار التسليم: ${store}`,
    headline: "عميل وافق، والمحادثة الآن لكم",
    paragraphs: [
      `${who} على ${channel === "instagram" ? "إنستجرام" : "ماسنجر"} وافق على البدء${how === "setup_open" ? " (له متجر قيد الإعداد بنفس البريد)" : ""}.`,
      [lead.niche && `النشاط: ${lead.niche}`, `المتجر: ${store}`, lead.email && `البريد: ${lead.email}`, lead.whatsapp && `واتساب: ${lead.whatsapp}`, lead.instagram && `إنستجرام: @${lead.instagram}`].filter(Boolean).join(" · "),
      "أُغلق الوكيل في هذه المحادثة نهائياً، ولن يُرسل رابط الإعداد آلياً. في صفحة المحادثة رسائل جاهزة للنسخ (رابط الإعداد وطريقة الدخول ورابط المتجر) وزر إرسالها عبر الرسائل مباشرة.",
    ],
    buttons: [
      { title: "افتحوا المحادثة", url: `${origin}/admin/conversations?id=${conv.id}` },
      { title: "بانتظار التسليم", url: `${origin}/admin/conversations/delivery` },
    ],
  }).catch(() => {});
}

async function getOrCreateConversation(channel: Channel, senderId: string): Promise<Conv | undefined> {
  const where = and(eq(conversations.channel, channel), eq(conversations.externalId, senderId));

  const [found] = await db.select().from(conversations).where(where).limit(1);
  if (found) return found;

  const prof = await metaApi.profile(channel, senderId).catch(() => null);
  const [created] = await db
    .insert(conversations)
    .values({ channel, externalId: senderId, profileName: prof?.name ?? undefined, memory: prof?.username ? { igUsername: prof.username } : {} })
    .onConflictDoNothing()
    .returning();

  return created ?? (await db.select().from(conversations).where(where).limit(1))[0];
}
