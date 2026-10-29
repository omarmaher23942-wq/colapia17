import "server-only";
// alerts.ts — تنبيهات المالك من وكيل الرسائل: تعذر الذكاء الاصطناعي (الوكيل يصمت ولا ردود جاهزة بقرار المالك)، وكل خروج بلا رد،
// وتحويل لموظف، وطلب «خدمة أخرى»، وطلب بناء متجر جديد (إغلاق الوكيل بعده). محدودة التكرار حتى لا تُغرق بريده، ونصوصها في agent/owner-mail.ts.
import { clientEnv, env, getOwnerAlertEmails } from "@/lib/env";
import { sendEmail } from "@/lib/email";
import { redis } from "@/lib/redis";
import { runtimeTag } from "@/lib/meta-trace";
import { notifyAdmin } from "@/ai/lifecycle/notify";
import { handoffMail, keywordMail, leadMail, type OwnerMail } from "@/agent/owner-mail";

// أصل المنصة من النطاق الرئيسي المضبوط (لا NEXT_PUBLIC_APP_URL الذي قد يشير لنشر قديم).
const origin = () => (env.ROOT_DOMAIN.startsWith("localhost") ? "http://localhost:3100" : `https://${env.ROOT_DOMAIN}`);

/** إشعار لوحة + بريد للمالك بنص جاهز ورابط المحادثة. `mailKey` يمنع تكرار البريد (إشعار اللوحة يُسجَّل دائماً). */
async function notifyOwner(mail: OwnerMail, conversationId: string, opts: { mailKey?: string; mailTtlS?: number; extraButtons?: { title: string; url: string }[] } = {}): Promise<void> {
  await notifyAdmin(mail.adminNote, { conversationId }).catch(() => {});
  if (opts.mailKey) {
    const first = await redis.set(opts.mailKey, 1, { nx: true, ex: opts.mailTtlS ?? 1800 }).catch(() => "OK");
    if (!first) return;
  }
  const to = getOwnerAlertEmails();
  if (!to.length) return;
  await sendEmail({
    to,
    subject: mail.subject,
    headline: mail.headline,
    paragraphs: mail.paragraphs.filter(Boolean),
    buttons: [{ title: "افتحوا المحادثة", url: `${origin()}/admin/conversations?id=${conversationId}` }, ...(opts.extraButtons ?? [])],
  }).catch(() => {});
}

/** العميل طلب موظفاً أو رأى الوكيل أن الموقف يحتاج إنساناً: مرة لكل محادثة كل 30 دقيقة. */
export async function alertHandoff(i: { conversationId: string; name?: string | null; channel: string; reason: string; pauseHours: number }): Promise<void> {
  await notifyOwner(handoffMail(i), i.conversationId, { mailKey: `agent:handoff-mail:${i.conversationId}` });
}

/** عميل محتمل جديد: بريد فوري للمالك + إشعار لوحة، مرة لكل محادثة. */
export async function alertLead(i: { conversationId: string; name: string; whatsapp: string; email?: string; service: string; summary: string; channel: string; igUsername?: string | null }): Promise<void> {
  await notifyOwner(leadMail(i), i.conversationId, { mailKey: `agent:lead-mail:${i.conversationId}`, mailTtlS: 24 * 3600, extraButtons: [{ title: "الليدز", url: `${origin()}/admin/leads` }] });
}

/** وصلت كلمة دعوة من منشور (متجر/مشروع/تفاصيل) وأُرسل الرد الآلي: إشعار لوحة دائماً، وبريد مرة لكل محادثة كل 6 ساعات. */
export async function alertKeyword(i: Parameters<typeof keywordMail>[0] & { conversationId: string }): Promise<void> {
  await notifyOwner(keywordMail(i), i.conversationId, { mailKey: `agent:kw-mail:${i.conversationId}`, mailTtlS: 6 * 3600 });
}

/**
 * كل رسالة لا يرد عليها الوكيل لأي سبب (محادثة موقوفة، وكيل مطفأ، حد الرسائل، فشل الإرسال إلى Meta) تُبلَّغ للمالك بسببها
 * الدقيق: لا صمت بلا تفسير. مرة لكل نوع كل 30 دقيقة.
 */
export async function alertAgentSilent(kind: string, reason: string, conversationId: string): Promise<void> {
  const first = await redis.set(`bot:silent-alert:${kind}`, 1, { nx: true, ex: 1800 }).catch(() => null);
  if (!first) return;
  const why = reason.replace(/\s+/g, " ").slice(0, 400);
  await notifyAdmin(`وكيل الرسائل لم يرد على عميل: ${why}`, { conversationId }).catch(() => {});
  const to = getOwnerAlertEmails();
  if (!to.length) return;
  await sendEmail({
    to,
    subject: "وكيل الرسائل لم يرد على رسالة: السبب بالداخل",
    headline: "الوكيل لم يرد، وهذا السبب",
    paragraphs: [why, "افتح مركز جاهزية الإطلاق: «آخر ما حدث لرسائل الوكيل» يعرض كل خطوة، وزر «استئناف الوكيل في كل المحادثات» يعيد تشغيله في المحادثات الموقوفة."],
    buttons: [{ title: "جاهزية الإطلاق", url: `${clientEnv.NEXT_PUBLIC_APP_URL}/admin/launch` }],
  }).catch(() => {});
}

export async function alertAgentDegraded(reason: string, conversationId: string): Promise<void> {
  const first = await redis.set("bot:ai-fail-alert", 1, { nx: true, ex: 1800 }).catch(() => null);
  if (!first) return;
  const why = reason.replace(/\s+/g, " ").slice(0, 300);
  await notifyAdmin(`وكيل الرسائل لم يرد على عميل: الذكاء الاصطناعي تعذّر. السبب: ${why}`, { conversationId }).catch(() => {});
  const to = getOwnerAlertEmails();
  if (!to.length) return;
  await sendEmail({
    to,
    subject: "وكيل الرسائل: الذكاء الاصطناعي متوقف ولم يُرسل رد",
    headline: "الوكيل صامت لأن الذكاء الاصطناعي تعذّر",
    paragraphs: [
      "تعذّر على الذكاء الاصطناعي الرد في آخر رسالة، فلم يُرسل الوكيل شيئاً (لا ردود جاهزة بقرارك). الرسالة تنتظرك في المحادثات غير المقروءة.",
      `السبب كما أعاده المزوّد: ${why}`,
      `الخادم الذي حاول الرد: ${runtimeTag()}`,
      "الغالب أن مفتاح Groq أو Gemini منتهٍ أو خاطئ. افتح مركز جاهزية الإطلاق واضغط «اختبر وكيل الرسائل» لترى سبب كل نموذج، ثم ضع مفتاحاً صحيحاً وأعد النشر.",
    ],
    buttons: [{ title: "جاهزية الإطلاق", url: `${clientEnv.NEXT_PUBLIC_APP_URL}/admin/launch` }],
  }).catch(() => {});
}
