// landing-pricing.ts — تحويل نموذج الأسعار v4 إلى بطاقات للهبوط (خالص ومختبَر).
// الباقات الثلاث بسعرها الشهري وأهم حدودها الحقيقية، ورسوم التجهيز مرة واحدة. لا ذكر للدائرة الذهبية (بدعوة فقط).
import { limitHighlights, monthsLabel, startingPrice, type PlanId, type PricingModel } from "@/lib/platform-pricing";

export type PlanCard = {
  id: PlanId;
  label: string;
  /** السعر الشهري بالجنيه. */
  price: number;
  featured: boolean;
  priceText: string;
  highlights: string[];
};

/** أرقام بالصيغة العربية مع فواصل الآلاف؛ تُستخدم في كل نصوص الهبوط. */
export function fmtPrice(n: number): string {
  return new Intl.NumberFormat("ar-EG").format(Math.round(n));
}

export function planCards(model: PricingModel): PlanCard[] {
  return model.plans.map((p) => ({
    id: p.id,
    label: p.name,
    price: p.monthly,
    featured: p.id === model.featured,
    priceText: fmtPrice(p.monthly),
    highlights: limitHighlights(p.limits),
  }));
}

/** سطر رسوم التجهيز والمدد: «تجهيز المتجر ٢٬٩٩٩ ج.م مرة واحدة، والدفع لشهر أو ٣ أشهر أو …». */
export function buildFeeText(model: PricingModel): string {
  return `تجهيز المتجر ${fmtPrice(model.build.price)} ج.م مرة واحدة مع أول دفعة، ثم الاستضافة الشهرية بالباقة المختارة لمدة ${model.months.map(monthsLabel).join(" أو ")}.`;
}

/** سطر قصير للوصف: «الاستضافة من ١٩٩ ج.م شهرياً». */
export function startingText(model: PricingModel): string {
  return `الاستضافة من ${fmtPrice(startingPrice(model))} ج.م شهرياً`;
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
  return /^https:\/\//.test(v) ? v : "https://ig.me/m/colapia";
}
