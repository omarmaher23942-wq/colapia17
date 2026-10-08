// onboarding/adaptive-questions.ts — الأسئلة المخصصة لكل فئة.
//
// السبب الجذري:
// الاستمارة القديمة كانت تسأل نفس 8 أسئلة لكل تاجر. بائع العطور ما كانش
// بيسأله عن نوع العطر (شرقي/غربي/زيتي)، ومدة الثبات، وحجم القارورة. النتيجة:
// Blueprint عام لا يميز متجر عطور عن متجر ملابس.
//
// الحل: كل فئة لها 5-8 أسئلة مخصصة تُعرض فقط لو اختار التاجر هذه الفئة.
// الإجابات تُخزَّن في launch.adaptiveAnswers وتُمرَّر للـ AI composer.
import type { IndustryId } from "./schema";

export type AdaptiveQuestionKind =
  | "text"
  | "textarea"
  | "single_choice"
  | "multi_choice"
  | "number";

export type AdaptiveQuestion = {
  key: string;
  label: string;
  hint?: string;
  kind: AdaptiveQuestionKind;
  required?: boolean;
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
  min?: number;
  max?: number;
};

export const ADAPTIVE_QUESTIONS: Record<IndustryId, AdaptiveQuestion[]> = {
  // ─── أزياء ───────────────────────────────────────────────────────────────
  fashion: [
    {
      key: "fashion_types",
      label: "أنواع الملابس اللي بتبيعها",
      kind: "multi_choice",
      required: true,
      options: [
        { value: "dresses", label: "فساتين" },
        { value: "abayas", label: "عبايات وطرح" },
        { value: "casual", label: "ملابس كاجوال" },
        { value: "formal", label: "ملابس رسمية" },
        { value: "sportswear", label: "ملابس رياضية" },
        { value: "kids", label: "ملابس أطفال" },
        { value: "underwear", label: "ملابس داخلية" },
        { value: "shoes", label: "أحذية" },
        { value: "bags", label: "شنط" },
      ],
    },
    {
      key: "fashion_sizes",
      label: "المقاسات المتاحة",
      kind: "multi_choice",
      options: [
        { value: "xs", label: "XS" },
        { value: "s", label: "S" },
        { value: "m", label: "M" },
        { value: "l", label: "L" },
        { value: "xl", label: "XL" },
        { value: "2xl", label: "2XL" },
        { value: "3xl", label: "3XL" },
        { value: "plus", label: "مقاسات كبيرة" },
      ],
    },
    {
      key: "fashion_fabrics",
      label: "الخامات الرئيسية",
      kind: "multi_choice",
      options: [
        { value: "cotton", label: "قطن" },
        { value: "linen", label: "كتان" },
        { value: "silk", label: "حرير" },
        { value: "chiffon", label: "شيفون" },
        { value: "wool", label: "صوف" },
        { value: "denim", label: "جينز" },
        { value: "leather", label: "جلد" },
        { value: "mixed", label: "خامات مخلوطة" },
      ],
    },
    {
      key: "fashion_fits_culture",
      label: "هل فيه موديلات محتشمة / مستورة؟",
      kind: "single_choice",
      options: [
        { value: "yes_all", label: "أيوة، كل المنتجات محتشمة" },
        { value: "yes_some", label: "أيوة، جزء منها محتشم" },
        { value: "no", label: "لا، عادي" },
      ],
    },
  ],

  // ─── تجميل وعناية ──────────────────────────────────────────────────────
  beauty: [
    {
      key: "beauty_types",
      label: "أنواع المنتجات",
      kind: "multi_choice",
      required: true,
      options: [
        { value: "makeup", label: "ميك اب" },
        { value: "skincare", label: "سكين كير" },
        { value: "haircare", label: "العناية بالشعر" },
        { value: "perfume", label: "عطور" },
        { value: "natural", label: "منتجات طبيعية" },
        { value: "tools", label: "أدوات تجميل" },
      ],
    },
    {
      key: "beauty_origin",
      label: "المصدر",
      kind: "single_choice",
      options: [
        { value: "local", label: "مصنع محلي" },
        { value: "imported", label: "مستورد" },
        { value: "korean", label: "كوري" },
        { value: "european", label: "أوروبي" },
        { value: "mixed", label: "مختلط" },
      ],
    },
    {
      key: "beauty_certifications",
      label: "شهادات / اختبارات؟",
      kind: "multi_choice",
      options: [
        { value: "dermatologist", label: "مختبر من أطباء الجلدية" },
        { value: "cruelty_free", label: "لا يُختبر على الحيوانات" },
        { value: "organic", label: "مكونات عضوية" },
        { value: "halal", label: "حلال" },
        { value: "vegan", label: "نباتي" },
      ],
    },
    {
      key: "beauty_skin_types",
      label: "منتجات مخصصة لنوع بشرة معين؟",
      kind: "multi_choice",
      options: [
        { value: "oily", label: "بشرة دهنية" },
        { value: "dry", label: "بشرة جافة" },
        { value: "sensitive", label: "بشرة حساسة" },
        { value: "mixed", label: "بشرة مختلطة" },
        { value: "all", label: "لكل أنواع البشرة" },
      ],
    },
  ],

  // ─── إلكترونيات ─────────────────────────────────────────────────────────
  electronics: [
    {
      key: "electronics_types",
      label: "الفئات الرئيسية",
      kind: "multi_choice",
      required: true,
      options: [
        { value: "phones", label: "موبايلات" },
        { value: "laptops", label: "لابتوبات" },
        { value: "tablets", label: "تابلت" },
        { value: "headphones", label: "سماعات" },
        { value: "accessories", label: "إكسسوارات" },
        { value: "gaming", label: "ألعاب وفيديو جيمز" },
        { value: "cameras", label: "كاميرات" },
        { value: "smart_home", label: "أجهزة منزلية ذكية" },
      ],
    },
    {
      key: "electronics_origin",
      label: "بلد المنشأ",
      kind: "single_choice",
      options: [
        { value: "china", label: "صيني" },
        { value: "usa", label: "أمريكي" },
        { value: "korea", label: "كوري" },
        { value: "japan", label: "ياباني" },
        { value: "europe", label: "أوروبي" },
        { value: "mixed", label: "مختلط" },
      ],
    },
    {
      key: "electronics_warranty",
      label: "الضمان المتاح",
      kind: "single_choice",
      required: true,
      options: [
        { value: "none", label: "بدون ضمان" },
        { value: "3_months", label: "3 شهور" },
        { value: "6_months", label: "6 شهور" },
        { value: "1_year", label: "سنة" },
        { value: "2_years", label: "سنتين" },
      ],
    },
    {
      key: "electronics_condition",
      label: "حالة المنتجات",
      kind: "single_choice",
      options: [
        { value: "new", label: "جديد" },
        { value: "refurbished", label: "مجدد" },
        { value: "open_box", label: "Open Box" },
        { value: "mixed", label: "مختلط" },
      ],
    },
  ],

  // ─── أغذية ──────────────────────────────────────────────────────────────
  food: [
    {
      key: "food_types",
      label: "الأنواع",
      kind: "multi_choice",
      required: true,
      options: [
        { value: "sweets", label: "حلويات" },
        { value: "honey", label: "عسل ومنتجات النحل" },
        { value: "spices", label: "توابل وأعشاب" },
        { value: "nuts", label: "مكسرات" },
        { value: "dates", label: "تمور" },
        { value: "oils", label: "زيوت طبيعية" },
        { value: "dairy", label: "ألبان وأجبان" },
        { value: "snacks", label: "سناكس" },
      ],
    },
    {
      key: "food_packaging",
      label: "التغليف",
      kind: "single_choice",
      options: [
        { value: "vacuum", label: "فاكيوم" },
        { value: "box", label: "علب كرتون" },
        { value: "glass", label: "برطمان زجاج" },
        { value: "plastic", label: "عبوات بلاستيك" },
      ],
    },
    {
      key: "food_shelf_life",
      label: "مدة الصلاحية",
      kind: "single_choice",
      options: [
        { value: "1_week", label: "أسبوع" },
        { value: "1_month", label: "شهر" },
        { value: "6_months", label: "6 شهور" },
        { value: "1_year", label: "سنة" },
        { value: "longer", label: "أكثر من سنة" },
      ],
    },
    {
      key: "food_certifications",
      label: "شهادات جودة؟",
      kind: "multi_choice",
      options: [
        { value: "iso", label: "ISO" },
        { value: "haccp", label: "HACCP" },
        { value: "halal", label: "حلال" },
        { value: "organic", label: "عضوي" },
      ],
    },
  ],

  // ─── أدوات منزلية ──────────────────────────────────────────────────────
  home: [
    {
      key: "home_types",
      label: "الفئات",
      kind: "multi_choice",
      required: true,
      options: [
        { value: "kitchen", label: "أدوات مطبخ" },
        { value: "bedding", label: "مفروشات وأغطية" },
        { value: "decor", label: "ديكور وتحف" },
        { value: "lighting", label: "إضاءة" },
        { value: "storage", label: "تخزين وتنظيم" },
        { value: "cleaning", label: "أدوات تنظيف" },
        { value: "bathroom", label: "مستلزمات حمام" },
        { value: "furniture", label: "أثاث" },
      ],
    },
    {
      key: "home_material",
      label: "الخامات",
      kind: "multi_choice",
      options: [
        { value: "wood", label: "خشب" },
        { value: "metal", label: "معدن" },
        { value: "plastic", label: "بلاستيك" },
        { value: "glass", label: "زجاج" },
        { value: "ceramic", label: "سيراميك" },
        { value: "fabric", label: "أقمشة" },
      ],
    },
    {
      key: "home_style",
      label: "الستايل",
      kind: "single_choice",
      options: [
        { value: "modern", label: "مودرن" },
        { value: "classic", label: "كلاسيك" },
        { value: "bohemian", label: "بوهيمي" },
        { value: "minimal", label: "مينيمال" },
        { value: "mixed", label: "مختلط" },
      ],
    },
  ],

  // ─── أطفال ──────────────────────────────────────────────────────────────
  kids: [
    {
      key: "kids_age_groups",
      label: "الفئات العمرية",
      kind: "multi_choice",
      required: true,
      options: [
        { value: "newborn", label: "حديثي الولادة (0-3 شهور)" },
        { value: "infant", label: "رضع (3-12 شهر)" },
        { value: "toddler", label: "أطفال صغار (1-3 سنين)" },
        { value: "preschool", label: "ما قبل المدرسة (3-6)" },
        { value: "school", label: "سن المدرسة (6-12)" },
        { value: "teen", label: "مراهقين (12-16)" },
      ],
    },
    {
      key: "kids_types",
      label: "الأنواع",
      kind: "multi_choice",
      required: true,
      options: [
        { value: "clothes", label: "ملابس" },
        { value: "toys", label: "ألعاب" },
        { value: "strollers", label: "عربيات أطفال" },
        { value: "car_seats", label: "كراسي سيارة" },
        { value: "feeding", label: "مستلزمات رضاعة" },
        { value: "educational", label: "ألعاب تعليمية" },
        { value: "furniture", label: "أثاث أطفال" },
      ],
    },
    {
      key: "kids_safety",
      label: "معايير الأمان",
      kind: "multi_choice",
      options: [
        { value: "bpa_free", label: "خالي من BPA" },
        { value: "non_toxic", label: "مواد غير سامة" },
        { value: "certified", label: "معتمد من جهة دولية" },
        { value: "tested", label: "مختبر علمياً" },
      ],
    },
  ],

  // ─── إكسسوارات ─────────────────────────────────────────────────────────
  accessories: [
    {
      key: "acc_types",
      label: "الأنواع",
      kind: "multi_choice",
      required: true,
      options: [
        { value: "watches", label: "ساعات" },
        { value: "bags", label: "شنط ومحافظ" },
        { value: "jewelry", label: "مجوهرات وإكسسوارات" },
        { value: "sunglasses", label: "نظارات شمسية" },
        { value: "belts", label: "أحزمة" },
        { value: "scarves", label: "أوشحة وكوفيات" },
        { value: "hair", label: "إكسسوارات شعر" },
      ],
    },
    {
      key: "acc_material",
      label: "الخامات",
      kind: "multi_choice",
      options: [
        { value: "leather", label: "جلد طبيعي" },
        { value: "faux_leather", label: "جلد صناعي" },
        { value: "gold", label: "ذهب" },
        { value: "silver", label: "فضة" },
        { value: "steel", label: "ستانلس ستيل" },
        { value: "mixed", label: "مختلط" },
      ],
    },
    {
      key: "acc_authenticity",
      label: "منتجات أصلية؟",
      kind: "single_choice",
      options: [
        { value: "all_original", label: "أيوة، كلها أصلية" },
        { value: "inspired", label: "مستلهمة من ماركات" },
        { value: "local", label: "صناعة محلية" },
      ],
    },
  ],

  // ─── هدايا ─────────────────────────────────────────────────────────────
  gifts: [
    {
      key: "gift_occasions",
      label: "المناسبات",
      kind: "multi_choice",
      required: true,
      options: [
        { value: "birthdays", label: "أعياد ميلاد" },
        { value: "weddings", label: "أفراح وزفاف" },
        { value: "graduation", label: "تخرج" },
        { value: "ramadan", label: "رمضان" },
        { value: "eid", label: "عيد" },
        { value: "valentine", label: "فالنتاين" },
        { value: "mother_day", label: "عيد الأم" },
        { value: "corporate", label: "هدايا شركات" },
      ],
    },
    {
      key: "gift_wrapping",
      label: "التغليف",
      kind: "multi_choice",
      options: [
        { value: "box", label: "علبة هدية" },
        { value: "ribbon", label: "شريط" },
        { value: "card", label: "كارت إهداء" },
        { value: "custom", label: "تغليف مخصص" },
      ],
    },
    {
      key: "gift_personalization",
      label: "تخصيص؟",
      kind: "single_choice",
      options: [
        { value: "yes", label: "أيوة، نقش أو طباعة اسم" },
        { value: "no", label: "لا" },
      ],
    },
  ],

  // ─── صحة ───────────────────────────────────────────────────────────────
  health: [
    {
      key: "health_types",
      label: "الأنواع",
      kind: "multi_choice",
      required: true,
      options: [
        { value: "supplements", label: "مكملات غذائية" },
        { value: "vitamins", label: "فيتامينات" },
        { value: "herbal", label: "أعشاب" },
        { value: "medical_devices", label: "أجهزة طبية منزلية" },
        { value: "personal_care", label: "عناية شخصية" },
        { value: "sports", label: "تغذية رياضية" },
      ],
    },
    {
      key: "health_certifications",
      label: "شهادات",
      kind: "multi_choice",
      options: [
        { value: "fda", label: "FDA" },
        { value: "who", label: "WHO" },
        { value: "egypt_moh", label: "وزارة الصحة المصرية" },
        { value: "gmp", label: "GMP" },
        { value: "halal", label: "حلال" },
      ],
    },
    {
      key: "health_prescription",
      label: "تحتاج وصفة طبية؟",
      kind: "single_choice",
      options: [
        { value: "no", label: "لا، متاحة للجميع" },
        { value: "some", label: "بعض المنتجات نعم" },
        { value: "all", label: "كل المنتجات" },
      ],
    },
  ],

  // ─── عام ───────────────────────────────────────────────────────────────
  other: [
    {
      key: "other_description",
      label: "وصف نشاطك في جملة",
      kind: "textarea",
      required: true,
      placeholder: "مثال: ببيع منتجات يدوية مصنوعة من الراتنج والخشب.",
    },
    {
      key: "other_audience",
      label: "مين عميلك الأساسي؟",
      kind: "text",
      placeholder: "مثال: شباب من 20-30 سنة مهتمين بالديكور",
    },
  ],
};

export function getAdaptiveQuestions(
  industry: IndustryId | undefined
): AdaptiveQuestion[] {
  if (!industry) return [];
  return ADAPTIVE_QUESTIONS[industry] ?? ADAPTIVE_QUESTIONS.other;
}