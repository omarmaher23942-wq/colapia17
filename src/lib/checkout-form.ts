// checkout-form.ts — منطق صفحة الدفع الخالص: التحقق من الحقول برسائل لكل حقل، موعد التوصيل، ومبلغ التحويل بالقروش.
import { normalizeEgyptianPhone } from "@/lib/phone";

export type CheckoutFields = {
  name: string;
  phone: string;
  altPhone: string;
  governorate: string;
  address: string;
  paymentMethod: "cod" | "vodafone_cash" | "instapay";
  transferScreenshotUrl: string;
};

export type FieldErrors = Partial<Record<"name" | "phone" | "altPhone" | "governorate" | "address" | "transferScreenshotUrl", string>>;

/** ترتيب الحقول كما تظهر في الصفحة: أول خطأ منها هو الذي يُمرَّر إليه. */
export const FIELD_ORDER = ["name", "phone", "altPhone", "governorate", "address", "transferScreenshotUrl"] as const;

export function validateCheckout(f: CheckoutFields, opts: { requireProof: boolean }): FieldErrors {
  const e: FieldErrors = {};
  if (f.name.trim().length < 2) e.name = "اكتبوا الاسم بالكامل";
  if (!normalizeEgyptianPhone(f.phone)) e.phone = "رقم موبايل مصري غير صحيح (مثال: 01012345678)";
  if (f.altPhone.trim() && !normalizeEgyptianPhone(f.altPhone)) e.altPhone = "رقم الموبايل البديل غير صحيح";
  if (!f.governorate) e.governorate = "اختاروا المحافظة";
  if (f.address.trim().length < 5) e.address = "اكتبوا اسم الشارع ورقم العمارة والشقة";
  if (f.paymentMethod !== "cod" && opts.requireProof && !f.transferScreenshotUrl) e.transferScreenshotUrl = "أرفقوا صورة إيصال التحويل لإتمام الطلب";
  return e;
}

export const firstErrorField = (e: FieldErrors) => FIELD_ORDER.find((k) => e[k]);

/** يضيف أياماً مع تخطي الجمعة (لا توصيل عادة). */
export function addDeliveryDays(from: Date, days: number): Date {
  const d = new Date(from.getTime());
  let left = Math.max(0, Math.floor(days));
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (d.getUTCDay() !== 5) left--;
  }
  if (d.getUTCDay() === 5) d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

const fmtDay = (d: Date) => new Intl.DateTimeFormat("ar-EG-u-nu-latn", { weekday: "long", day: "numeric", month: "long", timeZone: "Africa/Cairo" }).format(d);

/** «من الأحد 20 أكتوبر إلى الأربعاء 23 أكتوبر» (أو يوم واحد إن تساوى الحدان). */
export function deliveryRange(now: Date, etaMin: number, etaMax: number): string {
  const lo = addDeliveryDays(now, Math.max(1, etaMin));
  const hi = addDeliveryDays(now, Math.max(etaMin, etaMax, 1));
  return lo.getTime() === hi.getTime() ? fmtDay(lo) : `من ${fmtDay(lo)} إلى ${fmtDay(hi)}`;
}

/** المبلغ كما يُكتب في تطبيق التحويل: جنيهات وقروش بنقطة، بلا فواصل آلاف (1250.50). */
export function exactAmount(piasters: number): string {
  const v = Math.max(0, Math.round(piasters));
  const egp = Math.floor(v / 100);
  const p = v % 100;
  return p === 0 ? String(egp) : `${egp}.${String(p).padStart(2, "0")}`;
}

/** مناطق شائعة لقائمة الاقتراح (اختيارية؛ الكتابة الحرة مقبولة). */
export const AREAS: Record<string, string[]> = {
  cairo: ["مدينة نصر", "مصر الجديدة", "المعادي", "التجمع الخامس", "الرحاب", "مدينتي", "شبرا", "حلوان", "المقطم", "عين شمس", "وسط البلد", "الزمالك", "السلام", "المطرية", "الشروق", "العبور"],
  giza: ["الدقي", "المهندسين", "العجوزة", "فيصل", "الهرم", "6 أكتوبر", "الشيخ زايد", "حدائق الأهرام", "العمرانية", "إمبابة", "بولاق الدكرور"],
  qalyubia: ["شبرا الخيمة", "بنها", "قليوب", "الخانكة", "العبور", "الخصوص", "القناطر الخيرية"],
  alexandria: ["سموحة", "ميامي", "المنتزه", "سيدي بشر", "العجمي", "سان ستيفانو", "كليوباترا", "العصافرة", "محرم بك", "برج العرب"],
  dakahlia: ["المنصورة", "ميت غمر", "طلخا", "السنبلاوين", "أجا"],
  sharqia: ["الزقازيق", "العاشر من رمضان", "بلبيس", "أبو حماد", "منيا القمح"],
  gharbia: ["طنطا", "المحلة الكبرى", "كفر الزيات", "زفتى"],
  monufia: ["شبين الكوم", "السادات", "منوف", "أشمون"],
  beheira: ["دمنهور", "كفر الدوار", "إدكو", "رشيد"],
  port_said: ["بورفؤاد", "حي الشرق", "حي العرب"],
  ismailia: ["الإسماعيلية", "القنطرة", "التل الكبير"],
  suez: ["السويس", "عتاقة", "الأربعين"],
  faiyum: ["الفيوم", "سنورس", "إطسا"],
  minya: ["المنيا", "ملوي", "مغاغة", "سمالوط"],
  asyut: ["أسيوط", "ديروط", "منفلوط"],
  luxor: ["الأقصر", "إسنا", "أرمنت"],
  aswan: ["أسوان", "كوم أمبو", "إدفو"],
};
