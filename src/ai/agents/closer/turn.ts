// turn.ts — دور الوكيل بصيغته الثانية (خالص ومختبَر): {reply, memory, requestHuman, lead, confirmCreate}.
// التحليل **صارم**: لا رد صالح = يُرفض الناتج ويُجرَّب النموذج التالي. لا يُرسل أبداً نص خام فيه أقواس أو أسماء حقول.
import { z } from "zod";
import { stripEmoji } from "@/lib/emoji";

function clean(value: unknown, max = 1000): string {
  const s = typeof value === "string" ? value : "";
  return stripEmoji(s)
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\s+|\s+$/g, "")
    .slice(0, max);
}

const optText = (max: number) => z.string().nullish().transform((s) => clean(s, max) || undefined);

export const closerTurnSchema = z.object({
  reply: z.string().transform((s) => clean(s, 800)),
  memory: z.string().nullish().transform((s) => clean(s, 900)),
  requestHuman: z.string().nullish().transform((s) => clean(s, 200) || null),
  lead: z
    .object({
      storeName: optText(120),
      niche: optText(200),
      email: optText(160),
      whatsapp: optText(40),
      instagram: optText(120),
    })
    .nullish()
    .transform((l) => l ?? {}),
  confirmCreate: z.boolean().nullish().transform((v) => v === true),
  /** طلب صريح لإعادة إرسال رابط الإعداد (بعد إنشاء المتجر). */
  resendLink: z.boolean().nullish().transform((v) => v === true),
});

export type CloserTurn = z.infer<typeof closerTurnSchema>;

/** يستخرج أول كائن JSON متوازن من نص (يتجاوز أسوار ```json ونصاً قبله وبعده). */
export function extractJsonObject(text: string): unknown {
  const s0 = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  const start = s0.indexOf("{");
  if (start < 0) throw new Error("no json object");
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < s0.length; i++) {
    const ch = s0[i]!;
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) {
      const slice = s0.slice(start, i + 1).replace(/[“”]/g, '"').replace(/,\s*([}\]])/g, "$1");
      return JSON.parse(slice);
    }
  }
  throw new Error("unterminated json");
}

/** رد يسرّب بنية الـ JSON أو أسماء الحقول إلى العميل. */
export function looksLikeLeak(reply: string): boolean {
  return /^\s*[{[]/.test(reply) || /"\s*(reply|memory|requestHuman|confirmCreate|lead)\s*"\s*:/.test(reply) || /```/.test(reply);
}

/** تحليل صارم لدور الوكيل: null إن لم يكن JSON صالحاً بحقل reply نصي غير فارغ وغير مسرّب. */
export function parseCloserTurn(raw: string): CloserTurn | null {
  let obj: unknown;
  try {
    obj = extractJsonObject(raw);
  } catch {
    return null;
  }
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return null;
  const p = closerTurnSchema.safeParse(obj);
  if (!p.success) return null;
  if (!p.data.reply || looksLikeLeak(p.data.reply)) return null;
  return p.data;
}
