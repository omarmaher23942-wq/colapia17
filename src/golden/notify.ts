import "server-only";
// notify.ts — ما بعد إرسال الحجز (داخل after()): فحص الإيصال الآلي ثم تنبيه المالك بخلاصته، وإشعار العميل باستلام طلبه.
// فشل أي خطوة لا يُفشل الحجز نفسه (سُجّل قبل هذا).
import { verifyPlatformPayment } from "@/ai/verify-payment";
import { assessReceipt } from "@/lifecycle/payment-policy";
import { notifyOwnerOfPayment } from "@/lifecycle/owner-alerts";
import { deliverToClient, platformOrigin } from "@/agency/client-notify";
import { bookingReceivedMessage } from "@/agent/handoff-messages";
import { db } from "@/db/client";
import { storeRequests } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { BookingData } from "./schema";
import type { PaymentPlan } from "@/lib/platform-pricing";

export async function notifyBookingSubmitted(i: {
  requestId: string;
  paymentId: string;
  code: string;
  trackToken: string;
  data: BookingData;
  offer: PaymentPlan;
  amountEgp: number;
  receiptUrl: string;
}): Promise<void> {
  const verification = await verifyPlatformPayment(i.paymentId).catch(() => null);
  await notifyOwnerOfPayment({
    paymentId: i.paymentId,
    kind: "project",
    title: i.data.store.name,
    clientEmail: i.data.contact.email,
    method: i.data.payment.method,
    senderPhone: i.data.payment.senderPhone,
    amountEgp: i.amountEgp,
    offer: i.offer,
    screenshotUrl: i.receiptUrl,
    assessment: assessReceipt(verification, i.amountEgp),
  }).catch((e) => console.error("[golden] owner alert failed", e));

  const [req] = await db.select({ conversationId: storeRequests.conversationId }).from(storeRequests).where(eq(storeRequests.id, i.requestId)).limit(1).catch(() => []);
  const trackUrl = `${platformOrigin()}/golden/done/${i.trackToken}`;
  await deliverToClient(
    { email: i.data.contact.email, conversationId: req?.conversationId ?? null },
    {
      key: `booking.received:${i.requestId}`,
      text: bookingReceivedMessage({ storeName: i.data.store.name, code: i.code, trackUrl }),
      subject: `استلمنا طلبكم ${i.code}`,
      buttons: [{ title: "متابعة حالة الطلب", url: trackUrl }],
    }
  ).catch((e) => console.error("[golden] client ack failed", e));
}
