import "server-only";
// link.ts — رابط صفحة حجز مقعد الدائرة الذهبية (عقد V4: يملكه K1 ويستهلكه وكيل الرسائل).
// نفس المحادثة = نفس الرابط دائماً (مشتق بـ HMAC من معرّف المحادثة)، والملء المسبق للحقول الفارغة فقط ولا يمر في الرابط.
import { env } from "@/lib/env";
import { ensureConversationDraft } from "./repo";
import { readFields } from "./schema";

export type GoldenPrefill = {
  storeName?: string;
  niche?: string;
  instagram?: string;
  whatsapp?: string;
  email?: string;
  styleNotes?: string;
};

const origin = () => {
  const root = (env.ROOT_DOMAIN || "").trim();
  return !root || root.startsWith("localhost") ? "http://localhost:3100" : `https://${root}`;
};

/** يعيد رابط صفحة الحجز والدفع للمحادثة نفسها (نفس الرابط لنفس المحادثة). */
export async function issueGoldenLink(input: { conversationId: string; prefill?: GoldenPrefill }): Promise<string> {
  const { token } = await ensureConversationDraft(input.conversationId, input.prefill ? readFields(input.prefill) : undefined);
  return `${origin()}/golden?c=${token}`;
}
