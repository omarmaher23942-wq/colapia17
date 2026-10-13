// policy.ts — قواعد سلوك وكيل المبيعات على فيسبوك وإنستجرام، منطق خالص مختبَر (تنفيذها في runtime.ts).
// قرار المالك (2026-10-13): لا إفصاح استباقي في كل رد ولا في أول رد (كان يثقل الرد ويطرد الناس)؛ الوكيل لا يتكلم عن
// كونه بوتاً إلا إن سُئل صراحة «انت بوت ولا إنسان؟» فيقول «أنا بوت» بصدق. وطلب موظف بشري يحوّل المحادثة كما كان.
import { normalizeArabic } from "@/lib/arabic";

/** الرد الصادق على «انت بوت ولا إنسان؟» (لا يُقال إلا لمن سأل). */
export const ASK_BOT_REPLY = "أنا بوت. وعندنا فريق بشري كمان، اكتبوا «موظف» وهيكلمكم حد منهم.";

// الأنماط على نص مُطبَّع (normalizeArabic: ا لكل ألف، ه للتاء المربوطة، ي للألف المقصورة). كل كلمة بحدودها: «بوتيك»
// (متجر ملابس) ليست «بوت»، و«email» ليست «ai»، و«الدفع اوتوماتيك ولا يدوي» ليس سؤالاً عن المحادثة.
const AR = "\\u0600-\\u06FF";
const aStart = `(?<![${AR}])`;
const aEnd = `(?![${AR}])`;
const BOT = `(?:${aStart}(?:ال)?(?:بوت|روبوت|ربوت|بوتات)${aEnd}|(?<![a-z])(?:chat\\s*bot|bot|robot|ai)(?![a-z])|ذكاء\\s*(?:ال)?اصطناعي)`;
const HUMAN = `(?:${aStart}(?:انسان|بني\\s*ادم|شخص|ادمي|بشر|موظف)${aEnd}|حد\\s*حقيقي|شخص\\s*حقيقي)`;
// من نكلمه: «انت بوت» لا «عندكم بوت للمتجر» (الأخير سؤال عن خدمة).
const SELF = `${aStart}(?:انت|انتي|انتو|انتم|حضرتك|حضرتكم|ده|دا|دي|هو|هي)${aEnd}`;
const AUTO = "(?:اوتوماتيك|الي|تلقائي|مبرمج|مبرمجه)";
const BOT_QUESTION_RE = new RegExp(
  [
    `${SELF}\\s*(?:ده\\s*|دا\\s*)?${BOT}`,
    `${SELF}\\s*${HUMAN}`,
    `${BOT}\\s*(?:ولا|او)\\s*.{0,12}${HUMAN}`,
    `${HUMAN}\\s*(?:ولا|او)\\s*.{0,12}${BOT}`,
    `${aStart}(?:الرد|الشات|الكلام|الرساله|الرسايل)\\s*(?:ده|دا|دي)?\\s*${AUTO}${aEnd}`,
    `${SELF}\\s*(?:رد|ردود)\\s*${AUTO}${aEnd}`,
    // الإنجليزية: «are you a bot», «is this a bot», «bot or human».
    "\\b(?:are|r)\\s*(?:you|u)\\s*(?:a\\s*|an\\s*)?(?:real\\s*)?(?:bot|robot|human|person|ai|automated)\\b",
    "\\bis\\s*(?:this|it|that)\\s*(?:a\\s*|an\\s*)?(?:real\\s*)?(?:bot|robot|human|person|ai|automated|auto)\\b",
    "\\b(?:bot|robot|ai)\\s*or\\s*(?:a\\s*)?(?:human|real|person|bot)\\b",
    "\\b(?:human|real\\s*person|person)\\s*or\\s*(?:a\\s*)?(?:bot|robot|ai)\\b",
  ].join("|"),
  "i"
);

/** هل يسأل العميل إن كنا بوتاً أم إنساناً؟ (جوابه «أنا بوت» وليس تحويلاً لموظف). */
export function asksIfBot(text: string): boolean {
  const t = normalizeArabic(text).replace(/[؟?!.,،]/g, " ");
  return BOT_QUESTION_RE.test(t);
}

const HUMAN_RE =
  /(موظف|بشري|حد\s*(حقيقي|من\s*الفريق|يرد)|ممثل\s*(خدمة|مبيعات)|خدمه\s*العملاء|اكلم\s*(حد|حضرتك|مسوول|المسوول|مسؤول|المسؤول)|كلم(ني)?\s*(حد|مسوول|مسؤول)|عايز\s*(حد|انسان|بني\s*ادم)|اكلم\s*(انسان|بني\s*ادم)|human\s*(?:agent|please|plz|pls|help|support|being)|(?:talk|speak|chat)\s*(?:to|with)\s*(?:a\s*|an\s*)?(?:human|person|someone|agent|representative)|real\s*person|agent\b|representative)/i;

/** طلب صريح لتحويل المحادثة لإنسان (لا يشمل السؤال «انت بوت ولا إنسان؟»: ذاك يُجاب بصدق ولا يُحوَّل). */
export function wantsHuman(text: string): boolean {
  if (asksIfBot(text)) return false;
  return HUMAN_RE.test(normalizeArabic(text));
}

export const HANDOFF_REPLY =
  "تمام، حوّلنا المحادثة لفريق Colapia وهيرد عليكم موظف بشري. الرد بيكون في ساعات العمل، وممكن تكتبوا رسالتكم هنا وهتوصله.";

/** حد رسائل المرسل الواحد في الساعة (حماية فاتورة الذكاء الاصطناعي من الإغراق والحلقات الآلية). */
export const MAX_MESSAGES_PER_HOUR = 30;

export const RATE_NOTICE = "وصلتم للحد المؤقت من الرسائل خلال الساعة. اكتبوا لنا بعد قليل أو اكتبوا «موظف» ليتواصل معكم فريقنا.";

/** زر الاستمارة لا يُكرَّر خلال هذه المدة إلا إن طلبه العميل صراحة. */
export const LINK_REPEAT_MS = 20 * 60_000;
