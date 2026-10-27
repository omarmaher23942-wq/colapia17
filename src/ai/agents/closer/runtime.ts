import "server-only";
// runtime.ts — وكيل الرسائل V5 على إنستجرام وفيسبوك: مستشار مبيعات بالذكاء الاصطناعي وحده يحاور بحرية داخل إطار مهني (prompt.ts).
// لا قواعد لغوية ولا قرارات حوار في الكود: النموذج يقرر ماذا يقول ومتى يطلب فعلاً (build_request، other_service، ignore، أو
// requestHuman)، والكود يتحقق من الشروط البيانية والرقمية فقط (review.ts) وينفذ:
//  - build_request: بعد تغطية الأسئلة الخمسة (أو رفض بعضها) يحفظ طلب بناء بلا دفع (agent/build-request-store.ts)، يرسل رسالة
//    الإغلاق الثابتة (متجر مخصص مجاني، رابط إعداد خلال مدة، لا دفع إلا بعد الإعجاب)، يبلّغ المالك، ويغلق الوكيل في المحادثة.
//  - other_service: يعلّم المحادثة «خدمة أخرى»، يبلّغ المالك (بريد + لوحة)، ويوقف الوكيل بانتظار رده؛ لا دفع ولا طلب بناء.
// لا ردود جاهزة عند تعذر الذكاء الاصطناعي: صمت + تنبيه للمالك. طلب موظف يوقف الوكيل مؤقتاً (يعود وحده) ويُنبَّه المالك فوراً.
import { and, desc, eq, sql } from "drizzle-orm";
import type { ModelMessage } from "ai";
import { db } from "@/db/client";
import { conversations, messages } from "@/db/schema";
import { meta as metaApi } from "@/channels/meta";
import { trace } from "@/lib/meta-trace";
import { aiText } from "@/ai/providers";
import { getPrompt } from "@/ai/prompts";
import { isOn } from "@/lib/flags";
import { redis } from "@/lib/redis";
import { alertAgentDegraded, alertAgentSilent, alertBuildRequest, alertHandoff, alertOtherService } from "./alerts";
import { agentFacts, type AgentFacts } from "./facts";
import { parseCloserTurn, type CloserTurn, type Speaker } from "./turn";
import { capHistory, describeInbound, isStaleBatch, MAX_STORED_TEXT, STALE_INBOUND_MS, modelView } from "./guard";
import { HISTORY_LIMIT, MAX_MESSAGES_PER_HOUR, RATE_NOTICE } from "./policy";
import { reviewTurn, type ActionCtx } from "./review";
import { createBuildRequest } from "@/agent/build-request-store";
import { BUILD_REQUEST_FLAG, buildRequestMessage, parseDeclined, type Area } from "@/agent/build-request";
import { agentConfig } from "@/agent/settings";
import { groundLeadInput, mergeLead, type Lead, type LeadInvalid } from "@/agent/lead";
import { OTHER_SERVICE_FLAG, briefOf, isOtherService } from "@/agent/other-service";
import { stateBlock } from "@/agent/state";
import { handoffUntil, pauseState } from "@/agent/pause";
import { patchMemory } from "@/agent/memory";

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
type Mem = Record<string, unknown> & {
  lead?: Lead;
  leadInvalid?: LeadInvalid;
  summary?: string;
  igUsername?: string;
  speaker?: Speaker;
  closedBy?: string;
  flag?: string;
  declined?: Area[];
  buildRequest?: { id: string; code: string; at: string };
};

const AI_ATTEMPT_MS = 9_000;
const AI_BUDGET_MS = 24_000; // ميزانية استدعاء واحد عبر كل النماذج (المعالجة داخل after() محدودة بنحو 30 ث)
const TURN_BUDGET_MS = 40_000; // ميزانية الدور كله بمحاولاته التصحيحية
const MIN_RETRY_MS = 7_000;
const MAX_RETRIES = 2;

const memOf = (c: Conv): Mem => ((c.memory as Mem | null) ?? {}) as Mem;

type Row = { role: string; text: string | null; at: Date };

/** سجل المحادثة للنموذج: بلا تكرار رسالة بدل صداها، ورد الموظف يُعدّ ردّنا. */
function modelHistory(rows: Row[]): ModelMessage[] {
  const out: ModelMessage[] = [];
  for (const m of rows) {
    const raw = (m.text ?? "").trim();
    if (!raw) continue;
    const role = m.role === "user" ? ("user" as const) : ("assistant" as const);
    const text = modelView(role, raw);
    const prev = out[out.length - 1];
    if (prev && prev.role === role && prev.content === text) continue;
    out.push({ role, content: text });
  }
  const capped = capHistory(out as { role: "user" | "assistant"; content: string }[]) as ModelMessage[];
  return capped.length ? capped : [{ role: "user", content: "مرحباً" }];
}

/** دور واحد مع النموذج: JSON صارم. ناتج بلا reply صالح يُرفض فيُجرَّب النموذج التالي (لا يصل نص خام للعميل أبداً). */
async function converse(system: string, msgs: ModelMessage[], conversationId: string | undefined, budgetMs = AI_BUDGET_MS): Promise<{ turn: CloserTurn; provider: string }> {
  const instruction = `${system}\n\nأخرج JSON فقط بلا Markdown ولا أي نص خارجه.`;
  const r = await aiText("chat", { system: instruction, messages: msgs, temperature: 0.7, maxTokens: 1600, timeoutMs: AI_ATTEMPT_MS, budgetMs, accept: (t) => parseCloserTurn(t) !== null }, { purpose: "closer", conversationId });
  const turn = parseCloserTurn(r.text);
  if (!turn) throw new Error("no valid reply from model");
  return { turn, provider: r.provider };
}

/** التعليمات الكاملة لدور: الإطار الثابت بحقائقه الحية + حالة المحادثة. */
async function systemFor(facts: AgentFacts, state: Parameters<typeof stateBlock>[0]): Promise<string> {
  return (await getPrompt("closer.v5", facts.vars)) + stateBlock(state);
}

export async function handleInbound(channel: Channel, senderId: string, batch: Inbound[]) {
  const botOn = (await isOn("bot.enabled")) && (channel !== "instagram" || (await isOn("bot.instagram")));

  // إعادة تسليم متأخرة (أقدم من نافذة الرد): لا رد، فقط أثر.
  if (isStaleBatch(batch.map((m) => m.timestamp))) {
    await trace("skip", `stale: رسائل أقدم من ${Math.round(STALE_INBOUND_MS / 3600_000)} ساعة، لا يُرد عليها`);
    return;
  }

  const conv0 = await getOrCreateConversation(channel, senderId);
  if (!conv0) return;
  let conv: Conv = conv0;
  const previousUserAt = conv0.lastUserMessageAt;

  if (botOn) await metaApi.seen(channel, senderId);

  // مصدر الإعلان (أول لمسة تُحفظ، وآخر لمسة تُحدَّث).
  const referral = batch.find((m) => m.referral)?.referral;
  if (referral) {
    const prev = (memOf(conv).attribution ?? null) as { first?: unknown } | null;
    await patchMemory(conv.id, { attribution: { first: prev?.first ?? { ...referral, at: new Date().toISOString() }, last: { ...referral, at: new Date().toISOString() } } }).catch(() => {});
  }

  // سجل inbound messages.
  const userTexts: string[] = [];
  for (const m of batch) {
    const text = (m.quickReply ?? m.text ?? "").replace(/\u0000/g, "").trim().slice(0, MAX_STORED_TEXT);
    if (text) userTexts.push(text);
    await db
      .insert(messages)
      .values({
        conversationId: conv.id,
        role: "user",
        externalMid: m.mid,
        text: text || describeInbound(undefined, m.attachments),
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
    await trace("skip", `paused: ${conv.profileName ?? senderId} (إيقاف مقصود من الفريق أو تحويل لموظف أو إغلاق)`);
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

  await metaApi.typing(channel, senderId, true);

  const started = Date.now();
  const lead0: Lead = mem.lead ?? {};
  const otherService = isOtherService(mem);
  const requested = Boolean(mem.buildRequest) || mem.flag === BUILD_REQUEST_FLAG;
  const declined0: Area[] = parseDeclined(mem.declined);
  const profileInstagram = channel === "instagram" ? (mem.igUsername ?? null) : null;

  let turn: CloserTurn;
  let merged: { lead: Lead; invalid: LeadInvalid };
  let facts: AgentFacts;
  let cfg: Awaited<ReturnType<typeof agentConfig>>;
  try {
    const [f, rows, c] = await Promise.all([agentFacts(), recentRows(conv.id), agentConfig()]);
    facts = f;
    cfg = c;
    const assistantTexts = rows.filter((r) => r.role !== "user").map((r) => r.text ?? "");
    const userHistory = rows.filter((r) => r.role === "user").map((r) => r.text ?? "");
    const mergeFrom = (t: CloserTurn) => mergeLead(lead0, groundLeadInput(t.lead, [...userHistory, ...userTexts]), { profileInstagram, prevInvalid: mem.leadInvalid });
    const declinedOf = (t: CloserTurn): Area[] => [...new Set([...declined0, ...parseDeclined(t.declined)])];
    const actionCtx = (m: { lead: Lead }, t: CloserTurn): ActionCtx => ({ lead: m.lead, declined: declinedOf(t), otherService, alreadyRequested: requested });

    const firstUser = rows.findIndex((r) => r.role === "user");
    const origin = rows.length && rows.length < HISTORY_LIMIT ? (firstUser === 0 ? "them" : firstUser > 0 ? "us" : undefined) : undefined;
    const system = await systemFor(facts, {
      replies: rows.filter((r) => r.role === "assistant").length,
      origin,
      channel,
      lead: lead0,
      invalid: mem.leadInvalid ?? {},
      declined: declined0,
      summary: typeof mem.summary === "string" ? mem.summary : "",
      speaker: mem.speaker,
      offer: facts.offer,
      requested,
      otherService,
      idleHours: previousUserAt ? Math.max(0, (Date.now() - previousUserAt.getTime()) / 3_600_000) : null,
    });
    const history = modelHistory(rows);
    ({ turn } = await converse(system, history, conv.id));
    merged = mergeFrom(turn);

    // مراجعة الدور: حراسة المخرج + شروط الفعل + التكرار الحرفي ← محاولات تصحيحية بملاحظة صريحة ضمن ميزانية الدور.
    const notes: string[] = [];
    for (let attempt = 0; ; attempt++) {
      const review = reviewTurn(turn, { replyCtx: facts.replyCtx, recentAssistant: assistantTexts, action: actionCtx(merged, turn) });
      if (!review) break;
      await trace(review.kind === "action" ? "action-denied" : "reply-rejected", review.note.slice(0, 120));
      const left = TURN_BUDGET_MS - (Date.now() - started);
      if (attempt >= MAX_RETRIES || left < MIN_RETRY_MS) {
        // الفعل المرفوض يُخفَّض إلى حوار عادي؛ أي مشكلة أخرى لا تصل للعميل أبداً.
        if (review.kind === "action") {
          turn = { ...turn, action: "none" };
          break;
        }
        throw new Error(`reply rejected by review (${review.kind}): ${review.note}`);
      }
      notes.push(review.note);
      ({ turn } = await converse(system + notes.map((n) => `\n- تنبيه: ${n}`).join(""), history, conv.id, Math.min(AI_BUDGET_MS, left)));
      merged = mergeFrom(turn);
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

  // من يكتب: آخر تقدير واضح يبقى (unknown لا يمحو تقديراً سابقاً).
  const speaker: Speaker = turn.speaker !== "unknown" ? turn.speaker : (mem.speaker ?? "unknown");
  const declined = [...new Set([...declined0, ...parseDeclined(turn.declined)])];
  await patchMemory(conv.id, { lead: merged.lead, leadInvalid: merged.invalid, declined, speaker, ...(turn.memory ? { summary: turn.memory } : {}) }).catch(() => {});

  try {
    if (turn.action === "ignore") {
      await trace("ignored", `${channel} …${String(senderId).slice(-4)}: رسالة لا تستحق رداً`);
    } else if (turn.requestHuman) {
      // الوكيل رأى أن الموقف يحتاج إنساناً.
      if (await sendIfStillActive(channel, senderId, conv, turn.reply)) await handoffToHuman(channel, conv, turn.requestHuman, cfg.handoffPauseHours);
    } else if (turn.action === "build_request") {
      await sendBuildRequest(channel, senderId, conv, turn.reply, merged.lead, declined, typeof turn.memory === "string" && turn.memory ? turn.memory : typeof mem.summary === "string" ? mem.summary : "", facts, cfg);
    } else if (turn.action === "other_service") {
      await sendIfStillActive(channel, senderId, conv, turn.reply);
      await escalateOtherService(channel, conv, briefOf(turn.brief, turn.memory || (typeof mem.summary === "string" ? mem.summary : "")), merged.lead, mem.igUsername);
    } else {
      await sendIfStillActive(channel, senderId, conv, turn.reply, conv.stage === "greeting" ? "discovery" : undefined);
    }
    await trace("reply-sent", `${channel} …${String(senderId).slice(-4)} action=${turn.action}`);
  } catch (e) {
    const why = String((e as Error)?.message ?? e);
    await silent("send", `الذكاء الاصطناعي كتب الرد لكن إرساله إلى Meta فشل: ${why}. الغالب رمز الصفحة أو صلاحية instagram_manage_messages.`);
  }
  await metaApi.typing(channel, senderId, false).catch(() => {});
}

/**
 * يرسل الرد بعد إعادة قراءة حالة الإيقاف (قد يوقف الفريق المحادثة أثناء تفكير النموذج). يعيد false إن كانت موقوفة فلا يُرسل شيء.
 */
async function sendIfStillActive(channel: Channel, senderId: string, conv: Conv, text: string, stage?: Conv["stage"]): Promise<boolean> {
  const [fresh] = await db.select({ botPaused: conversations.botPaused, until: conversations.botPausedUntil }).from(conversations).where(eq(conversations.id, conv.id)).limit(1);
  if (fresh && pauseState({ botPaused: fresh.botPaused, botPausedUntil: fresh.until }) === "paused") {
    await trace("skip", "paused-before-send: أوقف الفريق المحادثة قبل الإرسال");
    return false;
  }
  await metaApi.text(channel, senderId, text);
  await db.insert(messages).values({ conversationId: conv.id, role: "assistant", text });
  await db
    .update(conversations)
    .set({ lastBotMessageAt: new Date(), updatedAt: new Date(), ...(stage ? { stage } : {}) })
    .where(eq(conversations.id, conv.id));
  return true;
}

/**
 * ينفذ build_request: يحفظ طلب البناء أولاً (فشل الحفظ = اعتذار قصير وتحويل لموظف بدل وعد لا يتحقق)، ثم يرسل مقدمة النموذج مع
 * رسالة الإغلاق الثابتة، ثم يغلق الوكيل ويبلّغ المالك. الإغلاق لا يتوقف على نجاح الإرسال: وإلا عاد الوكيل يرد على عميل أُنشئ طلبه.
 */
async function sendBuildRequest(channel: Channel, senderId: string, conv: Conv, intro: string, lead: Lead, declined: Area[], summary: string, facts: AgentFacts, cfg: { buildWindowHours: number; handoffPauseHours: number }) {
  let created: Awaited<ReturnType<typeof createBuildRequest>>;
  try {
    created = await createBuildRequest({ conversationId: conv.id, lead, declined, offer: facts.offer, summary });
  } catch (e) {
    const why = String((e as Error)?.message ?? e).slice(0, 160);
    await trace("request-failed", why);
    if (await sendIfStillActive(channel, senderId, conv, "حدث خلل بسيط أثناء تسجيل طلبكم، وسيتواصل معكم أحد الفريق خلال وقت قصير لاستكماله.")) await handoffToHuman(channel, conv, `تعذر إنشاء طلب البناء: ${why}`, cfg.handoffPauseHours);
    return;
  }
  const text = buildRequestMessage(intro, { windowHours: cfg.buildWindowHours, offer: facts.offer });
  await sendIfStillActive(channel, senderId, conv, text);
  await closeAfterRequest(channel, conv, lead, created, facts.offer.golden, cfg.buildWindowHours);
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
 * تجربة كاملة للوكيل بلا إرسال ولا حفظ: نفس البرومبت ونفس المخطط الصارم ونفس سلسلة النماذج، فيظهر لمركز الجاهزية ما كان
 * سيرد به على رسالة حقيقية (أو سبب العجز بنص خطأ كل نموذج). `confirmCreate` يعني هنا أنه سينشئ طلب بناء.
 */
export async function probeAgent(text: string): Promise<{ ok: true; reply: string; confirmCreate: boolean; leadFound: string; provider: string; ms: number } | { ok: false; error: string }> {
  const t0 = Date.now();
  try {
    const facts = await agentFacts();
    const system = await systemFor(facts, { replies: 0, channel: "instagram", lead: {}, invalid: {}, declined: [], summary: "", offer: facts.offer, requested: false, otherService: false, idleHours: null });
    const { turn, provider } = await converse(system, [{ role: "user", content: text.slice(0, 300) }], undefined);
    const found = Object.entries(turn.lead).filter(([, x]) => x).map(([k]) => k).join("، ");
    const reply = turn.reply || (turn.requestHuman ? `(حوّل لموظف) ${turn.requestHuman}` : turn.action === "ignore" ? "(تجاهل الرسالة)" : "");
    return { ok: true, reply, confirmCreate: turn.action === "build_request", leadFound: found, provider, ms: Date.now() - t0 };
  } catch (e) {
    return { ok: false, error: String((e as Error)?.message ?? e).slice(0, 700) };
  }
}

/**
 * يوقف الوكيل في المحادثة مؤقتاً (يعود وحده بعد المدة) ويبلّغ الفريق: إشعار في اللوحة + بريد فوري للمالك (مرة كل 30 دقيقة
 * لكل محادثة). الرد على العميل يُرسل قبل هذه الدالة.
 */
async function handoffToHuman(channel: Channel, conv: Conv, reason: string, pauseHours: number) {
  await db
    .update(conversations)
    .set({ botPaused: true, botPausedUntil: handoffUntil(pauseHours), stage: "human", unreadForAdmin: sql`${conversations.unreadForAdmin} + 1`, updatedAt: new Date() })
    .where(eq(conversations.id, conv.id));
  await patchMemory(conv.id, { handoffBy: "ai", handoffAt: new Date().toISOString(), handoffReason: reason.slice(0, 200) }).catch(() => {});
  await trace("handoff", reason.slice(0, 120));
  await alertHandoff({ conversationId: conv.id, name: conv.profileName, channel, reason, pauseHours });
}

/**
 * «خدمة أخرى غير المتجر»: يعلّم المحادثة في ذاكرتها (شارة وفلتر في /admin/conversations)، يوقف الوكيل إيقافاً دائماً بانتظار رد المالك،
 * ويبلّغه ببريد وإشعار لوحة مع ملخص الطلب. لا دفع ولا رابط حجز في هذا المسار أبداً.
 */
async function escalateOtherService(channel: Channel, conv: Conv, brief: string, lead: Lead, igUsername?: string) {
  await db
    .update(conversations)
    .set({ botPaused: true, botPausedUntil: null, stage: "human", unreadForAdmin: sql`${conversations.unreadForAdmin} + 1`, updatedAt: new Date() })
    .where(eq(conversations.id, conv.id));
  const at = new Date().toISOString();
  await patchMemory(conv.id, { flag: OTHER_SERVICE_FLAG, otherService: { brief, at }, handoffBy: "other_service", handoffAt: at }).catch(() => {});
  await trace("other-service", brief.slice(0, 120));
  await alertOtherService({ conversationId: conv.id, name: conv.profileName, channel, igUsername, brief, lead });
}

/**
 * بعد إنشاء طلب البناء: يغلق الوكيل نفسه في هذه المحادثة نهائياً (لا يعود إلا باستئناف يدوي من الفريق)، ويعلّمها «طلب بناء جديد»
 * ويحوّلها للمالك: إشعار في /admin/conversations وبريد فوري بالطلب. closedBy يبقى agent_done لتستثنيه أداة «استئناف الكل».
 */
async function closeAfterRequest(channel: Channel, conv: Conv, lead: Lead, req: { id: string; code: string; existed: boolean }, golden: boolean, windowHours: number) {
  await db
    .update(conversations)
    .set({ botPaused: true, botPausedUntil: null, stage: "handoff", unreadForAdmin: sql`${conversations.unreadForAdmin} + 1`, updatedAt: new Date() })
    .where(eq(conversations.id, conv.id));
  const at = new Date().toISOString();
  await patchMemory(conv.id, { flag: BUILD_REQUEST_FLAG, buildRequest: { id: req.id, code: req.code, at }, closedBy: "agent_done", closedAt: at, handoffBy: "agent_done" }).catch(() => {});
  await trace("closed", `build_request ${req.code} (محادثة …${conv.id.slice(-4)})`);
  if (!req.existed) await alertBuildRequest({ conversationId: conv.id, name: conv.profileName, channel, lead, code: req.code, golden, windowHours }).catch(() => {});
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
