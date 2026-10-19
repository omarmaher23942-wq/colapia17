// store-templates.ts — قوالب بدء جاهزة لكل نشاط (خالص ومختبَر). القالب = تصميم كامل (من التصميمات الثمانية) + تركيب الرئيسية
// (الواجهة والأقسام والمنتجات) بعناوين محايدة صادقة. المسار نفسه الذي يطبّقه الإعداد يصلح لأي بناء آخر (الديمو مثلاً):
// لا شيء هنا خاص بالديمو، ولا أي ادعاء أو أرقام أو آراء مختلقة. التاجر يعدّل بعده ما يشاء.
import type { StoreBlueprint } from "@/blueprint/schema";
import { applyTheme, type ThemeId } from "@/blueprint/themes";
import type { Niche } from "@/lib/niche-attributes";

export const TEMPLATE_IDS = ["fashion", "shoes", "accessories", "beauty", "perfume", "electronics", "home", "food", "kids", "general"] as const;
export type TemplateId = (typeof TEMPLATE_IDS)[number];
export const isTemplateId = (v: unknown): v is TemplateId => typeof v === "string" && (TEMPLATE_IDS as readonly string[]).includes(v);

type CatVariant = "circles" | "grid" | "cards_overlay" | "bento" | "stories";
type GridVariant = "grid" | "carousel" | "featured_first" | "editorial";

export type StarterTemplate = {
  id: TemplateId;
  label: string;
  blurb: string;
  /** النشاط الذي يناسبه (يحدد حقول المنتج). */
  niche: Niche;
  theme: ThemeId;
  /** مفردة النشاط لعناوين الأقسام («تشكيلة …»). */
  noun: string;
  cats: { variant: CatVariant; title: string };
  newest: { variant: GridVariant; title: string };
  best: { variant: GridVariant; title: string };
};

export const STARTER_TEMPLATES: Record<TemplateId, StarterTemplate> = {
  fashion: { id: "fashion", label: "ملابس وأزياء", blurb: "ألوان مبهجة وبطاقات واضحة، ودليل مقاسات.", niche: "fashion", theme: "coral-pop", noun: "الملابس", cats: { variant: "circles", title: "تسوقوا حسب القسم" }, newest: { variant: "grid", title: "وصل حديثاً" }, best: { variant: "carousel", title: "الأكثر طلباً" } },
  shoes: { id: "shoes", label: "أحذية", blurb: "صور كبيرة للمنتج وتركيز على المقاس واللون.", niche: "shoes", theme: "midnight-mercury", noun: "الأحذية", cats: { variant: "cards_overlay", title: "اختاروا الفئة" }, newest: { variant: "grid", title: "وصل حديثاً" }, best: { variant: "carousel", title: "الأكثر طلباً" } },
  accessories: { id: "accessories", label: "إكسسوارات وحقائب", blurb: "فخامة هادئة تبرز تفاصيل القطعة.", niche: "other", theme: "noir-gold", noun: "الإكسسوارات", cats: { variant: "cards_overlay", title: "تصفحوا الأقسام" }, newest: { variant: "featured_first", title: "وصل حديثاً" }, best: { variant: "carousel", title: "الأكثر طلباً" } },
  beauty: { id: "beauty", label: "عناية وتجميل", blurb: "هدوء ونظافة بصرية تناسب منتجات العناية.", niche: "beauty", theme: "sage-minimal", noun: "منتجات العناية", cats: { variant: "circles", title: "تسوقوا حسب الفئة" }, newest: { variant: "grid", title: "وصل حديثاً" }, best: { variant: "carousel", title: "الأكثر طلباً" } },
  perfume: { id: "perfume", label: "عطور", blurb: "داكن فاخر يبرز الزجاجة والحجم.", niche: "perfume", theme: "noir-gold", noun: "العطور", cats: { variant: "cards_overlay", title: "تصفحوا العطور" }, newest: { variant: "featured_first", title: "وصل حديثاً" }, best: { variant: "carousel", title: "الأكثر طلباً" } },
  electronics: { id: "electronics", label: "إلكترونيات", blurb: "مظهر تقني داكن، وسمات المنتج في جدول واضح.", niche: "electronics", theme: "neon-tech", noun: "الإلكترونيات", cats: { variant: "bento", title: "تسوقوا حسب الفئة" }, newest: { variant: "grid", title: "وصل حديثاً" }, best: { variant: "carousel", title: "الأكثر طلباً" } },
  home: { id: "home", label: "أدوات منزلية وديكور", blurb: "دفء وأصالة تناسب المنزل.", niche: "home", theme: "desert-sand", noun: "المنزل", cats: { variant: "cards_overlay", title: "تسوقوا حسب الغرفة أو الفئة" }, newest: { variant: "grid", title: "وصل حديثاً" }, best: { variant: "carousel", title: "الأكثر طلباً" } },
  food: { id: "food", label: "أغذية ومشروبات", blurb: "ألوان دافئة وصور شهية، والوزن بدل المقاس.", niche: "food", theme: "desert-sand", noun: "الأغذية", cats: { variant: "circles", title: "تصفحوا القائمة" }, newest: { variant: "grid", title: "وصل حديثاً" }, best: { variant: "carousel", title: "الأكثر طلباً" } },
  kids: { id: "kids", label: "أطفال", blurb: "ألوان مرحة وبطاقات بارزة.", niche: "kids", theme: "coral-pop", noun: "الأطفال", cats: { variant: "circles", title: "تسوقوا حسب الفئة" }, newest: { variant: "grid", title: "وصل حديثاً" }, best: { variant: "carousel", title: "الأكثر طلباً" } },
  general: { id: "general", label: "متجر عام", blurb: "تصميم متوازن يناسب أي نشاط.", niche: "other", theme: "midnight-mercury", noun: "المنتجات", cats: { variant: "circles", title: "تسوقوا حسب القسم" }, newest: { variant: "grid", title: "وصل حديثاً" }, best: { variant: "carousel", title: "الأكثر طلباً" } },
};

export const TEMPLATE_LIST: StarterTemplate[] = TEMPLATE_IDS.map((id) => STARTER_TEMPLATES[id]);

/** القالب الأقرب لنشاط المتجر (للاقتراح الأول؛ التاجر يغيّره). */
export function templateForNiche(niche: Niche): TemplateId {
  switch (niche) {
    case "fashion":
      return "fashion";
    case "shoes":
      return "shoes";
    case "electronics":
      return "electronics";
    case "beauty":
      return "beauty";
    case "perfume":
      return "perfume";
    case "food":
      return "food";
    case "home":
      return "home";
    case "kids":
      return "kids";
    default:
      return "general";
  }
}

/**
 * يطبّق قالب البدء على نسخة من الـ Blueprint: التصميم الكامل ثم تركيب الرئيسية. لا يمسّ هوية التاجر (الاسم، الشعار، لون العلامة
 * إن غيّره، القنوات، الدفع، الشحن، السياسات) ولا نصوصاً كتبها بنفسه: العنوان الرئيسي يُستبدل فقط إن كان ما زال اسم المتجر الافتراضي.
 */
export function applyStarterTemplate(bp: StoreBlueprint, id: TemplateId): StoreBlueprint {
  const t = STARTER_TEMPLATES[id];
  const themed = applyTheme(bp, t.theme);
  const name = bp.brand.name;
  const home = themed.home.map((s) => {
    if (s.type === "hero") {
      const untouched = !s.headline || s.headline === name;
      return untouched ? { ...s, headline: `تسوقوا ${t.noun} من ${name}`.slice(0, 90), subheadline: s.subheadline && s.subheadline !== "تسوقوا منتجاتنا بسهولة" ? s.subheadline : `اطلبوا من ${name} واستلموا في بيتكم.` } : s;
    }
    if (s.type === "categories" && s.id === "cats") return { ...s, variant: t.cats.variant, title: t.cats.title };
    if (s.type === "product_grid" && s.id === "new") return { ...s, variant: t.newest.variant, title: t.newest.title };
    if (s.type === "product_grid" && s.id === "best") return { ...s, variant: t.best.variant, title: t.best.title };
    return s;
  });
  return { ...themed, home };
}
