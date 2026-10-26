// offers.ts — الأسطر التي يتغذى بها برومبت الوكيل من الأسعار الحقيقية (خالص ومختبَر). لا رقم يُكتب في البرومبت يدوياً.
// نموذج V4: سعر مشروع واحد يُدفع قبل التسليم، والدائرة الذهبية بسعر مخفّض لأول المقاعد، وتعديل مجاني ثم برسوم.
import { fmtEgp, type GoldenOffer, type PricingModel } from "@/lib/platform-pricing";

/** سعر المشروع: «مشروع المتجر 4,999 ج كاملاً يُدفع قبل التسليم». */
export function plansLine(model: Pick<PricingModel, "regularPrice">): string {
  return `مشروع المتجر ${fmtEgp(model.regularPrice)} ج كاملاً يُدفع قبل التسليم`;
}

/** التعديل بعد التسليم (يُذكر فقط إن سُئل). */
export function renewalLine(model: Pick<PricingModel, "edit">): string {
  return `بعد التسليم تعديل مجاني واحد خلال ${model.edit.freeDays} أيام، وما زاد ${fmtEgp(model.edit.fee)} ج للتعديل`;
}

/**
 * سطر الدائرة الذهبية للبرومبت. فارغ تماماً إن كان العرض متوقفاً أو اكتملت مقاعده، فلا يذكره الوكيل.
 * regularPrice: السعر العادي للمقارنة الصادقة («بدلاً من …»).
 */
export function goldenLine(g: GoldenOffer, seatsLeft: number, regularPrice?: number): string {
  if (!g.enabled || seatsLeft <= 0) return "";
  const instead = regularPrice && regularPrice > g.price ? ` بدلاً من ${fmtEgp(regularPrice)} ج` : "";
  return [
    `عرض خاص «الدائرة الذهبية» للمتاجر متاح الآن، متبقٍ ${seatsLeft} ${seatsLeft === 1 ? "مقعد" : seatsLeft === 2 ? "مقعدان" : "مقاعد"} فقط:`,
    `سعر المشروع ${fmtEgp(g.price)} ج${instead}، مقابل تعاون (Collab أو شهادة) بموافقة العميل على النسخة النهائية.`,
    "اذكره بهدوء كعرض خاص لا كضغط، ولا تخترع مدة أو شروطاً غير ما هنا.",
  ].join(" ");
}

export type Mentions = { demo: boolean; golden: boolean };

/** هل ذكر الوكيل في ردوده السابقة الديمو أو الدائرة الذهبية (بحثاً في نصوصه هو لا في كلام العميل). */
export function detectMentions(assistantTexts: string[], opts: { demoHost: string; goldenPrice: number }): Mentions {
  const all = assistantTexts.join("\n").toLowerCase();
  return {
    demo: all.includes(opts.demoHost.toLowerCase()),
    golden: all.includes("الدائرة الذهبية") || all.includes(fmtEgp(opts.goldenPrice)) || all.includes(String(opts.goldenPrice)),
  };
}
