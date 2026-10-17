import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { conversations, messages, systemEvents } from "@/db/schema";
import { meta, type Tag } from "@/channels/meta";

type LinkButton = { title: string; url: string };
type Card = { title: string; subtitle?: string; imageUrl: string; buttons: LinkButton[] };
type Conv = typeof conversations.$inferSelect;

const WINDOW_MS = 23.5 * 36e5;

const EMOJI_RE = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{1F3FB}-\u{1F3FF}\uFE0F\u200D\u20E3]/gu;
const clean = (s: string) => String(s ?? "").replace(EMOJI_RE, "").replace(/[ \t]{2,}/g, " ").replace(/^\s+|\s+$/gm, "").trim();
const cleanButtons = (b?: LinkButton[]) => b?.filter((x) => typeof x?.url === "string" && x.url).map((x) => ({ ...x, title: clean(x.title) }));

async function logEvent(storeId: string | null, level: "error" | "warn", message: string, data: Record<string, unknown>) {
  try {
    await db.insert(systemEvents).values({ scope: "webhook", level, ...(storeId ? { storeId } : {}), message, data });
  } catch (e) {
    console.error("[notify] event log failed", e);
  }
}

async function merchantConversation(storeId: string): Promise<Conv | undefined> {
  const [conv] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.storeId, storeId))
    .orderBy(sql`${conversations.lastUserMessageAt} desc nulls last`)
    .limit(1);
  return conv;
}

export async function notifyMerchant(
  storeId: string,
  rawText: string,
  opts: { buttons?: LinkButton[]; card?: Card; tag?: Tag; promotional?: boolean } = {}
): Promise<boolean> {
  const text = clean(rawText);
  const buttons = cleanButtons(opts.buttons);
  const card: Card | undefined = opts.card
    ? {
        ...opts.card,
        title: clean(opts.card.title),
        subtitle: opts.card.subtitle ? clean(opts.card.subtitle) : undefined,
        buttons: cleanButtons(opts.card.buttons) ?? [],
      }
    : undefined;
  if (!text && !card) return false;

  const conv = await merchantConversation(storeId);
  if (!conv) return false;

  // إذا كانت المحادثة مسجلة عبر الويب فقط (ليست حساب فيسبوك حقيقي)
  if (conv.externalId.startsWith("web_")) {
    await db.insert(messages).values({ conversationId: conv.id, role: "assistant", text });
    return true;
  }

  const last = conv.lastUserMessageAt ? new Date(conv.lastUserMessageAt).getTime() : 0;
  const inWindow = last > 0 && Date.now() - last < WINDOW_MS;
  const tag = inWindow ? undefined : (opts.tag ?? "ACCOUNT_UPDATE");
  const sentText = text || card?.title || "";

  // خارج نافذة الـ 24 ساعة لا يُسمح بالإرسال على إنستجرام ولا بالرسائل الترويجية: لا طابور معلّق
  // (لم يكن يُفرَّغ أبداً)، والبريد في lifecycle/messenger.ts هو القناة المضمونة.
  if (!inWindow && (conv.channel === "instagram" || opts.promotional)) return false;

  try {
    if (card) await meta.card(conv.channel, conv.externalId, card, tag);
    else if (buttons?.length) await meta.buttons(conv.channel, conv.externalId, text, buttons, tag);
    else await meta.text(conv.channel, conv.externalId, text, tag);
  } catch (e) {
    await logEvent(storeId, "error", "فشل إرسال رسالة للتاجر عبر ميتا (البريد يغطيها)", {
      error: String(e).slice(0, 500),
      channel: conv.channel,
      tag: tag ?? null,
    });
    return false;
  }

  try {
    await db.insert(messages).values({ conversationId: conv.id, role: "assistant", text: sentText });
    await db.update(conversations).set({ lastBotMessageAt: new Date() }).where(eq(conversations.id, conv.id));
  } catch (e) {
    console.error("[notify] delivered but logging failed", e);
  }
  return true;
}

export async function notifyAdmin(rawText: string, data: Record<string, unknown> = {}) {
  const text = clean(rawText);
  try {
    await db.insert(systemEvents).values({ scope: "admin", message: text, data });
  } catch (e) {
    console.error("[notify] admin event failed", e);
  }
  if (process.env.ADMIN_MESSENGER_PSID) {
    await meta.text("messenger", process.env.ADMIN_MESSENGER_PSID, text, "ACCOUNT_UPDATE").catch(() => {});
  }
}