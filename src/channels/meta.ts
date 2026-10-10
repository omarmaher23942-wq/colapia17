import "server-only";
import { env } from "@/lib/env";

type Channel = "messenger" | "instagram";

/**
 * Message Tags خارج نافذة 24 ساعة:
 *  - HUMAN_AGENT: ردّ موظف بشري حقيقي فقط، حتى 7 أيام من رسالة العميل، على Messenger وInstagram، ويحتاج موافقة App Review من Meta.
 *    لا يُستخدم أبداً لرد آلي (يُرفض وقد يعرّض التطبيق للتقييد).
 *  - ACCOUNT_UPDATE وأخواتها: Messenger فقط، وتفيد مصادر غير رسمية أن Meta قيّدتها في 2026 [تحقق من وثائق Meta]:
 *    لذلك أي فشل في إرسالها يُحفظ كرسالة معلّقة وتصل بالبريد (lifecycle/messenger.ts).
 */
export type Tag = "HUMAN_AGENT" | "ACCOUNT_UPDATE" | "CONFIRMED_EVENT_UPDATE" | "POST_PURCHASE_UPDATE";

/** أقصى مدة لردّ بشري بوسم HUMAN_AGENT. */
export const HUMAN_AGENT_WINDOW_MS = 7 * 24 * 36e5;
/** نافذة الرد العادية (24 ساعة) بهامش نصف ساعة. */
export const STANDARD_WINDOW_MS = 23.5 * 36e5;

/** كيف يُرسَل ردّ لعميل راسلنا آخر مرة في `lastUserMessageAt`: عادي، أو بوسم بشري، أو ممنوع. */
export function replyMode(lastUserMessageAt: Date | null, now = Date.now()): { mode: "standard" } | { mode: "human_agent" } | { mode: "closed" } {
  const age = lastUserMessageAt ? now - lastUserMessageAt.getTime() : Infinity;
  if (age < STANDARD_WINDOW_MS) return { mode: "standard" };
  if (age < HUMAN_AGENT_WINDOW_MS) return { mode: "human_agent" };
  return { mode: "closed" };
}

type SendResult = { message_id?: string };
type CallOpts = { retry?: boolean };
type LinkButton = { title: string; url: string };

/** حدود طول النص لكل قناة (Messenger حده 2000 حرف، و Instagram أقل) */
const TEXT_LIMIT: Record<Channel, number> = { messenger: 1900, instagram: 900 };
const BUTTON_TEXT_LIMIT = 640;
const REQUEST_TIMEOUT_MS = 10_000;
const PROFILE_TIMEOUT_MS = 5_000;
const MAX_ATTEMPTS = 3;
/** أكواد Meta المؤقتة التي تستحق إعادة المحاولة (أخطاء خدمة و Rate Limit) */
const RETRYABLE_CODES = new Set([1, 2, 4, 17, 32, 613]);

/** خط الدفاع الأخير لقانون الصفر إيموجي: أي إيموجي يفلت من الطبقات الأعلى يُحذف هنا */
const EMOJI_RE = new RegExp("[\\p{Extended_Pictographic}\\u{1F1E6}-\\u{1F1FF}\\u{1F3FB}-\\u{1F3FF}\\uFE0F\\u20E3\\u200D]", "gu");

export class MetaSendError extends Error {
  constructor(message: string, readonly status: number, readonly code?: number, readonly subcode?: number) {
    super(message);
    this.name = "MetaSendError";
  }
}

const token = (ch: Channel) => {
  const tok =
    ch === "instagram"
      ? env.META_INSTAGRAM_ACCESS_TOKEN ?? env.META_PAGE_ACCESS_TOKEN
      : env.META_PAGE_ACCESS_TOKEN;
  if (!tok) {
    throw new Error(
      `Meta access token is missing for channel: ${ch}. Make sure META_PAGE_ACCESS_TOKEN is configured in environment variables.`
    );
  }
  return tok;
};

// ضمان أن الإصدار يبدأ بحرف v دائماً لتجنب خطأ Code 2500
const getVersion = () => {
  const v = (env.META_GRAPH_VERSION || "v21.0").trim();
  return v.startsWith("v") ? v : `v${v}`;
};

const base = () => `https://graph.facebook.com/${getVersion()}`;

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function sanitize(s: string | undefined | null): string {
  return (s ?? "")
    .replace(EMOJI_RE, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

function toError(e: unknown): Error {
  if (e instanceof Error) return e;
  const err = new Error(String(e));
  const name = (e as { name?: unknown } | null)?.name;
  if (typeof name === "string") err.name = name;
  return err;
}

async function readJson(res: Response): Promise<any> {
  const txt = await res.text().catch(() => "");
  if (!txt) return {};
  try { return JSON.parse(txt); } catch { return { raw: txt.slice(0, 300) }; }
}

/** Instagram يقبل HUMAN_AGENT وحده؛ بقية الوسوم لـ Messenger فقط. */
function messaging(ch: Channel, tag?: Tag) {
  if (!tag) return { messaging_type: "RESPONSE" };
  if (ch === "messenger" || tag === "HUMAN_AGENT") return { messaging_type: "MESSAGE_TAG", tag };
  return { messaging_type: "RESPONSE" };
}

async function call(ch: Channel, payload: Record<string, unknown>, opts: CallOpts = {}): Promise<SendResult> {
  const tok = token(ch);
  const target = (env as any).META_PAGE_ID || "me";
  const url = `${base()}/${target}/messages?access_token=${encodeURIComponent(tok)}`;
  const attempts = opts.retry === false ? 1 : MAX_ATTEMPTS;
  let lastError: Error = new Error("Meta send failed: no attempt made");

  for (let attempt = 1; attempt <= attempts; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tok}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: "no-store",
    }).catch(toError);

    if (res instanceof Error) {
      lastError = res;
      // المهلة قد تعني أن Meta استلمت الرسالة فعلًا: لا نعيد حتى لا تتكرر عند العميل
      if (res.name === "TimeoutError" || res.name === "AbortError") break;
    } else {
      const j = await readJson(res);
      if (res.ok) return j as SendResult;
      const err = j?.error ?? {};
      lastError = new MetaSendError(
        `Meta send failed: ${JSON.stringify(j?.error ?? j)}`,
        res.status,
        typeof err.code === "number" ? err.code : undefined,
        typeof err.error_subcode === "number" ? err.error_subcode : undefined
      );
      const retryable = res.status >= 500 || RETRYABLE_CODES.has(Number(err.code));
      if (!retryable) break;
    }

    if (attempt < attempts) await wait(400 * 3 ** (attempt - 1));
  }

  throw lastError;
}

/** تقسيم النص على حدود طبيعية (فقرة، سطر، جملة، فاصلة، مسافة) مع قص صارم كحل أخير */
function splitText(input: string, max: number): string[] {
  const text = (input ?? "").trim();
  if (!text) return [];
  if (text.length <= max) return [text];

  const out: string[] = [];
  let rest = text;
  while (rest.length > max) {
    const cut = findCut(rest.slice(0, max));
    const part = rest.slice(0, cut).trim();
    if (part) out.push(part);
    rest = rest.slice(cut).trim();
  }
  if (rest) out.push(rest);
  return out;
}

function findCut(window: string): number {
  const min = Math.floor(window.length * 0.5);
  const seps = ["\n\n", "\n", ". ", "؟ ", "? ", "! ", "، ", ", ", " "];
  for (const sep of seps) {
    const i = window.lastIndexOf(sep);
    if (i >= min) return i + sep.length;
  }
  // قص صارم: لا نقسم زوجًا بديلًا (surrogate pair) في المنتصف
  const code = window.charCodeAt(window.length - 1);
  return code >= 0xd800 && code <= 0xdbff ? window.length - 1 : window.length;
}

function cleanButtons(buttons: LinkButton[]): LinkButton[] {
  return (buttons ?? [])
    .filter((b) => typeof b?.url === "string" && b.url.startsWith("http"))
    .slice(0, 3)
    .map((b) => ({ title: (sanitize(b.title) || "افتح الرابط").slice(0, 20), url: b.url }));
}

/** نص (يُقسَّم تلقائيًا حسب حد القناة على حدود الجمل) */
async function sendText(ch: Channel, to: string, text: string, tag?: Tag): Promise<string[]> {
  const chunks = splitText(sanitize(text), TEXT_LIMIT[ch]);
  const ids: string[] = [];
  for (const c of chunks) {
    const r = await call(ch, { recipient: { id: to }, ...messaging(ch, tag), message: { text: c } });
    if (r.message_id) ids.push(r.message_id);
  }
  return ids;
}

/** ردود سريعة تحت آخر جزء من الرسالة (الأجزاء السابقة تُرسل كنص عادي) */
async function sendQuickReplies(ch: Channel, to: string, text: string, options: string[]): Promise<SendResult> {
  const chunks = splitText(sanitize(text), TEXT_LIMIT[ch]);
  if (!chunks.length) return {};
  const opts = Array.from(new Set((options ?? []).map((o) => sanitize(o)).filter(Boolean))).slice(0, 13);

  for (const c of chunks.slice(0, -1)) {
    await call(ch, { recipient: { id: to }, messaging_type: "RESPONSE", message: { text: c } });
  }
  const last = chunks[chunks.length - 1] ?? "";

  return call(ch, {
    recipient: { id: to },
    messaging_type: "RESPONSE",
    message: opts.length
      ? {
          text: last,
          quick_replies: opts.map((t) => ({ content_type: "text", title: t.slice(0, 20), payload: t.slice(0, 1000) })),
        }
      : { text: last },
  });
}

/** أزرار برابط (Instagram أو بدون أزرار صالحة: نص بالروابط) */
async function sendButtons(
  ch: Channel,
  to: string,
  text: string,
  buttons: LinkButton[],
  tag?: Tag
): Promise<string[] | SendResult> {
  const list = cleanButtons(buttons);
  const clean = sanitize(text);

  if (ch === "instagram" || !list.length) {
    const links = list.map((b) => `${b.title}: ${b.url}`).join("\n");
    return sendText(ch, to, links ? `${clean}\n\n${links}` : clean, tag);
  }

  // قالب الأزرار حده 640 حرفًا: الأجزاء السابقة تُرسل نصًا، والجزء الأخير يحمل الأزرار
  const chunks = splitText(clean, BUTTON_TEXT_LIMIT);
  if (!chunks.length) chunks.push(list[0]?.title ?? "افتح الرابط");

  for (const c of chunks.slice(0, -1)) {
    await call(ch, { recipient: { id: to }, ...messaging(ch, tag), message: { text: c } });
  }
  const last = chunks[chunks.length - 1] ?? "";

  return call(ch, {
    recipient: { id: to },
    ...messaging(ch, tag),
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "button",
          text: last,
          buttons: list.map((b) => ({
            type: "web_url",
            title: b.title,
            url: b.url,
            webview_height_ratio: "full",
          })),
        },
      },
    },
  });
}

/** كارت عام بصورة وعنوان وأزرار */
async function sendCard(
  ch: Channel,
  to: string,
  c: { title: string; subtitle?: string; imageUrl: string; buttons: LinkButton[] },
  tag?: Tag
): Promise<SendResult> {
  const list = cleanButtons(c.buttons);
  const subtitle = sanitize(c.subtitle).slice(0, 80);

  return call(ch, {
    recipient: { id: to },
    ...messaging(ch, tag),
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "generic",
          elements: [
            {
              title: (sanitize(c.title) || "متجرك").slice(0, 80),
              ...(subtitle ? { subtitle } : {}),
              image_url: c.imageUrl,
              ...(list.length
                ? { buttons: list.map((b) => ({ type: "web_url", title: b.title, url: b.url })) }
                : {}),
            },
          ],
        },
      },
    },
  });
}

/** اسم العميل من الملف الشخصي */
async function fetchProfile(ch: Channel, id: string): Promise<string | null> {
  try {
    const tok = token(ch);
    const fields = ch === "instagram" ? "name,username" : "first_name,last_name";
    const r = await fetch(`${base()}/${id}?fields=${fields}&access_token=${encodeURIComponent(tok)}`, {
      headers: { Authorization: `Bearer ${tok}` },
      signal: AbortSignal.timeout(PROFILE_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!r.ok) return null;
    const j = await readJson(r);
    const name =
      ch === "instagram"
        ? (j.name ?? j.username ?? "")
        : [j.first_name, j.last_name].filter(Boolean).join(" ");
    return sanitize(String(name)) || null;
  } catch {
    return null;
  }
}

export const meta = {
  typing: (ch: Channel, to: string, on = true) =>
    call(ch, { recipient: { id: to }, sender_action: on ? "typing_on" : "typing_off" }, { retry: false }).catch(() => {}),

  seen: (ch: Channel, to: string) =>
    call(ch, { recipient: { id: to }, sender_action: "mark_seen" }, { retry: false }).catch(() => {}),

  text: sendText,

  quickReplies: sendQuickReplies,

  buttons: sendButtons,

  image: (ch: Channel, to: string, url: string) =>
    call(ch, {
      recipient: { id: to },
      messaging_type: "RESPONSE",
      message: { attachment: { type: "image", payload: { url, is_reusable: true } } },
    }),

  card: sendCard,

  profile: fetchProfile,
};
