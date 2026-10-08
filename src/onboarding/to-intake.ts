import type { OnboardingSubmission, OnboardingProduct } from "./schema";
import type { IntakeAssets, IntakeProduct, IntakeVariant, IntakeOptionDef } from "@/db/schema/ai";
import { stripEmoji } from "@/lib/emoji";

export type OwnerDirective = {
  scope: "store" | "product";
  productId?: string;
  instruction: string;
  imageUrls: string[];
};

export type IntakePayload = {
  brief: Record<string, unknown>;
  policies: Record<string, unknown>;
  assets: IntakeAssets;
  products: IntakeProduct[];
};

const clean = (s?: string | null): string | undefined => {
  if (!s) return undefined;
  const out = stripEmoji(s).replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  return out || undefined;
};

const toPiasters = (egp?: number | null) =>
  typeof egp === "number" && isFinite(egp) && egp > 0 ? Math.round(egp * 100) : null;

const drop = <T extends Record<string, unknown>>(o: T): T =>
  Object.fromEntries(
    Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && !v.length))
  ) as T;

function mapProduct(p: OnboardingProduct, directives: OwnerDirective[]): IntakeProduct {
  const byId = new Map(p.images.map((i) => [i.id, i.url]));
  const primary = byId.get(p.primaryImageId) ?? p.images[0]?.url ?? "";
  const gallery = p.images.map((i) => i.url).filter((u) => u !== primary);

  const optionDefs: IntakeOptionDef[] = p.options.map((o) => ({
    name: clean(o.name) ?? o.name,
    kind: o.kind,
    values: o.values.map((v) => ({ label: clean(v.label) ?? v.label })),
  }));

  const variants: IntakeVariant[] = p.options.length
    ? p.variants.map((v) => ({
        optionValues: p.options.map((o) => clean(o.values.find((x) => x.id === v.key[o.id])?.label) ?? ""),
        pricePiasters: toPiasters(v.priceEgp),
        stock: v.stock,
        available: v.available,
        imageUrls: [],
      }))
    : [];

  const own = directives.filter((d) => d.scope === "product" && d.productId === p.id);

  const out: IntakeProduct = {
    name: clean(p.name) ?? p.name,
    price: p.priceEgp,
    compareAt: p.compareAtEgp,
    description: clean(p.description),
    category: clean(p.categoryName),
    imageUrl: primary,
    imageUrls: gallery.length ? gallery : undefined,
    stock: variants.length || p.stock === null ? undefined : (p.stock ?? 20),
    unlimitedStock: !variants.length && p.stock === null ? true : undefined,
    bestSeller: p.bestSeller || undefined,
    sourceId: p.id,
    aiDraft: p.aiDraft,
    attributes: p.attributes,
    optionDefs: optionDefs.length ? optionDefs : undefined,
    variants: variants.length ? variants : undefined,
    ownerDirectives: own.length ? own.map((d) => ({ instruction: d.instruction, imageUrls: d.imageUrls })) : undefined,
  };

  return drop(out as unknown as Record<string, unknown>) as unknown as IntakeProduct;
}

export function submissionToIntake(s: OnboardingSubmission, directives: OwnerDirective[] = []): IntakePayload {
  const { store: st, launch: ln } = s;
  const rawProducts = s.products;
  const prList: OnboardingProduct[] = Array.isArray(rawProducts) ? rawProducts : (rawProducts?.products ?? []);
  const feat = ln.features;

  const products = prList.map((p) => mapProduct(p, directives));
  const spotlight = prList.find((p) => p.bestSeller) ?? prList[0];

  const capturedRequests: string[] = [];
  if (feat.inspectionBadge || ln.inspectionAllowed) capturedRequests.push("شارة المعاينة والفحص قبل الاستلام كاش");
  if (feat.countdownOffer) capturedRequests.push("عداد تنازلي لعرض اليوم الخاص الفوري");
  if (feat.marqueeBanner) capturedRequests.push("شريط إخباري متحرك أعلى المتجر لرسائل الشحن");
  if (feat.whatsappDirectChat && (st.whatsapp || st.phone)) capturedRequests.push("زر واتساب عائم مباشر");
  if (feat.bundleOffer) capturedRequests.push("قسم عروض الأطقم المجمعة بخصم إضافي");
  if (feat.freeShippingBar) capturedRequests.push("شريط تقدم الشحن المجاني التفاعلي");
  if (feat.directExpressBuy) capturedRequests.push("نافذة الشراء السريع المباشرة بضغطة واحدة");

  const whyCustomersBuy = feat.whyChooseUs
    ? [
        "منتجات مطابقة للمواصفات المعروضة 100%",
        ln.inspectionAllowed ? "معاينة وفحص الشحنة مع المندوب قبل دفع أي مليم" : "توصيل سريع لباب البيت في جميع المحافظات",
        "شحن وتوصيل لجميع محافظات مصر",
        `استبدال واسترجاع سهل خلال ${ln.returnDays} يوماً`,
      ]
    : [];

  const faq = feat.faqSection
    ? [
        {
          q: "إزاي أطلب من المتجر؟",
          a: "اختر المنتج الذي يعجبك وحدد المقاس أو اللون، ثم اضغط 'اطلب الآن' وأدخل اسمك وموبايلك وعنوانك وسيتم تجهيز وشحن طلبك فوراً.",
        },
        {
          q: "هل المعاينة متاحة قبل الدفع؟",
          a: ln.inspectionAllowed
            ? "نعم بكل تأكيد، يمكنك فتح الشحنة ومعاينة المنتج بالكامل مع مندوب التوصيل والاطمئنان عليه قبل سداد المبلغ."
            : "يمكنك استلام الشحنة وتجربتها وفي حال وجود أي ملاحظة متاح الاستبدال والاسترجاع فوراً.",
        },
        {
          q: "الشحن بيستغرق كام يوم؟",
          a: `يستغرق التوصيل عادة ${ln.deliveryEta || "من 2 إلى 4 أيام عمل"} لباب منزلك في أي محافظة داخل مصر.`,
        },
        {
          q: "إيه طرق الدفع المتاحة؟",
          a: ln.codEnabled
            ? "متاح الدفع نقداً عند الاستلام (كاش للمندوب)، كما نقبل التحويل الفوري عبر فودافون كاش وإنستاباي (InstaPay)."
            : "متاح الدفع عبر التحويل الفوري بالمحافظ الإلكترونية فودافون كاش وإنستاباي (InstaPay).",
        },
      ]
    : [];

  const storeDirectives = directives
    .filter((d) => d.scope === "store")
    .map((d) => ({ instruction: d.instruction, imageUrls: d.imageUrls }));

  if (ln.colorInspirationImage?.url) {
    storeDirectives.push({
      instruction: "استخرج درجات الألوان الأساسية والثانوية من صورة إلهام الألوان المرفقة واجعلها لوحة ألوان المتجر بتناسق تام وتباين عالي.",
      imageUrls: [ln.colorInspirationImage.url],
    });
  }

  const founderStory = clean(ln.founderStory);

  const brief = drop({
    storeName: clean(st.storeName),
    ownerName: clean(st.ownerName),
    industry: clean(st.industry),
    phone: st.phone,
    whatsappNumber: st.whatsapp || st.phone,
    email: clean(st.email),
    colorPreference: ln.autoTheme ? "سيبها لتصميم الفريق والـ AI" : clean(ln.colorPreference) || "ألوان راقية متناسقة وعالية التباين",
    founderStory,
    toneOfVoice: ln.toneOfVoice,
    autoTheme: ln.autoTheme,
    motionStyle: ln.motionStyle,
    depth3d: ln.depth3d,
    spotlightProduct: spotlight ? clean(spotlight.name) : undefined,
    whyCustomersBuy,
    faq,
    testimonials: [],
    bundleIdeas: feat.bundleOffer ? ["طقم التوفير الخاص"] : [],
    capturedRequests,
    features: feat,
    desiredSubdomain: st.desiredSubdomain,
    instagramHandle: clean(st.instagramHandle),
    facebookPageUrl: clean(st.facebookPageUrl),
    tiktokHandle: clean(st.tiktokHandle),
    ownerDirectives: storeDirectives,
  }) as Record<string, unknown>;

  const returnDays = ln.returnDays ?? 14;
  const zones =
    ln.shippingMode === "zones"
      ? ln.zones.map((z) => ({ governorate: z.governorate, feeEgp: z.feeEgp, etaMinDays: z.etaMinDays, etaMaxDays: z.etaMaxDays, active: z.active }))
      : undefined;
  const policies = drop({
    cod: ln.codEnabled,
    vodafoneCashNumber: ln.vodafoneCashEnabled ? ln.vodafoneCash : undefined,
    instapayAddress: ln.instapayEnabled ? clean(ln.instapayAddress) : undefined,
    shipsAllEgypt: ln.shipsAllEgypt ?? true,
    shippingFlatEgp: ln.shippingMode === "flat" ? ln.flatFeeEgp : ln.shippingMode === "free" ? 0 : undefined,
    shippingZones: zones,
    freeShippingOverEgp: ln.shippingMode === "free" ? 0 : ln.freeOverEgp,
    deliveryEta: clean(ln.deliveryEta),
    deliveryDays: ln.deliveryExpectedDays,
    codFeeEgp: ln.codEnabled ? ln.codFeeEgp : 0,
    pickupAddress: ln.pickupEnabled ? clean(ln.pickupAddress) : undefined,
    inspectionAllowed: ln.inspectionAllowed,
    returnDays,
    allowExchange: returnDays > 0 && ln.allowExchange,
    allowRefund: returnDays > 0 && ln.allowRefund,
    returnShippingPaidBy: ln.returnShippingPaidBy,
    refundDays: ln.refundDays,
    returnConditionsList: ln.returnConditionsList.map((c) => clean(c)).filter(Boolean),
    nonReturnable: clean(ln.nonReturnable),
    defectPolicy: ln.defectPolicy,
    defectReportHours: ln.defectReportHours,
    defectShippingByStore: ln.defectShippingByStore,
    returnConditions:
      clean(ln.returnConditions) ||
      (returnDays > 0
        ? `متاح استبدال أو استرجاع المنتج خلال ${returnDays} يوماً من الاستلام بشرط سلامة المنتج والتغليف الأصلي.`
        : "لا يتوفر استرجاع بعد الاستلام، ويمكنك معاينة المنتج قبل الدفع."),
  }) as Record<string, unknown>;

  const assets: IntakeAssets = drop({
    logoUrl: st.logo?.url,
    coverUrls: ln.colorInspirationImage?.url ? [ln.colorInspirationImage.url] : undefined,
  }) as IntakeAssets;

  return { brief, policies, assets, products };
}