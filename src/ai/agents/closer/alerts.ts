import "server-only";
// alerts.ts — تنبيه المالك حين يتعذر الذكاء الاصطناعي على وكيل الرسائل فيردّ بالقواعد الاحتياطية (ردود أبسط). مرة واحدة
// كل 30 دقيقة كحد أقصى حتى لا يُغرق بريده، وبسبب الفشل الحقيقي ورابط الفحص.
import { clientEnv, getOwnerAlertEmails } from "@/lib/env";
import { sendEmail } from "@/lib/email";
import { redis } from "@/lib/redis";
import { notifyAdmin } from "@/ai/lifecycle/notify";

export async function alertAgentDegraded(reason: string, conversationId: string): Promise<void> {
  const first = await redis.set("bot:ai-fail-alert", 1, { nx: true, ex: 1800 }).catch(() => null);
  if (!first) return;
  const why = reason.replace(/\s+/g, " ").slice(0, 300);
  await notifyAdmin(`وكيل الرسائل يرد بالقواعد الاحتياطية: الذكاء الاصطناعي تعذّر. السبب: ${why}`, { conversationId }).catch(() => {});
  const to = getOwnerAlertEmails();
  if (!to.length) return;
  await sendEmail({
    to,
    subject: "وكيل الرسائل: الذكاء الاصطناعي متوقف، الردود بالقواعد الاحتياطية",
    headline: "الوكيل يرد، لكن بردود أبسط",
    paragraphs: [
      "تعذّر على الذكاء الاصطناعي الرد في آخر رسالة، فرد الوكيل بقواعد احتياطية (قصيرة ومناسبة لما سُئل عنه، لكنها أقل مرونة).",
      `السبب كما أعاده المزوّد: ${why}`,
      "الغالب أن مفتاح Groq أو Gemini منتهٍ أو خاطئ. افتح مركز جاهزية الإطلاق واضغط «اختبر وكيل الرسائل» لترى سبب كل نموذج، ثم ضع مفتاحاً صحيحاً وأعد النشر.",
    ],
    buttons: [{ title: "جاهزية الإطلاق", url: `${clientEnv.NEXT_PUBLIC_APP_URL}/admin/launch` }],
  }).catch(() => {});
}
