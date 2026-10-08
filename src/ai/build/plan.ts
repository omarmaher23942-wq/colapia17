// plan.ts — خطة البناء: تطبيع رد النموذج إلى خطة صالحة دائماً، وخطة احتياطية من الاستمارة وحدها.
// وحدة نقية بلا اعتماديات خادم، لتُختبر مباشرة.
import { planSchema, toSlug, type OutlineItem, type Plan } from "./schemas";
import type { IntakeLike } from "./composer";

type IntakeProductLite = { name?: unknown; price?: unknown; category?: unknown; bestSeller?: unknown; description?: unknown };

export function productLines(intake: IntakeLike) {
  return (Array.isArray(intake.products) ? intake.products : [])
    .map((p) => p as IntakeProductLite)
    .filter((p) => p && typeof p.name === "string" && p.name.trim())
    .slice(0, 60)
    .map((p) => ({
      name: String(p.name).trim().slice(0, 80),
      priceEgp: Number(p.price) || undefined,
      category: typeof p.category === "string" && p.category.trim() ? p.category.trim().slice(0, 40) : undefined,
      bestSeller: p.bestSeller === true || undefined,
    }));
}

const DEFAULT_OUTLINE: OutlineItem[] = [
  { type: "announcement", variant: "marquee", purpose: "رسائل الشحن والدفع والعروض", background: "primary" },
  { type: "hero", variant: "split", purpose: "عرض الهوية وأهم منتج", background: "default" },
  { type: "trust_badges", variant: "row", purpose: "الدفع عند الاستلام والشحن والاستبدال", background: "muted" },
  { type: "categories", variant: "circles", purpose: "تصفح الأقسام", background: "default" },
  { type: "product_grid", variant: "grid", purpose: "المنتجات المميزة", background: "default" },
  { type: "promo_banner", variant: "wide", purpose: "عرض أو ميزة المتجر الأقوى", background: "gradient" },
  { type: "product_grid", variant: "carousel", purpose: "وصل حديثاً", background: "muted" },
  { type: "brand_story", variant: "split", purpose: "قصة المتجر", background: "default" },
  { type: "faq", variant: "accordion", purpose: "الأسئلة الشائعة", background: "muted" },
  { type: "newsletter", variant: "card", purpose: "متابعة العروض", background: "default" },
];

/** خطة سليمة دائماً من بيانات الاستمارة وحدها: تُستخدم عند تعذّر الذكاء الاصطناعي أو نقص رده. */
export function fallbackPlan(intake: IntakeLike): Plan {
  const brief = intake.brief ?? {};
  const name = brief.storeName?.trim() || "متجري";
  const byCat = new Map<string, string[]>();
  for (const p of productLines(intake)) {
    const c = p.category || "منتجاتنا";
    byCat.set(c, [...(byCat.get(c) ?? []), p.name]);
  }
  return {
    brandDirection: {
      name,
      tagline: "",
      positioning: "",
      moodWords: [],
      colorStrategy: "",
      typographyStrategy: "",
      voice: "friendly_egyptian",
      industry: brief.industry?.trim() || "general",
    },
    audience: { who: "", topObjections: [], buyingTriggers: [] },
    seoStrategy: {
      metaTitle: name.slice(0, 60),
      // لا نكتب هنا أي ادعاء عن الدفع أو الشحن: الوصف يكتبه كاتب المحتوى من حقائق المتجر نفسها.
      metaDescription: "",
      keywords: [],
    },
    categories: [...byCat.entries()].slice(0, 8).map(([cat, names]) => ({ name: cat, slug: toSlug(cat), productNames: names })),
    homeOutline: DEFAULT_OUTLINE,
    conversionFocus: [],
    productWriting: { tone: "", mustMention: [], avoid: [] },
    stagesForComposer: [],
  };
}

/** يحوّل أي رد من النموذج (ناقص، أو ملفوف في مفتاح، أو بأنواع خاطئة) إلى خطة صالحة. */
export function normalizePlan(raw: unknown, fallback: Plan): Plan {
  let c: unknown = raw;
  for (const k of ["plan", "buildPlan", "build_plan", "data", "result"]) {
    if (c && typeof c === "object" && !Array.isArray(c) && k in c && typeof (c as Record<string, unknown>)[k] === "object")
      c = (c as Record<string, unknown>)[k];
  }
  if (!c || typeof c !== "object" || Array.isArray(c)) return fallback;
  const obj = { ...(c as Record<string, unknown>) };
  for (const k of ["brandDirection", "audience", "productWriting"])
    if (!obj[k] || typeof obj[k] !== "object" || Array.isArray(obj[k])) obj[k] = {};
  const parsed = planSchema.safeParse(obj);
  if (!parsed.success) return fallback;
  const p = parsed.data;
  // كل منتج يجب أن يقع في قسم: ما لم يوزّعه النموذج يبقى في أقسام الاستمارة.
  const categories = p.categories.filter((x) => x.name).length ? p.categories.filter((x) => x.name) : fallback.categories;
  return {
    ...p,
    brandDirection: {
      ...p.brandDirection,
      // اسم المتجر قرار التاجر، لا يغيّره النموذج.
      name: fallback.brandDirection.name,
      industry: p.brandDirection.industry || fallback.brandDirection.industry,
    },
    seoStrategy: {
      metaTitle: p.seoStrategy.metaTitle || fallback.seoStrategy.metaTitle,
      metaDescription: p.seoStrategy.metaDescription || fallback.seoStrategy.metaDescription,
      keywords: p.seoStrategy.keywords,
    },
    categories,
    homeOutline: p.homeOutline.length >= 5 ? p.homeOutline : fallback.homeOutline,
  };
}

