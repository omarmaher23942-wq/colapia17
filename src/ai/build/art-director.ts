// art-director.ts — المخرج الفني: يركّب الصفحة الرئيسية من محتوى الذكاء الاصطناعي وبيانات المتجر الفعلية.
//
// الذكاء الاصطناعي يكتب الكلام ويختار الطابع، وهذه القواعد الحتمية تضمن تجربة مستخدم سليمة دائماً:
// - كل قسم يظهر فقط إن كان عنده محتوى حقيقي (لا أقسام فارغة ولا «منتجاتنا» بمنتج واحد في شبكة من 4).
// - عدد المنتجات يحدد الشكل: منتج واحد = عرض بطولي، منتجان أو ثلاثة = شبكة بعددها، والأكثر = شبكات متنوعة.
// - المميزات التي أطفأها التاجر في الاستمارة لا تظهر أبداً.
// - إيقاع بصري متبادل بين الأقسام، ولا قسمان متجاوران بنفس الخلفية الملونة.
import type { Section, StoreBlueprint } from "@/blueprint/schema";
import type { StudioCopy, StudioDesign, Titled } from "./studio";

export type CatalogStats = {
  products: { slug: string; name: string; image?: string; bestSeller?: boolean; onSale?: boolean; category?: string }[];
  categories: { slug: string; name: string; count: number }[];
};

type Features = Record<string, boolean | undefined>;
const on = (f: Features, k: string) => f[k] !== false;

let seq = 0;
const id = (type: string) => `${type}-${(++seq).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function base(type: Section["type"], extra: Record<string, unknown>): Section {
  return { id: id(type), type, enabled: true, spacing: "normal", background: "default", reveal: "fade", ...extra } as unknown as Section;
}

function heading(t: Titled | undefined) {
  return { ...(t?.title ? { title: t.title } : {}), ...(t?.subtitle ? { subtitle: t.subtitle } : {}) };
}

export function composeHome(input: { copy: StudioCopy; design: StudioDesign; stats: CatalogStats; features?: Features; founderImage?: string }): Section[] {
  const { copy, design, stats } = input;
  const features = input.features ?? {};
  const n = stats.products.length;
  const out: Section[] = [];

  // 1) شريط الإعلان: رسائل صادقة مرتبطة بحقائق المتجر.
  if (on(features, "marqueeBanner") && copy.announcements.length) {
    out.push(
      base("announcement", {
        variant: copy.announcements.length > 1 ? "marquee" : "static",
        spacing: "compact",
        background: "primary",
        reveal: "none",
        messages: copy.announcements.slice(0, 4).map((a) => ({ text: a.text, ...(a.fact ? { fact: a.fact } : {}) })),
        dismissible: false,
        sticky: false,
      })
    );
  }

  // 2) الواجهة: صور المنتجات الحقيقية (الأكثر مبيعاً أولاً).
  const withImg = [...stats.products.filter((p) => p.bestSeller), ...stats.products.filter((p) => !p.bestSeller)].filter((p) => p.image);
  const spotlight = withImg[0];
  const firstCat = stats.categories.find((c) => c.count > 0);
  out.push(
    base("hero", {
      variant: design.heroVariant,
      spacing: "spacious",
      ...(copy.hero.eyebrow ? { eyebrow: copy.hero.eyebrow } : {}),
      headline: copy.hero.headline,
      ...(copy.hero.subheadline ? { subheadline: copy.hero.subheadline } : {}),
      images: withImg.slice(0, design.heroVariant === "orbit" ? 8 : design.heroVariant === "collage" ? 4 : 3).map((p) => ({ url: p.image!, alt: p.name, focalX: 0.5, focalY: 0.4 })),
      ...(design.heroVariant === "product_spotlight" && spotlight ? { spotlightProductSlug: spotlight.slug } : {}),
      primaryCta: { label: copy.hero.primaryCta, target: n === 1 && stats.products[0] ? { type: "product", slug: stats.products[0].slug } : { type: "all_products" }, style: "primary" },
      ...(copy.hero.secondaryCta && firstCat && stats.categories.length > 1
        ? { secondaryCta: { label: copy.hero.secondaryCta, target: { type: "category", slug: firstCat.slug }, style: "secondary" } }
        : {}),
      highlights: [],
      textAlign: design.heroVariant === "centered" ? "center" : "start",
      height: design.heroVariant === "fullscreen" ? "screen" : "tall",
      overlayOpacity: 0.45,
      autoplayMs: 5000,
      enableParallax: true,
      enableKineticTypography: true,
      enableAmbientGlow: true,
    })
  );

  // 3) الثقة: من 2 إلى 4 حقائق فقط.
  if (on(features, "trustBadges") && copy.trust.length >= 2) {
    out.push(
      base("trust_badges", {
        variant: design.design.icon.frame === "none" ? "compact_strip" : "cards",
        spacing: "compact",
        items: copy.trust.slice(0, 4).map((t) => ({ icon: t.icon, title: t.title, ...(t.text ? { text: t.text } : {}), fact: t.fact })),
      })
    );
  }

  // 4) الأقسام: فقط إن كان هناك قسمان فيهما منتجات.
  const liveCats = stats.categories.filter((c) => c.count > 0);
  if (liveCats.length >= 2) {
    out.push(
      base("categories", {
        variant: liveCats.length <= 3 ? "cards_overlay" : liveCats.length <= 6 ? "bento" : "grid",
        ...heading(copy.sections.categories),
        categorySlugs: liveCats.slice(0, 8).map((c) => c.slug),
        showProductCount: true,
      })
    );
  }

  // 5) المنتجات: الشكل يتبع العدد الحقيقي.
  const hasFeatured = stats.products.some((p) => p.bestSeller);
  if (n === 1) {
    out.push(base("product_grid", { variant: "spotlight", ...heading(copy.sections.spotlight ?? copy.sections.featured), source: { type: "newest" }, limit: 2, columnsMobile: 1, columnsDesktop: 3, showViewAll: false, quickAdd: true }));
  } else if (n > 1) {
    const limit = Math.min(n, 8);
    out.push(
      base("product_grid", {
        variant: n >= 5 && design.design.layout.density !== "compact" ? "featured_first" : "grid",
        ...heading(hasFeatured ? copy.sections.bestSellers ?? copy.sections.featured : copy.sections.featured),
        source: hasFeatured ? { type: "featured" } : { type: "newest" },
        limit: Math.max(2, limit),
        columnsMobile: 2,
        columnsDesktop: (n <= 3 ? 3 : n === 4 ? 4 : 4) as 3 | 4,
        showViewAll: n > limit,
        quickAdd: true,
      })
    );
  }

  const onSale = stats.products.filter((p) => p.onSale).length;
  if (onSale >= 3 && n > 6) {
    out.push(base("product_grid", { variant: "carousel", ...heading(copy.sections.onSale), source: { type: "on_sale" }, limit: Math.min(onSale, 10), columnsMobile: 2, columnsDesktop: 4, showViewAll: false, quickAdd: true }));
  }

  // 5ب) صف لكل قسم حقيقي (حتى 3) حين يكفي الكتالوج: المتجر يمتلئ بمنتجاته هو لا بأقسام فارغة.
  if (n >= 6 && liveCats.length >= 2) {
    for (const c of liveCats.filter((c) => c.count >= 3).slice(0, 3)) {
      out.push(base("product_grid", { variant: "carousel", title: c.name, source: { type: "category", slug: c.slug }, limit: Math.min(c.count, 10), columnsMobile: 2, columnsDesktop: 4, showViewAll: c.count > 4, quickAdd: true }));
    }
  }

  // 5ج) كيف تطلب: خطوات الشراء الحقيقية في هذا المتجر (من حقائقه؛ تُراجع عند العرض أيضاً).
  const steps = orderSteps(copy.trust);
  out.push(base("steps", { variant: "numbered", eyebrow: "بسهولة", title: "كيف تطلب", subtitle: "من اختيار المنتج لحد ما يوصلك", items: steps }));

  // 6) القصة: من كلام صاحب المتجر أو فلسفته.
  if (on(features, "brandStory") && copy.story.body) {
    out.push(
      base("brand_story", {
        variant: input.founderImage || withImg[1] ? "split" : "quote",
        title: copy.story.title || copy.sections.story?.title || copy.brandTagline || "قصتنا",
        body: copy.story.body,
        ...(copy.story.quote ? { quote: copy.story.quote } : {}),
        ...(input.founderImage ? { image: { url: input.founderImage, alt: "", focalX: 0.5, focalY: 0.5 } } : withImg[1] ? { image: { url: withImg[1].image!, alt: withImg[1].name, focalX: 0.5, focalY: 0.5 } } : {}),
      })
    );
  }

  // 7) وصل حديثاً: فقط لكتالوج كبير بما يكفي ليعرض منتجات مختلفة.
  if (n >= 10) {
    out.push(base("product_grid", { variant: "carousel", ...heading(copy.sections.newArrivals), source: { type: "newest" }, limit: 10, columnsMobile: 2, columnsDesktop: 4, showViewAll: true, quickAdd: true }));
  }

  // 8) آراء العملاء الحقيقية فقط (يُخفى القسم تلقائياً حتى تصل أول تقييمات معتمدة).
  if (on(features, "customerVoiceReviews")) {
    out.push(base("testimonials", { variant: "cards", ...heading(copy.sections.reviews), items: [], includeVerifiedReviews: true }));
  }

  // 9) الأسئلة الشائعة.
  if (on(features, "faqSection") && copy.faq.length >= 3) {
    out.push(base("faq", { variant: "accordion", ...heading(copy.sections.faq), items: copy.faq.slice(0, 6) }));
  }

  // 10) تواصل معنا: قنوات المتجر الحقيقية بشعاراتها (القسم يختفي وحده إن لم توجد قناة).
  out.push(base("contact", { variant: "cards", title: "عندك سؤال؟ كلّمنا", showChannels: true }));

  return applyRhythm(out);
}

/** خطوات الطلب من حقائق المتجر فقط: اختيار، طلب بلا حساب، ثم ما يقدمه المتجر فعلاً عند الاستلام وبعده. */
export function orderSteps(trust: StudioCopy["trust"]): { icon: string; title: string; text: string; fact?: string }[] {
  const has = (k: string) => trust.find((t) => t.fact === k);
  const out: { icon: string; title: string; text: string; fact?: string }[] = [
    { icon: "shopping-bag", title: "اختار منتجك", text: "تصفّح المنتجات بصورها وأسعارها، وأضف ما يعجبك للسلة." },
    { icon: "smartphone", title: "اطلب في دقيقة", text: "اكتب اسمك ورقمك وعنوانك، بدون حساب ولا تسجيل." },
  ];
  if (has("inspection")) out.push({ icon: "eye", title: "عاين قبل ما تدفع", text: "افتح الشحنة وافحص المنتج مع المندوب قبل أن تدفع.", fact: "inspection" });
  else if (has("cod")) out.push({ icon: "banknote", title: "ادفع عند الاستلام", text: "ادفع نقداً عند وصول طلبك.", fact: "cod" });
  else out.push({ icon: "package", title: "تابع طلبك", text: "تابع حالة طلبك خطوة بخطوة من «طلباتي» حتى يصلك." });
  const ret = has("returns");
  if (ret) out.push({ icon: "rotate-ccw", title: "لو ما ناسبك", text: (ret.text ?? ret.title).slice(0, 160), fact: "returns" });
  return out;
}

/** إيقاع بصري: الأقسام الرئيسية تتبادل بين الخلفية الأساسية والبديلة، والإعلان والواجهة بلا تبادل. */
export function applyRhythm(sections: Section[]): Section[] {
  let alt = false;
  return sections.map((s) => {
    if (s.type === "announcement" || s.type === "hero") return s;
    const next = { ...s, background: (alt ? "muted" : "default") as Section["background"] } as Section;
    alt = !alt;
    return next;
  });
}

/**
 * إعادة تصميم متجر قائم: يستبدل الشكل والنصوص والصفحة الرئيسية فقط، ويحافظ على كل ما يخص
 * تشغيل المتجر (الدفع، الشحن، الاستبدال، القنوات، الصفحات التي كتبها التاجر، إعدادات التحويل).
 */
export function redesignBlueprint(current: StoreBlueprint, studio: { design: StudioDesign; copy: StudioCopy }, stats: CatalogStats, features?: Features): StoreBlueprint {
  const { design, copy } = studio;
  return {
    ...current,
    theme: design.theme,
    design: design.design,
    customCss: design.customCss,
    copy: copy.microcopy,
    brand: { ...current.brand, ...(copy.brandTagline ? { tagline: copy.brandTagline.slice(0, 120) } : {}) },
    header: { ...current.header, variant: design.headerVariant },
    footer: { ...current.footer, variant: design.footerVariant, ...(copy.footerTagline ? { tagline: copy.footerTagline.slice(0, 160) } : {}) },
    home: composeHome({ copy, design, stats, features }),
    seo: { ...current.seo, ...(copy.seo.title ? { title: copy.seo.title.slice(0, 70) } : {}), ...(copy.seo.description ? { description: copy.seo.description.slice(0, 160) } : {}) },
    checkout: { ...current.checkout, ...(copy.checkoutSuccess ? { successMessage: copy.checkoutSuccess.slice(0, 300) } : {}) },
    orderMessages: { ...current.orderMessages, ...copy.orderMessages },
  };
}
