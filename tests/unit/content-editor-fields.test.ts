import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { z } from "zod";
import * as S from "@/blueprint/schema";
import { ADDABLE_SECTIONS, ENUM_ALIASES, ENUM_OPTIONS, PATH_FIELDS, SECTION_FIELDS, enumView, visibleKeys } from "@/editor/editable";
import { CONTEXT_LABELS, ENUM_LABELS, FIELD_LABELS } from "@/editor/field-meta";
import { describeIssue } from "@/blueprint/issues";

// يمشي المخطط كما يعرضه SchemaForm (نفس قواعد المسار والإظهار) ويجمع كل حقل وخيار يراه التاجر.
function unwrap(s: z.ZodTypeAny): z.ZodTypeAny {
  let c = s;
  for (;;) {
    if (c instanceof z.ZodOptional || c instanceof z.ZodNullable || c instanceof z.ZodDefault) c = c._def.innerType;
    else return c;
  }
}
const SPECIAL = new Set(["icon", "favicon", "ogImage", "endsAt", "couponCode", "spotlightProductSlug", "productSlugs", "slugs", "categorySlugs"]);
const isImage = (o: z.ZodObject<z.ZodRawShape>) => "url" in o.shape && "focalX" in o.shape;
const isCta = (o: z.ZodObject<z.ZodRawShape>) => "label" in o.shape && "target" in o.shape;

type Seen = { fields: { path: string; name: string }[]; enums: { path: string; value: string }[] };
function walk(schema: z.ZodTypeAny, path: string, name: string | undefined, depth: number, seen: Seen) {
  const inner = unwrap(schema);
  if (depth > 0 && name) seen.fields.push({ path, name });
  if (name && SPECIAL.has(name)) return;
  if (inner instanceof z.ZodEnum) for (const o of enumView(path, inner.options as string[], undefined).options) seen.enums.push({ path, value: o });
  if (inner instanceof z.ZodDiscriminatedUnion) {
    const disc = inner.discriminator as string;
    const opts = inner.options as z.ZodObject<z.ZodRawShape>[];
    const values = opts.map((o) => String((o.shape[disc] as z.ZodLiteral<unknown>).value));
    const allowed = enumView(`${path}.${disc}`, values, undefined).options;
    for (const v of allowed) seen.enums.push({ path: `${path}.${disc}`, value: v });
    for (const o of opts.filter((o) => allowed.includes(String((o.shape[disc] as z.ZodLiteral<unknown>).value))))
      for (const k of visibleKeys(path, Object.keys(o.shape))) if (k !== disc && k !== "slug" && k !== "sectionId") walk(o.shape[k] as z.ZodTypeAny, `${path}.${k}`, k, depth + 1, seen);
  }
  if (inner instanceof z.ZodObject && !isImage(inner)) {
    const keys = visibleKeys(path, Object.keys(inner.shape)).filter((k) => !(isCta(inner) && !["label", "target"].includes(k)));
    for (const k of keys) walk(inner.shape[k] as z.ZodTypeAny, `${path}.${k}`, k, depth + 1, seen);
  }
  if (inner instanceof z.ZodArray) {
    const el = unwrap(inner.element);
    if (el instanceof z.ZodObject && !isImage(el)) walk(el, `${path}[]`, undefined, depth + 1, seen);
    if (el instanceof z.ZodDiscriminatedUnion) walk(el, `${path}[]`, undefined, depth + 1, seen);
  }
}

const PANELS: Record<string, z.ZodTypeAny> = {
  brand: S.brandSchema,
  header: S.headerSchema,
  footer: S.footerSchema,
  conversion: S.conversionSchema,
  productPage: S.productPageSchema,
  seo: S.seoSchema,
};
const sectionOf = (type: string) => (S.sectionSchema.options as unknown as z.ZodObject<z.ZodRawShape>[]).find((o) => (o.shape.type as z.ZodLiteral<string>).value === type)!;

function collect(): Seen {
  const seen: Seen = { fields: [], enums: [] };
  for (const [p, s] of Object.entries(PANELS)) walk(s, p, undefined, 0, seen);
  for (const t of ADDABLE_SECTIONS) walk(sectionOf(t), `section:${t}`, undefined, 0, seen);
  return seen;
}

describe("محرر المحتوى: ما يراه التاجر", () => {
  it("كل حقل ظاهر له اسم عربي", () => {
    const missing = collect().fields.filter((f) => !CONTEXT_LABELS[f.path] && !FIELD_LABELS[f.name]).map((f) => f.path);
    expect(missing).toEqual([]);
  });

  it("كل خيار ظاهر له اسم عربي", () => {
    const missing = collect().enums.filter((e) => !ENUM_LABELS[e.value]).map((e) => `${e.path}=${e.value}`);
    expect(missing).toEqual([]);
  });

  it("قوائم الحقول لا تذكر مفتاحاً غير موجود في المخطط", () => {
    for (const [t, keys] of Object.entries(SECTION_FIELDS)) {
      const shape = sectionOf(t).shape;
      expect(keys!.filter((k) => !(k in shape)), t).toEqual([]);
    }
    const shapeAt = (path: string): Record<string, unknown> | null => {
      const [root, ...rest] = path.replace(/\[\]/g, ".[]").split(".");
      let cur: z.ZodTypeAny | undefined = root!.startsWith("section:") ? sectionOf(root!.slice(8)) : PANELS[root!];
      for (const k of rest) {
        if (!cur) return null;
        const u: z.ZodTypeAny = unwrap(cur);
        if (k === "[]") cur = u instanceof z.ZodArray ? u.element : undefined;
        else cur = u instanceof z.ZodObject ? (u.shape[k] as z.ZodTypeAny) : undefined;
      }
      const u = cur ? unwrap(cur) : null;
      if (u instanceof z.ZodObject) return u.shape;
      if (u instanceof z.ZodDiscriminatedUnion) return Object.assign({}, ...(u.options as z.ZodObject<z.ZodRawShape>[]).map((o) => o.shape));
      return null;
    };
    for (const [path, keys] of Object.entries(PATH_FIELDS)) {
      const shape = shapeAt(path);
      expect(shape, path).not.toBeNull();
      expect(keys.filter((k) => !(k in shape!)), path).toEqual([]);
    }
  });

  it("كل تصميم قديم يُعرض بما يراه العميل (مسموح أو له بديل)", () => {
    for (const [path, allowed] of Object.entries(ENUM_OPTIONS)) {
      if (!path.endsWith(".variant")) continue;
      const root = path.slice(0, -".variant".length);
      const schema = root.startsWith("section:") ? sectionOf(root.slice(8)).shape.variant : (PANELS[root] as z.ZodObject<z.ZodRawShape>).shape.variant;
      const all = (unwrap(schema as z.ZodTypeAny) as z.ZodEnum<[string, ...string[]]>).options;
      const orphan = all.filter((v) => !allowed.includes(v) && !ENUM_ALIASES[path]?.[v]);
      expect(orphan, path).toEqual([]);
      for (const v of all) expect(allowed, `${path}=${v}`).toContain(enumView(path, all, v).selected);
    }
  });

  it("الأقسام القابلة للإضافة = ما يعرضه المتجر (registry.tsx)", () => {
    const src = readFileSync("src/blueprint/registry.tsx", "utf8");
    const body = src.slice(src.indexOf("switch (s.type)"));
    const rendered = [...body.matchAll(/case "([a-z_]+)":/g)].map((m) => m[1]!).filter((t) => t in SECTION_FIELDS || (S.sectionSchema.options as unknown as z.ZodObject<z.ZodRawShape>[]).some((o) => (o.shape.type as z.ZodLiteral<string>).value === t));
    expect([...new Set(rendered)].sort()).toEqual([...ADDABLE_SECTIONS].sort());
  });

  it("خطأ في عنصر متداخل يُسمّى بالعربية", () => {
    const bp = { home: [{ id: "f1", type: "faq", items: [{ q: "", a: "" }] }] };
    const d = describeIssue({ code: "too_small", type: "string", minimum: 1, inclusive: true, path: ["home", 0, "items", 0, "q"], message: "" }, bp as never);
    expect(d.text).toBe("قسم «أسئلة شائعة» · السؤال: لا يمكن أن يكون فارغاً");
    expect(d.target.sectionId).toBe("f1");
  });
});
