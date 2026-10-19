// niche-attributes.ts — سمات المنتج حسب نشاط المتجر (خالص بلا تبعيات، يعمل في المتصفح والخادم).
// المبدأ: لا يرى التاجر حقلاً لا يخص نشاطه. الملابس والأحذية وملابس الأطفال لها مقاسات وألوان (تركيبات)،
// والإلكترونيات سعة ولون وضمان، والعطور حجم وتركيز، والأغذية وزن، والباقي سمات حرة. القيم تُحفظ في
// products.attributes بصيغة {label, value} فتظهر جدولاً في صفحة المنتج دون أي تغيير في مخطط القاعدة.

export type Niche = "fashion" | "shoes" | "electronics" | "beauty" | "perfume" | "food" | "home" | "kids" | "other";

export const NICHES: readonly Niche[] = ["fashion", "shoes", "electronics", "beauty", "perfume", "food", "home", "kids", "other"] as const;

export const NICHE_LABEL: Record<Niche, string> = {
  fashion: "ملابس وأزياء",
  shoes: "أحذية وحقائب",
  electronics: "إلكترونيات وإكسسوارات",
  beauty: "عناية وتجميل",
  perfume: "عطور",
  food: "أغذية ومشروبات",
  home: "منزل وديكور",
  kids: "أطفال وألعاب",
  other: "نشاط آخر",
};

export type NicheAttribute = {
  key: string;
  label: string;
  kind: "option" | "text";
  /** قيم جاهزة تُختار بضغطة (يمكن كتابة غيرها). */
  values?: string[];
  placeholder?: string;
};

export const isNiche = (v: unknown): v is Niche => typeof v === "string" && (NICHES as readonly string[]).includes(v);

// ─── التعرف على النشاط من نص حر (ما قاله التاجر للوكيل، أو وصف المتجر) ──────────

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[ً-ٟ]/g, "");

// الترتيب مقصود: الأكثر تحديداً أولاً (عطور قبل تجميل، أحذية قبل ملابس، أطفال قبل ملابس).
const RULES: { niche: Niche; words: string[] }[] = [
  { niche: "perfume", words: ["عطر", "عطور", "برفان", "برفيوم", "بخور", "مسك", "perfume", "parfum", "fragrance", "oud", "عود"] },
  { niche: "kids", words: ["اطفال", "طفل", "بيبي", "رضع", "مواليد", "العاب", "لعب", "kids", "baby", "toys", "toy"] },
  { niche: "shoes", words: ["احذيه", "حذاء", "جزم", "جزمه", "كوتشي", "صنادل", "شبشب", "شنط", "شنطه", "حقائب", "sneakers", "shoes", "shoe", "bags", "boots"] },
  { niche: "electronics", words: ["الكترونيات", "الكتروني", "موبايل", "موبايلات", "هاتف", "هواتف", "لابتوب", "سماعات", "سماعه", "شاحن", "اكسسوارات موبايل", "جيمنج", "ساعات ذكيه", "electronics", "mobile", "phone", "laptop", "gadgets", "tech", "headphones", "charger"] },
  { niche: "beauty", words: ["تجميل", "مكياج", "ميكب", "ميك اب", "عنايه", "بشره", "شعر", "سكين كير", "كريمات", "beauty", "makeup", "skincare", "cosmetics"] },
  { niche: "food", words: ["اكل", "طعام", "حلويات", "قهوه", "شاي", "توابل", "عسل", "تمور", "مخبوزات", "شوكولا", "مكسرات", "مشروبات", "food", "coffee", "sweets", "bakery", "snacks", "honey"] },
  { niche: "home", words: ["منزل", "ديكور", "مفروشات", "اثاث", "مطبخ", "ادوات منزليه", "سجاد", "مفارش", "home", "decor", "furniture", "kitchen"] },
  { niche: "fashion", words: ["ملابس", "ازياء", "موضه", "فساتين", "فستان", "تيشيرت", "تيشيرتات", "قمصان", "بناطيل", "عبايات", "عبايه", "حجاب", "طرح", "هوديز", "جينز", "بيجامات", "لانجري", "fashion", "clothes", "clothing", "wear", "apparel", "dress", "streetwear"] },
];

/** يقرأ النشاط من أي نص (كلام التاجر أو وصف المتجر). بلا تطابق ← other. */
export function nicheOf(text: string): Niche {
  const t = norm(text || "");
  if (!t.trim()) return "other";
  for (const r of RULES) if (r.words.some((w) => t.includes(norm(w)))) return r.niche;
  return "other";
}

/** نشاط المتجر المحفوظ: اختيار التاجر الصريح (onboarding.nicheKind) يغلب، ثم ما قاله للوكيل، ثم أي وصف احتياطي. */
export function resolveNiche(onboarding: unknown, ...fallbackText: (string | null | undefined)[]): Niche {
  const o = onboarding && typeof onboarding === "object" && !Array.isArray(onboarding) ? (onboarding as Record<string, unknown>) : {};
  if (isNiche(o.nicheKind)) return o.nicheKind;
  const text = [typeof o.niche === "string" ? o.niche : "", ...fallbackText.map((x) => x ?? "")].join(" ");
  return nicheOf(text);
}

// ─── السمات لكل نشاط ─────────────────────────────────────────────────────────

const COLOR_VALUES = ["أسود", "أبيض", "رمادي", "فضي", "ذهبي", "أزرق", "أحمر", "أخضر", "وردي", "بيج", "بني", "كحلي"];

const A = {
  material: { key: "material", label: "الخامة", kind: "text", placeholder: "مثال: قطن 100%" },
  fit: { key: "fit", label: "القَصّة", kind: "option", values: ["عادية", "واسعة", "ضيقة", "أوفر سايز"] },
  color: { key: "color", label: "اللون", kind: "option", values: COLOR_VALUES },
  capacity: { key: "capacity", label: "السعة", kind: "option", values: ["64GB", "128GB", "256GB", "512GB", "1TB"] },
  warranty: { key: "warranty", label: "الضمان", kind: "option", values: ["بدون ضمان", "3 أشهر", "6 أشهر", "سنة", "سنتان"] },
  model: { key: "model", label: "الموديل", kind: "text", placeholder: "مثال: Galaxy A55" },
  condition: { key: "condition", label: "الحالة", kind: "option", values: ["جديد", "مستعمل بحالة ممتازة"] },
  volume: { key: "volume", label: "الحجم", kind: "option", values: ["30 مل", "50 مل", "75 مل", "100 مل", "150 مل", "200 مل"] },
  concentration: { key: "concentration", label: "التركيز", kind: "option", values: ["Eau de Parfum", "Eau de Toilette", "Parfum", "زيت عطري", "بودي سبلاش"] },
  scentFor: { key: "scent_for", label: "مناسب لـ", kind: "option", values: ["للرجال", "للنساء", "للجنسين"] },
  notes: { key: "notes", label: "النفحات", kind: "text", placeholder: "مثال: فانيليا، عود، مسك" },
  skin: { key: "skin", label: "نوع البشرة/الشعر", kind: "option", values: ["كل الأنواع", "دهنية", "جافة", "مختلطة", "حساسة"] },
  ingredients: { key: "ingredients", label: "المكونات الأساسية", kind: "text", placeholder: "مثال: فيتامين C، حمض الهيالورونيك" },
  weight: { key: "weight", label: "الوزن", kind: "option", values: ["100 جم", "250 جم", "500 جم", "1 كجم"] },
  flavor: { key: "flavor", label: "النكهة", kind: "text", placeholder: "مثال: شوكولاتة داكنة" },
  shelfLife: { key: "shelf_life", label: "مدة الصلاحية", kind: "text", placeholder: "مثال: 6 أشهر من تاريخ الإنتاج" },
  dimensions: { key: "dimensions", label: "المقاسات (الأبعاد)", kind: "text", placeholder: "مثال: 120 × 60 سم" },
  age: { key: "age", label: "العمر المناسب", kind: "option", values: ["0–6 أشهر", "6–12 شهراً", "1–3 سنوات", "3–6 سنوات", "6–12 سنة"] },
  origin: { key: "origin", label: "بلد الصنع", kind: "text", placeholder: "مثال: مصر" },
} satisfies Record<string, NicheAttribute>;

const BY_NICHE: Record<Niche, NicheAttribute[]> = {
  fashion: [A.material, A.fit, A.origin],
  shoes: [A.material, A.origin],
  electronics: [A.capacity, A.color, A.warranty, A.model, A.condition],
  beauty: [A.volume, A.skin, A.ingredients, A.origin],
  perfume: [A.volume, A.concentration, A.scentFor, A.notes],
  food: [A.weight, A.flavor, A.shelfLife],
  home: [A.dimensions, A.material, A.color],
  kids: [A.age, A.material],
  other: [],
};

/** سمات المنتج المناسبة للنشاط (نسخة مستقلة لكل استدعاء). المقاس واللون للملابس تُدار كتركيبات لا كسمات. */
export function attributesFor(niche: Niche): NicheAttribute[] {
  return (BY_NICHE[niche] ?? []).map((a) => ({ ...a, values: a.values ? [...a.values] : undefined }));
}

/** هل يبيع هذا النشاط بمقاسات وألوان (تركيبات)؟ الإلكترونيات والعطور والأغذية لا ترى مصفوفة المقاس × اللون. */
export function usesSizeColor(niche: Niche): boolean {
  return niche === "fashion" || niche === "shoes" || niche === "kids";
}

// ─── أدوات القيم ({label, value}[]) ──────────────────────────────────────────

export type AttrPair = { label: string; value: string };

const clean = (s: string, max: number) => s.replace(/\s+/g, " ").trim().slice(0, max);

/** ينقّي قائمة السمات: بلا فارغ ولا تكرار للاسم (الأول يغلب)، حتى 30 سمة. */
export function cleanAttributes(list: unknown): AttrPair[] {
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  const out: AttrPair[] = [];
  for (const x of list) {
    if (!x || typeof x !== "object") continue;
    const label = clean(String((x as AttrPair).label ?? ""), 40);
    const value = clean(String((x as AttrPair).value ?? ""), 120);
    if (!label || !value || seen.has(label)) continue;
    seen.add(label);
    out.push({ label, value });
    if (out.length >= 30) break;
  }
  return out;
}

export function attrValue(list: AttrPair[], label: string): string {
  return list.find((a) => a.label === label)?.value ?? "";
}

/** يضبط قيمة سمة بالاسم (فارغ = حذف) ويحفظ ترتيب الباقي. */
export function setAttr(list: AttrPair[], label: string, value: string): AttrPair[] {
  const v = clean(value, 120);
  const i = list.findIndex((a) => a.label === label);
  if (!v) return i < 0 ? list : list.filter((_, k) => k !== i);
  if (i < 0) return [...list, { label, value: v }];
  return list.map((a, k) => (k === i ? { label, value: v } : a));
}

/** قيم متعددة في سمة واحدة تُكتب «أ، ب». */
export const splitValues = (v: string): string[] =>
  v
    .split(/[،,]/)
    .map((x) => x.trim())
    .filter(Boolean);

export const joinValues = (vs: string[]): string => [...new Set(vs.map((x) => x.trim()).filter(Boolean))].join("، ");

/**
 * يجهّز منتجاً للحفظ حسب النشاط: في نشاط بلا تركيبات تُنقل الألوان المذكورة إلى سمة «اللون» إن كانت من سماته،
 * وتُحذف المقاسات والألوان كتركيبات (فلا تظهر مصفوفة مقاس × لون لعطر أو هاتف).
 */
export function foldForNiche<T extends { sizes: string[]; colors: string[]; attributes: AttrPair[] }>(c: T, niche: Niche): T {
  if (usesSizeColor(niche)) return c;
  let attributes = c.attributes;
  const hasColorAttr = attributesFor(niche).some((a) => a.label === A.color.label);
  if (c.colors.length && hasColorAttr && !attrValue(attributes, A.color.label)) attributes = setAttr(attributes, A.color.label, joinValues(c.colors));
  return { ...c, sizes: [], colors: [], attributes };
}
