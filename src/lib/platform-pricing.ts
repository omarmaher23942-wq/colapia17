// platform-pricing.ts — نموذج أسعار Colapia v3 (قرار المالك 2026-10-17، docs/V2-PLAN.md 3.4). منطق خالص مختبَر.
// ثلاث باقات بالمدة (3 و6 و12 شهراً)، لكل منها «السعر أول مرة» (البناء + المدة) و«سعر التجديد» للمدة نفسها،
// وباقة مميَّزة تُبرز في صفحة الدفع، و«الدائرة الذهبية»: كود بسعر رمزي لعدد محدود من المتاجر لمدة قصيرة
// (تكلفة الاستضافة فقط، والبناء مجاني) مقابل بوست Collab على إنستجرام أو رأي نشاركه.
// الإعداد في feature_flags («pricing») ويُعدَّل من /admin/pricing فقط. يقرأ الشكل القديم (السلّم) بأمان.

export type PaymentKind = "setup" | "renewal";
export type PaymentPlan = "standard" | "golden";

/** المدد المتاحة بالأشهر (ثابتة؛ المالك يحدد أسعارها). */
export const PLAN_MONTHS = [3, 6, 12] as const;
export type PlanMonths = (typeof PLAN_MONTHS)[number];

export type PlanOption = { months: PlanMonths; price: number; renewal: number };
export type GoldenOffer = { enabled: boolean; code: string; price: number; months: number; seats: number };
export type PricingModel = { v: 3; plans: PlanOption[]; featured: PlanMonths; golden: GoldenOffer };

export const DEFAULT_PLANS: PlanOption[] = [
  { months: 3, price: 1999, renewal: 999 },
  { months: 6, price: 2499, renewal: 1699 },
  { months: 12, price: 3499, renewal: 2499 },
];
export const DEFAULT_GOLDEN: GoldenOffer = { enabled: true, code: "GOLDEN499", price: 499, months: 3, seats: 5 };
export const DEFAULT_PRICING: PricingModel = { v: 3, plans: DEFAULT_PLANS, featured: 12, golden: DEFAULT_GOLDEN };

export const MAX_PRICE_EGP = 1_000_000;
export const COUPON_RE = /^[A-Z0-9_-]{4,32}$/;

const obj = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const int = (v: unknown, min: number, max: number) => {
  if (v === null || v === undefined || v === "" || typeof v === "boolean") return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? Math.round(n) : null;
};

export const isPlanMonths = (v: unknown): v is PlanMonths => PLAN_MONTHS.includes(Number(v) as PlanMonths);

/** يطبّع الكود كما يكتبه العميل (مسافات وحروف صغيرة وأرقام هندية). */
export function normalizeCoupon(raw: unknown): string {
  return String(raw ?? "")
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/\s+/g, "")
    .toUpperCase()
    .slice(0, 32);
}

function goldenFrom(raw: unknown, legacy: boolean): GoldenOffer {
  const g = obj(raw);
  // الشكل القديم كان «مدى الحياة» بكود وسعر مختلفين: لا يُنقل منه إلا عدد المقاعد.
  if (legacy) return { ...DEFAULT_GOLDEN, seats: int(g.seats, 0, 1000) ?? DEFAULT_GOLDEN.seats };
  const code = normalizeCoupon(g.code);
  return {
    enabled: typeof g.enabled === "boolean" ? g.enabled : DEFAULT_GOLDEN.enabled,
    code: COUPON_RE.test(code) ? code : DEFAULT_GOLDEN.code,
    price: int(g.price, 1, MAX_PRICE_EGP) ?? DEFAULT_GOLDEN.price,
    months: int(g.months, 1, 24) ?? DEFAULT_GOLDEN.months,
    seats: int(g.seats, 0, 1000) ?? DEFAULT_GOLDEN.seats,
  };
}

/**
 * يقرأ إعداد الأسعار بأمان. الشكل v3 يُقرأ باقةً باقة (ما نقص أو فسد يأخذ الافتراضي)، والشكل القديم (سلّم بمراحل وسعر
 * باقة سنوية «مدى الحياة» للدائرة الذهبية) لا يطابق النموذج الجديد فيُستبدل بالافتراضي مع الإبقاء على عدد مقاعد العرض.
 */
export function pricingFrom(raw: unknown): PricingModel {
  const c = obj(raw);
  const legacy = c.v !== 3;
  const list = !legacy && Array.isArray(c.plans) ? c.plans.map(obj) : [];
  const plans = DEFAULT_PLANS.map((d) => {
    const r = list.find((p) => Number(p.months) === d.months);
    if (!r) return { ...d };
    return {
      months: d.months,
      price: int(r.price, 1, MAX_PRICE_EGP) ?? d.price,
      renewal: int(r.renewal, 1, MAX_PRICE_EGP) ?? d.renewal,
    };
  });
  const featured = !legacy && isPlanMonths(c.featured) ? (Number(c.featured) as PlanMonths) : DEFAULT_PRICING.featured;
  return { v: 3, plans, featured, golden: goldenFrom(c.golden, legacy) };
}

export function planFor(model: PricingModel, months: unknown): PlanOption | null {
  return isPlanMonths(months) ? model.plans.find((p) => p.months === Number(months)) ?? null : null;
}

/** المبلغ المطلوب لباقة بمدتها ونوع الدفعة (أول مرة = البناء + المدة، تجديد = سعر تجديد المدة نفسها). */
export function planAmount(model: PricingModel, months: unknown, kind: PaymentKind): number | null {
  const p = planFor(model, months);
  if (!p) return null;
  return kind === "renewal" ? p.renewal : p.price;
}

/** المقابل الشهري التقريبي (للعرض فقط). */
export function perMonth(price: number, months: number): number {
  return months > 0 ? Math.round(price / months) : price;
}

/** أرخص سعر أول مرة (للعبارات المختصرة مثل «تبدأ من …»). */
export function startingPrice(model: PricingModel): number {
  return Math.min(...model.plans.map((p) => p.price));
}

export const monthsLabel = (m: number) => (m === 12 ? "سنة" : m === 1 ? "شهر" : m === 2 ? "شهران" : m <= 10 ? `${m} أشهر` : `${m} شهراً`);

/** مقاعد الدائرة الذهبية: المتاح فعلاً = مفعّل وفيه مقعد واحد على الأقل. */
export function goldenAvailability(g: GoldenOffer, used: number) {
  const seatsUsed = Math.max(0, Math.floor(used));
  const seatsLeft = Math.max(0, g.seats - seatsUsed);
  return { enabled: g.enabled, seatsUsed, seatsLeft, available: g.enabled && seatsLeft > 0 };
}

/** تحقق صارم لما يحفظه المالك من /admin/pricing (لا قيم افتراضية صامتة: الخطأ يُرد بسببه). */
export function validatePlans(input: unknown): { ok: true; plans: PlanOption[]; featured: PlanMonths } | { ok: false; error: string } {
  const c = obj(input);
  const list = Array.isArray(c.plans) ? c.plans.map(obj) : [];
  const plans: PlanOption[] = [];
  for (const months of PLAN_MONTHS) {
    const r = list.find((p) => Number(p.months) === months);
    const price = int(r?.price, 1, MAX_PRICE_EGP);
    const renewal = int(r?.renewal, 1, MAX_PRICE_EGP);
    if (!price) return { ok: false, error: `اكتبوا سعراً صحيحاً لباقة ${monthsLabel(months)} أول مرة.` };
    if (!renewal) return { ok: false, error: `اكتبوا سعر تجديد صحيحاً لباقة ${monthsLabel(months)}.` };
    plans.push({ months, price, renewal });
  }
  if (!isPlanMonths(c.featured)) return { ok: false, error: "اختاروا الباقة المميَّزة." };
  return { ok: true, plans, featured: Number(c.featured) as PlanMonths };
}

export function validateGolden(input: unknown): { ok: true; golden: GoldenOffer } | { ok: false; error: string } {
  const g = obj(input);
  const code = normalizeCoupon(g.code);
  if (!COUPON_RE.test(code)) return { ok: false, error: "الكود من 4 إلى 32 حرفاً إنجليزياً أو رقماً (ويُسمح بـ - و _)." };
  const price = int(g.price, 1, MAX_PRICE_EGP);
  if (!price) return { ok: false, error: "اكتبوا سعراً صحيحاً للعرض." };
  const months = int(g.months, 1, 24);
  if (!months) return { ok: false, error: "مدة العرض من شهر إلى 24 شهراً." };
  const seats = int(g.seats, 0, 1000);
  if (seats === null) return { ok: false, error: "عدد المقاعد من 0 إلى 1000." };
  return { ok: true, golden: { enabled: g.enabled === true, code, price, months, seats } };
}

/** سطور المعاينة الحية في /admin/pricing: ما سيقوله الهبوط وصفحة الدفع والوكيل بالأرقام الحالية (للمالك فقط). */
export function previewLines(model: PricingModel, goldenUsed: number): { landing: string[]; billing: string[]; agent: string } {
  const fmt = (n: number) => n.toLocaleString("en-US");
  const landing = model.plans.map(
    (p) => `${monthsLabel(p.months)}: ${fmt(p.price)} ج.م (${fmt(perMonth(p.price, p.months))} ج.م شهرياً تقريباً)${p.months === model.featured ? " · الأكثر اختياراً" : ""}`
  );
  const billing = model.plans.map((p) => `تجديد ${monthsLabel(p.months)}: ${fmt(p.renewal)} ج.م`);
  const g = goldenAvailability(model.golden, goldenUsed);
  if (g.available) {
    landing.push(`الدائرة الذهبية: ${fmt(model.golden.price)} ج.م لـ${monthsLabel(model.golden.months)} (الاستضافة فقط والبناء مجاني) · متبقٍ ${g.seatsLeft} من ${model.golden.seats}`);
  }
  const start = startingPrice(model);
  const agent = g.available
    ? `الوكيل يذكر: «تبدأ الباقات من ${fmt(start)} ج.م، وعندنا عرض الدائرة الذهبية بـ ${fmt(model.golden.price)} ج.م لـ${monthsLabel(model.golden.months)} ومتبقٍ ${g.seatsLeft} مقاعد».`
    : `الوكيل يذكر: «تبدأ الباقات من ${fmt(start)} ج.م» ولا يذكر الدائرة الذهبية (${model.golden.enabled ? "اكتملت المقاعد" : "متوقفة"}).`;
  return { landing, billing, agent };
}
