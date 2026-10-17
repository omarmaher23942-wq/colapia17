import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { merchants, stores } from "@/db/schema";
import { sendTemplatedEmail } from "@/lib/email";
import { GenericEmail } from "@/lib/email-templates/GenericEmail";
import { stripEmoji } from "@/lib/emoji";
import { notifyMerchant, notifyAdmin } from "@/ai/lifecycle/notify";
import { recordEvent } from "./machine";

type LinkButton = { title: string; url: string };

export type OutboundMessage = {
  key: string;
  text: string;
  buttons?: LinkButton[];
  purpose: "transactional" | "promotional";
  /** البريد يُرسل دائماً متى وُجد (always قديم بلا أثر، يبقى للتوافق). */
  email?: { subject: string; always?: boolean };
  card?: Parameters<typeof notifyMerchant>[2] extends infer O ? (O extends { card?: infer C } ? C : never) : never;
};

export type DeliveryReport = { viaMeta: boolean; emailed: boolean; undelivered: boolean };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * بريد صاحب المتجر: stores.merchant_id ← merchants.email (البريد الذي أعطاه للوكيل ويدخل به لوحته).
 * مصدر واحد ثابت؛ لا قراءة من جداول الاستمارات القديمة.
 */
export async function merchantEmail(storeId: string): Promise<string | null> {
  const [row] = await db
    .select({ email: merchants.email })
    .from(stores)
    .innerJoin(merchants, eq(merchants.id, stores.merchantId))
    .where(eq(stores.id, storeId))
    .limit(1);
  const e = row?.email?.trim().toLowerCase();
  return e && EMAIL_RE.test(e) ? e : null;
}

async function emailMerchant(a: { storeId: string; to: string; subject: string; text: string; buttons: LinkButton[]; key: string }): Promise<boolean> {
  const paragraphs = a.text.split(/\n+/).map((p) => p.trim()).filter(Boolean);
  const r = await sendTemplatedEmail({
    to: a.to,
    subject: stripEmoji(a.subject).slice(0, 150),
    element: GenericEmail({ storeName: "Colapia", paragraphs, buttons: a.buttons }),
    senderKind: "hello",
    idempotencyKey: a.key.slice(0, 200),
    storeId: a.storeId,
    tracking: false,
  }).catch((e) => {
    console.error("[messenger] email error", e);
    return { ok: false };
  });
  return r.ok;
}

export async function deliverToMerchant(storeId: string, m: OutboundMessage): Promise<DeliveryReport> {
  const text = stripEmoji(m.text).trim();
  const buttons = (m.buttons ?? []).filter((b) => /^https?:\/\//.test(b.url)).map((b) => ({ ...b, title: stripEmoji(b.title) }));

  const viaMeta = await notifyMerchant(storeId, text, {
    buttons,
    card: m.card,
    promotional: m.purpose === "promotional",
  }).catch((e) => {
    console.error("[messenger] meta failed", e);
    return false;
  });

  // رسائل دورة الحياة (التجربة، الإيقاف، التنبيه الأخير، الدفع، الاستضافة) تصل بالبريد دائماً، سواء وصلت المحادثة أم لا:
  // نافذة الـ 24 ساعة في ميتا تمنع أغلبها، والبريد هو القناة المضمونة.
  let emailed = false;
  if (m.email) {
    const to = await merchantEmail(storeId);
    if (to) emailed = await emailMerchant({ storeId, to, subject: m.email.subject, text, buttons, key: m.key });
  }

  const undelivered = !viaMeta && !emailed;
  await recordEvent({
    storeId,
    type: undelivered ? "message.undelivered" : "message.outbound",
    actor: "system",
    data: { key: m.key, purpose: m.purpose, viaMeta, emailed },
  });
  if (undelivered) await notifyAdmin(`تعذّر توصيل رسالة (${m.key}) للتاجر: لا محادثة مفتوحة ولا بريد صالح أو فشل الإرسال`, { storeId, key: m.key });

  return { viaMeta, emailed, undelivered };
}