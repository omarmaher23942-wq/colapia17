// platform-pricing.ts — سعر Colapia من مصدر واحد في كل مكان (الهبوط، اللوحة، صفحة الدفع، التحقق من الإيصال).
// المتغير: PLATFORM_PRICE_EGP (والسعر قبل الخصم PLATFORM_BASE_PRICE_EGP)، ونسختا NEXT_PUBLIC القديمتان احتياط فقط.
// يُقرأ على الخادم فقط.
const num = (...vals: (string | undefined)[]) => {
  for (const v of vals) {
    const n = Number(v);
    if (v && Number.isFinite(n) && n > 0) return Math.round(n);
  }
  return null;
};

export type PlatformPricing = { price: number; basePrice: number };

export function platformPricing(): PlatformPricing {
  const price = num(process.env.PLATFORM_PRICE_EGP, process.env.NEXT_PUBLIC_PLATFORM_PRICE) ?? 899;
  const base = num(process.env.PLATFORM_BASE_PRICE_EGP, process.env.NEXT_PUBLIC_PLATFORM_BASE_PRICE) ?? price;
  // سعر «قبل» لا يكون أقل من السعر الفعلي (وإلا لا يُعرض خصم).
  return { price, basePrice: Math.max(price, base) };
}
