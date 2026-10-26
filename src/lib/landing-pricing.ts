// landing-pricing.ts — تحويل نموذج الأسعار (V4) إلى نصوص وبطاقات للهبوط (خالص ومختبَر).
import { goldenAvailability, type PricingModel } from "@/lib/platform-pricing";

export type PlanCard = {
  id: string;
  label: string;
  /** السعر بالجنيه. */
  price: number;
  featured: boolean;
  priceText: string;
  highlights: string[];
};

/** أرقام بالصيغة العربية مع فواصل الآلاف؛ تُستخدم في كل نصوص الهبوط. */
export function fmtPrice(n: number): string {
  return new Intl.NumberFormat("ar-EG").format(Math.round(n));
}

/** V4: سعر واحد لمشروع المتجر (لا باقات). */
export function planCards(model: PricingModel): PlanCard[] {
  return [
    {
      id: "project",
      label: "مشروع متجر",
      price: model.regularPrice,
      featured: true,
      priceText: fmtPrice(model.regularPrice),
      highlights: ["تصميم وتجهيز متجركم بالكامل", "تسليم الكود والمشروع ملكاً لكم", "جلسة تسليم مباشرة معكم"],
    },
  ];
}

export type LandingOffer = {
  buildPrice: number;
  buildText: string;
  /** عرض الدائرة الذهبية: null إن كان متوقفاً أو اكتملت مقاعده (لا نعرض ما لا يمكن حجزه). */
  golden: null | { priceText: string; seatsLeft: number; seats: number; firstMonthFree: boolean; firstMonthText: string };
};

/** بطاقة السعر وعرض المقاعد الذهبية من الأسعار الحالية والحجوزات المؤكدة فعلاً. */
export function landingOffer(model: PricingModel, confirmedGolden: number): LandingOffer {
  const g = goldenAvailability(model.golden, confirmedGolden);
  return {
    buildPrice: model.regularPrice,
    buildText: fmtPrice(model.regularPrice),
    golden: g.available ? { priceText: fmtPrice(model.golden.price), seatsLeft: g.seatsLeft, seats: model.golden.seats, firstMonthFree: false, firstMonthText: "" } : null,
  };
}

/** سطر السعر: «مشروع المتجر ٤٬٩٩٩ ج.م يُدفع قبل التسليم، بلا اشتراك شهري ولا عمولة». */
export function buildFeeText(model: PricingModel): string {
  return `مشروع المتجر ${fmtPrice(model.regularPrice)} ج.م يُدفع قبل التسليم، بلا اشتراك شهري ولا عمولة على مبيعاتكم.`;
}

/** سطر قصير للوصف. */
export function startingText(model: PricingModel): string {
  return `مشروع متجر بـ ${fmtPrice(model.regularPrice)} ج.م`;
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
  return /^https:\/\//.test(v) ? v : "https://ig.me/colapia";
}
