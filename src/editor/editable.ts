// editable.ts — ما يعرضه محرر المحتوى من إعدادات المتجر: الحقول التي يقرؤها المتجر فعلاً فقط.
// مخطط الـ Blueprint فيه مفاتيح كثيرة بلا أي أثر (خيارات «سينمائية» لم تُبنَ، وتصميمات لا يفرّق بينها القسم، وحقول
// لا يعرضها)، فإظهارها يجعل التاجر يعدّل ما لا يتغير. القاعدة: مسار له قائمة هنا لا يُعرض منه غيرها، ومسار بلا قائمة
// يُعرض كله عدا المفاتيح التقنية. عند جعل حقل جديد يعمل في المتجر: أضفه هنا وأعطه اسماً في field-meta.ts.
import type { Section } from "@/blueprint/schema";

/** مفاتيح لا تظهر للتاجر في أي مكان. */
export const TECHNICAL_KEYS = new Set(["id", "type", "schemaVersion", "anchor", "fact", "focalX", "focalY", "enabled"]);

/** خلفية القسم ومسافاته وحركته: تطبّقها SectionShell على الأقسام التي تستخدمها. */
const SHELL = ["background", "backgroundImage", "spacing", "reveal"];

/** الأقسام التي يعرضها المتجر (registry.tsx)، بالحقول التي تقرؤها. */
export const SECTION_FIELDS: Partial<Record<Section["type"], string[]>> = {
  hero: ["variant", "eyebrow", "headline", "subheadline", "images", "videoUrl", "primaryCta", "secondaryCta", "spotlightProductSlug", "overlayOpacity"],
  categories: ["variant", "title", "subtitle", "categorySlugs", "showProductCount"],
  product_grid: ["variant", "title", "subtitle", "source", "limit", "columnsDesktop", "showViewAll", "quickAdd", ...SHELL],
  promo_banner: ["items", ...SHELL],
  countdown_offer: ["title", "text", "endsAt", "couponCode", ...SHELL],
  trust_badges: ["variant", "items", ...SHELL],
  testimonials: ["title", "subtitle", "items", "includeVerifiedReviews", ...SHELL],
  faq: ["variant", "title", "subtitle", "items", ...SHELL],
  about: ["title", "body", ...SHELL],
  bundle: ["title", "text", "productSlugs", "bundleDiscountPercent", ...SHELL],
  video: ["title", "videoUrl", ...SHELL],
  contact: ["title", "address", ...SHELL],
  brand_story: ["variant", "title", "body", "image", "quote", ...SHELL],
  custom_blocks: ["title", "blocks", ...SHELL],
  steps: ["eyebrow", "title", "subtitle", "items", ...SHELL],
  // مكوّن كتبه فريق البناء لهذا المتجر: شكله من الكود، والتاجر يعدّل عنوانه ويخفيه ويرتبه فقط.
  store_block: ["title"],
};

/** أنواع الأقسام التي يمكن إضافتها (يعرضها المتجر). يطابقها اختبار مع registry.tsx. */
/** ما يضيفه التاجر بنفسه. المكوّن الخاص يضعه فريق البناء فقط (يحتاج ملفاً في مستودع المتاجر). */
export const ADDABLE_SECTIONS = (Object.keys(SECTION_FIELDS) as Section["type"][]).filter((t) => t !== "store_block");

/** حقول بقية الأجزاء والعناصر المتداخلة (المسار كما يبنيه SchemaForm). */
export const PATH_FIELDS: Record<string, string[]> = {
  brand: ["name", "tagline", "description", "logo", "favicon", "voice"],
  header: ["variant", "nav", "showCategoriesMenu", "announcement", "bottomBar"],
  "header.announcement": ["enabled", "items", "dismissible", "rotate"],
  "header.announcement.items[]": ["text", "target"],
  "header.nav[]": ["label", "target"],
  footer: ["tagline", "showChannels", "showPaymentIcons"],
  conversion: ["lowStockAlert", "socialProofToasts", "exitIntentOffer", "whatsappButton", "productTrustRow", "showSavings", "recommendations", "rememberCustomer"],
  "conversion.recommendations": ["frequentlyBoughtTogether"],
  "conversion.productTrustRow[]": ["icon", "text"],
  productPage: ["layout", "showAttributesTable", "showReviews", "showShareButtons"],
  seo: ["title", "description", "ogImage", "noIndex"],
  "section:promo_banner.items[]": ["title", "text", "couponCode"],
  "section:trust_badges.items[]": ["icon", "title", "text"],
  "section:steps.items[]": ["icon", "title", "text"],
  "section:testimonials.items[]": ["screenshot", "name", "text"],
  "section:faq.items[]": ["q", "a"],
  "section:custom_blocks.blocks[]": ["text"],
};

/** خيارات «مفعّل» داخل كائنات محرك المبيعات تبقى ظاهرة (وتختفي من غيرها: إظهار القسم من قائمة الأقسام). */
const ENABLED_PARENTS = new Set(["conversion.lowStockAlert", "conversion.socialProofToasts", "conversion.exitIntentOffer", "header.announcement"]);

/** خيارات القوائم التي يفرّق بينها المتجر فعلاً (غيرها يُعرض كأحدها، فلا داعي لعرضه). */
export const ENUM_OPTIONS: Record<string, string[]> = {
  "section:hero.variant": ["video", "split", "product_spotlight"],
  "section:categories.variant": ["circles", "grid"],
  "section:product_grid.variant": ["grid", "carousel", "featured_first", "spotlight"],
  "section:faq.variant": ["accordion", "two_columns", "chat_bubbles"],
  "section:trust_badges.variant": ["row", "cards"],
  "section:brand_story.variant": ["split", "quote"],
  "header.variant": ["classic", "centered_logo", "minimal"],
  "section:custom_blocks.blocks[].kind": ["heading", "paragraph"],
};

/** الحقول الظاهرة من كائن، بترتيب القائمة إن وُجدت. */
export function visibleKeys(path: string, keys: string[]): string[] {
  const list = path.startsWith("section:") && !path.includes(".") ? SECTION_FIELDS[path.slice(8) as Section["type"]] : PATH_FIELDS[path];
  if (list) return list.filter((k) => keys.includes(k));
  return keys.filter((k) => !TECHNICAL_KEYS.has(k) || (k === "enabled" && ENABLED_PARENTS.has(path)));
}

/** تصميمات قديمة يعرضها المتجر كأحد الخيارات المسموح بها (يظهر في القائمة ما يراه العميل فعلاً). */
export const ENUM_ALIASES: Record<string, Record<string, string>> = {
  "section:hero.variant": { fullscreen: "video", cinematic: "video", editorial: "split", collage: "split", carousel: "split", orbit: "split", centered: "product_spotlight", kinetic: "product_spotlight", ambient: "product_spotlight", storyteller: "product_spotlight" },
  "section:categories.variant": { cards: "grid", bento: "grid", cards_overlay: "grid", featured_hero: "grid", stories: "circles", scroll: "circles", marquee: "circles" },
  "section:product_grid.variant": { masonry: "featured_first", bento: "featured_first", two_rows_scroll: "carousel", carousel_3d: "carousel", editorial: "grid" },
  "section:faq.variant": { split: "accordion" },
  "section:trust_badges.variant": { compact_strip: "row", horizontal_marquee: "cards" },
  "section:brand_story.variant": { scroll_linked: "split", timeline: "split" },
  "header.variant": { mega: "classic" },
};

/** خيارات قائمة والقيمة المعروضة: المسموح بها فقط، والقيمة القديمة تُعرض بما يراه العميل. */
export function enumView(path: string, all: string[], current: unknown): { options: string[]; selected: string | undefined } {
  const cur = typeof current === "string" ? current : undefined;
  const allowed = ENUM_OPTIONS[path];
  if (!allowed) return { options: all, selected: cur };
  const options = all.filter((o) => allowed.includes(o));
  const selected = cur && options.includes(cur) ? cur : cur ? ENUM_ALIASES[path]?.[cur] : undefined;
  return { options: selected || !cur ? options : [...options, cur], selected: selected ?? cur };
}
