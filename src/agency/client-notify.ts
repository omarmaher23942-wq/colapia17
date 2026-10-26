import "server-only";
// client-notify.ts — رسائل العميل في رحلة المشروع (تأكيد الحجز، التسليم، التعديلات). البريد هو القناة المضمونة، ورسالة ميتا
// تُرسل أيضاً متى عُرفت المحادثة وسمحت قواعد نافذة المراسلة (ai/lifecycle/notify.ts). فشل أي قناة لا يُفشل الإجراء.
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { conversations } from "@/db/schema";
import { sendTemplatedEmail } from "@/lib/email";
import { GenericEmail } from "@/lib/email-templates/GenericEmail";
import { stripEmoji } from "@/lib/emoji";
import { notifyConversation } from "@/ai/lifecycle/notify";
import { env } from "@/lib/env";

export type ClientTarget = { email: string | null; conversationId: string | null };
export type ClientMessage = { key: string; text: string; subject: string; buttons?: { title: string; url: string }[] };
export type ClientDelivery = { emailed: boolean; viaMeta: boolean };

/** أصل المنصة لروابط الرسائل. */
export const platformOrigin = () => {
  const root = (env.ROOT_DOMAIN || "").trim();
  return !root || root.startsWith("localhost") ? "http://localhost:3100" : `https://${root}`;
};

/** رابط بوابة العميل (يدخلها بالبريد المسجل في الحجز). */
export const accountUrl = () => `${platformOrigin()}/dashboard`;

export async function deliverToClient(to: ClientTarget, m: ClientMessage): Promise<ClientDelivery> {
  const text = stripEmoji(m.text).trim();
  const buttons = (m.buttons ?? []).filter((b) => /^https?:\/\//.test(b.url)).map((b) => ({ ...b, title: stripEmoji(b.title) }));

  let emailed = false;
  if (to.email) {
    const paragraphs = text.split(/\n+/).map((p) => p.trim()).filter(Boolean);
    const r = await sendTemplatedEmail({
      to: to.email,
      subject: stripEmoji(m.subject).slice(0, 150),
      element: GenericEmail({ storeName: "Colapia", paragraphs, buttons }),
      senderKind: "hello",
      idempotencyKey: m.key.slice(0, 200),
      tracking: false,
    }).catch((e) => {
      console.error("[client-notify] email error", e);
      return { ok: false };
    });
    emailed = r.ok;
  }

  let viaMeta = false;
  if (to.conversationId) {
    const [conv] = await db.select().from(conversations).where(eq(conversations.id, to.conversationId)).limit(1).catch(() => []);
    if (conv) viaMeta = await notifyConversation(conv, text, { buttons }).catch(() => false);
  }
  return { emailed, viaMeta };
}
