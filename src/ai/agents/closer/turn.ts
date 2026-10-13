import { z } from "zod";
import { stripEmoji } from "@/lib/emoji";

// تنظيف موحّد: يزيل الإيموجي، يطوي المسافات الزائدة، ويسقط الأسطر الفارغة.
function clean(value: unknown, max = 1000): string {
  const s = typeof value === "string" ? value : "";
  return stripEmoji(s)
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\s+|\s+$/g, "")
    .slice(0, max);
}

const DEFAULT_BUTTON = "ابدأ استمارة متجرك";

export const closerTurnSchema = z.object({
  thinking: z
    .string()
    .nullish()
    .transform((s) => clean(s, 400)),

  // قد يأتي فارغاً من نموذج مضطرب: المستدعي يعامل الفارغ كفشل ويرد بالقواعد (لا رد عام ثابت).
  reply: z
    .string()
    .nullish()
    .transform((s) => clean(s, 700)),

  issueLink: z.boolean().nullish().transform((v) => v === true),

  buttonTitle: z
    .string()
    .nullish()
    .transform((s) => clean(s, 30) || DEFAULT_BUTTON),

  requestHuman: z
    .string()
    .nullish()
    .transform((s) => clean(s, 200) || null),

  // ذاكرة المحادثة: ملاحظات مضغوطة يعيد الوكيل كتابتها كل دور (نشاطه، منتجاته، ألمه، اعتراضاته، ما شُرح، أين وصلنا).
  memory: z.string().nullish().transform((s) => clean(s, 900)),

  // ما كتبه العميل بنفسه ويملأ الاستمارة مسبقاً (الفارغ فقط؛ intake/link.ts applyPrefill).
  storeName: z.string().nullish().transform((s) => clean(s, 60) || null),
  business: z.string().nullish().transform((s) => clean(s, 200) || null),
  social: z.string().nullish().transform((s) => clean(s, 200) || null),
  whatsapp: z.string().nullish().transform((s) => clean(s, 30) || null),
});

export type CloserTurn = z.infer<typeof closerTurnSchema>;