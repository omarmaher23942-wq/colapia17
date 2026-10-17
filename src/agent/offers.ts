// offers.ts — الأسطر التي يتغذى بها برومبت الوكيل من الأسعار الحقيقية (خالص ومختبَر). لا رقم يُكتب في البرومبت يدوياً.
import { monthsLabel, perMonth, type GoldenOffer, type PricingModel } from "@/lib/platform-pricing";

const fmt = (n: number) => n.toLocaleString("en-US");

/** الباقات بأسعارها الحالية، مثال: «3 أشهر 1,999 ج، 6 أشهر 2,499 ج، سنة 3,499 ج». */
export function plansLine(model: Pick<PricingModel, "plans">): string {
  return [...model.plans]
    .sort((a, b) => a.months - b.months)
    .map((p) => `${monthsLabel(p.months)} ${fmt(p.price)} ج`)
    .join("، ");
}

/** تجديد كل باقة، مثال: «التجديد: 3 أشهر 999 ج، …». */
export function renewalLine(model: Pick<PricingModel, "plans">): string {
  return `التجديد: ${[...model.plans]
    .sort((a, b) => a.months - b.months)
    .map((p) => `${monthsLabel(p.months)} ${fmt(p.renewal)} ج`)
    .join("، ")}`;
}

/** السعر الشهري التقريبي لأطول باقة (للمقارنة الصادقة). */
export function monthlyHint(model: Pick<PricingModel, "plans">): string {
  const longest = [...model.plans].sort((a, b) => b.months - a.months)[0];
  return longest ? `تقريباً ${fmt(perMonth(longest.price, longest.months))} ج في الشهر للباقة الأطول` : "";
}

/**
 * سطر الدائرة الذهبية للبرومبت. فارغ تماماً إن كان العرض متوقفاً أو اكتملت مقاعده، فلا يذكره الوكيل.
 * القيمة المعتادة للمتجر (5–10 آلاف) معلومة تسويقية ثابتة يقرها المالك، تُذكر لتوضيح أن السعر ليس قيمته.
 */
export function goldenLine(g: GoldenOffer, seatsLeft: number): string {
  if (!g.enabled || seatsLeft <= 0) return "";
  return [
    `عرض خاص «الدائرة الذهبية» متاح الآن، متبقٍ ${seatsLeft} ${seatsLeft === 1 ? "مقعد" : seatsLeft === 2 ? "مقعدان" : "مقاعد"} فقط:`,
    `${fmt(g.price)} جنيه لمدة ${monthsLabel(g.months)} تغطي الاستضافة والتشغيل فقط، وبناء المتجر مجاناً، مقابل منشور Collab على إنستجرام (ولو لم يرغب في البوست يكفي رأيه في رسالة نشاركها)، والمونتاج علينا مجاناً.`,
    `اذكره بهدوء كعرض خاص لا كضغط، ووضّح أن ${fmt(g.price)} ليست قيمة المتجر نفسه، فقيمته المعتادة بين 5 و10 آلاف جنيه. بعد الأشهر ${g.months === 3 ? "الثلاثة" : monthsLabel(g.months)} يجدد بأي باقة عادية.`,
  ].join(" ");
}

export type Mentions = { demo: boolean; golden: boolean };

/** هل ذكر الوكيل في ردوده السابقة الديمو أو الدائرة الذهبية (بحثاً في نصوصه هو لا في كلام العميل). */
export function detectMentions(assistantTexts: string[], opts: { demoHost: string; goldenPrice: number }): Mentions {
  const all = assistantTexts.join("\n").toLowerCase();
  return {
    demo: all.includes(opts.demoHost.toLowerCase()),
    golden: all.includes("الدائرة الذهبية") || all.includes(fmt(opts.goldenPrice)) || all.includes(String(opts.goldenPrice)),
  };
}
