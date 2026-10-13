import "server-only";
// alerts.ts — تنبيه المالك حين يتعذر الذكاء الاصطناعي على وكيل الرسائل فيصمت الوكيل (لا ردود جاهزة بقرار المالك). مرة واحدة
// كل 30 دقيقة كحد أقصى حتى لا يُغرق بريده، وبسبب الفشل الحقيقي ورابط الفحص.
import { clientEnv, getOwnerAlertEmails } from "@/lib/env";
import { sendEmail } from "@/lib/email";
import { redis } from "@/lib/redis";
import { notifyAdmin } from "@/ai/lifecycle/notify";

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
      "الغالب أن مفتاح Groq أو Gemini منتهٍ أو خاطئ. افتح مركز جاهزية الإطلاق واضغط «اختبر وكيل الرسائل» لترى سبب كل نموذج، ثم ضع مفتاحاً صحيحاً وأعد النشر.",
    ],
    buttons: [{ title: "جاهزية الإطلاق", url: `${clientEnv.NEXT_PUBLIC_APP_URL}/admin/launch` }],
  }).catch(() => {});
}
