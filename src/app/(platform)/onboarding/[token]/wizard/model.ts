// model.ts — قيم الاستمارة الافتراضية (مضبوطة على السوق المصري) والتحقق لكل خطوة.
import { GOVERNORATES, type ShippingGroup } from "@/lib/egypt";
import type { IndustryId, OnboardingAsset, OnboardingProduct, ShippingZone } from "@/onboarding/schema";

export const PHONE_RE = /^01[0125]\d{8}$/;
export const uid = () => Math.random().toString(36).slice(2, 10);

export type StoreValue = {
  storeName?: string;
  ownerName?: string;
  industryNote?: string;
  desiredSubdomain?: string;
  industry?: IndustryId;
  phone?: string;
  whatsapp?: string;
  email?: string;
  logo?: OnboardingAsset;
  instagramHandle?: string;
  facebookPageUrl?: string;
  tiktokHandle?: string;
};

export type MotionStyle = "auto" | "calm" | "lively" | "cinematic";
export type Tone = "friendly_egyptian" | "professional" | "playful" | "luxury" | "minimal";
export type Payer = "customer" | "store" | "store_if_defect";
export type DefectPolicy = "replace_or_refund" | "replace" | "refund" | "case_by_case" | "none";

export type Features = Partial<Record<FeatureKey, boolean>>;

export type LaunchValue = {
  codEnabled: boolean;
  codFeeEgp: number;
  vodafoneCashEnabled: boolean;
  vodafoneCash?: string;
  instapayEnabled: boolean;
  instapayAddress?: string;
  prepaidEnabled: boolean;
  shippingMode: "flat" | "free" | "zones";
  flatFeeEgp: number;
  freeOverEgp?: number;
  deliveryEta?: string;
  deliveryExpectedDays: { min: number; max: number };
  zones: ShippingZone[];
  pickupEnabled: boolean;
  pickupAddress?: string;
  inspectionAllowed: boolean;
  returnDays: number;
  allowExchange: boolean;
  allowRefund: boolean;
  returnShippingPaidBy: Payer;
  refundDays: number;
  returnConditionsList: string[];
  nonReturnable?: string;
  defectPolicy: DefectPolicy;
  defectReportHours: number;
  defectShippingByStore: boolean;
  returnConditions?: string;
  toneOfVoice: Tone;
  autoTheme: boolean;
  motionStyle: MotionStyle;
  depth3d: boolean;
  colorPreference?: string;
  colorInspirationImage?: OnboardingAsset;
  founderStory?: string;
  features: Features;
  paymentPreferences: ("cod" | "vodafone_cash" | "instapay")[];
};

// ─── الشحن ───────────────────────────────────────────────────────────────────

export const GROUPS: { id: ShippingGroup; label: string; hint: string }[] = [
  { id: "gc", label: "القاهرة الكبرى", hint: "القاهرة، الجيزة، القليوبية" },
  { id: "alex", label: "الإسكندرية", hint: "" },
  { id: "delta", label: "الدلتا", hint: "البحيرة، الدقهلية، الشرقية..." },
  { id: "canal", label: "مدن القناة", hint: "بورسعيد، الإسماعيلية، السويس" },
  { id: "upper", label: "الصعيد", hint: "من الفيوم حتى أسوان" },
  { id: "remote", label: "المحافظات البعيدة", hint: "البحر الأحمر، مطروح، سيناء، الوادي الجديد" },
];

/** أسعار وأزمنة شحن قريبة من متوسط شركات الشحن في مصر؛ يعدّلها التاجر بضغطة. */
export const MARKET_RATES: Record<ShippingGroup, { fee: number; min: number; max: number }> = {
  gc: { fee: 65, min: 1, max: 2 },
  alex: { fee: 70, min: 2, max: 3 },
  delta: { fee: 75, min: 2, max: 4 },
  canal: { fee: 75, min: 2, max: 4 },
  upper: { fee: 90, min: 3, max: 5 },
  remote: { fee: 120, min: 4, max: 7 },
};

export const groupOf = (code: string): ShippingGroup => GOVERNORATES.find((g) => g.code === code)?.group ?? "remote";

export function marketZones(): ShippingZone[] {
  return GOVERNORATES.map((g) => {
    const r = MARKET_RATES[g.group];
    return { governorate: g.code, feeEgp: r.fee, etaMinDays: r.min, etaMaxDays: r.max, active: true };
  });
}

// ─── السياسات ────────────────────────────────────────────────────────────────

export const RETURN_CONDITION_PRESETS = [
  "أن يكون المنتج بحالته الأصلية، غير مستخدم وغير مغسول.",
  "أن يكون في تغليفه الأصلي مع كل الملحقات والبطاقات.",
  "أن يكون معك كود الطلب أو رقم الموبايل المسجل به.",
  "ألا تكون العلامات أو الملصقات قد أُزيلت.",
  "أن يُرسل صورة للمنتج قبل الاسترجاع عند وجود عيب.",
];

export const NON_RETURNABLE_PRESETS = [
  "الملابس الداخلية ولبس البحر",
  "المنتجات المفصّلة أو المطبوعة حسب الطلب",
  "مستحضرات التجميل والعطور بعد فتحها",
  "الأطعمة والمنتجات القابلة للتلف",
  "المنتجات المخفّضة في التصفيات",
];

// ─── المميزات ────────────────────────────────────────────────────────────────

export type FeatureKey =
  | "marqueeBanner"
  | "countdownOffer"
  | "bundleOffer"
  | "exitIntentDiscount"
  | "lowStockAlert"
  | "stickyAddToCart"
  | "directExpressBuy"
  | "freeShippingBar"
  | "trustBadges"
  | "socialProofToasts"
  | "whatsappDirectChat"
  | "brandStory"
  | "faqSection"
  | "whyChooseUs"
  | "frequentlyBoughtTogether"
  | "customerVoiceReviews";

export const RECOMMENDED_FEATURES: FeatureKey[] = [
  "marqueeBanner",
  "stickyAddToCart",
  "directExpressBuy",
  "freeShippingBar",
  "trustBadges",
  "socialProofToasts",
  "whatsappDirectChat",
  "brandStory",
  "faqSection",
  "whyChooseUs",
  "frequentlyBoughtTogether",
  "lowStockAlert",
];

// ─── القيم الافتراضية ────────────────────────────────────────────────────────

export const LAUNCH_DEFAULTS: LaunchValue = {
  codEnabled: true,
  codFeeEgp: 0,
  vodafoneCashEnabled: false,
  instapayEnabled: false,
  prepaidEnabled: false,
  shippingMode: "flat",
  flatFeeEgp: 65,
  deliveryExpectedDays: { min: 2, max: 4 },
  zones: [],
  pickupEnabled: false,
  inspectionAllowed: true,
  returnDays: 14,
  allowExchange: true,
  allowRefund: true,
  returnShippingPaidBy: "customer",
  refundDays: 7,
  returnConditionsList: RETURN_CONDITION_PRESETS.slice(0, 3),
  defectPolicy: "replace_or_refund",
  defectReportHours: 48,
  defectShippingByStore: true,
  toneOfVoice: "friendly_egyptian",
  autoTheme: true,
  motionStyle: "auto",
  depth3d: true,
  features: Object.fromEntries(RECOMMENDED_FEATURES.map((k) => [k, true])),
  paymentPreferences: ["cod"],
};

/** يكمل القيم الناقصة (مسودات قديمة) ويحسب الحقول المشتقة قبل الحفظ. */
export function normalizeLaunch(raw: Partial<LaunchValue> | undefined): LaunchValue {
  const v = { ...LAUNCH_DEFAULTS, ...(raw ?? {}) } as LaunchValue;
  v.deliveryExpectedDays = { ...LAUNCH_DEFAULTS.deliveryExpectedDays, ...(raw?.deliveryExpectedDays ?? {}) };
  v.features = { ...LAUNCH_DEFAULTS.features, ...(raw?.features ?? {}) };
  v.zones = (raw?.zones ?? []).map((z) => ({ ...z, active: z.active !== false }));
  v.returnConditionsList = raw?.returnConditionsList ?? LAUNCH_DEFAULTS.returnConditionsList;
  v.prepaidEnabled = v.vodafoneCashEnabled || v.instapayEnabled;
  v.paymentPreferences = [
    ...(v.codEnabled ? (["cod"] as const) : []),
    ...(v.vodafoneCashEnabled ? (["vodafone_cash"] as const) : []),
    ...(v.instapayEnabled ? (["instapay"] as const) : []),
  ];
  v.deliveryEta = `من ${v.deliveryExpectedDays.min} إلى ${v.deliveryExpectedDays.max} أيام عمل`;
  return v;
}

/** منتج من مسودة قديمة أو من المكتبة: نكمل الحقول الناقصة حتى لا تنكسر الواجهة. */
export function normalizeProduct(raw: Partial<OnboardingProduct>): OnboardingProduct {
  const images = Array.isArray(raw.images) ? raw.images : [];
  return {
    ...raw,
    id: raw.id || uid(),
    name: raw.name ?? "",
    priceEgp: Number(raw.priceEgp) || 0,
    aiDraft: raw.aiDraft ?? true,
    images,
    primaryImageId: raw.primaryImageId || images[0]?.id || "",
    options: Array.isArray(raw.options) ? raw.options.map((o) => ({ ...o, values: Array.isArray(o.values) ? o.values : [] })) : [],
    variants: Array.isArray(raw.variants) ? raw.variants : [],
    attributes: Array.isArray(raw.attributes) ? raw.attributes : [],
    stock: raw.stock === undefined ? 20 : raw.stock,
    bestSeller: Boolean(raw.bestSeller),
    isSpotlight: Boolean(raw.isSpotlight),
  } as OnboardingProduct;
}

export function blankProduct(images: OnboardingAsset[], categoryName?: string): OnboardingProduct {
  return {
    id: uid(),
    name: "",
    priceEgp: 0,
    categoryName,
    aiDraft: true,
    images,
    primaryImageId: images[0]?.id ?? "",
    options: [],
    variants: [],
    attributes: [],
    stock: 20,
    bestSeller: false,
    isSpotlight: false,
  } as OnboardingProduct;
}

// ─── التحقق ──────────────────────────────────────────────────────────────────

export type StepId = "identity" | "products" | "shipping" | "policies" | "look";

export function validateStep(step: StepId, store: StoreValue, products: OnboardingProduct[], launch: LaunchValue, inventory?: "track" | "always"): Record<string, string> {
  const e: Record<string, string> = {};
  if (step === "identity") {
    if (!store.storeName?.trim()) e.storeName = "اكتب اسم متجرك";
    if (!store.ownerName?.trim() || store.ownerName.trim().length < 2 || store.ownerName.trim() === "صاحب المتجر") e.ownerName = "اكتب اسمك";
    if (!store.desiredSubdomain || store.desiredSubdomain.length < 2) e.desiredSubdomain = "اختر رابطاً لمتجرك";
    if (!store.phone || !PHONE_RE.test(store.phone)) e.phone = "رقم موبايل مصري صحيح (11 رقماً يبدأ بـ 01)";
    if (store.whatsapp && !PHONE_RE.test(store.whatsapp)) e.whatsapp = "رقم واتساب غير صحيح";
    if (store.facebookPageUrl && !/^https?:\/\//.test(store.facebookPageUrl)) e.facebookPageUrl = "انسخ رابط الصفحة كاملاً (يبدأ بـ https://)";
  }
  if (step === "products") {
    if (!products.length) e.products = "أضف منتجاً واحداً على الأقل";
    if (!inventory) e.inventory = "اختر طريقة المخزون: نتتبع الكميات، أم كل المنتجات متاحة دائماً";
    products.forEach((p, i) => {
      // كل رسالة تسمّي المنتج، فيعرف التاجر أين المشكلة حتى لو كانت قائمته طويلة.
      const label = p.name?.trim() ? `«${p.name.trim().slice(0, 30)}»` : `المنتج رقم ${i + 1}`;
      if (!p.name?.trim()) e[`p${i}name`] = `اكتب اسم ${label}`;
      if (!(Number(p.priceEgp) > 0)) e[`p${i}price`] = `اكتب سعر ${label}`;
      if (p.compareAtEgp && Number(p.compareAtEgp) <= Number(p.priceEgp)) e[`p${i}compare`] = `سعر ${label} قبل الخصم يجب أن يكون أعلى من سعره الحالي، أو امسحه`;
      const empty = p.options.find((o) => !o.values.length);
      if (empty) e[`p${i}options`] = `أضف قيمة واحدة على الأقل لخيار «${empty.name || "بدون اسم"}» في ${label}، أو احذف الخيار`;
    });
  }
  if (step === "shipping") {
    if (launch.shippingMode === "zones" && !launch.zones.some((z) => z.active)) e.zones = "فعّل محافظة واحدة على الأقل";
    if (launch.deliveryExpectedDays.min > launch.deliveryExpectedDays.max) e.days = "أقل مدة يجب ألا تزيد عن أكبر مدة";
    if (launch.pickupEnabled && !launch.pickupAddress?.trim()) e.pickupAddress = "اكتب عنوان الاستلام";
  }
  if (step === "policies") {
    if (!launch.codEnabled && !launch.vodafoneCashEnabled && !launch.instapayEnabled) e.payment = "فعّل طريقة دفع واحدة على الأقل";
    if (launch.vodafoneCashEnabled && !PHONE_RE.test(launch.vodafoneCash ?? "")) e.vodafoneCash = "رقم فودافون كاش غير صحيح";
    if (launch.instapayEnabled && !launch.instapayAddress?.trim()) e.instapayAddress = "اكتب عنوان إنستاباي أو رقمه";
    if (launch.returnDays > 0 && !launch.allowExchange && !launch.allowRefund) e.returns = "اختر الاستبدال أو الاسترجاع أو كليهما";
  }
  return e;
}
