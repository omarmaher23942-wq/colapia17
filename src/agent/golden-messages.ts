// golden-messages.ts — النصوص الثابتة التي يرسلها الكود حرفياً في مسار الدائرة الذهبية (خالصة ومختبَرة). النموذج يكتب مقدمة قصيرة
// ثم يلحق الكود الرابط وسطر العدّاد والخطوات بالكلمات المتفق عليها، فلا يختلف الوعد بين محادثة وأخرى ولا يخترعه النموذج.

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

/** «مقعد واحد»، «مقعدان»، «5 مقاعد»، «12 مقعداً». */
export function seatsPhrase(n: number): string {
  const k = Math.max(0, Math.floor(n));
  if (k === 1) return "مقعد واحد";
  if (k === 2) return "مقعدان";
  if (k <= 10) return `${k} مقاعد`;
  return `${k} مقعداً`;
}

/** سطر العدّاد الحقيقي: «باقي 9 مقاعد من 10 في الدائرة الذهبية.» */
export function counterLine(seatsLeft: number, seatsTotal: number): string {
  const left = Math.max(0, Math.floor(seatsLeft));
  const total = Math.max(left, Math.floor(seatsTotal));
  return `باقي ${seatsPhrase(left)} من ${total} في الدائرة الذهبية.`;
}

export type GoldenLinkInput = {
  link: string;
  /** الدائرة الذهبية متاحة (مقاعد باقية): تظهر بعدّادها وسعرها. غير متاحة: السعر العادي بلا عدّاد ولا صياغة ذهبية. */
  golden: boolean;
  seatsLeft: number;
  seatsTotal: number;
  /** سعر الدائرة الذهبية والسعر العادي (اختياريان: يسقط ذكر المبلغ إن غابا). */
  price?: number | null;
  regular?: number | null;
};

const positive = (n: number | null | undefined): n is number => typeof n === "number" && Number.isFinite(n) && n > 0;

/** كتلة الرابط التي تلحق بمقدمة النموذج: الرابط، العدّاد (للذهبية فقط)، الخطوات، ووعد التواصل بعد تأكيد الإدارة. */
export function goldenLinkBlock(i: GoldenLinkInput): string {
  const due = i.golden ? i.price : i.regular;
  const amount = positive(due) ? `مبلغ ${fmt(due)} ج${i.golden && positive(i.regular) && i.regular > due ? ` (بدلاً من ${fmt(i.regular)} ج)` : ""}` : "المبلغ الموضح في الصفحة";
  return [
    i.golden ? `رابط حجز مقعدكم: ${i.link}` : `رابط الحجز: ${i.link}`,
    i.golden ? counterLine(i.seatsLeft, i.seatsTotal) : "",
    `ادفعوا ${amount} بالطريقة الموضحة في الصفحة، ثم أرسلوا طلبكم عبر الرابط نفسه. وبعد أن تؤكد الإدارة الدفع سيتم التواصل معكم.`,
  ]
    .filter(Boolean)
    .join("\n");
}

/** مقدمة النموذج ثم كتلة الرابط، في رسالة واحدة. */
export function goldenLinkMessage(intro: string, input: GoldenLinkInput): string {
  const head = intro.trim();
  const block = goldenLinkBlock(input);
  return head ? `${head}\n\n${block}` : block;
}

/** سطر الإغلاق الثابت بعد أن يؤكد العميل فهمه للخطوات. */
export const GOLDEN_DONE_LINE = "بعد تأكيد الإدارة للدفع يبدأ الفريق تجهيز متجركم خلال 48 ساعة، وسنتواصل معكم مباشرة.";

/** رسالة الإغلاق: شكر النموذج القصير ثم السطر الثابت. */
export function goldenDoneMessage(thanks: string): string {
  const head = thanks.trim();
  return head ? `${head}\n\n${GOLDEN_DONE_LINE}` : GOLDEN_DONE_LINE;
}
