/** قانون الصفر إيموجي: مصدر واحد للتنظيف والكشف */
const EMOJI_SRC = "[\\p{Extended_Pictographic}\\u{1F1E6}-\\u{1F1FF}\\u{1F3FB}-\\u{1F3FF}\\uFE0F\\u200D\\u20E3]";
const EMOJI_G = new RegExp(EMOJI_SRC, "gu");
const EMOJI_T = new RegExp(EMOJI_SRC, "u");

export const hasEmoji = (s: string): boolean => EMOJI_T.test(s);
export const stripEmoji = (s: string): string => s.replace(EMOJI_G, "");

export function stripEmojiDeep<T>(v: T): T {
  if (typeof v === "string") return stripEmoji(v) as T;
  if (Array.isArray(v)) return v.map(stripEmojiDeep) as T;
  if (v && typeof v === "object") {
    return Object.fromEntries(
      Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, stripEmojiDeep(x)])
    ) as T;
  }
  return v;
}