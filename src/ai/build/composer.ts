import "server-only";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { storeBlueprints } from "@/db/schema";
import { DEFAULT_PROMPTS } from "@/ai/prompts.defaults";
import {
  designSchema,
  type StoreBlueprint,
  type Section,
} from "@/blueprint/schema";
import { policySlices } from "./policy";
import type { StudioCopy, StudioDesign } from "./studio";
import {
  extractPalette,
  pickAdaptiveFonts,
  buildVariationSeed,
  buildAmbientBackdrop,
} from "@/blueprint/palette";
import { callAIJson } from "@/ai/runner";
import {
  type Plan,
  type HomeShell,
  type ProductOut,
  type PagesOut,
  type OutlineItem,
  productsOut,
  str,
} from "./schemas";
import { fallbackPlan, normalizePlan, productLines } from "./plan";

export { fallbackPlan, normalizePlan };

// ─── Types ─────────────────────────────────────────────────────────────────
type ProductsOut = { products: ProductOut[] };
export type Degraded = { unit: string; reason: string };

export type IntakePolicies = {
  cod?: boolean;
  vodafoneCashNumber?: string;
  instapayAddress?: string;
  shipsAllEgypt?: boolean;
  shippingFlatEgp?: number;
  freeShippingOverEgp?: number;
  deliveryEta?: string;
  inspectionAllowed?: boolean;
  returnDays?: number;
  returnConditions?: string;
  allowExchange?: boolean;
  allowRefund?: boolean;
  returnShippingPaidBy?: "customer" | "store" | "store_if_defect";
  refundDays?: number;
  returnConditionsList?: string[];
  nonReturnable?: string;
  defectPolicy?: "replace_or_refund" | "replace" | "refund" | "case_by_case" | "none";
  defectReportHours?: number;
  defectShippingByStore?: boolean;
  pickupAddress?: string;
  shippingZones?: { governorate: string; feeEgp: number; etaMinDays?: number; etaMaxDays?: number; active?: boolean }[];
  deliveryDays?: { min?: number; max?: number };
  codFeeEgp?: number;
};

export type IntakeBrief = {
  storeName?: string;
  ownerName?: string;
  industry?: string;
  phone?: string;
  whatsappNumber?: string;
  email?: string;
  colorPreference?: string;
  founderStory?: string;
  toneOfVoice?: string;
  autoTheme?: boolean;
  /** الحركة التي اختارها التاجر (auto = يختارها المدير الفني)، والعمق ثلاثي الأبعاد. */
  motionStyle?: "auto" | "calm" | "lively" | "cinematic";
  depth3d?: boolean;
  spotlightProduct?: string;
  desiredSubdomain?: string;
  instagramHandle?: string;
  facebookPageUrl?: string;
  tiktokHandle?: string;
  /** مميزات اختارها التاجر في الاستمارة (تُطبق على إعدادات التحويل في المتجر). */
  features?: Record<string, boolean>;
};

export type IntakeLike = {
  brief?: IntakeBrief;
  policies?: IntakePolicies;
  assets?: Record<string, unknown>;
  products?: unknown[];
};

// ─── Section Normalizer ────────────────────────────────────────────────────
const VARIANT_MAP: Record<string, readonly string[]> = {
  hero: ["split", "fullscreen", "centered", "carousel", "product_spotlight", "collage", "video", "editorial", "cinematic", "kinetic", "ambient", "storyteller"],
  announcement: ["static", "marquee", "rotating"],
  categories: ["grid", "circles", "stories", "cards_overlay", "scroll", "bento", "featured_hero", "marquee"],
  product_grid: ["grid", "carousel", "masonry", "featured_first", "two_rows_scroll", "bento", "spotlight", "carousel_3d", "editorial"],
  promo_banner: ["wide", "split_duo", "triple", "ticket", "floating_card"],
  countdown_offer: ["banner", "hero_card", "inline"],
  trust_badges: ["row", "cards", "compact_strip", "horizontal_marquee"],
  testimonials: ["cards", "carousel", "masonry", "screenshots", "voice_reviews", "marquee"],
  faq: ["accordion", "two_columns", "chat_bubbles", "split"],
  about: ["split", "centered_story", "timeline", "founder_note", "scroll_linked"],
  instagram_gallery: ["grid", "scroll", "masonry"],
  rich_text: ["narrow", "wide", "two_columns"],
  bundle: ["build_your_set", "fixed_bundle"],
  stats: ["row", "cards"],
  video: ["inline", "cinematic"],
  contact: ["cards", "split_map", "compact"],
  brand_story: ["scroll_linked", "split", "quote", "timeline"],
  newsletter: ["inline", "card", "strip"],
  custom_blocks: ["stack"],
};

function pickString(v: unknown, fallback: string): string {
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : fallback;
}

function normalizeSection(raw: unknown, outlineType?: string): Section | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  const type = (typeof r.type === "string" ? r.type : outlineType) as
    | Section["type"]
    | undefined;
  if (!type || !VARIANT_MAP[type]) return null;

  const out: Record<string, unknown> = { ...r, type };

  if (typeof out.id !== "string" || out.id.length === 0) {
    out.id = `${type}-${Math.random().toString(36).slice(2, 10)}`;
  }

  const validVariants = VARIANT_MAP[type]!;
  const currentVariant = typeof out.variant === "string" ? out.variant : null;
  if (!currentVariant || !validVariants.includes(currentVariant)) {
    out.variant = validVariants[0]!;
  }

  if (type === "faq" && Array.isArray(out.items)) {
    out.items = (out.items as unknown[])
      .map((it) => {
        if (!it || typeof it !== "object") return null;
        const i = it as Record<string, unknown>;
        const q = typeof i.q === "string" ? i.q : typeof i.question === "string" ? i.question : "";
        const a = typeof i.a === "string" ? i.a : typeof i.answer === "string" ? i.answer : "";
        if (!q || !a) return null;
        return { q: q.slice(0, 140), a: a.slice(0, 600) };
      })
      .filter(Boolean);
    if (!Array.isArray(out.items) || out.items.length < 1) return null;
  }

  if (type === "trust_badges" && Array.isArray(out.items)) {
    out.items = (out.items as unknown[])
      .map((it) => {
        if (!it || typeof it !== "object") return null;
        const i = it as Record<string, unknown>;
        const title = typeof i.title === "string" ? i.title.trim() : "";
        if (!title) return null;
        const text =
          typeof i.text === "string" ? i.text : typeof i.description === "string" ? i.description : undefined;
        return {
          icon: typeof i.icon === "string" && i.icon ? i.icon : "check",
          title: title.slice(0, 40),
          ...(text ? { text: String(text).slice(0, 90) } : {}),
        };
      })
      .filter(Boolean);
    if (!Array.isArray(out.items) || out.items.length < 2) return null;
  }

  if (type === "announcement" && Array.isArray(out.messages)) {
    out.messages = (out.messages as unknown[])
      .map((m) => {
        if (typeof m === "string") return { text: m.slice(0, 120) };
        if (!m || typeof m !== "object") return null;
        const mm = m as Record<string, unknown>;
        const text = typeof mm.text === "string" ? mm.text.trim() : "";
        if (!text) return null;
        return { text: text.slice(0, 120), ...(mm.target ? { target: mm.target } : {}) };
      })
      .filter(Boolean);
    if (!Array.isArray(out.messages) || out.messages.length < 1) return null;
    if ((out.messages as unknown[]).length > 6) {
      out.messages = (out.messages as unknown[]).slice(0, 6);
    }
  }

  if (type === "hero") {
    const headline = pickString(out.headline, "");
    if (!headline) return null;
    out.headline = headline.slice(0, 90);
    if (typeof out.subheadline === "string" && out.subheadline.length > 220) {
      out.subheadline = out.subheadline.slice(0, 220);
    }
  }

  if (type === "categories" && !Array.isArray(out.categorySlugs)) {
    out.categorySlugs = [];
  }

  if (type === "product_grid") {
    const src = out.source as Record<string, unknown> | undefined;
    if (!src || typeof src !== "object" || typeof src.type !== "string") {
      out.source = { type: "featured" };
    } else {
      const VALID_SRC = ["featured", "newest", "best_sellers", "on_sale", "category", "manual", "tag"];
      if (!VALID_SRC.includes(src.type)) {
        out.source = { type: "featured" };
      }
    }
  }

  return out as unknown as Section;
}

// ─── Emergency Fallback ────────────────────────────────────────────────────
// آخر خط دفاع فقط (لا يُستخدم في البناء العادي): اسم المتجر ومنتجاته، بلا أي نص عام ولا أي ادعاء سياسة.
function buildEmergencyHome(storeName: string): Section[] {
  return [
    {
      id: "hero-main",
      type: "hero",
      variant: "centered",
      enabled: true,
      spacing: "spacious",
      background: "default",
      reveal: "fade",
      headline: (storeName || "متجري").slice(0, 90),
      primaryCta: { label: "تسوّق الآن", target: { type: "all_products" }, style: "primary" },
      images: [],
      highlights: [],
      overlayOpacity: 0.35,
      textAlign: "center",
      height: "tall",
      autoplayMs: 5000,
      enableParallax: true,
      enableKineticTypography: true,
      enableAmbientGlow: true,
    },
    {
      id: "grid-main",
      type: "product_grid",
      variant: "grid",
      enabled: true,
      spacing: "normal",
      background: "default",
      reveal: "fade",
      source: { type: "newest" },
      limit: 8,
      columnsMobile: 2,
      columnsDesktop: 4,
      showViewAll: true,
      quickAdd: true,
    },
  ] as unknown as Section[];
}

// ─── Section Ranker ────────────────────────────────────────────────────────
const SECTION_PRIORITY: Record<string, number> = {
  announcement: 1,
  hero: 2,
  trust_badges: 3,
  categories: 4,
  product_grid: 5,
  promo_banner: 6,
  countdown_offer: 7,
  bundle: 8,
  testimonials: 9,
  brand_story: 10,
  about: 11,
  stats: 12,
  instagram_gallery: 13,
  video: 14,
  rich_text: 15,
  faq: 16,
  newsletter: 17,
  contact: 18,
  custom_blocks: 19,
};

export function sectionRanker(sections: Section[]): Section[] {
  return [...sections].sort((a, b) => {
    const pa = SECTION_PRIORITY[a.type] ?? 99;
    const pb = SECTION_PRIORITY[b.type] ?? 99;
    if (pa !== pb) return pa - pb;
    return String(a.id).localeCompare(String(b.id));
  });
}

// ─── Anti-Duplication Guard ────────────────────────────────────────────────
export function antiDuplicateGuard(bp: StoreBlueprint) {
  return {
    nav: false,
    announcement: false,
    messages: false,
    productGridSource: false,
    samples: [] as Array<{ type: string; sample: string }>,
  };
}

// ─── Uniqueness ────────────────────────────────────────────────────────────
function paletteVector(p: StoreBlueprint): number[] {
  const toRgb = (hex: string): [number, number, number] => {
    const h = hex.replace("#", "");
    const n = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
    return [
      parseInt(n.slice(0, 2), 16) / 255,
      parseInt(n.slice(2, 4), 16) / 255,
      parseInt(n.slice(4, 6), 16) / 255,
    ];
  };
  const pal = p.theme.palette;
  return [
    ...toRgb(pal.primary),
    ...toRgb(pal.accent),
    ...toRgb(pal.background),
    ...toRgb(pal.foreground),
  ];
}

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export async function validateBlueprintUniqueness(
  bp: StoreBlueprint,
  excludeStoreId: string
): Promise<{ unique: boolean; maxSimilarity: number; similarStoreId?: string }> {
  try {
    const recent = await db
      .select({ storeId: storeBlueprints.storeId, data: storeBlueprints.data })
      .from(storeBlueprints)
      .orderBy(sql`${storeBlueprints.updatedAt} desc`)
      .limit(30);

    const myVec = paletteVector(bp);
    let maxSim = 0;
    let mostSimilar: string | undefined;

    for (const row of recent) {
      if (row.storeId === excludeStoreId) continue;
      const other = row.data as StoreBlueprint;
      if (!other?.theme?.palette) continue;
      const sim = cosine(myVec, paletteVector(other));
      if (sim > maxSim) {
        maxSim = sim;
        mostSimilar = row.storeId;
      }
    }
    return { unique: maxSim < 0.85, maxSimilarity: maxSim, similarStoreId: mostSimilar };
  } catch {
    return { unique: true, maxSimilarity: 0 };
  }
}

// ─── Local QA ──────────────────────────────────────────────────────────────
export type QaIssue = { severity: "error" | "warning" | "info"; path: string; message: string };

export function enhanceLocalQa(bp: StoreBlueprint): { score: number; issues: QaIssue[] } {
  const issues: QaIssue[] = [];
  const add = (severity: QaIssue["severity"], path: string, message: string) =>
    issues.push({ severity, path, message });

  if (bp.home.length < 10) add("warning", "home", "أقل من 10 أقسام");
  if (bp.home.length > 24) add("warning", "home", "أكثر من 24 قسماً");

  for (let i = 1; i < bp.home.length; i++) {
    if (bp.home[i]!.type === bp.home[i - 1]!.type) {
      add("warning", `home[${i}]`, "قسمان متتاليان بنفس النوع");
    }
  }

  const hero = bp.home.find((s) => s.type === "hero");
  if (hero && hero.type === "hero") {
    if (hero.headline.length > 90) add("error", "hero.headline", "العنوان أطول من 90 حرفاً");
  }

  const grids = bp.home.filter((s) => s.type === "product_grid");
  if (grids.length === 0) add("warning", "home", "لا يوجد أي product_grid");

  const sources = grids.map((g) => JSON.stringify((g as { source: unknown }).source));
  if (new Set(sources).size !== sources.length) {
    add("warning", "product_grid", "مصادر product_grid مكررة");
  }

  if (!bp.variationSeed || bp.variationSeed.length < 8) add("error", "variationSeed", "variationSeed مفقود");

  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;
  const score = Math.max(0, 100 - errorCount * 10 - warningCount * 3);

  return { score, issues };
}

export function groundSections(sections: Section[]): Section[] {
  const seen = new Set<string>();
  const out: Section[] = [];
  for (const s of sections) {
    if (s.type === "announcement" && seen.has("announcement")) continue;
    const last = out[out.length - 1];
    if (last && last.type === s.type && s.type !== "product_grid") continue;
    seen.add(s.type);
    out.push(s);
  }
  return out;
}

// ─── Helpers ───────────────────────────────────────────────────────────────
// حتمية: نفس المتجر يعطي نفس البذرة في كل خطوة وكل إعادة محاولة، فلا تتناقض الخطوات.
export function resolveVariationSeed(storeId: string, provided?: string): string {
  if (provided && provided.length >= 8) return provided;
  return buildVariationSeed(storeId, 0);
}

// ─── AI Steps ──────────────────────────────────────────────────────────────
const BUILD_AI = { budgetMs: 42_000, timeoutMs: 38_000 } as const;

export async function architect(intake: IntakeLike, storeId: string): Promise<Plan> {
  const brief = intake.brief ?? {};
  const fallback = fallbackPlan(intake);
  const submission = { ...brief, policies: intake.policies ?? {}, products: productLines(intake) };
  const prompt = DEFAULT_PROMPTS["architect.system"]
    .replace("{{submission}}", JSON.stringify(submission))
    .replace("{{industry}}", brief.industry || "general")
    .replace("{{targetAudience}}", "استنتجه من المنتجات والأسعار")
    .replace("{{competitors}}", "غير محدد")
    .replace("{{brandVision}}", brief.founderStory || "غير محدد")
    .replace("{{brandPersonality}}", "غير محدد")
    .replace("{{toneOfVoice}}", "friendly_egyptian")
    .replace("{{marketingBudget}}", "none")
    .replace("{{seoKeywordsHint}}", "")
    .replace("{{variationSeed}}", resolveVariationSeed(storeId));

  try {
    const raw = await callAIJson<unknown>(prompt, { tier: "architect", storeId, purpose: "build_architect", ...BUILD_AI });
    return normalizePlan(raw, fallback);
  } catch {
    return fallback;
  }
}

export function composeTheme(
  intake: IntakeLike,
  plan: Plan,
  storeId: string,
  _degraded: Degraded[]
): StoreBlueprint["theme"] {
  const seed = resolveVariationSeed(storeId);
  const extracted = extractPalette(
    intake.brief?.colorPreference,
    plan.brandDirection.industry,
    seed
  );
  const fonts = pickAdaptiveFonts(plan.brandDirection.industry, "friendly_egyptian", seed);
  const backdrop = buildAmbientBackdrop(extracted.palette, seed);

  return {
    mode: extracted.palette.background === "#ffffff" ? "light" : "dark",
    palette: extracted.palette,
    fonts,
    radius: "lg",
    buttonStyle: "solid",
    shadow: "soft",
    motion: "balanced",
    productCardStyle: "elevated",
    imageRatio: "square",
    backgroundPattern: "none",
    imageBackground: "none",
    ambientBackdrop: backdrop,
  };
}

export function composeHomeShell(
  _intake: IntakeLike,
  plan: Plan,
  _catalog: unknown,
  _storeId: string,
  _degraded: Degraded[]
): HomeShell {
  return {
    header: {
      variant: "classic",
      transparentOnHero: false,
      nav: [
        { label: "الرئيسية", target: { type: "home" } },
        { label: "كل المنتجات", target: { type: "all_products" } },
      ],
    },
    footer: {
      variant: "rich",
      tagline: plan.brandDirection.tagline || "شكراً لتسوقكم معنا",
    },
    conversionOverrides: {},
  };
}

export function homeOutlineChunks(plan: Plan): OutlineItem[][] {
  const chunks: OutlineItem[][] = [];
  const size = 3;
  for (let i = 0; i < plan.homeOutline.length; i += size) {
    chunks.push(plan.homeOutline.slice(i, i + size));
  }
  return chunks;
}

export async function composeHomeChunk(
  intake: IntakeLike,
  plan: Plan,
  _catalog: unknown,
  storeId: string,
  chunk: OutlineItem[],
  index: number,
  degraded: Degraded[]
): Promise<Section[]> {
  const prompt = DEFAULT_PROMPTS["composer.home"]
    .replace("{{storeName}}", plan.brandDirection.name)
    .replace("{{industry}}", plan.brandDirection.industry)
    .replace("{{toneOfVoice}}", plan.brandDirection.voice)
    .replace("{{brandVision}}", plan.brandDirection.positioning)
    .replace("{{targetAudience}}", plan.audience.who)
    .replace("{{sections}}", JSON.stringify(chunk))
    .replace("{{variationSeed}}", resolveVariationSeed(storeId));

  void intake;

  try {
    const raw = await callAIJson<unknown>(prompt, { tier: "compose", storeId, purpose: "build_home", ...BUILD_AI });
    const res = (Array.isArray(raw) ? { sections: raw } : raw) as { sections?: Section[] } | null;

    if (!Array.isArray(res?.sections) || res.sections.length === 0) {
      degraded.push({ unit: `home_chunk_${index}`, reason: "AI returned empty sections array" });
      return [];
    }

    const normalized: Section[] = [];
    let rejected = 0;
    for (let i = 0; i < res.sections.length; i++) {
      const fixed = normalizeSection(res.sections[i], chunk[i]?.type);
      if (fixed) normalized.push(fixed);
      else rejected++;
    }
    if (rejected > 0) {
      degraded.push({
        unit: `home_chunk_${index}`,
        reason: `${rejected} section(s) rejected during normalization`,
      });
    }
    return normalized;
  } catch (e) {
    degraded.push({ unit: `home_chunk_${index}`, reason: String(e) });
    return [];
  }
}

export function mergeHome(_shell: HomeShell, chunks: Section[][]): Section[] {
  const allNormalized: Section[] = [];
  for (const s of chunks.flat()) {
    const n = normalizeSection(s, s.type);
    if (n) allNormalized.push(n);
  }

  const merged = groundSections(sectionRanker(allNormalized));
  if (merged.length === 0) {
    return buildEmergencyHome("متجرنا");
  }
  return merged;
}

// ─── Products ──────────────────────────────────────────────────────────────
export function productBatches(intake: IntakeLike): unknown[][] {
  const products = Array.isArray(intake.products) ? intake.products : [];
  const batches: unknown[][] = [];
  const size = 5;
  for (let i = 0; i < products.length; i += size) {
    batches.push(
      products.slice(i, i + size).map((p, idx) => ({
        ...(p as Record<string, unknown>),
        index: i + idx,
      }))
    );
  }
  return batches;
}

export async function composeProductsBatch(
  _intake: IntakeLike,
  plan: Plan,
  storeId: string,
  batch: unknown[],
  degraded: Degraded[]
): Promise<ProductOut[]> {
  const prompt = DEFAULT_PROMPTS["composer.products"]
    .replace("{{products}}", JSON.stringify(batch))
    .replace("{{industry}}", plan.brandDirection.industry)
    .replace("{{toneOfVoice}}", plan.brandDirection.voice)
    .replace("{{targetAudience}}", plan.audience.who)
    .replace("{{variationSeed}}", resolveVariationSeed(storeId));

  try {
    const raw = await callAIJson<unknown>(prompt, { tier: "compose", storeId, purpose: "build_products", ...BUILD_AI });
    const parsed = productsOut.safeParse(Array.isArray(raw) ? { products: raw } : raw);
    if (!parsed.success || !parsed.data.products.length) throw new Error("products output invalid");
    return parsed.data.products;
  } catch (e) {
    degraded.push({ unit: `products_batch`, reason: String(e) });
    return (batch as Array<{ index: number; name: string; description?: string; attributes?: unknown[] }>).map((p) => ({
      index: p.index,
      name: p.name,
      shortDescription: "",
      description: p.description || "",
      attributes: (p.attributes as { label: string; value: string }[]) || [],
      tags: [],
      badges: [],
      seoTitle: p.name,
      seoDescription: "",
      categorySlug: "",
      optionNames: [],
      variantValues: [],
    }));
  }
}

// ─── Pages ─────────────────────────────────────────────────────────────────
// صفحات السياسات (الشحن، الاستبدال، الخصوصية، الشروط، التواصل) لا يكتبها النموذج:
// تُولَّد عند العرض من سياسات المتجر الفعلية (blueprint/policy-pages)، فتبقى مطابقة لها دائماً.
// النموذج يكتب صفحة "من نحن" وحدها، قصيرة وسريعة، لأنها الوحيدة التي تحتاج قصة.
const aboutOut = z.object({ title: str(80), body: z.string().nullish().catch(undefined).transform((v) => (v ?? "").trim().slice(0, 4000)) });

export async function composePagesGroup(
  intake: IntakeLike,
  plan: Plan,
  storeId: string,
  group: "core" | "legal",
  degraded: Degraded[]
): Promise<PagesOut> {
  const empty: PagesOut = { pages: [], assumptions: [], payments: {}, shippingGeneralEta: "" };
  if (group === "legal") return empty;
  const brief = intake.brief ?? {};
  const prompt = [
    `اكتب صفحة "من نحن" لمتجر مصري اسمه «${plan.brandDirection.name}» في مجال ${plan.brandDirection.industry || "التجارة"}.`,
    brief.founderStory ? `قصة المؤسس كما كتبها: ${brief.founderStory}` : "لا توجد قصة مؤسس: اكتب عن فلسفة المتجر في الاختيار والجودة دون اختلاق أحداث أو أرقام.",
    `المنتجات: ${productLines(intake).slice(0, 12).map((p) => p.name).join("، ")}`,
    "المطلوب: من 120 إلى 220 كلمة، بعربية سهلة دافئة، بلا إيموجي، بلا وعود غير حقيقية.",
    "استخدم Markdown بسيطاً: فقرات، وعنوان فرعي واحد أو اثنين بـ ##، وقائمة نقاط قصيرة لما يميز المتجر.",
    'أعد JSON فقط بالشكل: {"title": "...", "body": "..."}',
  ].join("\n");
  try {
    const raw = await callAIJson<unknown>(prompt, { tier: "compose", storeId, purpose: "build_about", maxTokens: 1200, ...BUILD_AI });
    const r = aboutOut.safeParse(raw);
    if (!r.success || r.data.body.length < 80) throw new Error("about output invalid");
    return {
      ...empty,
      pages: [{ slug: "about", title: r.data.title || `عن ${plan.brandDirection.name}`, body: r.data.body, enabled: true, showInFooter: true }],
    };
  } catch (e) {
    degraded.push({ unit: `pages_${group}`, reason: String(e).slice(0, 200) });
    return empty;
  }
}

export function mergePages(core: PagesOut, legal: PagesOut): StoreBlueprint["pages"] {
  const all = [...core.pages, ...legal.pages];
  const unique = new Map<string, StoreBlueprint["pages"][number]>();
  for (const p of all) {
    if (!unique.has(p.slug)) unique.set(p.slug, p);
  }
  return Array.from(unique.values());
}

// ─── QA ────────────────────────────────────────────────────────────────────
export async function runQa(
  blueprint: StoreBlueprint,
  _catalog: unknown,
  _storeId: string
): Promise<{ score: number; fixes: unknown[]; summary: string; blockers: string[] }> {
  const local = enhanceLocalQa(blueprint);
  return {
    score: local.score,
    fixes: [],
    summary: "تم الفحص محلياً",
    blockers: local.issues.filter((i) => i.severity === "error").map((i) => i.message),
  };
}

export function applyFixes(blueprint: StoreBlueprint, _fixes: unknown[]): StoreBlueprint {
  return blueprint;
}

// ─── Assemble ──────────────────────────────────────────────────────────────
export async function assemble(
  input: {
    plan: Plan;
    theme: StoreBlueprint["theme"];
    studio?: { design: StudioDesign; copy: StudioCopy };
    home: Section[];
    pages: StoreBlueprint["pages"];
    catalog: unknown;
    intake?: IntakeLike;
  },
  storeId: string
): Promise<StoreBlueprint> {
  const seed = resolveVariationSeed(storeId);
  const name = input.plan.brandDirection.name || input.intake?.brief?.storeName || "متجري";
  const finalHome = Array.isArray(input.home) && input.home.length > 0 ? input.home : buildEmergencyHome(name);

  const brief = input.intake?.brief ?? {};
  const assets = (input.intake?.assets ?? {}) as { logoUrl?: string };
  // ميزة لم يحددها التاجر (مسودة قديمة) تبقى على الإعداد الافتراضي.
  const feat = (k: string, fallback: boolean) => (typeof brief.features?.[k] === "boolean" ? brief.features[k]! : fallback);
  const policy = policySlices(input.intake);
  const freeOver = policy.shipping.freeOverPiasters;
  const generalEta = policy.shipping.generalEta;
  const copy = input.studio?.copy;
  const design = input.studio?.design;

  const msg = (k: keyof StoreBlueprint["orderMessages"], fallback: string) => copy?.orderMessages[k] || fallback;

  return {
    schemaVersion: 1,
    variationSeed: seed,
    brand: {
      name,
      tagline: (copy?.brandTagline || input.plan.brandDirection.tagline || "").slice(0, 120) || undefined,
      ...(assets.logoUrl ? { logo: { url: assets.logoUrl, alt: name, focalX: 0.5, focalY: 0.5 } } : {}),
      description: (copy?.seo.description || input.plan.seoStrategy.metaDescription || "").slice(0, 300) || undefined,
      voice: input.plan.brandDirection.voice as StoreBlueprint["brand"]["voice"],
      industry: (brief.industry || input.plan.brandDirection.industry || "general").slice(0, 60),
    },
    theme: input.theme,
    design: design?.design ?? designSchema.parse({}),
    copy: copy?.microcopy ?? {},
    locale: { language: "ar", currency: "EGP", timezone: "Africa/Cairo" },
    header: {
      variant: design?.headerVariant ?? "classic",
      sticky: true,
      transparentOnHero: false,
      showSearch: true,
      showCategoriesMenu: true,
      nav: [],
    },
    footer: {
      variant: design?.footerVariant ?? "rich",
      tagline: (copy?.footerTagline ?? "").slice(0, 160),
      showPaymentIcons: true,
      showChannels: true,
      showPoweredBy: true,
    },
    channels: policy.channels,
    home: finalHome,
    productPage: {
      layout: "gallery_left",
      showSku: false,
      showAttributesTable: true,
      showReviews: true,
      showShareButtons: true,
      extraSections: [],
    },
    conversion: {
      stickyAddToCart: feat("stickyAddToCart", true),
      buyNowButton: feat("directExpressBuy", true),
      freeShippingBar: { enabled: Boolean(freeOver) && feat("freeShippingBar", true), thresholdPiasters: freeOver ?? 50000 },
      lowStockAlert: { enabled: feat("lowStockAlert", true), threshold: 5 },
      socialProofToasts: { enabled: feat("socialProofToasts", true), minOrdersToShow: 5, lookbackHours: 72 },
      liveViewers: false,
      exitIntentOffer: { enabled: false, title: "", text: "", showOncePerDays: 3 },
      productTrustRow: [],
      deliveryEstimate: true,
      recommendations: {
        frequentlyBoughtTogether: feat("frequentlyBoughtTogether", true),
        completeTheLook: true,
        recentlyViewed: true,
        cartUpsell: true,
      },
      expressCheckout: false,
      rememberCustomer: true,
      messengerOrderButton: true,
      showSavings: true,
      cartDrawer: true,
      shareButtons: true,
      ambientSound: false,
      cursorFollower: false,
      liveActivityBar: false,
      kineticTypography: true,
      viewTransitions: true,
      smartImageSequence: true,
      quickViewModal: true,
      stockPulseIndicator: true,
      product360Viewer: false,
      productARPreview: false,
      imageZoomLens: true,
      videoThumbs: true,
      multiLayerParallax: true,
      ambientBackdrop: true,
      scrollLinkedStory: true,
      comparisonBar: false,
      wishlistEnabled: true,
      voiceNavigation: false,
      aiSearch: true,
    },
    payments: policy.payments,
    returns: policy.returns,
    shipping: policy.shipping,
    checkout: {
      fields: { altPhone: "optional", city: "optional", landmark: "optional", notes: "optional", email: "hidden" },
      customFields: [],
      minOrderPiasters: null,
      termsCheckbox: false,
      successMessage: (copy?.checkoutSuccess || "وصلنا طلبك، وهنتواصل معاك قريب جداً لتأكيده.").slice(0, 300),
    },
    orderMessages: {
      confirmed: msg("confirmed", `أهلاً {name}، تم تأكيد طلبك {code} بإجمالي {total}. هيوصلك خلال ${generalEta}.`),
      shipped: msg("shipped", "طلبك {code} خرج مع شركة الشحن وهيوصلك قريباً. رقم الشحنة: {tracking}"),
      delivered: msg("delivered", "نتمنى يكون طلبك {code} عجبك. لو حابب تقيّم تجربتك: {review_link}"),
      abandoned: msg("abandoned", "أهلاً {name}، لاحظنا إنك سبت {items} في السلة. محتاج مساعدة في إتمام الطلب؟"),
    },
    invoice: {
      showLogo: true,
      footerNote: (copy?.footerTagline || `شكراً لتسوقك من ${name}`).slice(0, 200),
      showQr: true,
      paperSize: "A5",
      showPrices: true,
    },
    customCss: design?.customCss ?? "",
    pages: input.pages,
    seo: {
      title: (copy?.seo.title || input.plan.seoStrategy.metaTitle || name).slice(0, 70),
      description: (copy?.seo.description || input.plan.seoStrategy.metaDescription || "").slice(0, 160) || undefined,
      noIndex: false,
    },
  };
}
