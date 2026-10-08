import { z } from "zod";
import { themeSchema, sectionSchema, policyPageSchema } from "@/blueprint/schema";

const squash = (s: string) => s.replace(/\s+/g, " ").trim();
const squashLines = (s: string) => s.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
export const str = (max: number) => z.string().nullish().catch(undefined).transform((s) => squash(s ?? "").slice(0, max));
export const strLines = (max: number) => z.string().nullish().catch(undefined).transform((s) => squashLines(s ?? "").slice(0, max));
export const optStr = (max: number) => z.string().nullish().catch(undefined).transform((s) => { const v = squash(s ?? "").slice(0, max); return v || undefined; });
export const optStrLines = (max: number) => z.string().nullish().catch(undefined).transform((s) => { const v = squashLines(s ?? "").slice(0, max); return v || undefined; });
export const strList = (itemMax: number, max: number) => z.array(z.string().nullish()).nullish().catch(undefined).transform((a) => Array.from(new Set((a ?? []).map((s) => squash(s ?? "").slice(0, itemMax)).filter(Boolean))).slice(0, max));
export const toSlug = (s: unknown) => (typeof s === "string" ? s.toLowerCase().trim().replace(/[^\p{L}\p{N}\-\s]/gu, "").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) : "");
export const slugField = () => z.string().nullish().catch(undefined).transform(toSlug);

export const lenientArray = <T extends z.ZodTypeAny>(item: T, max: number) =>
  z.array(item.catch(null as unknown as z.infer<T>)).nullish().catch(undefined).transform((a) => (a ?? []).filter((x): x is z.infer<T> => x !== null && x !== undefined).slice(0, max));

export const SECTION_TYPES: string[] = (sectionSchema.options as z.ZodObject<any>[]).map((o) => o.shape.type.value as string);
export type Section = z.infer<typeof sectionSchema>;

export const outlineItemSchema = z.object({
  type: str(40).describe(`نوع القسم، واحد من: ${SECTION_TYPES.join(", ")}`),
  variant: str(40),
  purpose: str(120),
  background: z.enum(["default", "muted", "primary", "dark", "gradient"]).catch("default"),
});
export type OutlineItem = z.infer<typeof outlineItemSchema>;

export const planSchema = z.object({
  brandDirection: z.object({
    name: str(60),
    tagline: str(80),
    positioning: str(300),
    moodWords: strList(20, 6),
    colorStrategy: str(200),
    typographyStrategy: str(120),
    voice: z.enum(["friendly_egyptian", "premium_formal", "playful", "minimal"]).catch("friendly_egyptian"),
    industry: str(60),
  }),
  audience: z.object({
    who: str(200),
    topObjections: strList(120, 6),
    buyingTriggers: strList(120, 6),
  }),
  seoStrategy: z.object({
    metaTitle: str(70).describe("عنوان SEO تسويقي قوي باللغة العربية"),
    metaDescription: str(160).describe("وصف ميتا مختصر للظهور في محركات البحث"),
    keywords: strList(30, 8),
  }).catch({
    metaTitle: "متجر إلكتروني احترافي",
    metaDescription: "تسوق أرقى المنتجات بأعلى معايير الجودة مع الشحن والدفع عند الاستلام كاش في مصر.",
    keywords: ["تسوق اونلاين", "الدفع عند الاستلام", "مصر"],
  }),
  categories: lenientArray(
    z.object({ name: str(40), slug: slugField(), productNames: strList(120, 40) }),
    8
  ),
  homeOutline: lenientArray(outlineItemSchema, 12).transform((a) => a.filter((o) => SECTION_TYPES.includes(o.type))),
  conversionFocus: strList(80, 6),
  productWriting: z.object({ tone: str(120), mustMention: strList(60, 6), avoid: strList(60, 6) }),
  stagesForComposer: lenientArray(z.object({ name: z.enum(["theme", "home", "products", "pages"]), notes: str(400) }), 4),
});
export type Plan = z.infer<typeof planSchema>;

export const themeOut = themeSchema;

export const homeShellOut = z.object({
  header: z.object({
    variant: z.enum(["classic", "centered_logo", "minimal", "mega"]).catch("classic"),
    transparentOnHero: z.boolean().catch(true),
    nav: lenientArray(z.object({ label: str(30), target: z.any() }), 6),
  }).catch({ variant: "classic", transparentOnHero: true, nav: [] }),
  footer: z.object({ variant: z.enum(["rich", "minimal", "centered"]).catch("rich"), tagline: str(160) }).catch({ variant: "rich", tagline: "" }),
  conversionOverrides: z.record(z.unknown()).nullish().catch(undefined).transform((v) => v ?? undefined),
});
export type HomeShell = z.infer<typeof homeShellOut>;

export function sectionsOutFor(types: string[]) {
  const opts = (sectionSchema.options as z.ZodObject<any>[]).filter((o) => types.includes(o.shape.type.value));
  const item: z.ZodTypeAny =
    opts.length >= 2
      ? z.discriminatedUnion("type", opts as unknown as [z.ZodDiscriminatedUnionOption<"type">, ...z.ZodDiscriminatedUnionOption<"type">[]])
      : (opts[0] ?? sectionSchema);
  return z.object({ sections: lenientArray(item, 6) }) as unknown as z.ZodType<{ sections: Section[] }>;
}

export const homeOut = homeShellOut.extend({ home: z.array(sectionSchema) });
export type HomeOut = z.infer<typeof homeOut>;

export const productItemOut = z.object({
  index: z.coerce.number().int().catch(-1),
  name: str(120),
  shortDescription: str(120),
  description: strLines(2500),
  attributes: lenientArray(z.object({ label: str(40), value: str(120) }), 8),
  tags: strList(30, 10),
  badges: strList(20, 1),
  seoTitle: str(70),
  seoDescription: str(160),
  categorySlug: slugField(),
  optionNames: strList(30, 2),
  variantValues: z.array(z.array(z.string().nullish()).nullish()).nullish().catch(undefined).transform((a) => (a ?? []).map((v) => Array.from(new Set((v ?? []).map((s) => squash(s ?? "").slice(0, 40)).filter(Boolean))).slice(0, 12)).slice(0, 2)),
});
export const productsOut = z.object({ products: lenientArray(productItemOut, 12) });
export type ProductOut = z.infer<typeof productItemOut>;
export type ProductsOut = z.infer<typeof productsOut>;

export const pagesOut = z.object({
  pages: lenientArray(policyPageSchema, 8),
  assumptions: strList(160, 10),
  payments: z.object({ codNote: optStr(160), transferInstructions: optStrLines(400) }).catch({}),
  shippingGeneralEta: str(80),
});
export type PagesOut = z.infer<typeof pagesOut>;

export const qaOut = z.object({
  score: z.coerce.number().catch(70).transform((n) => Math.max(0, Math.min(100, Math.round(Number.isFinite(n) ? n : 70)))),
  summary: str(400),
  fixes: lenientArray(z.object({ path: str(80), value: z.unknown(), reason: str(120) }), 40).transform((a) => a.filter((f) => f.path)),
  blockers: strList(160, 10),
});
export type QaOut = z.infer<typeof qaOut>;