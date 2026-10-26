// platform-pricing.ts — أسعار Colapia في نموذج V4 (قرار المالك 2026-10-24، docs/V4-PLAN.md القسم 5). منطق خالص مختبَر.
//
//  - مشروع متجر عادي: سعر واحد يُدفع كاملاً قبل التسليم (افتراضي 4,999 ج).
//  - «الدائرة الذهبية»: سعر مخفّض (افتراضي 999 ج) لأول عدد محدود من المتاجر (افتراضي 10). أول مقعد يشغله عميل سابق (Qima)،
//    فالعدّاد يبدأ «باقٍ 9». المتبقي = المقاعد − المشغول سلفاً − الحجوزات الذهبية التي أكّدها المالك.
//  - تعديل بعد التسليم: تعديل مجاني واحد خلال نافذة (افتراضي 7 أيام من التسليم)، وما عداه برسوم (افتراضي 999 ج).
//  - المشاريع الأخرى (غير المتاجر): نص قابل للضبط يقوله الوكيل، ولا يطلب دفعاً أبداً.
// لا استضافة ولا اشتراك شهري ولا تجربة مجانية ولا باقات: حُذفت كلها في V4.
// الإعداد في feature_flags («pricing») ويُعدَّل من /admin/pricing فقط. الأشكال القديمة (V3 بالباقات والمدد) تُقرأ بأمان:
// لا تطابق النموذج الجديد فتُستبدل بالافتراضي مع الإبقاء على حالة تشغيل الدائرة الذهبية وعدد مقاعدها.

export type PaymentKind = "project" | "edit";
export type PaymentPlan = "standard" | "golden";

export type GoldenOffer = {
  enabled: boolean;
  /** سعر الدائرة الذهبية بالجنيه. */
  price: number;
  /** إجمالي المقاعد. */
  seats: number;
  /** مقاعد مشغولة سلفاً خارج النظام (العميل الأول Qima = 1). */
  base: number;
};
export type EditTerms = { fee: number; freeDays: number };
export type PricingModel = {
  v: 5;
  regularPrice: number;
  golden: GoldenOffer;
  edit: EditTerms;
  /** نص يقوله الوكيل عن المشاريع غير المتاجر (سعر أو طريقة التسعير). */
  otherServices: string;
};

export const DEFAULT_REGULAR_PRICE = 4999;
export const DEFAULT_GOLDEN: GoldenOffer = { enabled: true, price: 999, seats: 10, base: 1 };
export const DEFAULT_EDIT: EditTerms = { fee: 999, freeDays: 7 };
export const DEFAULT_OTHER_SERVICES = "المشاريع غير المتاجر (مواقع، أنظمة، تطبيقات) تُسعَّر بحسب نطاقها بعد أن يفهم الفريق المطلوب، ويرد عليكم الفريق بالسعر نفسه.";
export const DEFAULT_PRICING: PricingModel = {
  v: 5,
  regularPrice: DEFAULT_REGULAR_PRICE,
  golden: DEFAULT_GOLDEN,
  edit: DEFAULT_EDIT,
  otherServices: DEFAULT_OTHER_SERVICES,
};

export const MAX_PRICE_EGP = 1_000_000;
export const MAX_OTHER_SERVICES = 600;

const obj = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const int = (v: unknown, min: number, max: number) => {
  if (v === null || v === undefined || v === "" || typeof v === "boolean") return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? Math.round(n) : null;
};
const cleanNote = (v: unknown, fallback: string) => {
  const s = typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, MAX_OTHER_SERVICES) : "";
  return s.length >= 10 ? s : fallback;
};

/**
 * يقرأ إعداد الأسعار بأمان: v5 حقلاً حقلاً (ما نقص أو فسد يأخذ الافتراضي)، والأشكال القديمة تُستبدل بالافتراضي مع نقل
 * حالة تشغيل الدائرة الذهبية وعدد مقاعدها فقط (باقاتها وأكوادها كانت لنموذج آخر).
 */
export function pricingFrom(raw: unknown): PricingModel {
  const c = obj(raw);
  const g = obj(c.golden);
  if (c.v !== 5) {
    return {
      ...DEFAULT_PRICING,
      golden: {
        ...DEFAULT_GOLDEN,
        enabled: typeof g.enabled === "boolean" ? g.enabled : DEFAULT_GOLDEN.enabled,
        seats: int(g.seats, 0, 1000) ?? DEFAULT_GOLDEN.seats,
      },
    };
  }
  const e = obj(c.edit);
  return {
    v: 5,
    regularPrice: int(c.regularPrice, 1, MAX_PRICE_EGP) ?? DEFAULT_REGULAR_PRICE,
    golden: {
      enabled: typeof g.enabled === "boolean" ? g.enabled : DEFAULT_GOLDEN.enabled,
      price: int(g.price, 0, MAX_PRICE_EGP) ?? DEFAULT_GOLDEN.price,
      seats: int(g.seats, 0, 1000) ?? DEFAULT_GOLDEN.seats,
      base: int(g.base, 0, 1000) ?? DEFAULT_GOLDEN.base,
    },
    edit: { fee: int(e.fee, 0, MAX_PRICE_EGP) ?? DEFAULT_EDIT.fee, freeDays: int(e.freeDays, 0, 90) ?? DEFAULT_EDIT.freeDays },
    otherServices: cleanNote(c.otherServices, DEFAULT_OTHER_SERVICES),
  };
}

export const fmtEgp = (n: number) => Math.round(n).toLocaleString("en-US");

/** المقاعد: المشغول = المقاعد المحجوزة سلفاً + الحجوزات الذهبية المؤكَّدة. المتاح فعلاً = مفعّل وفيه مقعد على الأقل. */
export function goldenAvailability(g: GoldenOffer, confirmed: number) {
  const seatsUsed = Math.min(g.seats, Math.max(0, g.base) + Math.max(0, Math.floor(confirmed)));
  const seatsLeft = Math.max(0, g.seats - seatsUsed);
  return { enabled: g.enabled, seatsUsed, seatsLeft, available: g.enabled && seatsLeft > 0 };
}

export type ProjectQuote = {
  offer: PaymentPlan;
  /** المبلغ المطلوب الآن بالجنيه. */
  price: number;
  regularPrice: number;
  seatsLeft: number;
  seats: number;
};

/** سعر حجز جديد الآن: الدائرة الذهبية متى كان فيها مقعد، وإلا السعر العادي. confirmedGolden = الحجوزات الذهبية المؤكَّدة. */
export function projectQuote(model: PricingModel, confirmedGolden: number): ProjectQuote {
  const a = goldenAvailability(model.golden, confirmedGolden);
  return { offer: a.available ? "golden" : "standard", price: a.available ? model.golden.price : model.regularPrice, regularPrice: model.regularPrice, seatsLeft: a.seatsLeft, seats: model.golden.seats };
}

export type EditTermsResult =
  | { ok: true; free: true; fee: 0; until: Date }
  | { ok: true; free: false; fee: number; reason: "window_closed" | "free_used" }
  | { ok: false; error: string };

/**
 * هل طلب التعديل هذا مجاني؟ مجاني إن كان داخل نافذة التسليم ولم يُستهلك المجاني بعد، وإلا برسوم.
 * بلا تسليم (freeEditUntil = null) لا تعديل أصلاً: المشروع لم يُسلَّم.
 */
export function editTerms(model: PricingModel, input: { deliveredAt: Date | null; freeEditUntil: Date | null; freeUsed: boolean; now?: Date }): EditTermsResult {
  const now = input.now ?? new Date();
  if (!input.deliveredAt) return { ok: false, error: "التعديل يُفتح بعد تسليم المشروع." };
  const inWindow = input.freeEditUntil !== null && now.getTime() <= input.freeEditUntil.getTime();
  if (inWindow && !input.freeUsed && input.freeEditUntil) return { ok: true, free: true, fee: 0, until: input.freeEditUntil };
  return { ok: true, free: false, fee: model.edit.fee, reason: inWindow ? "free_used" : "window_closed" };
}

/** نهاية نافذة التعديل المجاني من لحظة التسليم. */
export const freeEditDeadline = (deliveredAt: Date, freeDays: number) => new Date(deliveredAt.getTime() + freeDays * 86_400_000);

const seatsWord = (n: number) => (n === 1 ? "مقعد واحد" : n === 2 ? "مقعدان" : n <= 10 ? `${n} مقاعد` : `${n} مقعداً`);

/**
 * حقائق الأسعار لبرومبت وكيل المبيعات بالأرقام الحالية (عربي). confirmedGolden = الحجوزات الذهبية المؤكَّدة.
 * سطر الدائرة الذهبية لا يظهر إلا وهي مفعّلة وفيها مقاعد، وللمتاجر فقط. المشاريع الأخرى لا يُطلب فيها دفع أبداً.
 */
export function agentPricingFacts(model: PricingModel, confirmedGolden: number): string {
  const g = goldenAvailability(model.golden, confirmedGolden);
  const lines = [
    `- مشروع متجر: ${fmtEgp(model.regularPrice)} ج كاملاً، يُدفع قبل التسليم بتحويل (فودافون كاش أو إنستاباي)، ويستلم العميل المشروع بكامله ملكاً له. لا اشتراك شهري ولا عمولة على المبيعات.`,
  ];
  if (g.available) {
    lines.push(
      `- عرض «الدائرة الذهبية» للمتاجر فقط، متاح الآن: ${fmtEgp(model.golden.price)} ج بدلاً من ${fmtEgp(model.regularPrice)} ج لأول ${model.golden.seats} متاجر، والمتبقي ${seatsWord(g.seatsLeft)}. مقابل تعاون (Collab أو شهادة) بموافقة العميل على النسخة النهائية. يُذكر بهدوء كعرض خاص لا كضغط، ولا تخترع مدة أو شروطاً غير ما هنا.`
    );
  }
  lines.push(
    `- بعد التسليم: تعديل مجاني واحد خلال ${model.edit.freeDays} أيام، وما زاد أو بعدها ${fmtEgp(model.edit.fee)} ج للتعديل. لا تروّج لهذا، واذكره فقط إن سأل العميل عن التعديلات.`,
    `- المشاريع غير المتاجر: ${model.otherServices} لا تطلب دفعاً ولا ترسل رابط حجز أبداً؛ يصل الفريق إشعار ويرد بنفسه.`
  );
  return lines.join("\n");
}

/** معاينة المالك الحية في /admin/pricing: ما سيراه العميل في الحجز والوكيل، بالأرقام المكتوبة الآن. */
export function previewLines(model: PricingModel, confirmedGolden: number): { booking: string[]; edits: string[]; agent: string } {
  const g = goldenAvailability(model.golden, confirmedGolden);
  const q = projectQuote(model, confirmedGolden);
  const booking = [
    g.available ? `صفحة الحجز تعرض الدائرة الذهبية: ${fmtEgp(model.golden.price)} ج بدلاً من ${fmtEgp(model.regularPrice)} ج، وعدّاد «باقٍ ${g.seatsLeft} من ${model.golden.seats}».` : `صفحة الحجز تعرض السعر العادي ${fmtEgp(model.regularPrice)} ج${model.golden.enabled ? " (اكتملت مقاعد الدائرة الذهبية)" : " (الدائرة الذهبية متوقفة)"}.`,
    `سعر الحجز الذي سيُطلب من العميل الآن: ${fmtEgp(q.price)} ج.`,
  ];
  const edits = [`تعديل مجاني واحد خلال ${model.edit.freeDays} أيام من التسليم، وما عداه ${fmtEgp(model.edit.fee)} ج.`];
  return { booking, edits, agent: agentPricingFacts(model, confirmedGolden) };
}

export type PricingInput = {
  regularPrice: number;
  golden: GoldenOffer;
  edit: EditTerms;
  otherServices: string;
};

/** تحقق صارم لما يحفظه المالك (لا قيم افتراضية صامتة: الخطأ يُرد بسببه). */
export function validatePricing(input: unknown): { ok: true; model: PricingModel } | { ok: false; error: string } {
  const c = obj(input);
  const regularPrice = int(c.regularPrice, 1, MAX_PRICE_EGP);
  if (regularPrice === null) return { ok: false, error: "اكتبوا سعر المشروع العادي (رقم صحيح أكبر من صفر)." };

  const g = obj(c.golden);
  const price = int(g.price, 0, MAX_PRICE_EGP);
  if (price === null) return { ok: false, error: "اكتبوا سعر الدائرة الذهبية (صفر أو أكثر)." };
  if (price > regularPrice) return { ok: false, error: "سعر الدائرة الذهبية يجب ألا يزيد على السعر العادي." };
  const seats = int(g.seats, 0, 1000);
  if (seats === null) return { ok: false, error: "عدد مقاعد الدائرة الذهبية من 0 إلى 1000." };
  const base = int(g.base, 0, 1000);
  if (base === null) return { ok: false, error: "المقاعد المشغولة سلفاً من 0 إلى 1000." };
  if (base > seats) return { ok: false, error: "المقاعد المشغولة سلفاً لا تزيد على إجمالي المقاعد." };

  const e = obj(c.edit);
  const fee = int(e.fee, 0, MAX_PRICE_EGP);
  if (fee === null) return { ok: false, error: "اكتبوا رسوم التعديل (صفر أو أكثر)." };
  const freeDays = int(e.freeDays, 0, 90);
  if (freeDays === null) return { ok: false, error: "نافذة التعديل المجاني من 0 إلى 90 يوماً." };

  const note = typeof c.otherServices === "string" ? c.otherServices.replace(/\s+/g, " ").trim() : "";
  if (note.length < 10) return { ok: false, error: "اكتبوا نص المشاريع الأخرى (10 أحرف على الأقل)." };
  if (note.length > MAX_OTHER_SERVICES) return { ok: false, error: `نص المشاريع الأخرى حتى ${MAX_OTHER_SERVICES} حرفاً.` };

  return { ok: true, model: { v: 5, regularPrice, golden: { enabled: g.enabled === true, price, seats, base }, edit: { fee, freeDays }, otherServices: note } };
}
