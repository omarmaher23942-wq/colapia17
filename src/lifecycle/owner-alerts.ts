import "server-only";
// owner-alerts.ts — تنبيهات فورية لمالك المنصة بالبريد (إيصال دفع جديد ينتظر قراره).
import { clientEnv, getOwnerAlertEmails } from "@/lib/env";
import { sendEmail } from "@/lib/email";
import { storeUrl } from "@/lib/utils";
import type { ReceiptAssessment } from "./payment-policy";

const METHOD: Record<string, string> = { vodafone_cash: "فودافون كاش", instapay: "إنستاباي" };
const LEVEL: Record<ReceiptAssessment["level"], string> = {
  ok: "✅ الفحص الآلي: يبدو مطابقاً",
  check: "🟡 الفحص الآلي: يحتاج نظرة منك",
  danger: "🔴 الفحص الآلي: إشارة احتيال",
};

export async function notifyOwnerOfPayment(p: {
  paymentId: string;
  storeName: string;
  subdomain: string;
  method: string;
  senderPhone: string;
  amountEgp: number;
  screenshotUrl: string;
  assessment: ReceiptAssessment;
}): Promise<void> {
  const to = getOwnerAlertEmails();
  if (!to.length) return;
  const review = `${clientEnv.NEXT_PUBLIC_APP_URL}/admin/payments?focus=${p.paymentId}`;
  await sendEmail({
    to,
    subject: `${p.assessment.level === "danger" ? "🔴 " : ""}إيصال دفع جديد: ${p.storeName} (${p.amountEgp} ج)`,
    headline: "إيصال دفع جديد ينتظر قرارك",
    paragraphs: [
      `المتجر: ${p.storeName} (${p.subdomain})`,
      `المبلغ: ${p.amountEgp} ج عبر ${METHOD[p.method] ?? p.method}، من الرقم ${p.senderPhone}.`,
      `${LEVEL[p.assessment.level]}: ${p.assessment.summary}`,
      "المتجر لن يُفعَّل حتى تقبل الإيصال. بمجرد القبول يُفعَّل فوراً ويصل التاجر بريد التفعيل.",
    ],
    buttons: [
      { title: "راجع واقبل الآن", url: review },
      { title: "صورة الإيصال", url: p.screenshotUrl },
      { title: "شاهد المتجر", url: storeUrl(p.subdomain) },
    ],
  });
}
