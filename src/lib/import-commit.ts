// import-commit.ts — يحوّل المرشّحين المعتمدين إلى صفوف قاعدة البيانات (خالص ومختبَر): الأقسام تُطابق بالاسم المطبَّع
// وتُنشأ عند الحاجة، والروابط فريدة، والتركيبات تُولَّد من الرقائق بسعر مشترك (يرثه المنتج)، والمنتج بلا سعر يُحفظ مسودة.
import { buildSearchText, normalizeArabic, slugify } from "@/lib/arabic";
import { isDraft, variantPlan, type Candidate } from "@/lib/import-candidates";

export type ExistingCategory = { id: string; name: string; slug: string };
export type CommitInput = {
  storeId: string;
  candidates: Candidate[];
  existingCategories: ExistingCategory[];
  existingSlugs: string[];
  /** هل المتجر يتتبع المخزون؟ الكميات لا تُسجَّل إلا عندها ولمنتج بلا تركيبات. */
  tracking: boolean;
  /** معرّفات تُولَّد خارجياً لتبقى الدالة خالصة. */
  newId: () => string;
  sortOffset?: { categories: number; products: number };
};

export type CommitPlan = {
  categories: { id: string; storeId: string; name: string; slug: string; sortOrder: number }[];
  products: {
    id: string;
    storeId: string;
    name: string;
    slug: string;
    categoryId: string | null;
    description: string | null;
    shortDescription: string | null;
    pricePiasters: number;
    compareAtPiasters: number | null;
    trackStock: boolean;
    stock: number | null;
    images: { url: string; alt: string }[];
    optionNames: string[];
    status: "active" | "draft";
    sortOrder: number;
    searchText: string;
  }[];
  variants: { storeId: string; productId: string; optionValues: string[]; pricePiasters: null; stock: null; isAvailable: true; sortOrder: number }[];
  stats: { active: number; drafts: number; newCategories: number; variantCount: number };
};

const catKey = (n: string) => normalizeArabic(n).replace(/^ال/, "");

export function planCommit(inp: CommitInput): CommitPlan {
  const catByKey = new Map(inp.existingCategories.map((c) => [catKey(c.name), c.id]));
  const usedCatSlugs = new Set(inp.existingCategories.map((c) => c.slug));
  const categories: CommitPlan["categories"] = [];
  const off = inp.sortOffset ?? { categories: inp.existingCategories.length, products: 0 };

  for (const c of inp.candidates) {
    if (!c.category) continue;
    const k = catKey(c.category);
    if (!k || catByKey.has(k)) continue;
    let slug = slugify(c.category) || `section-${categories.length + 1}`;
    const base = slug;
    for (let n = 2; usedCatSlugs.has(slug); n++) slug = `${base}-${n}`;
    usedCatSlugs.add(slug);
    const id = inp.newId();
    catByKey.set(k, id);
    categories.push({ id, storeId: inp.storeId, name: c.category, slug, sortOrder: off.categories + categories.length });
  }

  const used = new Set(inp.existingSlugs);
  const uniqueSlug = (name: string) => {
    const base = slugify(name) || "item";
    let slug = base;
    for (let n = 2; used.has(slug); n++) slug = `${base}-${n}`;
    used.add(slug);
    return slug;
  };

  const products: CommitPlan["products"] = [];
  const variants: CommitPlan["variants"] = [];
  inp.candidates.forEach((c, i) => {
    const id = inp.newId();
    const plan = variantPlan(c.sizes, c.colors);
    const hasVariants = plan.combos.length > 0;
    const draft = isDraft(c);
    const desc = c.description || null;
    products.push({
      id,
      storeId: inp.storeId,
      name: c.name,
      slug: uniqueSlug(c.name),
      categoryId: c.category ? (catByKey.get(catKey(c.category)) ?? null) : null,
      description: desc,
      shortDescription: desc ? desc.split(/[.\n؟!،]/)[0]!.trim().slice(0, 160) || null : null,
      pricePiasters: draft ? 0 : Math.round(c.price! * 100),
      compareAtPiasters: !draft && c.compareAt ? Math.round(c.compareAt * 100) : null,
      trackStock: !hasVariants && inp.tracking && c.stock !== null,
      stock: !hasVariants && inp.tracking && c.stock !== null ? c.stock : null,
      images: c.images.map((url) => ({ url, alt: c.name })),
      optionNames: hasVariants ? plan.optionNames : [],
      status: draft ? "draft" : "active",
      sortOrder: off.products + i,
      searchText: buildSearchText([c.name, c.description, c.category, ...c.colors, ...c.sizes]),
    });
    plan.combos.forEach((optionValues, k) => variants.push({ storeId: inp.storeId, productId: id, optionValues, pricePiasters: null, stock: null, isAvailable: true, sortOrder: k }));
  });

  return {
    categories,
    products,
    variants,
    stats: { active: products.filter((p) => p.status === "active").length, drafts: products.filter((p) => p.status === "draft").length, newCategories: categories.length, variantCount: variants.length },
  };
}
