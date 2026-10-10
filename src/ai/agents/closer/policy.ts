// policy.ts — قواعد سلوك وكيل المبيعات على فيسبوك وإنستجرام، منطق خالص مختبَر (تنفيذها في runtime.ts).
// مصدر القواعد: سياسة Meta للمراسلة (إفصاح الرد الآلي، نافذة 24 ساعة، التحويل لبشري) ومبدأ الصدق في المنتج.

/** يُفصح الوكيل أنه آلي في بداية المحادثة، وبعد انقطاع أطول من 24 ساعة، وبعد عودته من تدخل بشري. */
export const DISCLOSURE_GAP_MS = 24 * 36e5;

export const DISCLOSURE =
  "أنا المساعد الآلي لـ Colapia (ذكاء اصطناعي)، ولست موظفاً بشرياً. لو حبيت تكلم موظف اكتب «موظف» في أي وقت.";

export function needsDisclosure(input: { lastBotMessageAt: Date | null; hasAnyBotMessage: boolean; resumedFromHuman?: boolean }, now = Date.now()): boolean {
  if (input.resumedFromHuman) return true;
  if (!input.hasAnyBotMessage || !input.lastBotMessageAt) return true;
  return now - input.lastBotMessageAt.getTime() > DISCLOSURE_GAP_MS;
}

/** يضيف الإفصاح في أول الرد (سطر مستقل) إن لزم. */
export function withDisclosure(reply: string, disclose: boolean): string {
  return disclose ? `${DISCLOSURE}\n\n${reply}` : reply;
}

const HUMAN_RE = /(موظف|بشري|بني\s*آدم|انسان|إنسان|حد\s*(حقيقي|من\s*الفريق|يرد)|ممثل\s*(خدمة|مبيعات)|خدمة\s*العملاء|اكلم\s*(حد|حضرتك|مسؤول|المسؤول)|كلم(ني)?\s*(حد|مسؤول)|human|agent|real\s*person)/i;

/** طلب صريح لتحويل المحادثة لإنسان. */
export function wantsHuman(text: string): boolean {
  return HUMAN_RE.test(text);
}

export const HANDOFF_REPLY =
  "تمام، حوّلت محادثتك لفريق Colapia وهيرد عليك موظف بشري. الرد بيكون في ساعات العمل، وتقدر تسيب رسالتك هنا وهتوصله.";

/** حد رسائل المرسل الواحد في الساعة (حماية فاتورة الذكاء الاصطناعي من الإغراق والحلقات الآلية). */
export const MAX_MESSAGES_PER_HOUR = 30;

export const RATE_NOTICE = "وصلت للحد المؤقت من الرسائل خلال الساعة. اكتب لنا بعد قليل أو اكتب «موظف» ليتواصل معك فريقنا.";
