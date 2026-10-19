// platform-pricing.ts — نموذج أسعار Colapia v4 (قرار المالك 2026-10-19، docs/V3-PLAN.md القسم 1 و3). منطق خالص مختبَر.
//
//  - رسوم بناء تُدفع مرة واحدة مع الدفعة الأولى (افتراضي 2,999 ج)، ويحددها المالك.
//  - «الدائرة الذهبية»: رسوم بناء مخفّضة (افتراضي 999 ج) لعدد محدود من المتاجر (افتراضي 10)، بكود ومفتاح تشغيل.
//  - استضافة شهرية بثلاث باقات (أساسية 199، نمو 499، احترافية 1,499)، لكل باقة حدود تُطبَّق فعلاً على الخادم
//    (server/usage.ts)، وتُدفع لعدد أشهر يختاره التاجر من المدد التي يسمح بها المالك (1/3/6/12).
//  - الدفعة الأولى = رسوم البناء + الباقة × الأشهر. التجديد = الباقة × الأشهر فقط.
// الإعداد في feature_flags («pricing») ويُعدَّل من /admin/pricing فقط. الأشكال القديمة (v3 بالمدد، والسلّم) تُقرأ بأمان:
// لا تطابق النموذج الجديد فتُستبدل بالافتراضي مع الإبقاء على ما يصح نقله (مقاعد الدائرة الذهبية وحالة تشغيلها).
// لا يظهر هنا ولا في أي واجهة هامش الربح الداخلي.

export type PaymentKind = "setup" | "renewal";
export type PaymentPlan = "standard" | "golden";

export const PLAN_IDS = ["basic", "growth", "pro"] as const;
export type PlanId = (typeof PLAN_IDS)[number];

/** المدد التي يمكن للمالك السماح بها (بالأشهر). */
export const MONTH_CHOICES = [1, 3, 6, 12] as const;

const MB = 1024 * 1024;
const GB = 1024 * MB;

export type PlanLimits = {
  /** عدد المنتجات في المتجر. */
  products: number;
  /** مساحة الصور والفيديو الإجمالية بالبايت. */
  storageBytes: number;
  /** عدد ملفات الفيديو في المتجر. */
  videos: number;
  /** أقصى حجم لفيديو واحد بالبايت. */
  videoMaxBytes: number;
  /** عمليات الذكاء الاصطناعي شهرياً (استيراد، أوصاف، شكل، محتوى، قراءة صور). */
  aiPerMonth: number;
  /** عمليات «البحث بالصورة» لزوار المتجر شهرياً. */
  visualSearchPerMonth: number;
  /** أعضاء فريق المتجر المدعوون (غير صاحب المتجر). */
  teamMembers: number;
  /** ربط نطاق خاص. */
  customDomain: boolean;
};

export type HostingPlan = { id: PlanId; name: string; monthly: number; limits: PlanLimits };
export type GoldenOffer = { enabled: boolean; code: string; buildPrice: number; seats: number };
export type PricingModel = {
  v: 4;
  build: { price: number };
  golden: GoldenOffer;
  plans: HostingPlan[];
  /** المدد المسموح بها بالأشهر، تصاعدياً. */
  months: number[];
  featured: PlanId;
};

export const DEFAULT_PLANS: HostingPlan[] = [
  {
    id: "basic",
    name: "الأساسية",
    monthly: 199,
    limits: { products: 300, storageBytes: 2 * GB, videos: 3, videoMaxBytes: 40 * MB, aiPerMonth: 300, visualSearchPerMonth: 200, teamMembers: 2, customDomain: false },
  },
  {
    id: "growth",
    name: "النمو",
    monthly: 499,
    limits: { products: 2000, storageBytes: 10 * GB, videos: 15, videoMaxBytes: 40 * MB, aiPerMonth: 1500, visualSearchPerMonth: 1000, teamMembers: 5, customDomain: true },
  },
  {
    id: "pro",
    name: "الاحترافية",
    monthly: 1499,
    limits: { products: 10000, storageBytes: 50 * GB, videos: 60, videoMaxBytes: 40 * MB, aiPerMonth: 6000, visualSearchPerMonth: 5000, teamMembers: 15, customDomain: true },
  },
];
export const DEFAULT_GOLDEN: GoldenOffer = { enabled: true, code: "GOLDEN999", buildPrice: 999, seats: 10 };
export const DEFAULT_BUILD_PRICE = 2999;
export const DEFAULT_PRICING: PricingModel = {
  v: 4,
  build: { price: DEFAULT_BUILD_PRICE },
  golden: DEFAULT_GOLDEN,
  plans: DEFAULT_PLANS,
  months: [1, 3, 6, 12],
  featured: "growth",
};
/** حدود التجربة = حدود «النمو» (V3-PLAN 3). */
export const TRIAL_PLAN: PlanId = "growth";

export const MAX_PRICE_EGP = 1_000_000;
export const COUPON_RE = /^[A-Z0-9_-]{4,32}$/;
/** سقوف الحدود التي يقبلها نموذج المالك. */
export const LIMIT_CAPS: Record<Exclude<keyof PlanLimits, "customDomain">, number> = {
  products: 1_000_000,
  storageBytes: 10_000 * GB,
  videos: 100_000,
  videoMaxBytes: 2 * GB,
  aiPerMonth: 1_000_000,
  visualSearchPerMonth: 1_000_000,
  teamMembers: 500,
};

const obj = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const int = (v: unknown, min: number, max: number) => {
  if (v === null || v === undefined || v === "" || typeof v === "boolean") return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? Math.round(n) : null;
};

export const isPlanId = (v: unknown): v is PlanId => typeof v === "string" && (PLAN_IDS as readonly string[]).includes(v);
export const isMonthChoice = (v: unknown): boolean => (MONTH_CHOICES as readonly number[]).includes(Number(v));

/** يطبّع الكود كما يكتبه العميل (مسافات وحروف صغيرة وأرقام هندية). */
export function normalizeCoupon(raw: unknown): string {
  return String(raw ?? "")
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/\s+/g, "")
    .toUpperCase()
    .slice(0, 32);
}

const cleanName = (v: unknown, fallback: string) => {
  const s = typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, 24) : "";
  return s.length >= 2 ? s : fallback;
};

function limitsFrom(raw: unknown, d: PlanLimits): PlanLimits {
  const r = obj(raw);
  return {
    products: int(r.products, 1, LIMIT_CAPS.products) ?? d.products,
    storageBytes: int(r.storageBytes, MB, LIMIT_CAPS.storageBytes) ?? d.storageBytes,
    videos: int(r.videos, 0, LIMIT_CAPS.videos) ?? d.videos,
    videoMaxBytes: int(r.videoMaxBytes, MB, LIMIT_CAPS.videoMaxBytes) ?? d.videoMaxBytes,
    aiPerMonth: int(r.aiPerMonth, 0, LIMIT_CAPS.aiPerMonth) ?? d.aiPerMonth,
    visualSearchPerMonth: int(r.visualSearchPerMonth, 0, LIMIT_CAPS.visualSearchPerMonth) ?? d.visualSearchPerMonth,
    teamMembers: int(r.teamMembers, 0, LIMIT_CAPS.teamMembers) ?? d.teamMembers,
    customDomain: typeof r.customDomain === "boolean" ? r.customDomain : d.customDomain,
  };
}

function monthsFrom(raw: unknown): number[] {
  const list = Array.isArray(raw) ? raw.map(Number).filter((n) => isMonthChoice(n)) : [];
  const uniq = Array.from(new Set(list)).sort((a, b) => a - b);
  return uniq.length ? uniq : [...DEFAULT_PRICING.months];
}

/**
 * يقرأ إعداد الأسعار بأمان: v4 حقلاً حقلاً (ما نقص أو فسد يأخذ الافتراضي)، والأشكال القديمة تُستبدل بالافتراضي مع نقل
 * مقاعد الدائرة الذهبية وحالة تشغيلها فقط (كودها وسعرها كانا لنموذج آخر).
 */
export function pricingFrom(raw: unknown): PricingModel {
  const c = obj(raw);
  if (c.v !== 4) {
    const g = obj(c.golden);
    return {
      ...DEFAULT_PRICING,
      plans: DEFAULT_PLANS.map((p) => ({ ...p, limits: { ...p.limits } })),
      golden: {
        ...DEFAULT_GOLDEN,
        enabled: typeof g.enabled === "boolean" ? g.enabled : DEFAULT_GOLDEN.enabled,
        seats: int(g.seats, 0, 1000) ?? DEFAULT_GOLDEN.seats,
      },
    };
  }
  const list = Array.isArray(c.plans) ? c.plans.map(obj) : [];
  const plans = DEFAULT_PLANS.map((d) => {
    const r = list.find((p) => p.id === d.id);
    if (!r) return { ...d, limits: { ...d.limits } };
    return { id: d.id, name: cleanName(r.name, d.name), monthly: int(r.monthly, 1, MAX_PRICE_EGP) ?? d.monthly, limits: limitsFrom(r.limits, d.limits) };
  });
  const g = obj(c.golden);
  const code = normalizeCoupon(g.code);
  return {
    v: 4,
    build: { price: int(obj(c.build).price, 0, MAX_PRICE_EGP) ?? DEFAULT_BUILD_PRICE },
    golden: {
      enabled: typeof g.enabled === "boolean" ? g.enabled : DEFAULT_GOLDEN.enabled,
      code: COUPON_RE.test(code) ? code : DEFAULT_GOLDEN.code,
      buildPrice: int(g.buildPrice, 0, MAX_PRICE_EGP) ?? DEFAULT_GOLDEN.buildPrice,
      seats: int(g.seats, 0, 1000) ?? DEFAULT_GOLDEN.seats,
    },
    plans,
    months: monthsFrom(c.months),
    featured: isPlanId(c.featured) ? c.featured : DEFAULT_PRICING.featured,
  };
}

export function planById(model: PricingModel, id: unknown): HostingPlan | null {
  return isPlanId(id) ? model.plans.find((p) => p.id === id) ?? null : null;
}

/** باقة المتجر المسجّلة (stores.plan) أو null لقيمة قديمة/غير معروفة. */
export function planIdFrom(v: unknown): PlanId | null {
  return isPlanId(v) ? v : null;
}

export const monthsLabel = (m: number) => (m === 12 ? "سنة" : m === 1 ? "شهر" : m === 2 ? "شهران" : m <= 10 ? `${m} أشهر` : `${m} شهراً`);
/** «لمدة شهر» / «لمدة 3 أشهر» / «لمدة سنة». */
export const forMonths = (m: number) => `لمدة ${monthsLabel(m)}`;

export const fmtEgp = (n: number) => Math.round(n).toLocaleString("en-US");

/** أرخص اشتراك شهري (للعبارات المختصرة: «الاستضافة تبدأ من 199 ج شهرياً»). */
export function startingPrice(model: PricingModel): number {
  return Math.min(...model.plans.map((p) => p.monthly));
}

/** مقاعد الدائرة الذهبية: المتاح فعلاً = مفعّل وفيه مقعد واحد على الأقل. */
export function goldenAvailability(g: GoldenOffer, used: number) {
  const seatsUsed = Math.max(0, Math.floor(used));
  const seatsLeft = Math.max(0, g.seats - seatsUsed);
  return { enabled: g.enabled, seatsUsed, seatsLeft, available: g.enabled && seatsLeft > 0 };
}

export type QuoteLine = { label: string; amount: number };
export type Quote = {
  ok: true;
  kind: PaymentKind;
  planId: PlanId;
  planName: string;
  months: number;
  monthly: number;
  golden: boolean;
  build: number;
  hosting: number;
  total: number;
  lines: QuoteLine[];
};

/**
 * المبلغ المطلوب لدفعة: الأولى = رسوم البناء (أو رسوم الدائرة الذهبية) + الباقة × الأشهر، والتجديد = الباقة × الأشهر.
 * الدائرة الذهبية للدفعة الأولى فقط، ويتحقق المستدعي من توفر مقاعدها.
 */
export function quote(model: PricingModel, input: { planId: unknown; months: unknown; golden?: boolean; kind: PaymentKind }): Quote | { ok: false; error: string } {
  const plan = planById(model, input.planId);
  if (!plan) return { ok: false, error: "اختاروا الباقة أولاً." };
  const months = Number(input.months);
  if (!model.months.includes(months)) return { ok: false, error: "اختاروا مدة من المدد المتاحة." };
  const golden = Boolean(input.golden);
  if (golden && input.kind !== "setup") return { ok: false, error: "عرض الدائرة الذهبية للدفعة الأولى فقط." };
  const build = input.kind === "setup" ? (golden ? model.golden.buildPrice : model.build.price) : 0;
  const hosting = plan.monthly * months;
  const lines: QuoteLine[] = [];
  if (input.kind === "setup") lines.push({ label: golden ? "تجهيز المتجر (الدائرة الذهبية)" : "تجهيز المتجر (مرة واحدة)", amount: build });
  lines.push({ label: `باقة ${plan.name}: ${fmtEgp(plan.monthly)} ج × ${monthsLabel(months)}`, amount: hosting });
  return { ok: true, kind: input.kind, planId: plan.id, planName: plan.name, months, monthly: plan.monthly, golden, build, hosting, total: build + hosting, lines };
}

/** وصف الحدود بالعربية (للدفع والهبوط والوكيل). */
export function fmtStorage(bytes: number): string {
  if (bytes >= GB) {
    const g = bytes / GB;
    return `${Number.isInteger(g) ? g : g.toFixed(1)} GB`;
  }
  return `${Math.round(bytes / MB)} MB`;
}

export function limitHighlights(l: PlanLimits): string[] {
  return [
    `حتى ${fmtEgp(l.products)} منتج`,
    `${fmtStorage(l.storageBytes)} للصور والفيديو`,
    l.videos > 0 ? `${fmtEgp(l.videos)} ${l.videos <= 10 && l.videos > 2 ? "فيديوهات" : "فيديو"} (حتى ${fmtStorage(l.videoMaxBytes)} للفيديو)` : "بلا فيديو",
    `${fmtEgp(l.aiPerMonth)} عملية تلقائية شهرياً (استيراد المنتجات وقراءة الصور والتعديل بالوصف)`,
    `${fmtEgp(l.visualSearchPerMonth)} بحث بالصورة لزواركم شهرياً`,
    l.teamMembers > 0 ? `${fmtEgp(l.teamMembers)} ${l.teamMembers === 1 ? "عضو" : "أعضاء"} في فريقكم` : "بلا أعضاء فريق",
    l.customDomain ? "نطاقكم الخاص (دومين)" : "رابط على colapia.com (بلا نطاق خاص)",
  ];
}

/**
 * حقائق الأسعار لبرومبت وكيل المبيعات بالأرقام الحالية (عربي، بلا أي هامش داخلي). سطر الدائرة الذهبية لا يظهر إلا وهي
 * مفعّلة وفيها مقاعد.
 */
export function agentPricingFacts(model: PricingModel, goldenUsed: number): string {
  const g = goldenAvailability(model.golden, goldenUsed);
  const plans = model.plans
    .map((p) => {
      const l = p.limits;
      return `- باقة ${p.name}: ${fmtEgp(p.monthly)} ج شهرياً (حتى ${fmtEgp(l.products)} منتج، ${fmtStorage(l.storageBytes)} للصور والفيديو، ${fmtEgp(l.teamMembers)} أعضاء فريق${l.customDomain ? "، ونطاق خاص" : "، بلا نطاق خاص"})${p.id === model.featured ? " — الأكثر اختياراً" : ""}.`;
    })
    .join("\n");
  const lines = [
    `- تجهيز المتجر: ${fmtEgp(model.build.price)} ج مرة واحدة مع أول دفعة.`,
    plans,
    `- مدد الدفع المتاحة: ${model.months.map(monthsLabel).join("، ")}. الدفعة الأولى = التجهيز + الباقة × عدد الأشهر، والتجديد = الباقة فقط.`,
    "- تجربة مجانية قبل أي دفع، وبلا عمولة على المبيعات أبداً، والدفع بفودافون كاش أو إنستاباي.",
  ];
  if (g.available) {
    lines.push(
      `- عرض «الدائرة الذهبية» متاح الآن: التجهيز بـ ${fmtEgp(model.golden.buildPrice)} ج بدلاً من ${fmtEgp(model.build.price)} ج لعدد محدود، والمتبقي ${g.seatsLeft} من ${model.golden.seats} مقاعد. يُذكر بهدوء كعرض خاص لا كضغط، والاستضافة الشهرية كما هي.`
    );
  }
  return lines.join("\n");
}

/** معاينة المالك الحية في /admin/pricing: ما سيراه التاجر في الدفع، والهبوط، والوكيل، بالأرقام المكتوبة الآن. */
export function previewLines(model: PricingModel, goldenUsed: number): { billing: string[]; landing: string[]; agent: string } {
  const g = goldenAvailability(model.golden, goldenUsed);
  const featured = planById(model, model.featured) ?? model.plans[0]!;
  const minMonths = model.months[0] ?? 1;
  const example = quote(model, { planId: featured.id, months: minMonths, kind: "setup" });
  const billing = example.ok
    ? [
        `مثال أول دفعة (${featured.name}، ${monthsLabel(minMonths)}): ${example.lines.map((l) => `${l.label} = ${fmtEgp(l.amount)} ج`).join(" + ")} → الإجمالي ${fmtEgp(example.total)} ج`,
        `التجديد: ${model.plans.map((p) => `${p.name} ${fmtEgp(p.monthly)} ج شهرياً`).join("، ")}، لمدة ${model.months.map(monthsLabel).join(" أو ")}.`,
      ]
    : [];
  if (g.available) billing.push(`مع كود ${model.golden.code}: التجهيز ${fmtEgp(model.golden.buildPrice)} ج بدلاً من ${fmtEgp(model.build.price)} ج · متبقٍ ${g.seatsLeft} من ${model.golden.seats}`);
  else billing.push(`الدائرة الذهبية: ${model.golden.enabled ? "اكتملت المقاعد، والكود يُرفض تلقائياً" : "متوقفة، والكود يُرفض"}`);
  const landing = model.plans.map((p) => `${p.name}: ${fmtEgp(p.monthly)} ج.م شهرياً${p.id === model.featured ? " · الأكثر اختياراً" : ""} — ${limitHighlights(p.limits).slice(0, 3).join("، ")}`);
  landing.unshift(`تجهيز المتجر: ${fmtEgp(model.build.price)} ج.م مرة واحدة`);
  return { billing, landing, agent: agentPricingFacts(model, goldenUsed) };
}

export type PricingInput = {
  build: { price: number };
  golden: GoldenOffer;
  plans: HostingPlan[];
  months: number[];
  featured: string;
};

/** تحقق صارم لما يحفظه المالك (لا قيم افتراضية صامتة: الخطأ يُرد بسببه وبمكانه). */
export function validatePricing(input: unknown): { ok: true; model: PricingModel } | { ok: false; error: string } {
  const c = obj(input);
  const buildPrice = int(obj(c.build).price, 0, MAX_PRICE_EGP);
  if (buildPrice === null) return { ok: false, error: "اكتبوا رسوم تجهيز صحيحة (0 أو أكثر)." };

  const g = obj(c.golden);
  const code = normalizeCoupon(g.code);
  if (!COUPON_RE.test(code)) return { ok: false, error: "كود الدائرة الذهبية من 4 إلى 32 حرفاً إنجليزياً أو رقماً (ويُسمح بـ - و _)." };
  const goldenBuild = int(g.buildPrice, 0, MAX_PRICE_EGP);
  if (goldenBuild === null) return { ok: false, error: "اكتبوا رسوم تجهيز صحيحة للدائرة الذهبية." };
  if (goldenBuild > buildPrice) return { ok: false, error: "رسوم الدائرة الذهبية يجب ألا تزيد على رسوم التجهيز العادية." };
  const seats = int(g.seats, 0, 1000);
  if (seats === null) return { ok: false, error: "عدد مقاعد الدائرة الذهبية من 0 إلى 1000." };

  const list = Array.isArray(c.plans) ? c.plans.map(obj) : [];
  const plans: HostingPlan[] = [];
  for (const d of DEFAULT_PLANS) {
    const r = list.find((p) => p.id === d.id);
    if (!r) return { ok: false, error: `بيانات باقة ${d.name} ناقصة.` };
    const name = typeof r.name === "string" ? r.name.replace(/\s+/g, " ").trim() : "";
    if (name.length < 2 || name.length > 24) return { ok: false, error: `اسم الباقة من 2 إلى 24 حرفاً (${d.name}).` };
    const monthly = int(r.monthly, 1, MAX_PRICE_EGP);
    if (!monthly) return { ok: false, error: `اكتبوا سعراً شهرياً صحيحاً لباقة ${name}.` };
    const l = obj(r.limits);
    const need = (k: keyof typeof LIMIT_CAPS, min: number, label: string) => {
      const v = int(l[k], min, LIMIT_CAPS[k]);
      return v === null ? `اكتبوا ${label} صحيحاً لباقة ${name}.` : v;
    };
    const products = need("products", 1, "عدد المنتجات");
    const storageBytes = need("storageBytes", MB, "حجم المساحة");
    const videos = need("videos", 0, "عدد الفيديوهات");
    const videoMaxBytes = need("videoMaxBytes", MB, "أقصى حجم للفيديو");
    const aiPerMonth = need("aiPerMonth", 0, "حد العمليات التلقائية");
    const visualSearchPerMonth = need("visualSearchPerMonth", 0, "حد البحث بالصورة");
    const teamMembers = need("teamMembers", 0, "عدد أعضاء الفريق");
    for (const v of [products, storageBytes, videos, videoMaxBytes, aiPerMonth, visualSearchPerMonth, teamMembers]) if (typeof v === "string") return { ok: false, error: v };
    plans.push({
      id: d.id,
      name,
      monthly,
      limits: {
        products: products as number,
        storageBytes: storageBytes as number,
        videos: videos as number,
        videoMaxBytes: videoMaxBytes as number,
        aiPerMonth: aiPerMonth as number,
        visualSearchPerMonth: visualSearchPerMonth as number,
        teamMembers: teamMembers as number,
        customDomain: l.customDomain === true,
      },
    });
  }
  const months = Array.isArray(c.months) ? Array.from(new Set(c.months.map(Number))).filter((m) => isMonthChoice(m)).sort((a, b) => a - b) : [];
  if (!months.length) return { ok: false, error: "اختاروا مدة دفع واحدة على الأقل." };
  if (!isPlanId(c.featured)) return { ok: false, error: "اختاروا الباقة المميَّزة." };
  return {
    ok: true,
    model: { v: 4, build: { price: buildPrice }, golden: { enabled: g.enabled === true, code, buildPrice: goldenBuild, seats }, plans, months, featured: c.featured },
  };
}
