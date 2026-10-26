import "server-only";
// owner-alerts.ts — تنبيهات فورية لمالك المنصة بالبريد (إيصال دفع جديد ينتظر قراره، أو سؤال عن مشروع غير متجر).
import { clientEnv, getOwnerAlertEmails } from "@/lib/env";
import { sendEmail } from "@/lib/email";
import type { ReceiptAssessment } from "./payment-policy";

const METHOD: Record<string, string> = { vodafone_cash: "فودافون كاش", instapay: "إنستاباي" };
const LEVEL: Record<ReceiptAssessment["level"], string> = {
  ok: "الفحص الآلي: يبدو مطابقاً",
  check: "الفحص الآلي: يحتاج نظرة منك",
  danger: "الفحص الآلي: إشارة احتيال",
};

export async function notifyOwnerOfPayment(p: {
  paymentId: string;
  kind: "project" | "edit";
  /** اسم المتجر (حجز) أو عنوان التعديل. */
  title: string;
  clientEmail: string;
  method: string;
  senderPhone: string;
  amountEgp: number;
  offer?: "standard" | "golden";
  screenshotUrl: string;
  assessment: ReceiptAssessment;
}): Promise<void> {
  const to = getOwnerAlertEmails();
  if (!to.length) return;
  const review = `${clientEnv.NEXT_PUBLIC_APP_URL}/admin/payments?focus=${p.paymentId}`;
  const edit = p.kind === "edit";
  await sendEmail({
    to,
    subject: `${p.assessment.level === "danger" ? "[تنبيه] " : ""}${edit ? "رسوم تعديل" : "حجز جديد"}: ${p.title} (${p.amountEgp} ج)`,
    headline: edit ? "إيصال رسوم تعديل ينتظر قرارك" : "حجز جديد بإيصال ينتظر قرارك",
    paragraphs: [
      `${edit ? "التعديل" : "المشروع"}: ${p.title}${!edit && p.offer === "golden" ? " · الدائرة الذهبية" : ""}`,
      `العميل: ${p.clientEmail}`,
      `المبلغ: ${p.amountEgp} ج عبر ${METHOD[p.method] ?? p.method}، من الرقم ${p.senderPhone}.`,
      `${LEVEL[p.assessment.level]}: ${p.assessment.summary}`,
      edit
        ? "التنفيذ لا يبدأ حتى تقبل الإيصال، وبعد القبول يصل العميل بريد التأكيد."
        : "الحجز لا يدخل الإنتاج حتى تقبل الإيصال. بعد القبول ينقص عدّاد الدائرة الذهبية (إن كان ذهبياً) ويصل العميل بريد التأكيد.",
    ],
    buttons: [
      { title: "راجع واقبل الآن", url: review },
      { title: "صورة الإيصال", url: p.screenshotUrl },
    ],
  });
}
