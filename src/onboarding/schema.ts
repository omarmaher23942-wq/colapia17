// onboarding/schema.ts — مخطط بيانات استمارة بناء المتجر (v3).
//
// التعديلات الجذرية (موجة 2):
//  1) إضافة 22 حقل جديد: audience, competitors, usp, brandStory, founder*,
//     currentChannels, marketingBudget*, expectedOrders*, workingHours,
//     deliveryExpectedDays, inspirationImages, brandColorText, discountCodes*,
//     instagram/tiktok/facebook handles, customDomain.
//  2) إضافة `adaptiveAnswers` — إجابات أسئلة ديناميكية لكل فئة.
//  3) تصريف منفصل لكل قسم (store / products / launch / adaptive / review).
//  4) تطبيع هاتف مصري + تحقق صارم من النطاق الفرعي + تحقق من الإيميل.
//  5) Zod refinements: منع تكرار المنافسين، منع منافس بلا url صحيح، إلخ.
import { z } from "zod";

const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";

export function normalizeEgPhone(input: string): string {
  let s = String(input ?? "")
    .replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)))
    .replace(/[\s\-().]/g, "");
  if (s.startsWith("+20")) s = "0" + s.slice(3);
  else if (s.startsWith("0020")) s = "0" + s.slice(4);
  else if (s.startsWith("20") && s.length === 12) s = "0" + s.slice(2);
  return s;
}

const emptyToUndef = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? undefined : v;
const optText = (max: number) =>
  z.preprocess(emptyToUndef, z.string().trim().max(max).optional());
const reqText = (min: number, max: number, msg?: string) =>
  z.string().trim().min(min, msg).max(max);

const PHONE_RE = /^01[0125]\d{8}$/;
const PHONE_MSG = "رقم موبايل مصري غير صحيح (01xxxxxxxxx)";

const phoneReq = z.preprocess(
  (v) => (typeof v === "string" ? normalizeEgPhone(v) : v),
  z.string().regex(PHONE_RE, PHONE_MSG)
);

const phoneOpt = z.preprocess(
  (v) => {
    const e = emptyToUndef(v);
    return typeof e === "string" ? normalizeEgPhone(e) : e;
  },
  z.string().regex(PHONE_RE, PHONE_MSG).optional()
);

const id = z.string().min(1).max(64);
const egp = z.coerce.number().min(0).max(1_000_000).default(0);
const stockNum = z.coerce
  .number()
  .int()
  .min(0)
  .max(1_000_000)
  .nullable()
  .optional();

// ─── enums ──────────────────────────────────────────────────────────────────
export const INDUSTRY_IDS = [
  "fashion",
  "beauty",
  "electronics",
  "food",
  "home",
  "kids",
  "accessories",
  "gifts",
  "health",
  "other",
] as const;
export type IndustryId = (typeof INDUSTRY_IDS)[number];

export const MARKETING_BUDGET_IDS = [
  "none",
  "under_5k",
  "5k_20k",
  "20k_50k",
  "50k_plus",
] as const;
export type MarketingBudgetId = (typeof MARKETING_BUDGET_IDS)[number];

export const TONE_IDS = [
  "friendly_egyptian",
  "professional",
  "playful",
  "luxury",
  "minimal",
] as const;
export type ToneId = (typeof TONE_IDS)[number];

export const LAYOUT_STYLE_IDS = [
  "classic",
  "modern",
  "editorial",
  "minimal",
  "bold",
] as const;

export const CARD_STYLE_IDS = [
  "minimal",
  "elevated",
  "bordered",
  "editorial",
  "overlay",
] as const;

export const MOTION_LEVEL_IDS = [
  "none",
  "subtle",
  "balanced",
  "cinematic",
] as const;

export const AGE_RANGE_IDS = [
  "18_24",
  "25_34",
  "35_44",
  "45_54",
  "55_plus",
  "all",
] as const;

export const GENDER_IDS = ["male", "female", "all"] as const;

export const INCOME_LEVEL_IDS = [
  "budget",
  "mid",
  "premium",
  "luxury",
  "mixed",
] as const;

export const CHANNEL_IDS = [
  "facebook",
  "instagram",
  "tiktok",
  "whatsapp",
  "physical",
  "website",
  "other",
] as const;

export const WEEK_DAYS = [
  "sat",
  "sun",
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
] as const;

// ─── assets ─────────────────────────────────────────────────────────────────
export const assetSchema = z.object({
  id: id.default(() => Math.random().toString(36).slice(2, 10)),
  url: z.string().min(1, "رابط الصورة مطلوب"),
  key: z.string().max(250).optional(),
  alt: optText(160),
});
export type OnboardingAsset = z.output<typeof assetSchema>;

// ─── product schema ─────────────────────────────────────────────────────────
export const optionValueSchema = z.object({
  id,
  label: reqText(1, 40, "اسم القيمة مطلوب"),
});

export const optionSchema = z.object({
  id,
  name: reqText(1, 40, "اسم الخيار مطلوب"),
  kind: z.enum(["color", "size", "custom"]).default("custom"),
  values: z.array(optionValueSchema).default([]),
});

export const variantSchema = z.object({
  key: z.record(z.string(), z.string()),
  priceEgp: egp.nullable().default(null),
  stock: stockNum.default(null),
  available: z.boolean().default(true),
  imageIds: z.array(z.string()).default([]),
});

export const productSchema = z
  .object({
    id: id.default(() => Math.random().toString(36).slice(2, 10)),
    name: reqText(1, 120, "اسم المنتج مطلوب"),
    sectionId: z.string().optional(),
    categoryName: optText(60),
    priceEgp: egp,
    compareAtEgp: egp.optional(),
    description: optText(3000),
    aiDraft: z.boolean().default(true),
    images: z.array(assetSchema).default([]),
    primaryImageId: z.string().optional().default(""),
    options: z.array(optionSchema).default([]),
    variants: z.array(variantSchema).default([]),
    attributes: z
      .array(z.object({ label: z.string(), value: z.string() }))
      .default([]),
    stock: stockNum.default(20),
    bestSeller: z.boolean().default(false),
    isSpotlight: z.boolean().default(false),
    /** import source — للمنتجات المستوردة من المكتبة */
    librarySourceId: z.string().optional(),
  })
  .transform((p) => {
    const firstImg = p.images[0];
    const primary =
      p.primaryImageId && p.images.some((i) => i.id === p.primaryImageId)
        ? p.primaryImageId
        : firstImg?.id ?? "";
    return { ...p, primaryImageId: primary };
  });

export type OnboardingProduct = z.output<typeof productSchema>;

export const sectionSchema = z.object({
  id: id.default(() => Math.random().toString(36).slice(2, 10)),
  name: reqText(1, 60, "اسم القسم مطلوب"),
});
export type OnboardingSection = z.output<typeof sectionSchema>;

// ─── Store Step (مُوسَّع بـ 8 حقول جديدة) ───────────────────────────────────
export const storeStepSchema = z.object({
  // الأساسي (كان موجوداً)
  storeName: reqText(1, 80, "اسم متجرك مطلوب"),
  ownerName: optText(80),
  industry: z.enum(INDUSTRY_IDS).catch("other").default("fashion"),
  desiredSubdomain: z
    .preprocess(
      (v) => {
        const s =
          typeof v === "string"
            ? v.trim().toLowerCase().replace(/[^a-z0-9-]/g, "")
            : "";
        return s || "mystore";
      },
      z
        .string()
        .min(2, "الرابط حرفين على الأقل")
        .max(40)
        .regex(/^[a-z0-9]/, "يجب أن يبدأ بحرف أو رقم")
    )
    .default("mystore"),
  phone: phoneReq,
  whatsapp: phoneOpt,
  email: z.preprocess(
    emptyToUndef,
    z.string().email("بريد إلكتروني غير صحيح").optional()
  ),
  logo: assetSchema.optional(),

  // جديد: المؤسس
  founderName: optText(80),
  founderTitle: optText(80),

  // جديد: قنوات البيع الحالية
  currentChannels: z.array(z.enum(CHANNEL_IDS)).max(7).default([]),

  // جديد: حسابات التواصل الاجتماعي
  facebookPageUrl: z.preprocess(
    emptyToUndef,
    z.string().url("رابط فيسبوك غير صحيح").max(300).optional()
  ),
  instagramHandle: z
    .preprocess(
      (v) => (typeof v === "string" ? v.trim().replace(/^@+/, "") : v),
      z.string().max(80).optional()
    )
    .optional(),
  tiktokHandle: z
    .preprocess(
      (v) => (typeof v === "string" ? v.trim().replace(/^@+/, "") : v),
      z.string().max(80).optional()
    )
    .optional(),

  // جديد: دومين مخصص (اختياري)
  customDomain: z.preprocess(
    emptyToUndef,
    z
      .string()
      .max(253)
      .regex(/^([a-z0-9-]+\.)+[a-z]{2,}$/i, "دومين غير صحيح")
      .optional()
  ),

  // جديد: أوقات العمل
  workingHours: z
    .object({
      days: z.array(z.enum(WEEK_DAYS)).max(7).default(["sat", "sun", "mon", "tue", "wed", "thu"]),
      from: z.string().regex(/^\d{2}:\d{2}$/).default("10:00"),
      to: z.string().regex(/^\d{2}:\d{2}$/).default("22:00"),
    })
    .default({}),
});

// ─── Products Step ──────────────────────────────────────────────────────────
export const productsStepSchema = z
  .object({
    sections: z.array(sectionSchema).max(20).default([]),
    products: z.array(productSchema).max(50).default([]),
  })
  .refine((v) => v.products.length >= 1, {
    message: "أضف منتجاً واحداً على الأقل لمتجرك",
    path: ["products"],
  });

export type ProductsStepValue = z.output<typeof productsStepSchema>;

// ─── Audience (جمهور مستهدف) ────────────────────────────────────────────────
export const audienceSchema = z
  .object({
    ageRange: z.enum(AGE_RANGE_IDS).default("all"),
    gender: z.enum(GENDER_IDS).default("all"),
    incomeLevel: z.enum(INCOME_LEVEL_IDS).default("mixed"),
    location: z.array(z.string().max(40)).max(27).default([]),
    interests: z.array(z.string().max(40)).max(10).default([]),
  })
  .default({});

// ─── Competitor ─────────────────────────────────────────────────────────────
export const competitorSchema = z.object({
  name: reqText(1, 80),
  url: z.preprocess(
    emptyToUndef,
    z.string().url("رابط المنافس غير صحيح").max(300).optional()
  ),
  strength: optText(200),
  weakness: optText(200),
});

// ─── Premium Features (كان موجوداً) ─────────────────────────────────────────
export const premiumFeaturesSchema = z.object({
  marqueeBanner: z.boolean().default(true),
  countdownOffer: z.boolean().default(true),
  bundleOffer: z.boolean().default(false),
  exitIntentDiscount: z.boolean().default(true),
  lowStockAlert: z.boolean().default(true),
  stickyAddToCart: z.boolean().default(true),
  directExpressBuy: z.boolean().default(true),
  freeShippingBar: z.boolean().default(true),
  trustBadges: z.boolean().default(true),
  inspectionBadge: z.boolean().default(true),
  socialProofToasts: z.boolean().default(true),
  customerVoiceReviews: z.boolean().default(true),
  whatsappDirectChat: z.boolean().default(true),
  shippingCalculator: z.boolean().default(true),
  fourteenDaysReturnBadge: z.boolean().default(true),
  brandStory: z.boolean().default(true),
  faqSection: z.boolean().default(true),
  whyChooseUs: z.boolean().default(true),
  specsTable: z.boolean().default(true),
  videoEmbeds: z.boolean().default(true),
  imageZoomLightbox: z.boolean().default(true),
  frequentlyBoughtTogether: z.boolean().default(true),
});

// ─── Shipping Zone ──────────────────────────────────────────────────────────
export const zoneSchema = z.object({
  governorate: z.string().min(1).max(50),
  feeEgp: z.coerce.number().min(0).max(5_000).default(55),
  etaMinDays: z.coerce.number().int().min(0).max(30).default(2),
  etaMaxDays: z.coerce.number().int().min(0).max(30).default(4),
  /** محافظة لا يشحن إليها المتجر تُخفى من صفحة الدفع. */
  active: z.boolean().default(true),
});

export const RETURN_SHIPPING_PAYER_IDS = ["customer", "store", "store_if_defect"] as const;
export type ShippingZone = z.output<typeof zoneSchema>;

// ─── Launch Step (مُوسَّع بـ 11 حقل جديد) ──────────────────────────────────
export const launchStepSchema = z.object({
  // الدفع
  codEnabled: z.boolean().default(true),
  prepaidEnabled: z.boolean().default(false),
  vodafoneCashEnabled: z.boolean().default(false),
  vodafoneCash: phoneOpt,
  instapayEnabled: z.boolean().default(false),
  instapayAddress: optText(80),

  // الشحن
  shippingMode: z.enum(["flat", "free", "zones"]).default("flat"),
  flatFeeEgp: z.coerce.number().min(0).max(5_000).default(55),
  freeOverEgp: z.coerce.number().min(0).max(100_000).optional(),
  deliveryEta: optText(80).default("من 2 إلى 4 أيام عمل"),
  shipsAllEgypt: z.boolean().default(true),
  zones: z.array(zoneSchema).max(30).default([]),

  // المعاينة
  inspectionAllowed: z.boolean().default(true),
  inspectionPolicyText: optText(700).default(
    "المعاينة وفحص المنتج متاحة بالكامل مع مندوب التوصيل قبل سداد المبلغ."
  ),
  returnDays: z.coerce.number().int().min(0).max(60).default(14),
  returnConditions: optText(600).default(
    "متاح استبدال أو استرجاع المنتج خلال 14 يوماً من الاستلام بشرط سلامة المنتج."
  ),
  // سياسة الاستبدال بالتفصيل (تُولَّد منها صفحة السياسة كما يطبقها التاجر حرفياً).
  allowExchange: z.boolean().default(true),
  allowRefund: z.boolean().default(true),
  returnShippingPaidBy: z.enum(RETURN_SHIPPING_PAYER_IDS).default("store_if_defect"),
  refundDays: z.coerce.number().int().min(1).max(30).default(7),
  returnConditionsList: z.array(z.string().max(160)).max(8).default([]),
  nonReturnable: optText(300),
  defectPolicy: z.enum(["replace_or_refund", "replace", "refund", "case_by_case", "none"]).catch("replace_or_refund").default("replace_or_refund"),
  defectReportHours: z.coerce.number().int().min(12).max(720).catch(48).default(48),
  defectShippingByStore: z.boolean().default(true),
  // رسوم إضافية على الدفع عند الاستلام (تحصّلها شركات الشحن غالباً).
  codFeeEgp: z.coerce.number().min(0).max(500).default(0),
  // الاستلام من مقر المتجر.
  pickupEnabled: z.boolean().default(false),
  pickupAddress: optText(200),

  // الهوية
  autoTheme: z.boolean().default(true),
  // الحركة: auto = يختارها المدير الفني حسب المتجر.
  motionStyle: z.enum(["auto", "calm", "lively", "cinematic"]).catch("auto").default("auto"),
  depth3d: z.boolean().catch(true).default(true),
  colorPreference: optText(300),
  colorInspirationImage: assetSchema.optional(),

  // تخصيص Blueprint
  marketingBudget: z.enum(MARKETING_BUDGET_IDS).default("none"),
  targetAudience: optText(400),
  competitors: optText(400),
  brandVision: optText(700),
  brandPersonality: z.array(z.string().max(30)).max(8).default([]),
  toneOfVoice: z.enum(TONE_IDS).default("friendly_egyptian"),
  preferredLayoutStyle: z.enum(LAYOUT_STYLE_IDS).default("modern"),
  preferredCardStyle: z.enum(CARD_STYLE_IDS).default("elevated"),
  preferredMotionLevel: z.enum(MOTION_LEVEL_IDS).default("balanced"),
  preferredFonts: z.array(z.string().max(40)).max(4).default([]),
  seoKeywordsHint: optText(400),

  // جديد
  expectedOrdersMonthly: z.coerce.number().int().min(0).max(100_000).default(0),
  deliveryExpectedDays: z
    .object({
      min: z.coerce.number().int().min(0).max(30).default(2),
      max: z.coerce.number().int().min(0).max(30).default(4),
    })
    .default({}),
  inspirationImages: z.array(assetSchema).max(6).default([]),
  brandColorText: optText(200),
  discountCodesAvailable: z.array(z.string().max(20)).max(10).default([]),
  paymentPreferences: z
    .array(z.enum(["cod", "vodafone_cash", "instapay"]))
    .max(3)
    .default(["cod"]),

  // الميزات
  features: premiumFeaturesSchema.default({}),
  prepaidOnly: z.boolean().default(false),
  founderStory: optText(1500),
  acceptedTerms: z.boolean().default(true),
});

export type LaunchStepValue = z.output<typeof launchStepSchema>;

// ─── Audience Step (جديد) ───────────────────────────────────────────────────
export const audienceStepSchema = z
  .object({
    audience: audienceSchema,
    competitors: z.array(competitorSchema).max(5).default([]),
    usp: optText(300),
  })
  .refine(
    (v) => v.competitors.every((c, i, arr) => arr.findIndex((x) => x.name.toLowerCase() === c.name.toLowerCase()) === i),
    {
      message: "لا يمكن تكرار نفس المنافس",
      path: ["competitors"],
    }
  );

export type AudienceStepValue = z.output<typeof audienceStepSchema>;

// ─── Adaptive Answers (جديد) ────────────────────────────────────────────────
// تخزين حر (key-value) لأن الأسئلة ديناميكية حسب الفئة.
export const adaptiveAnswersSchema = z
  .record(z.string().max(60), z.union([z.string().max(2000), z.array(z.string().max(200)).max(20)]))
  .default({});

// ─── Review Step ────────────────────────────────────────────────────────────
export const reviewStepSchema = z.object({
  accepted: z.boolean().default(false),
});

export type ReviewStepValue = z.output<typeof reviewStepSchema>;

// ─── Submission النهائي ─────────────────────────────────────────────────────
export const onboardingSubmissionSchema = z.object({
  schemaVersion: z.coerce.number().int().default(4),
  store: storeStepSchema,
  products: productsStepSchema,
  launch: launchStepSchema,
  audience: audienceStepSchema.optional(),
  adaptive: adaptiveAnswersSchema,
});

export type OnboardingSubmission = z.output<typeof onboardingSubmissionSchema>;

// ─── Steps ──────────────────────────────────────────────────────────────────
export const STEP_ORDER = [
  "store",
  "audience",
  "products",
  "launch",
  "review",
] as const;
export type StepId = (typeof STEP_ORDER)[number];

export const STEP_SCHEMAS = {
  store: storeStepSchema,
  audience: audienceStepSchema,
  products: productsStepSchema,
  launch: launchStepSchema,
  review: reviewStepSchema,
} as const;

// ─── Draft ──────────────────────────────────────────────────────────────────
export const onboardingDraftSchema = z.object({
  draftVersion: z.number().int().min(0),
  step: z.enum(STEP_ORDER).optional(),
  data: z.record(z.string(), z.unknown()),
});

export const DRAFT_MAX_BYTES = 1_200_000;