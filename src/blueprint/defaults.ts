import { designSchema } from "./schema";
// blueprint/defaults.ts — بناء Blueprint افتراضي ذكي.
//
// التعديلات الجذرية:
//  1) استخراج palette من colorPreference عبر extractPalette (نص/بذرة).
//  2) اختيار fonts حسب المجال + المزاج عبر pickAdaptiveFonts.
//  3) variationSeed إلزامي — كل متجر مختلف.
//  4) announcement محذوف من الـ home الافتراضي (يأتي من AI composer فقط).
//  5) hero variant يُختار تلقائياً حسب السياق.
//  6) ambientBackdrop يُبنى من palette + seed.
import type { StoreBlueprint } from "./schema";
import { normalizeChannels, normalizePayments } from "./normalize";
import { extractPalette, pickAdaptiveFonts, buildVariationSeed } from "./palette";
import { deriveCorePalette } from "./core-palette";

const cap = (s: string, max: number) => (s.length > max ? s.slice(0, max) : s);

export const INSPECTION_BADGE = {
  icon: "package-open",
  title: "معاينة قبل الاستلام",
  text: "معاينة الشحنة مع المندوب قبل الدفع",
} as const;
export const INSPECTION_TRUST = {
  icon: "package-open",
  text: "معاينة قبل الاستلام",
} as const;
export const INSPECTION_COD_NOTE = "معاينة الشحنة مع المندوب قبل الدفع متاحة";

// «لماذا نحن»: شارات مرتبطة بحقائق المتجر فقط (blueprint/facts). النص يُستبدل عند العرض بصياغة الحقيقة نفسها،
// والشارة التي لا تسندها سياسة المتجر الآن تختفي. لا ادعاء ثابت هنا (لا «أصلي» ولا «ضمان الوكيل»).
const TRUST_FACTS: Array<{ fact: string; icon: string; title: string; text: string }> = [
  { fact: "cod", icon: "banknote", title: "الدفع عند الاستلام", text: "الدفع نقداً عند وصول الطلب" },
  { fact: "inspection", icon: "eye", title: "معاينة قبل الدفع", text: "فتح الشحنة وفحص المنتج قبل الدفع" },
  { fact: "returns", icon: "rotate-ccw", title: "استبدال واسترجاع", text: "وفق سياسة المتجر" },
  { fact: "free_shipping_over", icon: "gift", title: "شحن مجاني", text: "على الطلبات التي تبلغ حداً معيناً" },
  { fact: "nationwide", icon: "map-pin", title: "شحن لكل المحافظات", text: "التوصيل إلى باب المنزل" },
  { fact: "whatsapp", icon: "message-circle", title: "رد سريع على واتساب", text: "للاستفسار قبل الطلب وبعده" },
];

// أسئلة شائعة بصياغة محايدة؛ كل سؤال يخص سياسة يُحذف تلقائياً إن لم تعد صحيحة (groundedItems بوضع drop).
function buildDynamicFaqItems(ctx: { inspectionAllowed: boolean; hasWhatsapp: boolean; shippingEta: string }): Array<{ q: string; a: string }> {
  const base = [
    { q: "كيف أطلب؟", a: "باختيار المنتج ثم «إضافة للسلة» ثم إكمال بيانات الشحن، وسنتواصل لتأكيد الطلب." },
    { q: "ما مدة التوصيل؟", a: ctx.shippingEta || "من 2 إلى 5 أيام عمل حسب المحافظة." },
    { q: "هل الدفع عند الاستلام متاح؟", a: "نعم، الدفع عند الاستلام متاح." },
  ];
  if (ctx.inspectionAllowed) base.push({ q: "هل يمكن فتح الشحنة قبل الدفع؟", a: "نعم، المعاينة مع المندوب قبل الدفع متاحة: الفحص أولاً ثم الدفع." });
  if (ctx.hasWhatsapp) base.push({ q: "كيف أتواصل مع المتجر؟", a: "عبر واتساب في أي وقت، ونرد في أقرب فرصة." });
  base.push({ q: "ماذا لو لم يناسبني المنتج؟", a: "يمكن الاستبدال خلال 14 يوماً من الاستلام بشرط أن يكون المنتج بحالته الأصلية." });
  return base;
}

export function defaultBlueprint(input: {
  name: string;
  tagline?: string;
  industry?: string;
  messengerPageUsername?: string;
  instagramUsername?: string;
  facebookUrl?: string;
  email?: string;
  phone?: string;
  whatsappNumber?: string;
  vodafoneCash?: string;
  instapay?: string;
  inspectionAllowed?: boolean;
  colorPreference?: string;
  toneOfVoice?: string;
  storeId?: string;
  productCount?: number;
  hasHeroImages?: boolean;
  hasLogo?: boolean;
  variationSeed?: string;
}): StoreBlueprint {
  const name = cap(input.name.trim() || "متجري", 60);
  const tagline = cap(
    (input.tagline ?? "").trim() || "تسوقوا منتجاتنا بسهولة",
    120
  );
  const industry = cap((input.industry ?? "").trim() || "general", 60);
  const normalizedTone = (input.toneOfVoice ?? "friendly_egyptian").trim();
  const tone = [
    "friendly_egyptian",
    "premium_formal",
    "playful",
    "minimal",
  ].includes(normalizedTone)
    ? (normalizedTone as StoreBlueprint["brand"]["voice"])
    : "friendly_egyptian";
  const inspection = input.inspectionAllowed === true;

  const { channels } = normalizeChannels({
    messengerPageUsername: input.messengerPageUsername,
    instagramUsername: input.instagramUsername,
    facebookUrl: input.facebookUrl,
    email: input.email,
    phone: input.phone,
    whatsappNumber: input.whatsappNumber,
  });

  const { payments } = normalizePayments({
    cod: true,
    codNote: inspection ? INSPECTION_COD_NOTE : undefined,
    vodafoneCash: input.vodafoneCash,
    instapay: input.instapay,
    requireTransferProof: true,
    transferInstructions:
      "حوّلوا المبلغ إلى الرقم الظاهر، ثم ارفعوا صورة التحويل واكتبوا الرقم المحوَّل منه، وسنؤكد الطلب فوراً.",
  });

  // variationSeed: من المُدخل أو من hash(storeId + timestamp).
  const seed =
    input.variationSeed ??
    buildVariationSeed(input.storeId ?? name, Date.now());

  // استخراج palette + fonts.
  const extracted = extractPalette(input.colorPreference, industry, seed);
  // لوحة Core: لون العلامة وحده يشتق بقية الألوان بتباين AA، والوضع تلقائي (الداكن يتبع جهاز الزائر).
  const palette = deriveCorePalette(extracted.palette.primary, "light");
  const fonts = pickAdaptiveFonts(industry, tone, seed);

  // صف الثقة في صفحة المنتج يُبنى عند العرض من حقائق المتجر الفعلية (blueprint/facts.ts)، لا من هنا.
  const productTrustRow: { icon: string; text: string }[] = [];

  const faqItems = buildDynamicFaqItems({
    inspectionAllowed: inspection,
    hasWhatsapp: Boolean(channels.whatsappNumber),
    shippingEta: "من 2 إلى 5 أيام عمل حسب المحافظة.",
  });

  // الواجهة: صور مرفوعة → صورة جانبية (split)، وإلا منتج بطل تلقائي (يُختار من منتجات المتجر عند العرض).
  const heroVariant = input.hasHeroImages ? ("split" as const) : ("product_spotlight" as const);

  return {
    schemaVersion: 1,
    variationSeed: seed,
    brand: {
      name,
      tagline,
      description: cap(
        `${name}: تسوقوا أونلاين بسهولة وتابعوا طلبكم خطوة بخطوة.`,
        300
      ),
      voice: tone,
      industry,
    },
    design: designSchema.parse({}),
    copy: {},
    theme: {
      mode: "auto",
      palette,
      fonts,
      radius: "lg",
      buttonStyle: "solid",
      shadow: "soft",
      motion: "subtle",
      productCardStyle: "elevated",
      imageRatio: "square",
      backgroundPattern: "none",
      imageBackground: "none",
    },
    locale: { language: "ar", currency: "EGP", timezone: "Africa/Cairo" },
    header: {
      variant: "classic",
      sticky: true,
      transparentOnHero: false,
      showSearch: true,
      showCategoriesMenu: true,
      bottomBar: true,
      nav: [
        { label: "الرئيسية", target: { type: "home" } },
        { label: "كل المنتجات", target: { type: "all_products" } },
        { label: "تواصل معنا", target: { type: "contact" } },
      ],
    },
    footer: {
      variant: "rich",
      tagline: "",
      showPaymentIcons: true,
      showChannels: true,
      showPoweredBy: true,
    },
    channels,
    // الرئيسية: كل قسم يحتاج بيانات يختفي تلقائياً حتى توجد (الأقسام، الأكثر مبيعاً، الآراء). شريط الإعلانات صار في الرأس.
    home: [
      {
        id: "hero",
        type: "hero",
        enabled: true,
        spacing: "normal",
        background: "default",
        reveal: "fade",
        variant: heroVariant,
        enableParallax: false,
        enableKineticTypography: false,
        enableAmbientGlow: false,
        headline: cap(name, 90),
        subheadline: tagline || undefined,
        images: [],
        highlights: [],
        primaryCta: { label: "تسوقوا الآن", target: { type: "all_products" }, style: "primary" },
        overlayOpacity: 0.35,
        textAlign: "start",
        height: "tall",
        autoplayMs: 5000,
      },
      {
        id: "cats",
        type: "categories",
        enabled: true,
        spacing: "normal",
        background: "default",
        reveal: "fade",
        variant: "circles",
        title: "تسوقوا حسب القسم",
        categorySlugs: [],
        showProductCount: true,
      },
      {
        id: "new",
        type: "product_grid",
        enabled: true,
        spacing: "normal",
        background: "default",
        reveal: "fade",
        variant: "grid",
        title: "وصل حديثاً",
        source: { type: "newest" },
        limit: 8,
        columnsMobile: 2,
        columnsDesktop: 4,
        showViewAll: true,
        quickAdd: true,
      },
      {
        id: "best",
        type: "product_grid",
        enabled: true,
        spacing: "normal",
        background: "muted",
        reveal: "fade",
        variant: "carousel",
        title: "الأكثر مبيعاً",
        source: { type: "best_sellers" },
        limit: 10,
        columnsMobile: 2,
        columnsDesktop: 4,
        showViewAll: true,
        quickAdd: true,
      },
      {
        id: "trust",
        type: "trust_badges",
        enabled: true,
        spacing: "compact",
        background: "default",
        reveal: "fade",
        variant: "row",
        items: TRUST_FACTS.map((t) => ({ ...t })),
      },
      {
        id: "reviews",
        type: "testimonials",
        enabled: true,
        spacing: "normal",
        background: "default",
        reveal: "fade",
        variant: "carousel",
        title: "آراء العملاء",
        items: [],
        includeVerifiedReviews: true,
      },
      {
        id: "faq",
        type: "faq",
        enabled: true,
        spacing: "normal",
        background: "default",
        reveal: "fade",
        variant: "accordion",
        title: "أسئلة شائعة",
        items: faqItems,
      },
      {
        id: "contact",
        type: "contact",
        enabled: true,
        spacing: "normal",
        background: "muted",
        reveal: "fade",
        variant: "cards",
        title: "تواصلوا معنا",
        showChannels: true,
      },
    ],
    productPage: {
      layout: "gallery_left",
      showSku: false,
      showAttributesTable: true,
      showReviews: true,
      showShareButtons: true,
      extraSections: [],
    },
    conversion: {
      stickyAddToCart: true,
      buyNowButton: true,
      whatsappButton: true,
      freeShippingBar: { enabled: false, thresholdPiasters: 50000 },
      lowStockAlert: { enabled: true, threshold: 5 },
      socialProofToasts: {
        enabled: true,
        minOrdersToShow: 5,
        lookbackHours: 72,
      },
      liveViewers: false,
      exitIntentOffer: {
        enabled: false,
        title: "خصم خاص على الطلب الأول",
        text: "استخدموا الكود للحصول على خصم",
        showOncePerDays: 3,
      },
      productTrustRow,
      deliveryEstimate: true,
      recommendations: {
        frequentlyBoughtTogether: true,
        completeTheLook: true,
        recentlyViewed: true,
        cartUpsell: true,
      },
      expressCheckout: true,
      rememberCustomer: true,
      messengerOrderButton: true,
      showSavings: true,
      cartDrawer: true,
      shareButtons: true,
      // Conversion flags جديدة — تُفعّل حسب المزاج + الـ seed.
      ambientSound: false,
      cursorFollower: false,
      liveActivityBar: false,
      kineticTypography: false,
      viewTransitions: false,
      smartImageSequence: false,
      quickViewModal: true,
      stockPulseIndicator: false,
      product360Viewer: false,
      productARPreview: false,
      imageZoomLens: true,
      videoThumbs: true,
      multiLayerParallax: false,
      ambientBackdrop: false,
      scrollLinkedStory: false,
      comparisonBar: false,
      wishlistEnabled: true,
      voiceNavigation: false,
      aiSearch: true,
    },
    payments,
    shipping: {
      freeOverPiasters: null,
      flatRatePiasters: null,
      generalEta: "من 2 إلى 5 أيام عمل",
      pickupEnabled: false,
      inspectionAllowed: input.inspectionAllowed ?? true,
    },
    returns: {
      windowDays: 14,
      allowExchange: true,
      allowRefund: true,
      returnShippingPaidBy: "customer",
      refundDays: 7,
      conditions: [],
      defectPolicy: "replace_or_refund",
      defectReportHours: 48,
      defectShippingByStore: true,
    },
    checkout: {
      fields: {
        altPhone: "optional",
        city: "optional",
        landmark: "optional",
        notes: "optional",
        email: "hidden",
      },
      customFields: [],
      minOrderPiasters: null,
      termsCheckbox: false,
      successMessage: "شكراً لطلبكم! سنتواصل خلال ساعات للتأكيد.",
    },
    orderMessages: {
      confirmed: "أهلاً {name}، تم تأكيد طلبكم {code} بإجمالي {total}. موعد الوصول المتوقع: {eta}. شكراً لثقتكم في {store}.",
      shipped: "خرج طلبكم {code} مع شركة الشحن وسيصل قريباً. رقم الشحنة: {tracking}",
      delivered: "نتمنى أن يكون طلبكم {code} قد نال إعجابكم. يسعدنا تقييم التجربة: {review_link}",
      abandoned: "أهلاً {name}، لاحظنا أن {items} لا يزال في السلة. هل تحتاجون مساعدة لإتمام الطلب؟",
    },
    invoice: {
      showLogo: true,
      footerNote: "شكراً لتسوقكم معنا",
      showQr: true,
      paperSize: "A5",
      showPrices: true,
    },
    customCss: "",
    // صفحات السياسات تُولَّد عند العرض من سياسات المتجر الفعلية (blueprint/policy-pages)،
    // ولا تُحفظ هنا إلا الصفحات التي يكتبها التاجر بنفسه.
    pages: [],
    seo: { noIndex: false },
    inventory: { tracking: true },
    campaigns: [],
    sizeGuide: { charts: [] },
  };
}