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

const DEFAULT_REPLY =
  "أهلاً بيك في كولابيا. ابعتلي اسم نشاطك أو منتجك، وهجهّزلك عرض متجر إلكتروني كامل بمنتجاتك وتجربة مجانية.";

const DEFAULT_BUTTON = "ابدأ استمارة متجرك الآن";

export const closerTurnSchema = z.object({
  thinking: z
    .string()
    .nullish()
    .transform((s) => clean(s, 400)),

  reply: z
    .string()
    .nullish()
    .transform((s) => clean(s, 1000) || DEFAULT_REPLY),

  issueLink: z.boolean().default(false),

  buttonTitle: z
    .string()
    .nullish()
    .transform((s) => clean(s, 30) || DEFAULT_BUTTON),

  requestHuman: z
    .string()
    .nullish()
    .transform((s) => clean(s, 200) || null),
});

export type CloserTurn = z.infer<typeof closerTurnSchema>;