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

// ─── سلّم الأسعار (المرحلة 5، قرار المالك): يتحكم فيه المالك من /admin/pricing ───────────────────────────────
// المتجر رقم n (بعدد الباقات المدفوعة فعلاً) يأخذ سعر المرحلة التي يقع فيها. السعر يُثبَّت للمتجر عند تسليمه
// (stores.price_locked_egp)، فمن وُعد بسعر يدفعه حتى لو امتلأت مرحلته قبل أن يدفع.

export type PriceTier = { upTo: number | null; price: number };
/**
 * «الدائرة الذهبية» (قرار المالك 2026-10-12): كود عام يُدخل في صفحة الدفع، بسعر رمزي مرة واحدة واستضافة مدى الحياة،
 * ويتوقف آلياً بعد `seats` دفعات مؤكدة به. السعر لا يُعرض على الهبوط.
 */
export type GoldenOffer = { code: string; price: number; seats: number };
export type PriceLadder = { tiers: PriceTier[]; basePrice: number; renewal: number; golden: GoldenOffer };

export const DEFAULT_GOLDEN: GoldenOffer = { code: "GOLDEN599", price: 599, seats: 5 };

// الافتراضي (قرار المالك 2026-10-12): سعر واحد 2,499 للبناء والسنة الأولى، وتجديد 1,299؛ بلا سعر «قبل» مشطوب.
export const DEFAULT_LADDER: PriceLadder = {
  tiers: [{ upTo: null, price: 2499 }],
  basePrice: 2499,
  renewal: 1299,
  golden: DEFAULT_GOLDEN,
};

/** يطبّع الكود كما يكتبه العميل (مسافات وحروف صغيرة وأرقام هندية). */
export function normalizeCoupon(raw: unknown): string {
  return String(raw ?? "")
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/\s+/g, "")
    .toUpperCase()
    .slice(0, 32);
}

function goldenFrom(raw: unknown): GoldenOffer {
  const g = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const code = normalizeCoupon(g.code);
  return {
    code: /^[A-Z0-9_-]{4,32}$/.test(code) ? code : DEFAULT_GOLDEN.code,
    price: egp(g.price) ?? DEFAULT_GOLDEN.price,
    seats: egp(g.seats, 0, 1000) ?? DEFAULT_GOLDEN.seats,
  };
}

const egp = (v: unknown, min = 1, max = 1_000_000) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? Math.round(n) : null;
};

/** يقرأ إعداد السلّم بأمان: مراحل تصاعدية، آخرها بلا حد، والسعر «قبل» لا يقل عن أعلى مرحلة. */
export function ladderFrom(config: unknown): PriceLadder {
  const c = (config && typeof config === "object" ? config : {}) as Record<string, unknown>;
  const raw = Array.isArray(c.tiers) ? c.tiers : [];
  const tiers: PriceTier[] = [];
  let last = 0;
  for (const t of raw) {
    const r = (t ?? {}) as Record<string, unknown>;
    const price = egp(r.price);
    const upTo = r.upTo === null || r.upTo === undefined || r.upTo === "" ? null : egp(r.upTo, 1, 100_000);
    if (!price) continue;
    if (upTo !== null && upTo <= last) continue;
    tiers.push({ upTo, price });
    if (upTo === null) break;
    last = upTo;
  }
  const golden = goldenFrom(c.golden);
  if (!tiers.length) return { ...DEFAULT_LADDER, golden };
  if (tiers[tiers.length - 1]!.upTo !== null) tiers.push({ upTo: null, price: tiers[tiers.length - 1]!.price });
  const top = Math.max(...tiers.map((t) => t.price));
  return { tiers, basePrice: Math.max(egp(c.basePrice) ?? top, top), renewal: egp(c.renewal) ?? DEFAULT_LADDER.renewal, golden };
}

export type LadderPosition = { price: number; tier: number; remaining: number | null; nextPrice: number | null };

/** سعر المتجر التالي بعد `paid` باقة مدفوعة، وكم بقي بهذا السعر (null = بلا حد)، وسعر المرحلة التالية. */
export function priceAt(paid: number, ladder: PriceLadder): LadderPosition {
  const n = Math.max(0, Math.floor(paid)) + 1;
  for (let i = 0; i < ladder.tiers.length; i++) {
    const t = ladder.tiers[i]!;
    if (t.upTo === null || n <= t.upTo) {
      return { price: t.price, tier: i, remaining: t.upTo === null ? null : t.upTo - n + 1, nextPrice: ladder.tiers[i + 1]?.price ?? null };
    }
  }
  const t = ladder.tiers[ladder.tiers.length - 1]!;
  return { price: t.price, tier: ladder.tiers.length - 1, remaining: null, nextPrice: null };
}
