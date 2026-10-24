// عقد V4: رابط صفحة حجز مقعد الدائرة الذهبية (يملكه الشريحة K1، ويستهلكه وكيل الرسائل K3).
export type GoldenPrefill = {
  storeName?: string;
  niche?: string;
  instagram?: string;
  whatsapp?: string;
  email?: string;
  styleNotes?: string;
};

/** يعيد رابط صفحة الحجز والدفع للمحادثة نفسها (نفس الرابط لنفس المحادثة). */
export async function issueGoldenLink(input: { conversationId: string; prefill?: GoldenPrefill }): Promise<string> {
  void input;
  const root = process.env.ROOT_DOMAIN || "colapia.com";
  return `https://${root}/golden`;
}
