// offers.ts — الأسطر التي يتغذى بها برومبت الوكيل من الأسعار الحقيقية (خالص ومختبَر). لا رقم يُكتب في البرومبت يدوياً.
// نموذج v4 (V3-PLAN 1): رسوم تجهيز مرة واحدة + اشتراك شهري بثلاث باقات، والحقائق الكاملة في agentPricingFacts.
import { fmtEgp, monthsLabel, startingPrice, type GoldenOffer, type PricingModel } from "@/lib/platform-pricing";

/** التجهيز والباقات بأسعارها الحالية: «التجهيز 2,999 ج مرة واحدة، والاستضافة: الأساسية 199 ج شهرياً، …». */
export function plansLine(model: Pick<PricingModel, "plans" | "build">): string {
  return `التجهيز ${fmtEgp(model.build.price)} ج مرة واحدة، والاستضافة: ${model.plans.map((p) => `${p.name} ${fmtEgp(p.monthly)} ج شهرياً`).join("، ")}`;
}

/** التجديد = الباقة الشهرية فقط، للمدد المتاحة. */
export function renewalLine(model: Pick<PricingModel, "months">): string {
  return `التجديد: الباقة الشهرية فقط بلا رسوم تجهيز، لمدة ${model.months.map(monthsLabel).join(" أو ")}`;
}

/** أرخص اشتراك شهري (للمقارنة الصادقة). */
export function monthlyHint(model: Pick<PricingModel, "plans">): string {
  return model.plans.length ? `الاستضافة تبدأ من ${fmtEgp(startingPrice(model as PricingModel))} ج في الشهر` : "";
}

/**
 * سطر الدائرة الذهبية للبرومبت. فارغ تماماً إن كان العرض متوقفاً أو اكتملت مقاعده، فلا يذكره الوكيل.
 * regularBuild: رسوم التجهيز العادية للمقارنة الصادقة («بدلاً من …»).
 */
export function goldenLine(g: GoldenOffer, seatsLeft: number, regularBuild?: number): string {
  if (!g.enabled || seatsLeft <= 0) return "";
  const instead = regularBuild && regularBuild > g.buildPrice ? ` بدلاً من ${fmtEgp(regularBuild)} ج` : "";
  return [
    `عرض خاص «الدائرة الذهبية» متاح الآن، متبقٍ ${seatsLeft} ${seatsLeft === 1 ? "مقعد" : seatsLeft === 2 ? "مقعدان" : "مقاعد"} فقط:`,
    `تجهيز المتجر بـ ${fmtEgp(g.buildPrice)} ج${instead}، والاستضافة الشهرية كما هي بالباقة التي يختارها.`,
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
