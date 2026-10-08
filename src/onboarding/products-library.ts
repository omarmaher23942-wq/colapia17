// onboarding/products-library.ts — مكتبة +120 منتج جاهز في 12 فئة.
//
// السبب الجذري:
// تاجر جديد يفتح الاستمارة بدون منتجات → ترك الاستمارة → 30 دقيقة ضائعة.
// المكتبة تجعله يختار 5-10 منتجات جاهزة بضغطة، يعدّل الأسعار، ويمشي.
//
// المبادئ:
//  - البيانات نظيفة ومطابقة للسوق المصري.
//  - كل منتج له: اسم، وصف مختصر، سعر مقترح، هامش، ألوان، مقاسات.
//  - الصور روابط picsum.photos placeholder (التاجر يستبدلها لاحقاً).
//  - البنية مطابقة لـ OnboardingProduct (importable مباشرة).
import type { IndustryId, OnboardingAsset, OnboardingProduct } from "./schema";

// ─── أنواع البيانات الداخلية (مبسّطة للتحرير) ─────────────────────────────
type LibraryProduct = {
  id: string;
  name: string;
  shortDescription: string;
  priceEgp: number;
  compareAtEgp?: number;
  colors?: Array<{ name: string; hex: string }>;
  sizes?: string[];
  attributes?: Array<{ label: string; value: string }>;
  keywords: string[];
};

type LibraryCategory = {
  industry: IndustryId;
  label: string;
  icon: string;
  products: LibraryProduct[];
};

function uid() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID().slice(0, 10)
    : Math.random().toString(36).slice(2, 12);
}

// ─── المكتبة ────────────────────────────────────────────────────────────────
export const PRODUCTS_LIBRARY: LibraryCategory[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // 1. فساتين نسائية
  // ═══════════════════════════════════════════════════════════════════════════
  {
    industry: "fashion",
    label: "فساتين وأزياء نسائية",
    icon: "dress",
    products: [
      {
        id: "dress_linen_summer",
        name: "فستان صيفي كتان بأزرار أمامية",
        shortDescription:
          "خامة كتان طبيعي 100%، مريح ومثالي لأجواء الصيف مع تصميم عصري.",
        priceEgp: 450,
        compareAtEgp: 599,
        colors: [
          { name: "أبيض", hex: "#f8f7f3" },
          { name: "بيج", hex: "#d6c7a1" },
          { name: "كحلي", hex: "#1e3a8a" },
          { name: "زيتي", hex: "#556b2f" },
        ],
        sizes: ["S", "M", "L", "XL"],
        attributes: [
          { label: "الخامة", value: "كتان 100%" },
          { label: "الطول", value: "ميدي" },
          { label: "الأكمام", value: "قصيرة" },
          { label: "الغسيل", value: "يدوي بماء بارد" },
        ],
        keywords: ["فستان صيفي", "كتان", "فساتين نسائية", "مودرن"],
      },
      {
        id: "dress_black_evening",
        name: "فستان سواريه أسود مطرز",
        shortDescription:
          "فستان سواريه أنيق بتفاصيل مطرزة بالخرز، مثالي للمناسبات المسائية.",
        priceEgp: 899,
        compareAtEgp: 1299,
        colors: [
          { name: "أسود", hex: "#111111" },
          { name: "عنابي", hex: "#7f1d1d" },
          { name: "كحلي", hex: "#1e3a8a" },
        ],
        sizes: ["S", "M", "L", "XL"],
        attributes: [
          { label: "الخامة", value: "شيفون مبطن" },
          { label: "الطول", value: "طويل" },
          { label: "الإكسسوار", value: "خرز يدوي" },
        ],
        keywords: ["فستان سواريه", "فساتين مناسبات", "فستان أسود"],
      },
      {
        id: "dress_floral_casual",
        name: "فستان كاجوال مشجر بأزرار",
        shortDescription:
          "فستان يومي بخامة قطنية ناعمة وطبعة زهور راقية، مريح لكل يوم.",
        priceEgp: 320,
        compareAtEgp: 420,
        colors: [
          { name: "وردي", hex: "#ec4899" },
          { name: "سماوي", hex: "#0ea5e9" },
          { name: "أصفر", hex: "#eab308" },
        ],
        sizes: ["S", "M", "L", "XL"],
        attributes: [{ label: "الخامة", value: "قطن مبطن" }],
        keywords: ["فستان كاجوال", "فستان مشجر", "ملابس نسائية"],
      },
      {
        id: "abaya_modern",
        name: "عباية مودرن بتفاصيل مطرزة",
        shortDescription:
          "عباية عصرية بقصّة مريحة وتطريز أنيق على الأكمام، مناسبة للعمل والمناسبات.",
        priceEgp: 650,
        compareAtEgp: 850,
        colors: [
          { name: "أسود", hex: "#111111" },
          { name: "كحلي", hex: "#1e3a8a" },
          { name: "بيج", hex: "#d6c7a1" },
        ],
        sizes: ["S", "M", "L", "XL", "2XL"],
        attributes: [
          { label: "الخامة", value: "كريب" },
          { label: "الطول", value: "طويل" },
          { label: "الإكسسوار", value: "تطريز ذهبي" },
        ],
        keywords: ["عباية", "عبايات مودرن", "عباية مطرزة"],
      },
      {
        id: "scarf_silk",
        name: "طرح حرير طبيعي مطبوعة",
        shortDescription:
          "طرح حرير طبيعي بألوان ثابتة وطبعة فنية أنيقة، حجم كبير يلائم كل التنسيقات.",
        priceEgp: 180,
        compareAtEgp: 250,
        colors: [
          { name: "وردي", hex: "#ec4899" },
          { name: "كحلي", hex: "#1e3a8a" },
          { name: "أخضر", hex: "#166534" },
          { name: "بيج", hex: "#d6c7a1" },
        ],
        attributes: [
          { label: "الخامة", value: "حرير طبيعي" },
          { label: "المقاس", value: "180×70 سم" },
        ],
        keywords: ["طرح", "حرير", "طرح نسائية"],
      },
      {
        id: "blouse_satin",
        name: "بلوزة ساتان بأكمام واسعة",
        shortDescription:
          "بلوزة ساتان لامعة بقصة أنيقة وأكمام واسعة، تناسب العمل والمناسبات.",
        priceEgp: 280,
        compareAtEgp: 380,
        colors: [
          { name: "أبيض", hex: "#f8f7f3" },
          { name: "بيج", hex: "#d6c7a1" },
          { name: "أسود", hex: "#111111" },
          { name: "زيتي", hex: "#556b2f" },
        ],
        sizes: ["S", "M", "L", "XL"],
        attributes: [{ label: "الخامة", value: "ساتان" }],
        keywords: ["بلوزة ساتان", "بلوزات نسائية"],
      },
      {
        id: "skirt_pleated",
        name: "جيبة بليسيه ميدي",
        shortDescription:
          "جيبة بليسيه بخامة خفيفة، تطول بمقاس ميدي أنيق مع حزام مطاطي مريح.",
        priceEgp: 240,
        compareAtEgp: 320,
        colors: [
          { name: "أسود", hex: "#111111" },
          { name: "كحلي", hex: "#1e3a8a" },
          { name: "بيج", hex: "#d6c7a1" },
        ],
        sizes: ["S", "M", "L", "XL"],
        attributes: [
          { label: "الخامة", value: "بوليستر مبطّن" },
          { label: "الطول", value: "ميدي" },
        ],
        keywords: ["جيبة بليسيه", "جيبة ميدي"],
      },
      {
        id: "pants_wide_leg",
        name: "بنطلون واسع بقصة كارجو",
        shortDescription:
          "بنطلون واسع بتصميم كارجو عصري، خامة متينة ومريحة.",
        priceEgp: 380,
        compareAtEgp: 480,
        colors: [
          { name: "بيج", hex: "#d6c7a1" },
          { name: "كاكي", hex: "#a3a380" },
          { name: "أسود", hex: "#111111" },
        ],
        sizes: ["S", "M", "L", "XL"],
        keywords: ["بنطلون واسع", "بنطلون كارجو"],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. عطور ومكياج
  // ═══════════════════════════════════════════════════════════════════════════
  {
    industry: "beauty",
    label: "عطور ومكياج",
    icon: "sparkles",
    products: [
      {
        id: "perfume_oud_royal",
        name: "عطر عود ملكي 100 مل",
        shortDescription:
          "عطر شرقي فخم بمزيج من العود والمسك والعنبر، ثبات يصل إلى 12 ساعة.",
        priceEgp: 850,
        compareAtEgp: 1200,
        attributes: [
          { label: "الحجم", value: "100 مل" },
          { label: "النوع", value: "شرقي" },
          { label: "الثبات", value: "10-12 ساعة" },
          { label: "الفوحان", value: "قوي" },
        ],
        keywords: ["عطر عود", "عطور شرقية", "عطر رجالي"],
      },
      {
        id: "perfume_rose_feminine",
        name: "عطر ورد نسائي فرنسي 50 مل",
        shortDescription:
          "عطر نسائي راقٍ بمزيج من الورد الدمشقي والفواكه الاستوائية.",
        priceEgp: 620,
        compareAtEgp: 899,
        attributes: [
          { label: "الحجم", value: "50 مل" },
          { label: "النوع", value: "زهري فواكه" },
          { label: "الثبات", value: "8 ساعات" },
        ],
        keywords: ["عطر ورد", "عطر نسائي", "عطور فرنسية"],
      },
      {
        id: "perfume_musk_white",
        name: "عطر مسك أبيض 50 مل",
        shortDescription:
          "عطر مسك ناعم بإحساس نظيف وأنيق، مثالي للاستخدام اليومي.",
        priceEgp: 320,
        attributes: [
          { label: "الحجم", value: "50 مل" },
          { label: "النوع", value: "مسك" },
        ],
        keywords: ["عطر مسك", "مسك أبيض"],
      },
      {
        id: "body_splash_fruit",
        name: "بادي سبلاش فواكه منعش",
        shortDescription:
          "بادي سبلاش منعش برائحة الفواكه الاستوائية، مثالي للصيف.",
        priceEgp: 150,
        compareAtEgp: 220,
        attributes: [
          { label: "الحجم", value: "250 مل" },
          { label: "النوع", value: "فواكه" },
        ],
        keywords: ["بادي سبلاش", "معطر جسم"],
      },
      {
        id: "makeup_lipstick_matte",
        name: "أحمر شفاه مات ثابت",
        shortDescription:
          "أحمر شفاه مات بتركيبة طويلة الثبات ولا يجفف الشفايف.",
        priceEgp: 130,
        compareAtEgp: 180,
        colors: [
          { name: "أحمر", hex: "#dc2626" },
          { name: "وردي", hex: "#ec4899" },
          { name: "نود", hex: "#d4a574" },
          { name: "بني", hex: "#7c4a21" },
        ],
        keywords: ["أحمر شفاه", "ميك اب", "ليبستيك"],
      },
      {
        id: "makeup_mascara_volume",
        name: "ماسكرا فوليوم كثيفة",
        shortDescription:
          "ماسكرا تعطي كثافة فورية ولون أسود غامق بدون تكتل.",
        priceEgp: 180,
        compareAtEgp: 250,
        keywords: ["ماسكرا", "ميك اب عيون"],
      },
      {
        id: "skincare_serum_vitamin_c",
        name: "سيروم فيتامين سي 30 مل",
        shortDescription:
          "سيروم مركّز بفيتامين سي 20% لتفتيح وتوحيد لون البشرة.",
        priceEgp: 380,
        compareAtEgp: 550,
        attributes: [
          { label: "الحجم", value: "30 مل" },
          { label: "المكوّن النشط", value: "فيتامين C 20%" },
        ],
        keywords: ["سيروم", "فيتامين سي", "سكين كير"],
      },
      {
        id: "skincare_moisturizer_day",
        name: "كريم مرطب نهاري SPF 30",
        shortDescription:
          "مرطب نهاري خفيف بمعامل حماية 30 يناسب كل أنواع البشرة.",
        priceEgp: 280,
        compareAtEgp: 400,
        keywords: ["مرطب", "واقي شمس"],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. إلكترونيات وإكسسوارات
  // ═══════════════════════════════════════════════════════════════════════════
  {
    industry: "electronics",
    label: "إلكترونيات وإكسسوارات",
    icon: "smartphone",
    products: [
      {
        id: "earbuds_wireless_pro",
        name: "سماعات لاسلكية Pro بلوتوث 5.3",
        shortDescription:
          "سماعات لاسلكية بجودة صوت عالية وعزل ضوضاء نشط، بطارية تدوم 30 ساعة.",
        priceEgp: 480,
        compareAtEgp: 750,
        colors: [
          { name: "أسود", hex: "#111111" },
          { name: "أبيض", hex: "#f8f7f3" },
        ],
        attributes: [
          { label: "البلوتوث", value: "5.3" },
          { label: "البطارية", value: "30 ساعة" },
          { label: "عزل الضوضاء", value: "ANC" },
          { label: "الضمان", value: "سنة" },
        ],
        keywords: ["سماعات لاسلكية", "earbuds", "سماعات بلوتوث"],
      },
      {
        id: "powerbank_20000",
        name: "باور بانك 20000 مللي أمبير شحن سريع",
        shortDescription:
          "باور بانك بسعة كبيرة ومنفذين USB و USB-C بشحن سريع 22.5 واط.",
        priceEgp: 380,
        compareAtEgp: 550,
        attributes: [
          { label: "السعة", value: "20000 مللي أمبير" },
          { label: "الشحن السريع", value: "22.5 واط" },
          { label: "المنافذ", value: "USB-C + USB-A" },
        ],
        keywords: ["باور بانك", "شاحن متنقل"],
      },
      {
        id: "charger_fast_65w",
        name: "شاحن سريع GaN 65 واط متعدد المنافذ",
        shortDescription:
          "شاحن GaN خفيف الوزن 65 واط بثلاث منافذ لشحن الموبايل واللابتوب معاً.",
        priceEgp: 420,
        compareAtEgp: 600,
        attributes: [
          { label: "القوة", value: "65 واط" },
          { label: "التقنية", value: "GaN" },
          { label: "المنافذ", value: "2×USB-C + USB-A" },
        ],
        keywords: ["شاحن سريع", "شاحن GaN"],
      },
      {
        id: "phone_case_silicone",
        name: "جراب سيليكون ماغنيتك بملمس ناعم",
        shortDescription:
          "جراب سيليكون ماغنيتك بملمس حريري وحماية من الصدمات.",
        priceEgp: 120,
        compareAtEgp: 180,
        colors: [
          { name: "أسود", hex: "#111111" },
          { name: "أزرق", hex: "#2563eb" },
          { name: "بيج", hex: "#d6c7a1" },
          { name: "وردي", hex: "#ec4899" },
        ],
        keywords: ["جراب موبايل", "كفر"],
      },
      {
        id: "screen_protector_glass",
        name: "زجاج حماية شاشة مقاوم للخدش",
        shortDescription:
          "زجاج حماية 9H مقاوم للخدش والصدمات مع طبقة مضادة للبصمات.",
        priceEgp: 60,
        attributes: [
          { label: "الصلابة", value: "9H" },
          { label: "المميزات", value: "مضاد للبصمات" },
        ],
        keywords: ["زجاج حماية", "سكرين"],
      },
      {
        id: "smart_watch_fitness",
        name: "ساعة ذكية رياضية بشاشة AMOLED",
        shortDescription:
          "ساعة ذكية بمستشعرات نبض وأكسجين و100+ نمط رياضي، بطارية 7 أيام.",
        priceEgp: 850,
        compareAtEgp: 1200,
        colors: [
          { name: "أسود", hex: "#111111" },
          { name: "فضي", hex: "#c0c7d3" },
        ],
        attributes: [
          { label: "الشاشة", value: "AMOLED 1.43 بوصة" },
          { label: "البطارية", value: "7 أيام" },
          { label: "المقاومة", value: "IP68" },
        ],
        keywords: ["ساعة ذكية", "smart watch"],
      },
      {
        id: "usb_cable_braided",
        name: "كيبل USB-C مجدول سريع الشحن 2 متر",
        shortDescription:
          "كيبل شحن سريع مجدول بمادة نايلون متينة، يدعم حتى 100 واط.",
        priceEgp: 90,
        attributes: [
          { label: "الطول", value: "2 متر" },
          { label: "القوة", value: "100 واط" },
        ],
        keywords: ["كيبل شحن", "USB-C"],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. حلويات ومكسرات
  // ═══════════════════════════════════════════════════════════════════════════
  {
    industry: "food",
    label: "حلويات ومكسرات",
    icon: "utensils",
    products: [
      {
        id: "dates_medjool_premium",
        name: "تمر مجدول فاخر 1 كجم",
        shortDescription:
          "تمر مجدول فاخر طري وحلو المذاق، مغلف بعناية للحفاظ على الطزاجة.",
        priceEgp: 320,
        compareAtEgp: 420,
        attributes: [
          { label: "الوزن", value: "1 كجم" },
          { label: "المصدر", value: "مصر" },
          { label: "التغليف", value: "علبة هدية" },
        ],
        keywords: ["تمر مجدول", "بلح", "تمور"],
      },
      {
        id: "honey_natural_1kg",
        name: "عسل نحل طبيعي 100% - 1 كجم",
        shortDescription:
          "عسل نحل طبيعي خام غير معالج، غني بالعناصر الغذائية.",
        priceEgp: 280,
        compareAtEgp: 380,
        attributes: [
          { label: "الوزن", value: "1 كجم" },
          { label: "النوع", value: "زهور برية" },
          { label: "طبيعي", value: "100%" },
        ],
        keywords: ["عسل نحل", "عسل طبيعي"],
      },
      {
        id: "nuts_mixed_premium",
        name: "مكسرات مشكلة فاخرة 500 جم",
        shortDescription:
          "خليط من أجود المكسرات: لوز، كاجو، بندق، فستق محمص.",
        priceEgp: 420,
        compareAtEgp: 550,
        attributes: [
          { label: "الوزن", value: "500 جم" },
          { label: "التحميص", value: "طبيعي بدون زيت" },
        ],
        keywords: ["مكسرات مشكلة", "لوز", "كاجو"],
      },
      {
        id: "spices_kitchen_set",
        name: "طقم بهارات مطبخ كامل 12 نوع",
        shortDescription:
          "طقم بهارات مختارة بعناية، 12 نوع أساسي في علب زجاجية أنيقة.",
        priceEgp: 380,
        compareAtEgp: 520,
        attributes: [
          { label: "عدد الأنواع", value: "12 نوع" },
          { label: "التغليف", value: "برطمانات زجاج" },
        ],
        keywords: ["بهارات", "توابل", "طقم مطبخ"],
      },
      {
        id: "chocolate_gift_box",
        name: "علبة شوكولاتة فاخرة للمناسبات",
        shortDescription:
          "علبة شوكولاتة بلجيكية فاخرة بـ 24 قطعة متنوعة، تغليف هدية أنيق.",
        priceEgp: 550,
        compareAtEgp: 750,
        attributes: [
          { label: "العدد", value: "24 قطعة" },
          { label: "المصدر", value: "بلجيكي" },
          { label: "التغليف", value: "علبة هدية" },
        ],
        keywords: ["شوكولاتة", "هدايا", "شوكولاتة بلجيكية"],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. أدوات منزلية
  // ═══════════════════════════════════════════════════════════════════════════
  {
    industry: "home",
    label: "أدوات منزلية ومطبخ",
    icon: "home",
    products: [
      {
        id: "cookware_set_nonstick",
        name: "طقم حلل جرانيت 7 قطع",
        shortDescription:
          "طقم حلل جرانيت بملمس غير لاصق، يحافظ على الطعام ولا يحتاج زيت كثير.",
        priceEgp: 1250,
        compareAtEgp: 1800,
        attributes: [
          { label: "عدد القطع", value: "7 قطع" },
          { label: "المادة", value: "جرانيت" },
          { label: "مناسب لـ", value: "كل أنواع البوتاجاز" },
        ],
        keywords: ["طقم حلل", "حلل جرانيت", "أدوات مطبخ"],
      },
      {
        id: "knife_set_kitchen",
        name: "طقم سكاكين مطبخ ستانلس 6 قطع",
        shortDescription:
          "طقم سكاكين احترافي من الستانلس ستيل المقاوم للصدأ مع حامل خشبي.",
        priceEgp: 480,
        compareAtEgp: 650,
        attributes: [
          { label: "عدد القطع", value: "6 قطع + حامل" },
          { label: "المادة", value: "ستانلس ستيل" },
        ],
        keywords: ["طقم سكاكين", "سكاكين مطبخ"],
      },
      {
        id: "bedding_set_cotton",
        name: "طقم مفروشات قطن مطرز",
        shortDescription:
          "طقم مفروشات قطني عالي الجودة يتضمن: ملاءة، لحاف، 4 كيسات مخدة.",
        priceEgp: 950,
        compareAtEgp: 1350,
        colors: [
          { name: "أبيض", hex: "#f8f7f3" },
          { name: "بيج", hex: "#d6c7a1" },
          { name: "رمادي", hex: "#64748b" },
        ],
        attributes: [
          { label: "المقاس", value: "180×200" },
          { label: "المادة", value: "قطن 100%" },
        ],
        keywords: ["مفروشات", "أغطية سرير"],
      },
      {
        id: "organizer_storage_boxes",
        name: "طقم صناديق تخزين شفافة 4 قطع",
        shortDescription:
          "صناديق تخزين بلاستيكية شفافة بأحجام مختلفة لتنظيم المنزل.",
        priceEgp: 220,
        compareAtEgp: 320,
        attributes: [
          { label: "العدد", value: "4 قطع" },
          { label: "المادة", value: "بلاستيك عالي الجودة" },
        ],
        keywords: ["صناديق تخزين", "تنظيم منزل"],
      },
      {
        id: "vase_ceramic_decor",
        name: "فازة سيراميك ديكور أنيقة",
        shortDescription:
          "فازة سيراميك بتصميم عصري وألوان هادئة، مثالية لديكور الغرفة.",
        priceEgp: 180,
        compareAtEgp: 260,
        colors: [
          { name: "أبيض", hex: "#f8f7f3" },
          { name: "بيج", hex: "#d6c7a1" },
          { name: "أسود", hex: "#111111" },
        ],
        keywords: ["فازة", "ديكور", "سيراميك"],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. مستلزمات أطفال
  // ═══════════════════════════════════════════════════════════════════════════
  {
    industry: "kids",
    label: "مستلزمات أطفال",
    icon: "baby",
    products: [
      {
        id: "baby_clothes_set",
        name: "طقم ملابس أطفال قطن 5 قطع",
        shortDescription:
          "طقم ملابس أطفال من القطن الطبيعي الناعم، مريح للبشرة الحساسة.",
        priceEgp: 320,
        compareAtEgp: 450,
        colors: [
          { name: "أزرق", hex: "#0ea5e9" },
          { name: "وردي", hex: "#ec4899" },
          { name: "أخضر", hex: "#16a34a" },
        ],
        sizes: ["0-3 شهور", "3-6 شهور", "6-9 شهور", "9-12 شهر"],
        attributes: [
          { label: "عدد القطع", value: "5 قطع" },
          { label: "المادة", value: "قطن 100%" },
        ],
        keywords: ["ملابس أطفال", "طقم بيبي"],
      },
      {
        id: "toy_educational_blocks",
        name: "لعبة تعليمية مكعبات بناء 100 قطعة",
        shortDescription:
          "مكعبات بناء آمنة للأطفال تنمي المهارات الحركية والتفكير الإبداعي.",
        priceEgp: 280,
        compareAtEgp: 400,
        attributes: [
          { label: "العمر المناسب", value: "3-6 سنوات" },
          { label: "عدد القطع", value: "100 قطعة" },
          { label: "الأمان", value: "مواد غير سامة" },
        ],
        keywords: ["لعبة أطفال", "مكعبات", "لعبة تعليمية"],
      },
      {
        id: "stroller_lightweight",
        name: "عربية أطفال خفيفة الوزن قابلة للطي",
        shortDescription:
          "عربية أطفال عملية وخفيفة، تُطوى بضغطة واحدة وتناسب السفر.",
        priceEgp: 1850,
        compareAtEgp: 2500,
        colors: [
          { name: "أسود", hex: "#111111" },
          { name: "رمادي", hex: "#64748b" },
        ],
        attributes: [
          { label: "الوزن", value: "6.5 كجم" },
          { label: "الطي", value: "بيد واحدة" },
        ],
        keywords: ["عربية أطفال", "عربية بيبي"],
      },
      {
        id: "feeding_bottle_set",
        name: "طقم زجاجات رضاعة خالية من BPA",
        shortDescription:
          "طقم زجاجات رضاعة 3 أحجام بمواد آمنة وحلمات سيليكون ناعمة.",
        priceEgp: 240,
        compareAtEgp: 350,
        attributes: [
          { label: "عدد القطع", value: "3 زجاجات + 3 حلمات" },
          { label: "الأمان", value: "خالي من BPA" },
        ],
        keywords: ["زجاجة رضاعة", "مستلزمات بيبي"],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 7. إكسسوارات وساعات
  // ═══════════════════════════════════════════════════════════════════════════
  {
    industry: "accessories",
    label: "إكسسوارات وساعات",
    icon: "gem",
    products: [
      {
        id: "watch_classic_leather",
        name: "ساعة يد كلاسيك بحزام جلد طبيعي",
        shortDescription:
          "ساعة يد أنيقة بتصميم كلاسيكي وحزام جلد طبيعي، مثالية للمناسبات والعمل.",
        priceEgp: 850,
        compareAtEgp: 1200,
        colors: [
          { name: "بني", hex: "#7c4a21" },
          { name: "أسود", hex: "#111111" },
        ],
        attributes: [
          { label: "نوع الحركة", value: "كوارتز" },
          { label: "الحزام", value: "جلد طبيعي" },
          { label: "مقاومة الماء", value: "3 ATM" },
        ],
        keywords: ["ساعة يد", "ساعة جلد"],
      },
      {
        id: "bag_leather_tote",
        name: "شنطة توت جلد طبيعي بحجم كبير",
        shortDescription:
          "شنطة توت جلد طبيعي بتصميم عملي، تناسب العمل والخروج اليومي.",
        priceEgp: 1450,
        compareAtEgp: 2000,
        colors: [
          { name: "بني", hex: "#7c4a21" },
          { name: "أسود", hex: "#111111" },
          { name: "بيج", hex: "#d6c7a1" },
        ],
        attributes: [
          { label: "المادة", value: "جلد طبيعي" },
          { label: "الحجم", value: "كبير" },
        ],
        keywords: ["شنطة توت", "شنطة جلد"],
      },
      {
        id: "jewelry_gold_plated_set",
        name: "طقم إكسسوارات مطلي ذهب 5 قطع",
        shortDescription:
          "طقم إكسسوارات أنيق مطلي بالذهب: كوليه، حلق، غوايش.",
        priceEgp: 520,
        compareAtEgp: 750,
        attributes: [
          { label: "عدد القطع", value: "5 قطع" },
          { label: "الطلاء", value: "ذهب 18K" },
        ],
        keywords: ["إكسسوارات", "طقم ذهب"],
      },
      {
        id: "sunglasses_polarized",
        name: "نظارة شمسية بولارايزد UV400",
        shortDescription:
          "نظارة شمسية بعدسات بولارايزد وحماية UV400، إطار خفيف ومتين.",
        priceEgp: 380,
        compareAtEgp: 550,
        colors: [
          { name: "أسود", hex: "#111111" },
          { name: "بني", hex: "#7c4a21" },
        ],
        attributes: [
          { label: "الحماية", value: "UV400" },
          { label: "العدسات", value: "بولارايزد" },
        ],
        keywords: ["نظارة شمسية", "sunglasses"],
      },
      {
        id: "wallet_leather_men",
        name: "محفظة رجالي جلد طبيعي 12 كارت",
        shortDescription:
          "محفظة رجالي أنيقة بجلد طبيعي ومنظم لكروت البنك.",
        priceEgp: 320,
        compareAtEgp: 450,
        colors: [
          { name: "بني", hex: "#7c4a21" },
          { name: "أسود", hex: "#111111" },
        ],
        attributes: [
          { label: "المادة", value: "جلد طبيعي" },
          { label: "الفتحات", value: "12 كارت + كاش" },
        ],
        keywords: ["محفظة", "محفظة رجالي"],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 8. هدايا وتوزيعات
  // ═══════════════════════════════════════════════════════════════════════════
  {
    industry: "gifts",
    label: "هدايا وتوزيعات",
    icon: "gift",
    products: [
      {
        id: "gift_box_custom",
        name: "علبة هدايا مخصصة بالاسم",
        shortDescription:
          "علبة هدايا فاخرة يمكن تخصيصها بالاسم أو الرسالة المفضلة.",
        priceEgp: 320,
        compareAtEgp: 450,
        attributes: [
          { label: "التخصيص", value: "اسم أو رسالة" },
          { label: "التغليف", value: "علبة كرتون فاخرة" },
        ],
        keywords: ["علبة هدايا", "هدية مخصصة"],
      },
      {
        id: "bouquet_dried_flowers",
        name: "بوكيه ورد مجفف فاخر",
        shortDescription:
          "بوكيه ورد مجفف يبقى جميلاً لسنوات، مثالي لتزيين المنزل أو الإهداء.",
        priceEgp: 480,
        compareAtEgp: 650,
        attributes: [
          { label: "النوع", value: "ورد مجفف" },
          { label: "الحجم", value: "متوسط" },
        ],
        keywords: ["ورد مجفف", "بوكيه ورد"],
      },
      {
        id: "mug_custom_photo",
        name: "مج مخصص بصورة أو نص",
        shortDescription:
          "مج سيراميك عالي الجودة يمكن طباعة صورة أو نص عليه.",
        priceEgp: 150,
        attributes: [
          { label: "المادة", value: "سيراميك" },
          { label: "السعة", value: "350 مل" },
        ],
        keywords: ["مج مخصص", "مج سيراميك"],
      },
      {
        id: "candle_gift_set",
        name: "طقم شموع معطرة فاخر",
        shortDescription:
          "طقم شموع معطرة بروائح دافئة، مثالي للمنزل أو الإهداء.",
        priceEgp: 280,
        compareAtEgp: 400,
        attributes: [
          { label: "العدد", value: "3 شموع" },
          { label: "المدة", value: "40 ساعة/شمعة" },
        ],
        keywords: ["شموع معطرة", "هدية"],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 9. صحة ومكملات
  // ═══════════════════════════════════════════════════════════════════════════
  {
    industry: "health",
    label: "صحة ومكملات",
    icon: "heart-pulse",
    products: [
      {
        id: "supplement_vitamin_d3",
        name: "مكمل فيتامين D3 5000 IU",
        shortDescription:
          "كبسولات فيتامين D3 لتعزيز المناعة وصحة العظام.",
        priceEgp: 180,
        compareAtEgp: 250,
        attributes: [
          { label: "الجرعة", value: "5000 IU" },
          { label: "العدد", value: "60 كبسولة" },
        ],
        keywords: ["فيتامين د", "مكملات"],
      },
      {
        id: "supplement_omega3",
        name: "أوميغا 3 زيت السمك 1000 ملجم",
        shortDescription:
          "كبسولات أوميغا 3 عالية التركيز لدعم صحة القلب والدماغ.",
        priceEgp: 320,
        compareAtEgp: 450,
        attributes: [
          { label: "الجرعة", value: "1000 ملجم" },
          { label: "العدد", value: "90 كبسولة" },
        ],
        keywords: ["أوميغا 3", "زيت السمك"],
      },
      {
        id: "supplement_collagen",
        name: "كولاجين بودر للنضارة والبشرة",
        shortDescription:
          "كولاجين هيدروليزد بنكهة الفراولة، لدعم البشرة والشعر والأظافر.",
        priceEgp: 450,
        compareAtEgp: 650,
        attributes: [
          { label: "الوزن", value: "300 جم" },
          { label: "النكهة", value: "فراولة" },
        ],
        keywords: ["كولاجين", "نضارة البشرة"],
      },
      {
        id: "herbal_tea_mix",
        name: "شاي أعشاب للتخسيس 30 كيس",
        shortDescription:
          "خليط أعشاب طبيعية لدعم إنقاص الوزن وتحسين الهضم.",
        priceEgp: 150,
        compareAtEgp: 220,
        attributes: [
          { label: "العدد", value: "30 كيس" },
          { label: "المكونات", value: "100% طبيعية" },
        ],
        keywords: ["شاي أعشاب", "تخسيس"],
      },
    ],
  },
];

// ─── Helper: تحويل منتج مكتبة → OnboardingProduct ──────────────────────────
export function libraryProductToOnboardingProduct(
  lib: LibraryProduct,
  sectionId: string
): OnboardingProduct {
  const productId = uid();
  const primaryImage: OnboardingAsset = {
    id: uid(),
    url: `https://picsum.photos/seed/${lib.id}/900/900`,
    alt: lib.name,
  };

  const options: OnboardingProduct["options"] = [];
  const variants: OnboardingProduct["variants"] = [];

  // ألوان
  if (lib.colors && lib.colors.length > 0) {
    const colorOptId = uid();
    options.push({
      id: colorOptId,
      name: "اللون",
      kind: "color",
      values: lib.colors.map((c) => ({ id: uid(), label: c.name })),
    });
  }

  // مقاسات
  if (lib.sizes && lib.sizes.length > 0) {
    const sizeOptId = uid();
    options.push({
      id: sizeOptId,
      name: "المقاس",
      kind: "size",
      values: lib.sizes.map((s) => ({ id: uid(), label: s })),
    });
  }

  // بناء variants للتركيبات
  if (options.length > 0) {
    const colorOpt = options.find((o) => o.kind === "color");
    const sizeOpt = options.find((o) => o.kind === "size");

    if (colorOpt && sizeOpt) {
      for (const color of colorOpt.values) {
        for (const size of sizeOpt.values) {
          variants.push({
            key: { [colorOpt.id]: color.id, [sizeOpt.id]: size.id },
            priceEgp: lib.priceEgp,
            stock: 15,
            available: true,
            imageIds: [],
          });
        }
      }
    } else if (colorOpt) {
      for (const color of colorOpt.values) {
        variants.push({
          key: { [colorOpt.id]: color.id },
          priceEgp: lib.priceEgp,
          stock: 15,
          available: true,
          imageIds: [],
        });
      }
    } else if (sizeOpt) {
      for (const size of sizeOpt.values) {
        variants.push({
          key: { [sizeOpt.id]: size.id },
          priceEgp: lib.priceEgp,
          stock: 15,
          available: true,
          imageIds: [],
        });
      }
    }
  }

  return {
    id: productId,
    name: lib.name,
    sectionId,
    categoryName: undefined,
    priceEgp: lib.priceEgp,
    compareAtEgp: lib.compareAtEgp,
    description: `${lib.shortDescription}\n\n**المواصفات:**\n${
      (lib.attributes ?? [])
        .map((a) => `- ${a.label}: ${a.value}`)
        .join("\n") || "- جودة عالية"
    }\n\n**المعاينة قبل الدفع متاحة مع مندوب التوصيل.**`,
    aiDraft: true,
    images: [primaryImage],
    primaryImageId: primaryImage.id,
    options,
    variants,
    attributes: lib.attributes ?? [],
    stock: options.length > 0 ? null : 20,
    bestSeller: false,
    isSpotlight: false,
    librarySourceId: lib.id,
  };
}

export function getLibraryByIndustry(
  industry: IndustryId | undefined
): LibraryCategory | null {
  if (!industry) return null;
  return PRODUCTS_LIBRARY.find((c) => c.industry === industry) ?? null;
}

export type { LibraryProduct, LibraryCategory };