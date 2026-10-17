// landing-pricing.ts — تحويل نموذج الأسعار v3 إلى بطاقات للهبوط (خالص ومختبَر).
// الباقات الثلاث بسعرها الأول وسعر التجديد والتكلفة الشهرية، بلا ذكر للدائرة الذهبية ما لم يجعلها المالك علنية.
import { monthsLabel, perMonth, type PricingModel } from "@/lib/platform-pricing";

export type PlanCard = {
  months: number;
  label: string;
  price: number;
  renewal: number;
  perMonth: number;
  featured: boolean;
  priceText: string;
  renewalText: string;
  perMonthText: string;
};

/** أرقام بالصيغة العربية مع فواصل الآلاف؛ تُستخدم في كل نصوص الهبوط. */
export function fmtPrice(n: number): string {
  return new Intl.NumberFormat("ar-EG").format(Math.round(n));
}

export function planCards(model: PricingModel): PlanCard[] {
  return [...model.plans]
    .sort((a, b) => a.months - b.months)
    .map((p) => {
      const pm = perMonth(p.price, p.months);
      return {
        months: p.months,
        label: monthsLabel(p.months),
        price: p.price,
        renewal: p.renewal,
        perMonth: pm,
        featured: p.months === model.featured,
        priceText: fmtPrice(p.price),
        renewalText: fmtPrice(p.renewal),
        perMonthText: fmtPrice(pm),
      };
    });
}

/** سطر قصير للوصف: «تبدأ من ١٬٩٩٩ ج.م». */
export function startingText(model: PricingModel): string {
  const min = Math.min(...model.plans.map((p) => p.price));
  return `تبدأ من ${fmtPrice(min)} ج.م`;
}

/** «طلب تعديل واحد» / «طلبا تعديل» / «٣ طلبات تعديل» / «١١ طلب تعديل». */
export function changesLabel(n: number): string {
  if (n === 1) return "طلب تعديل واحد";
  if (n === 2) return "طلبا تعديل";
  return `${fmtPrice(n)} ${n <= 10 ? "طلبات" : "طلب"} تعديل`;
}

/** رابط بدء المحادثة على إنستجرام (متغير بيئة مع قيمة احتياطية آمنة https فقط). */
export function instagramUrl(env: string | undefined): string {
  const v = (env ?? "").trim();
  return /^https:\/\//.test(v) ? v : "https://ig.me/m/colapia.eg";
}
