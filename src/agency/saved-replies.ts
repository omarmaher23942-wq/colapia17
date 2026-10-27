// saved-replies.ts — الردود المحفوظة للفريق (تُخزَّن في feature_flags بمفتاح saved_replies). خالصة ومختبَرة.
export type SavedReply = { id: string; title: string; text: string };

export const SAVED_REPLIES_KEY = "saved_replies";
export const MAX_REPLIES = 40;
export const MAX_TITLE = 60;
export const MAX_TEXT = 1500;

/** المتغيرات المسموحة في نص الرد. */
export const REPLY_VARS = ["{الاسم}", "{المتجر}"] as const;

const clean = (s: unknown, max: number) => (typeof s === "string" ? s.replace(/\r\n/g, "\n").trim().slice(0, max) : "");

/** يقرأ الإعداد الخام بتسامح ويعيد قائمة صالحة فقط، بلا تكرار معرّفات. */
export function parseReplies(raw: unknown): SavedReply[] {
  const items = raw && typeof raw === "object" ? (raw as { items?: unknown }).items : null;
  if (!Array.isArray(items)) return [];
  const seen = new Set<string>();
  const out: SavedReply[] = [];
  for (const it of items) {
    if (!it || typeof it !== "object") continue;
    const o = it as Record<string, unknown>;
    const id = clean(o.id, 40);
    const title = clean(o.title, MAX_TITLE);
    const text = clean(o.text, MAX_TEXT);
    if (!id || !title || !text || seen.has(id)) continue;
    seen.add(id);
    out.push({ id, title, text });
    if (out.length >= MAX_REPLIES) break;
  }
  return out;
}

export function validateReply(input: { title?: unknown; text?: unknown }): { ok: true; title: string; text: string } | { ok: false; error: string } {
  const title = clean(input.title, MAX_TITLE + 1);
  const text = clean(input.text, MAX_TEXT + 1);
  if (!title) return { ok: false, error: "اكتبوا عنواناً قصيراً للرد." };
  if (title.length > MAX_TITLE) return { ok: false, error: `العنوان أطول من ${MAX_TITLE} حرفاً.` };
  if (!text) return { ok: false, error: "اكتبوا نص الرد." };
  if (text.length > MAX_TEXT) return { ok: false, error: `النص أطول من ${MAX_TEXT} حرفاً.` };
  return { ok: true, title, text };
}

/** يملأ المتغيرات؛ ما لا قيمة له يُحذف مع مسافته بدل ترك أقواس. */
export function fillReply(text: string, v: { name?: string | null; store?: string | null }): string {
  return text
    .replace(/\s?\{الاسم\}/g, v.name?.trim() ? ` ${v.name.trim()}` : "")
    .replace(/\s?\{المتجر\}/g, v.store?.trim() ? ` ${v.store.trim()}` : "")
    .replace(/^\s+/, "")
    .replace(/[ \t]+\n/g, "\n");
}
