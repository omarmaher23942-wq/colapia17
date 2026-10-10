// platform-pricing.ts — أسعار Colapia من مصدر واحد في كل مكان (الهبوط، اللوحة، صفحة الدفع، التحقق من الإيصال، البوت).
// الباقة (قرار المالك 2026-10-10): إنشاء المتجر + أول سنة استضافة بسعر واحد، ثم تجديد سنوي معلن من اليوم الأول.
//  - PLATFORM_PRICE_EGP: سعر الباقة الآن (1,999 عرض إطلاق لفترة وعدد محدودين، والعدد لا يُعلن).
//  - PLATFORM_BASE_PRICE_EGP: سعرها المعتاد بعد العرض (7,999) ويُعرض مشطوباً.
//  - PLATFORM_RENEWAL_EGP: تجديد الاستضافة لكل سنة بعد الأولى (1,299).
// نسختا NEXT_PUBLIC القديمتان احتياط فقط. يُقرأ على الخادم فقط.
const num = (...vals: (string | undefined)[]) => {
  for (const v of vals) {
    const n = Number(v);
    if (v && Number.isFinite(n) && n > 0) return Math.round(n);
  }
  return null;
};

export const DEFAULT_PRICE_EGP = 1999;
export const DEFAULT_BASE_PRICE_EGP = 7999;
export const DEFAULT_RENEWAL_EGP = 1299;

export type PlatformPricing = { price: number; basePrice: number; renewal: number };
export type PaymentKind = "setup" | "renewal";

export function platformPricing(): PlatformPricing {
  const price = num(process.env.PLATFORM_PRICE_EGP, process.env.NEXT_PUBLIC_PLATFORM_PRICE) ?? DEFAULT_PRICE_EGP;
  const base = num(process.env.PLATFORM_BASE_PRICE_EGP, process.env.NEXT_PUBLIC_PLATFORM_BASE_PRICE) ?? DEFAULT_BASE_PRICE_EGP;
  const renewal = num(process.env.PLATFORM_RENEWAL_EGP) ?? DEFAULT_RENEWAL_EGP;
  // سعر «قبل» لا يكون أقل من السعر الفعلي (وإلا لا يُعرض خصم).
  return { price, basePrice: Math.max(price, base), renewal };
}

/** المبلغ المطلوب لنوع الدفعة. */
export function amountFor(kind: PaymentKind, p: PlatformPricing = platformPricing()): number {
  return kind === "renewal" ? p.renewal : p.price;
}
