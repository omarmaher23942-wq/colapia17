// schema-map.ts — «خريطة ما يمكن تعديله» مبنية آلياً من مخطط الـ Blueprint (Zod) والقيم الحالية للمتجر.
// كل ورقة في المخطط (لون، خيار، رقم بحدوده، مفتاح تشغيل، نص بطوله) تصير حقلاً بمسار واسم عربي ومخططها الأصلي للتحقق.
// أي حقل جديد يضيفه فريق التصميم في المخطط (theme/design) يظهر هنا تلقائياً دون تعديل. خالص (بلا خادم).
import { z } from "zod";
import { blueprintSchema, sectionSchema, type StoreBlueprint } from "@/blueprint/schema";
import { THEMES } from "@/blueprint/themes";
import { labelForPath, PAGE_LABELS, SECTION_LABELS } from "./labels";

export type FieldKind = "color" | "enum" | "number" | "boolean" | "text" | "order";

export type EditableField = {
  path: string;
  kind: FieldKind;
  label: string;
  /** مجموعة للعرض والبرومبت: theme | design | brand | header | footer | home | pages | seo | copy | productPage. */
  group: string;
  options?: string[];
  min?: number;
  max?: number;
  int?: boolean;
  minLen?: number;
  maxLen?: number;
  /** مخطط الورقة نفسها من الـ Blueprint (للتحقق النهائي من القيمة). غائب للحقول المركّبة. */
  schema?: z.ZodTypeAny;
  value: unknown;
};

// ─── المسارات ────────────────────────────────────────────────────────────────
export type Seg = string | number;
const UNSAFE = new Set(["__proto__", "prototype", "constructor"]);

/** «home:<id>.title» ← ["home", 3, "title"]، «pages:returns.body» ← ["pages", 1, "body"]. null إن لم يوجد الهدف. */
export function resolvePath(bp: StoreBlueprint, path: string): Seg[] | null {
  if (typeof path !== "string" || path.length > 160) return null;
  const out: Seg[] = [];
  for (const raw of path.split(".")) {
    if (!raw || UNSAFE.has(raw)) return null;
    const m = /^(home|pages):(.+)$/.exec(raw);
    if (m && out.length === 0) {
      const list = m[1] === "home" ? bp.home : bp.pages;
      const i = list.findIndex((s) => (m[1] === "home" ? (s as { id: string }).id : (s as { slug: string }).slug) === m[2]);
      if (i < 0) return null;
      out.push(m[1]!, i);
      continue;
    }
    out.push(/^\d{1,3}$/.test(raw) ? Number(raw) : raw);
  }
  return out;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

export function getAt(root: unknown, segs: Seg[]): unknown {
  let cur: unknown = root;
  for (const s of segs) {
    if (cur == null) return undefined;
    cur = (cur as Record<string | number, unknown>)[s];
  }
  return cur;
}

/** يكتب القيمة وينشئ الكائنات الوسيطة الناقصة (حقل اختياري لم يُضبط من قبل). undefined يحذف المفتاح. */
export function setAt(root: Record<string, unknown>, segs: Seg[], value: unknown): void {
  let cur: Record<string | number, unknown> = root;
  for (let i = 0; i < segs.length - 1; i++) {
    const s = segs[i]!;
    const nextIsIndex = typeof segs[i + 1] === "number";
    if (cur[s] == null || typeof cur[s] !== "object") cur[s] = nextIsIndex ? [] : {};
    cur = cur[s] as Record<string | number, unknown>;
  }
  const last = segs[segs.length - 1]!;
  if (value === undefined && !Array.isArray(cur)) delete cur[last];
  else cur[last] = value;
}

// ─── تفكيك مخطط Zod (v3) ─────────────────────────────────────────────────────
type Def = { typeName?: string; innerType?: z.ZodTypeAny; schema?: z.ZodTypeAny; checks?: { kind: string; value?: number; regex?: RegExp }[]; type?: z.ZodTypeAny };
const def = (s: z.ZodTypeAny) => (s as unknown as { _def: Def })._def;

export function unwrap(s: z.ZodTypeAny): z.ZodTypeAny {
  let cur = s;
  for (let i = 0; i < 10; i++) {
    const d = def(cur);
    if (d.typeName === "ZodDefault" || d.typeName === "ZodOptional" || d.typeName === "ZodNullable" || d.typeName === "ZodCatch" || d.typeName === "ZodBranded") cur = d.innerType ?? (cur as unknown as { unwrap: () => z.ZodTypeAny }).unwrap();
    else if (d.typeName === "ZodEffects") cur = d.schema!;
    else break;
  }
  return cur;
}

/** مفاتيح لا تُعدَّل بالكلام في أي مكان: صور وروابط ومعرّفات وحقائق السياسة ومفاتيح التتبع وما لا يعرضه المتجر. */
const SKIP_KEYS = new Set([
  "id", "anchor", "fact", "focalX", "focalY", "icon", "backgroundImage", "images", "image", "avatar", "screenshot", "poster",
  "founderImage", "logo", "logoDark", "favicon", "ogImage", "target", "source", "categorySlugs", "productSlugs", "spotlightProductSlug",
  "videoUrl", "audioUrl", "audioDuration", "mapEmbedUrl", "postUrl", "props", "blocks", "couponCode", "endsAt", "handle",
  "enableParallax", "enableKineticTypography", "enableAmbientGlow", "autoplayMs", "voice", "industry", "darkPalette", "ambientBackdrop",
  "backgroundPattern", "concept", "mood", "verified", "rating", "metaPixelId", "gaMeasurementId", "tiktokPixelId", "googleVerification",
  "noIndex", "extraSections", "reveal", "milestones", "includeVerifiedReviews", "bundleDiscountPercent", "highlights",
]);
/** أقسام عناصرها ادعاءات أو أرقام حقيقية: لا يُعاد صياغتها آلياً (لا آراء مخترعة ولا أرقام ولا وعود). */
const NO_ITEMS = new Set(["testimonials", "stats", "trust_badges", "steps", "instagram_gallery", "promo_banner"]);
const SECTION_TONES = ["default", "muted", "primary", "dark", "gradient"];

type Walk = { out: EditableField[]; group: string; labelPrefix?: string };

function leaf(s: z.ZodTypeAny, path: string, value: unknown, w: Walk, labelOverride?: string): void {
  const u = unwrap(s);
  const d = def(u);
  const label = labelOverride ?? (w.labelPrefix ? `${w.labelPrefix}: ${labelForPath(path)}` : labelForPath(path));
  const base = { path, label, group: w.group, schema: s, value };
  switch (d.typeName) {
    case "ZodEnum":
      w.out.push({ ...base, kind: "enum", options: [...(u as z.ZodEnum<[string, ...string[]]>).options] });
      return;
    case "ZodBoolean":
      w.out.push({ ...base, kind: "boolean" });
      return;
    case "ZodNumber": {
      const f: EditableField = { ...base, kind: "number" };
      for (const c of d.checks ?? []) {
        if (c.kind === "min") f.min = c.value;
        if (c.kind === "max") f.max = c.value;
        if (c.kind === "int") f.int = true;
      }
      w.out.push(f);
      return;
    }
    case "ZodString": {
      const checks = d.checks ?? [];
      const rx = checks.find((c) => c.kind === "regex")?.regex;
      if (rx && /0-9a-fA-F|0-9a-f/.test(rx.source)) {
        w.out.push({ ...base, kind: "color" });
        return;
      }
      if (rx || checks.some((c) => c.kind === "url" || c.kind === "email" || c.kind === "uuid")) return;
      const f: EditableField = { ...base, kind: "text", maxLen: 300 };
      for (const c of checks) {
        if (c.kind === "max") f.maxLen = c.value;
        if (c.kind === "min") f.minLen = c.value;
      }
      w.out.push(f);
      return;
    }
  }
}

function walk(s: z.ZodTypeAny, path: string, value: unknown, w: Walk): void {
  const u = unwrap(s);
  const d = def(u);
  if (d.typeName === "ZodObject") {
    const shape = (u as z.ZodObject<z.ZodRawShape>).shape;
    for (const [k, child] of Object.entries(shape)) {
      if (SKIP_KEYS.has(k)) continue;
      walk(child as z.ZodTypeAny, `${path}.${k}`, isObj(value) ? value[k] : undefined, w);
    }
    return;
  }
  if (d.typeName === "ZodArray") {
    const el = unwrap(d.type!);
    if (def(el).typeName !== "ZodObject" || !Array.isArray(value)) return;
    value.slice(0, 15).forEach((item, i) => walk(el, `${path}.${i}`, item, w));
    return;
  }
  leaf(s, path, value, w);
}

const ROOTS: { key: keyof StoreBlueprint; group: string; only?: string[] }[] = [
  { key: "theme", group: "theme" },
  { key: "design", group: "design" },
  { key: "brand", group: "brand", only: ["name", "tagline", "description"] },
  { key: "header", group: "header" },
  { key: "footer", group: "footer" },
  { key: "seo", group: "seo", only: ["title", "description"] },
  { key: "copy", group: "copy" },
  { key: "productPage", group: "productPage" },
];

type SectionOption = z.ZodObject<z.ZodRawShape>;
const sectionOptions = (sectionSchema as unknown as { optionsMap: Map<string, SectionOption> }).optionsMap;
const pageShape = (unwrap((blueprintSchema.shape.pages as z.ZodTypeAny)) as unknown as { _def: { type: z.ZodTypeAny } })._def.type;

/** كل ما يمكن تعديله في هذا المتجر الآن، بمساراته وأسمائه وقيمه الحالية. */
export function editableFields(bp: StoreBlueprint): EditableField[] {
  const out: EditableField[] = [];
  const shape = blueprintSchema.shape as Record<string, z.ZodTypeAny>;

  // التصميم الكامل (هوية جاهزة) وشريط الإعلان وترتيب الأقسام: حقول مركّبة تُطبَّق بقواعدها (apply.ts).
  out.push({ path: "theme.preset", kind: "enum", label: labelForPath("theme.preset"), group: "theme", options: THEMES.map((t) => t.id), value: themeIdOf(bp) });
  const ann = bp.header.announcement;
  out.push({ path: "announcement.text", kind: "text", label: labelForPath("announcement.text"), group: "header", minLen: 0, maxLen: 120, value: ann?.enabled === false ? "" : ann?.items?.[0]?.text ?? "" });

  for (const r of ROOTS) {
    const rootSchema = unwrap(shape[r.key]!);
    const rootShape = (rootSchema as z.ZodObject<z.ZodRawShape>).shape;
    const value = bp[r.key] as unknown;
    for (const [k, child] of Object.entries(rootShape)) {
      if (SKIP_KEYS.has(k) || (r.only && !r.only.includes(k))) continue;
      walk(child as z.ZodTypeAny, `${r.key}.${k}`, isObj(value) ? value[k] : undefined, { out, group: r.group });
    }
  }

  // أقسام الرئيسية: كل قسم بمعرّفه ونوعه.
  out.push({ path: "home.order", kind: "order", label: labelForPath("home.order"), group: "home", value: bp.home.map((s) => s.id) });
  for (const s of bp.home) {
    if (s.type === "announcement") continue; // شريط الإعلان يُدار من announcement.text (يُعرض من الهيدر).
    const opt = sectionOptions.get(s.type);
    if (!opt) continue;
    const prefix = `قسم «${sectionTitle(s)}»`;
    const w: Walk = { out, group: "home", labelPrefix: prefix };
    const p = `home:${s.id}`;
    out.push({ path: `${p}.enabled`, kind: "boolean", label: `${prefix}: ظاهر`, group: "home", schema: z.boolean(), value: s.enabled !== false });
    if (s.type !== "hero") out.push({ path: `${p}.background`, kind: "enum", label: `${prefix}: خلفية القسم`, group: "home", options: SECTION_TONES, schema: z.enum(SECTION_TONES as [string, ...string[]]), value: s.background });
    if (s.type === "categories") out.push({ path: `${p}.variant`, kind: "enum", label: `${prefix}: شكل العرض`, group: "home", options: ["circles", "grid"], schema: z.enum(["circles", "grid"]), value: s.variant === "grid" ? "grid" : "circles" });
    for (const [k, child] of Object.entries(opt.shape)) {
      if (SKIP_KEYS.has(k) || k === "type" || k === "enabled" || k === "background" || k === "variant") continue;
      if (k === "items" && NO_ITEMS.has(s.type)) continue;
      walk(child as z.ZodTypeAny, `${p}.${k}`, (s as Record<string, unknown>)[k], w);
    }
  }

  // نصوص الصفحات (السياسات): الموجودة فقط.
  for (const pg of bp.pages) {
    const prefix = PAGE_LABELS[pg.slug] ?? pg.slug;
    const ps = (unwrap(pageShape) as z.ZodObject<z.ZodRawShape>).shape;
    for (const k of ["title", "body", "enabled", "showInFooter"]) leaf(ps[k] as z.ZodTypeAny, `pages:${pg.slug}.${k}`, (pg as Record<string, unknown>)[k], { out, group: "pages" }, `${prefix}: ${k === "title" ? "العنوان" : k === "body" ? "النص" : k === "enabled" ? "ظاهرة" : "في الفوتر"}`);
  }
  return out;
}

export function sectionTitle(s: StoreBlueprint["home"][number]): string {
  const t = (s as { title?: string; headline?: string }).title ?? (s.type === "hero" ? s.headline : undefined);
  const base = SECTION_LABELS[s.type] ?? s.type;
  return t && s.type !== "hero" ? `${base} — ${t.slice(0, 30)}` : base;
}

/** معرّف التصميم الحالي إن كان المخطط يحمله (design.theme أو theme.id، يضيفه فريق التصميم). */
export function themeIdOf(bp: StoreBlueprint): string | undefined {
  const d = bp.design as Record<string, unknown>;
  const t = bp.theme as Record<string, unknown>;
  const v = d.theme ?? t.id ?? t.preset;
  return typeof v === "string" ? v : undefined;
}

export function fieldIndex(fields: EditableField[]): Map<string, EditableField> {
  return new Map(fields.map((f) => [f.path, f]));
}

/** هل يحمل المخطط هذا المسار (لحقول اختيارية قد لا توجد بعد، مثل theme.background). */
export function schemaHas(path: string): boolean {
  let cur: z.ZodTypeAny = blueprintSchema;
  for (const k of path.split(".")) {
    const u = unwrap(cur);
    if (def(u).typeName !== "ZodObject") return false;
    const next = (u as z.ZodObject<z.ZodRawShape>).shape[k];
    if (!next) return false;
    cur = next as z.ZodTypeAny;
  }
  return true;
}

const fmt = (v: unknown) => (typeof v === "string" ? JSON.stringify(v.length > 70 ? `${v.slice(0, 70)}…` : v) : Array.isArray(v) ? `[${v.join(", ")}]` : String(v));

/** الخريطة نصاً للنموذج: سطر لكل حقل «المسار | الاسم | النوع | القيمة الحالية». */
export function mapForPrompt(fields: EditableField[]): string {
  return fields
    .map((f) => {
      const t =
        f.kind === "enum" ? `خيار: ${f.options!.join("|")}`
        : f.kind === "number" ? `رقم ${f.min ?? ""}..${f.max ?? ""}${f.int ? " صحيح" : ""}`
        : f.kind === "text" ? `نص ≤${f.maxLen}`
        : f.kind === "order" ? "قائمة معرّفات"
        : f.kind === "color" ? "لون #rrggbb"
        : "true|false";
      return `${f.path} | ${f.label} | ${t} | ${f.value === undefined ? "—" : fmt(f.value)}`;
    })
    .join("\n");
}

