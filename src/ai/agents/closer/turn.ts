// turn.ts — دور الوكيل (خالص ومختبَر): {reply, memory, speaker, requestHuman, lead, action, brief}.
// التحليل **صارم**: لا رد صالح = يُرفض الناتج ويُجرَّب النموذج التالي. لا يُرسل أبداً نص خام فيه أقواس أو أسماء حقول.
// الأدوات (V4) أفعال يطلبها النموذج في `action` ويقرر الكود تنفيذها بعد التحقق من شروطها الرقمية والبيانية:
//  golden_link  = إصدار رابط صفحة الحجز وإرساله مع سطر العدّاد والخطوات
//  other_service = تصنيف الطلب «خدمة أخرى»: إشعار المالك وإيقاف الوكيل بانتظار رده
//  close_done   = إغلاق الوكيل بعد أن أكد العميل فهم الخطوات (بعد رابط الحجز)
//  ignore       = رسالة آلية أو غير مقصودة لا تستحق رداً
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

export type Speaker = "owner" | "moderator" | "unknown";

export const TURN_ACTIONS = ["none", "golden_link", "other_service", "close_done", "ignore"] as const;
export type TurnAction = (typeof TURN_ACTIONS)[number];

export const closerTurnSchema = z.object({
  reply: z.string().nullish().transform((s) => clean(s, 800)),
  memory: z.string().nullish().transform((s) => clean(s, 900)),
  requestHuman: z.string().nullish().transform((s) => clean(s, 200) || null),
  lead: z
    .object({
      storeName: optText(120),
      niche: optText(200),
      email: optText(160),
      whatsapp: optText(40),
      instagram: optText(120),
      styleNotes: optText(400),
    })
    .nullish()
    .transform((l) => l ?? {}),
  /** الفعل المطلوب. قيمة غير معروفة = none (لا يُرفض الدور بسببها). */
  action: z.unknown().transform((v): TurnAction => (typeof v === "string" && (TURN_ACTIONS as readonly string[]).includes(v) ? (v as TurnAction) : "none")),
  /** ملخص قصير لطلب «الخدمة الأخرى» يصل المالك (ماذا يريد، لمن، أهم المتطلبات، الموعد إن ذُكر). */
  brief: z.string().nullish().transform((s) => clean(s, 500)),
  /** تقدير النموذج لمن يكتب: صاحب القرار أو مشرف الصفحة. قيمة غير معروفة = unknown (لا يُرفض الدور بسببها). */
  speaker: z.unknown().transform((v): Speaker => (v === "owner" || v === "moderator" ? v : "unknown")),
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
  return /^\s*[{[]/.test(reply) || /"\s*(reply|memory|requestHuman|action|lead|speaker|brief)\s*"\s*:/.test(reply) || /```/.test(reply);
}

/** تحليل صارم لدور الوكيل: null إن لم يكن JSON صالحاً بحقل reply نصي غير فارغ وغير مسرّب (يُستثنى ignore فلا رد فيه). */
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
  if (p.data.action === "ignore") return p.data;
  if (!p.data.reply || looksLikeLeak(p.data.reply)) return null;
  return p.data;
}
