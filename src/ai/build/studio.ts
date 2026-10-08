// studio.ts — استوديو المتجر: مدير فني وكاتب محتوى بالذكاء الاصطناعي لكل متجر على حدة.
//
// 1) designStore: يقرأ نشاط التاجر ومنتجاته وأسعاره وألوانه وأسلوبه، فيكتب «الحمض النووي للتصميم»
//    (ألوان، خطوط، زوايا، ظلال، خلفية، شكل البطاقة والأزرار والأيقونات والعناوين) و CSS خاصاً بالمتجر.
// 2) writeStore: يكتب كل نصوص المتجر (الواجهة، الشارات، الإعلانات، الأسئلة، القصة، أزرار الواجهة،
//    رسائل الطلب، SEO) من «حقائق» المتجر الفعلية فقط، بلا أي ادعاء غير صحيح.
//
// كل رد يُفحص بصرامة: ما لا يطابق القواعد يُستبدل بقيمة مشتقة من بيانات التاجر نفسه، لا بنص عام.
import "server-only";
import { z } from "zod";
import { callAIJson } from "@/ai/runner";
import { copySchema, designSchema, fontFamilySchema, type Design, type StoreBlueprint, type StoreCopy } from "@/blueprint/schema";
import { buildFullPalette, contrastRatio, ensureContrast, extractNamedColors, extractPalette, pickAdaptiveFonts } from "@/blueprint/palette";
import { ICON_NAMES, safeIcon } from "@/blueprint/icons";
import { claimedFact, type StoreFact } from "@/blueprint/facts";
import { stripEmoji } from "@/lib/emoji";
import { intakeFacts } from "./policy";
import { productLines } from "./plan";
import type { Plan } from "./schemas";
import type { Degraded, IntakeLike } from "./composer";

const BUILD_AI = { budgetMs: 46_000, timeoutMs: 40_000 } as const;
const HEX = /^#[0-9a-f]{6}$/i;

// ─── موجز المتجر (ما يراه المدير الفني والكاتب) ─────────────────────────────

export type StoreBrief = ReturnType<typeof storeBrief>;

export function storeBrief(intake: IntakeLike, plan: Plan, factsOverride?: StoreFact[]) {
  const brief = intake.brief ?? {};
  const raw = (Array.isArray(intake.products) ? intake.products : []) as Array<Record<string, unknown>>;
  const lines = productLines(intake);
  const prices = lines.map((p) => p.priceEgp ?? 0).filter((n) => n > 0).sort((a, b) => a - b);
  const median = prices.length ? prices[Math.floor(prices.length / 2)]! : 0;
  const withImages = raw.filter((p) => typeof p.imageUrl === "string" && p.imageUrl).length;
  const onSale = raw.filter((p) => Number(p.compareAt) > Number(p.price)).length;
  const categories = Array.from(new Set(plan.categories.map((c) => c.name).filter(Boolean)));
  // ألوان التاجر: الأكواد التي اختارها بالضبط أولاً (#7a1f3d)، ثم أسماء الألوان التي كتبها.
  const pref = brief.colorPreference ?? "";
  const merchantColors =
    brief.autoTheme === false
      ? Array.from(new Set([...(pref.match(/#[0-9a-f]{6}/gi) ?? []).map((h) => h.toLowerCase()), ...extractNamedColors(pref).map((c) => c.hex.toLowerCase())])).slice(0, 3)
      : [];
  // إعادة التصميم تمرر حقائق الـ Blueprint الحالي (قد يكون التاجر عدّل سياساته من اللوحة).
  const facts = factsOverride ?? intakeFacts(intake);
  return {
    name: plan.brandDirection.name || brief.storeName || "",
    owner: brief.ownerName || undefined,
    industry: brief.industry || plan.brandDirection.industry || "general",
    tone: brief.toneOfVoice || "friendly_egyptian",
    founderStory: brief.founderStory || undefined,
    positioning: plan.brandDirection.positioning || undefined,
    audience: plan.audience.who || undefined,
    moodWords: plan.brandDirection.moodWords,
    merchantColors,
    colorWish: brief.autoTheme === false ? brief.colorPreference : undefined,
    motionWish: brief.motionStyle && brief.motionStyle !== "auto" ? brief.motionStyle : undefined,
    depthWish: typeof brief.depth3d === "boolean" ? brief.depth3d : undefined,
    products: lines.slice(0, 30).map((p, i) => ({
      name: p.name,
      price: p.priceEgp,
      compareAt: Number(raw[i]?.compareAt) > 0 ? Number(raw[i]?.compareAt) : undefined,
      category: p.category,
      bestSeller: p.bestSeller,
      note: typeof raw[i]?.description === "string" ? String(raw[i]!.description).slice(0, 90) : undefined,
    })),
    stats: {
      productCount: lines.length,
      categoryCount: categories.length,
      categories,
      priceMin: prices[0] ?? 0,
      priceMax: prices[prices.length - 1] ?? 0,
      priceMedian: median,
      productsWithImages: withImages,
      onSale,
    },
    facts,
    features: brief.features ?? {},
    hasLogo: Boolean((intake.assets as { logoUrl?: string } | undefined)?.logoUrl),
  };
}

const TONES: Record<string, string> = {
  friendly_egyptian: "عامية مصرية ودودة وراقية، كأنك صاحب المحل بيكلم زبون بيحترمه",
  professional: "عربية مبسطة احترافية وواثقة، جمل قصيرة واضحة",
  playful: "مرحة وخفيفة بعامية مصرية، بدون مبالغة ولا تهريج",
  luxury: "راقية وهادئة وفخمة، كلمات قليلة منتقاة، بلا صخب ولا علامات تعجب",
  minimal: "مختصرة جداً ونظيفة، أقل كلمات ممكنة بأعلى وضوح",
};

// ─── 1) المدير الفني ─────────────────────────────────────────────────────────

const FONT_GUIDE = `cairo: عصري متوازن متعدد الأوزان | tajawal: نظيف خفيف ودود | ibm_plex_arabic: هندسي تقني رصين | almarai: دائري ناعم ودود (أطفال، طعام، عناية) | changa: عريض جريء رياضي وشبابي | el_messiri: أنيق بلمسة كلاسيكية فاخر (أزياء راقية، عطور، هدايا) | readex_pro: حديث تقني واضح (إلكترونيات) | noto_kufi: كوفي هندسي قوي ومميز`;

const designOut = z.object({
  concept: z.string().catch(""),
  mood: z.string().catch(""),
  mode: z.enum(["light", "dark"]).catch("light"),
  palette: z.record(z.string()).catch({}),
  fonts: z.object({ heading: fontFamilySchema.catch("cairo"), body: fontFamilySchema.catch("cairo") }).partial().catch({}),
  design: z.record(z.unknown()).catch({}),
  cardStyle: z.string().catch(""),
  motion: z.string().catch(""),
  heroVariant: z.string().catch(""),
  headerVariant: z.string().catch(""),
  footerVariant: z.string().catch(""),
  css: z.string().catch(""),
});

export type StudioDesign = {
  theme: StoreBlueprint["theme"];
  design: Design;
  customCss: string;
  heroVariant: HeroChoice;
  headerVariant: StoreBlueprint["header"]["variant"];
  footerVariant: StoreBlueprint["footer"]["variant"];
};

export const HERO_CHOICES = ["split", "editorial", "collage", "product_spotlight", "centered", "fullscreen", "orbit"] as const;
export type HeroChoice = (typeof HERO_CHOICES)[number];
const CARD_STYLES = ["minimal", "elevated", "bordered", "editorial", "overlay", "glass", "floating", "brutalist"] as const;
const MOTIONS = ["minimal", "subtle", "balanced", "expressive", "cinematic"] as const;

function designPrompt(b: StoreBrief, avoid?: string): string {
  return `أنت مدير فني (Art Director) عالمي متخصص في متاجر التجارة الإلكترونية، تصمم متجراً واحداً فقط الآن، ولا يجب أن يشبه أي متجر آخر.

# المتجر
${JSON.stringify({ name: b.name, industry: b.industry, tone: b.tone, positioning: b.positioning, audience: b.audience, moodWords: b.moodWords, founderStory: b.founderStory?.slice(0, 400), colorWish: b.colorWish, merchantColors: b.merchantColors, stats: b.stats, products: b.products.slice(0, 18) })}

# المطلوب
صمم نظام تصميم كامل نابع من هذا المتجر تحديداً: من نوع منتجاته وأسعاره (الوسيط ${b.stats.priceMedian} جنيه) وجمهوره وأسلوبه.
فكّر أولاً: ما الإحساس الذي يجب أن يشعر به عميل هذا المتجر في أول ثانية؟ ثم ترجمه إلى قرارات بصرية متسقة.

# قواعد إلزامية
1. الألوان HEX بستة أرقام. تباين النص مع الخلفية لا يقل عن 7:1، واللون الأساسي مع الخلفية لا يقل عن 3:1.
${b.merchantColors.length ? `2. التاجر اختار ألوانه: اجعل primary = ${b.merchantColors[0]}${b.merchantColors[1] ? ` واستلهم accent من ${b.merchantColors[1]}` : ""}، وابنِ بقية الألوان حولها بتناغم.` : "2. اختر لوحة ألوان أصيلة لهذا النشاط والسعر، لا الأزرق الافتراضي ولا البنفسجي المكرر. الفخامة: درجات هادئة عميقة وخلفية دافئة. الأطفال: ألوان مبهجة ناعمة. الإلكترونيات: حادة نظيفة وقد تكون داكنة."}
3. الخطوط من هذه القائمة فقط: ${FONT_GUIDE}. يمكن أن يختلف خط العناوين عن خط النص.
4. design كائن بهذه الحقول والقيم المسموحة فقط:
   layout: {container: narrow|normal|wide, density: airy|balanced|compact, headingAlign: start|center}
   type: {headingWeight: 400..900, headingTracking: -0.05..0.08, headingScale: 0.85..1.35, bodyLeading: 1.4..2.1}
   shape: {card: 0..40, button: 0..999, input: 0..24, image: 0..40, chip: 0..999}  (بكسل؛ 999 = كبسولة)
   surface: {background: solid|soft_gradient|radial_glow|mesh|paper|dots|grid|lines|waves, rhythm: flat|alternate|bands, divider: none|line|wave|curve|slant, grain: true|false}
   elevation: {level: 0..4, tint: HEX لون الظل, border: 0..3}
   card: {ratio: square|portrait|tall|landscape, fit: cover|contain, imagePad: 0..28, imageBg: none|muted|tint|gradient, align: start|center, priceStyle: plain|bold|pill|accent|underline, hover: lift|zoom|swap|glow|none, badge: pill|tag|corner|ribbon, showCategory: true|false, quickAdd: button|icon|none}
   button: {fill: solid|gradient|outline|soft|glass, weight: 500..900, size: sm|md|lg}
   icon: {stroke: 1..2.5, frame: none|circle|squircle|square|outline, tone: primary|accent|foreground|soft}
   heading: {style: plain|eyebrow|underline|ornament|split}
   header: {surface: solid|glass|transparent|bordered, logoSize: sm|md|lg}
   motion: {level: calm|lively|cinematic, depth: true|false}  (calm للمتاجر الرصينة جداً، lively للأغلب، cinematic للعلامات الجريئة والفاخرة والأزياء؛ depth = ميل ثلاثي الأبعاد للبطاقات وعمق مع التمرير)${b.motionWish ? `
   صاحب المتجر اختار الحركة: level = ${b.motionWish}.` : ""}${b.depthWish === false ? `
   صاحب المتجر لا يريد العمق ثلاثي الأبعاد: depth = false.` : ""}
5. اختر للبطاقة شكلاً يناسب صور المنتجات: منتجات بخلفيات بيضاء (إلكترونيات، تجميل) = fit contain مع imagePad ولون خلفية؛ صور موديلات وملابس = portrait أو tall مع cover.
6. cardStyle واحد من: ${CARD_STYLES.join("|")}. motion واحد من: ${MOTIONS.join("|")}.
7. heroVariant واحد من: split|editorial|collage|product_spotlight|centered|fullscreen|orbit. عدد المنتجات بصور: ${b.stats.productsWithImages}. collage يحتاج 3 صور على الأقل، orbit (صور المنتجات تدور في حلقة ثلاثية الأبعاد، مبهر للمتاجر الجريئة) يحتاج 4 صور على الأقل، product_spotlight مناسب لمنتج واحد بطل، centered مناسب لهوية نصية قوية بلا صور كثيرة.
8. headerVariant: classic|centered_logo|minimal. footerVariant: rich|minimal|centered.
9. css: اكتب CSS «جلد» يضيف لمسات مميزة لهذا المتجر وحده (حتى 2500 حرف). استهدف هذه الخطافات فقط:
   .s-card .s-media .s-card-info .s-price .s-badge .s-btn .s-btn-ghost .s-title .s-display .s-eyebrow .s-sub .s-head .s-section .s-section[data-tone=alt] .s-section[data-tone=brand] .s-icon .s-chip .s-input .s-hero .s-hero-media .s-trust .s-announce .s-header .s-footer .s-cat .s-faq .s-story
   مسموح فقط: الألوان والخلفيات المتدرجة والحدود والزوايا والظلال وtext-shadow وletter-spacing وfont-weight وfilter وbackdrop-filter وtransition وtransform داخل :hover وanimation باسم يبدأ بـ s-.
   ممنوع: url() وdisplay وposition وwidth وheight وmargin وpadding وfont-size وأي محدد عام بلا خطاف.
   استخدم متغيرات CSS: var(--primary) var(--accent) var(--background) var(--foreground) var(--card) var(--muted) var(--border).
${avoid ? `10. هذا تصميم جديد بطلب صاحب المتجر: ابتعد تماماً عن التصميم السابق «${avoid}» في الألوان والخطوط والأشكال.
` : ""}11. concept: اسم قصير لفكرة التصميم بالعربية (مثل: «حرير المساء الهادئ»). mood: جملة تشرح القرار.

أعد JSON فقط بهذا الشكل:
{"concept":"...","mood":"...","mode":"light","palette":{"background":"#","foreground":"#","primary":"#","accent":"#","card":"#","muted":"#","border":"#"},"fonts":{"heading":"...","body":"..."},"design":{...},"cardStyle":"...","motion":"...","heroVariant":"...","headerVariant":"...","footerVariant":"...","css":"..."}`;
}

/** يأخذ كل حقل من تصميم الـ AI إن صح، وإلا قيمته الافتراضية — لا يفشل التصميم كله بسبب حقل. */
function lenientDesign(raw: Record<string, unknown>): Design {
  const base = designSchema.parse({});
  const shape = designSchema.shape;
  const out: Record<string, unknown> = { ...base };
  for (const key of Object.keys(shape) as (keyof typeof shape)[]) {
    const v = raw[key];
    if (v === undefined) continue;
    if (typeof v === "object" && v && !Array.isArray(v) && typeof base[key] === "object") {
      const merged: Record<string, unknown> = { ...(base[key] as object) };
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
        const trial = (shape[key] as z.ZodTypeAny).safeParse({ ...merged, [k]: typeof val === "string" && /^\d+(\.\d+)?$/.test(val) ? Number(val) : val });
        if (trial.success) merged[k] = (trial.data as Record<string, unknown>)[k];
      }
      out[key] = merged;
    } else {
      const trial = (shape[key] as z.ZodTypeAny).safeParse(v);
      if (trial.success) out[key] = trial.data;
    }
  }
  return designSchema.parse(out);
}

function seededDesign(seed: number, industry: string): Design {
  // تصميم احتياطي محسوب من نشاط المتجر (لا قالب ثابت): يختلف بين المتاجر بالبذرة.
  const pick = <T,>(arr: readonly T[], n: number) => arr[Math.abs(n) % arr.length]!;
  const luxury = /fashion|beauty|accessor|gift|perfume/i.test(industry);
  const playful = /kid|food|toy/i.test(industry);
  return designSchema.parse({
    layout: { container: luxury ? "normal" : "wide", density: luxury ? "airy" : "balanced", headingAlign: luxury ? "center" : "start" },
    type: { headingWeight: luxury ? 600 : playful ? 800 : 700, headingTracking: luxury ? 0.01 : -0.015, headingScale: luxury ? 1.12 : 1 },
    shape: { card: playful ? 24 : luxury ? 6 : 14, button: playful ? 999 : luxury ? 2 : 12, image: playful ? 20 : luxury ? 4 : 12 },
    surface: { background: pick(["soft_gradient", "radial_glow", "paper", "dots"] as const, seed), rhythm: pick(["alternate", "bands"] as const, seed >> 3), divider: pick(["none", "curve", "line"] as const, seed >> 5) },
    elevation: { level: luxury ? 0 : playful ? 2 : 1, border: luxury ? 1 : 0 },
    card: { ratio: luxury ? "tall" : "portrait", hover: pick(["zoom", "lift", "glow"] as const, seed >> 7), priceStyle: pick(["bold", "accent", "pill"] as const, seed >> 9) },
    button: { fill: pick(["solid", "gradient", "soft"] as const, seed >> 11), size: luxury ? "lg" : "md" },
    icon: { frame: pick(["squircle", "circle", "outline"] as const, seed >> 13) },
    heading: { style: luxury ? "ornament" : pick(["eyebrow", "underline", "split"] as const, seed >> 15) },
  });
}

function hashOf(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** لوحة كاملة متباينة من ألوان الـ AI، مع احترام ألوان التاجر. */
function resolvePalette(raw: Record<string, string>, b: StoreBrief, seed: string): { palette: StoreBlueprint["theme"]["palette"]; mode: "light" | "dark" } {
  const fallback = extractPalette(b.colorWish ?? "", b.industry, seed).palette;
  const hex = (k: string) => (HEX.test(raw[k] ?? "") ? raw[k]! : undefined);
  const background = hex("background") ?? fallback.background;
  let primary = b.merchantColors[0] ?? hex("primary") ?? fallback.primary;
  const accent = hex("accent") ?? b.merchantColors[1] ?? fallback.accent;
  // اللون الأساسي يُستخدم للأسعار والروابط: نضمن قراءته على الخلفية دون تغيير هويته جذرياً.
  if (contrastRatio(primary, background) < 3) primary = ensureContrast(primary, background, 4.5);
  const full = buildFullPalette(background, primary, accent);
  const foreground = hex("foreground") && contrastRatio(raw.foreground!, background) >= 7 ? raw.foreground! : full.foreground;
  const card = hex("card") && contrastRatio(foreground, raw.card!) >= 7 ? raw.card! : full.card;
  const muted = hex("muted") && contrastRatio(foreground, raw.muted!) >= 4.5 ? raw.muted! : full.muted;
  const border = hex("border") ?? full.border;
  const mode = contrastRatio(background, "#000000") < contrastRatio(background, "#ffffff") ? "dark" : "light";
  return { palette: { ...full, foreground, card, cardForeground: foreground, secondaryForeground: foreground, muted, border }, mode };
}

export async function designStore(
  intake: IntakeLike,
  plan: Plan,
  storeId: string,
  degraded: Degraded[],
  facts?: StoreFact[],
  avoid?: { concept?: string; nonce?: string }
): Promise<StudioDesign> {
  const b = storeBrief(intake, plan, facts);
  const seed = `${storeId}:${b.name}${avoid?.nonce ?? ""}`;
  const h = hashOf(seed);
  let raw: z.infer<typeof designOut> | null = null;
  try {
    const res = await callAIJson<unknown>(designPrompt(b, avoid?.concept), { tier: "architect", storeId, purpose: "build_design", temperature: 0.85, maxTokens: 3500, ...BUILD_AI });
    const parsed = designOut.safeParse(res);
    if (parsed.success) raw = parsed.data;
    else degraded.push({ unit: "design", reason: "invalid design output" });
  } catch (e) {
    degraded.push({ unit: "design", reason: String(e).slice(0, 200) });
  }

  const { palette, mode } = resolvePalette(raw?.palette ?? {}, b, seed);
  const fonts = {
    ...pickAdaptiveFonts(b.industry, b.tone, seed),
    ...(raw?.fonts?.heading ? { heading: raw.fonts.heading } : {}),
    ...(raw?.fonts?.body ? { body: raw.fonts.body } : {}),
  };
  const design = raw ? lenientDesign(raw.design) : seededDesign(h, b.industry);
  design.concept = stripEmoji(raw?.concept ?? "").slice(0, 80);
  design.mood = stripEmoji(raw?.mood ?? "").slice(0, 240);

  const pick = <T extends string>(v: string | undefined, allowed: readonly T[], fallback: T): T => (allowed.includes(v as T) ? (v as T) : fallback);
  const imgs = b.stats.productsWithImages;
  let hero = pick(raw?.heroVariant, HERO_CHOICES, imgs >= 3 ? "collage" : imgs >= 1 ? "split" : "centered");
  // قواعد صارمة فوق اختيار الـ AI: لا واجهة تعتمد على صور غير موجودة.
  if (hero === "collage" && imgs < 3) hero = imgs ? "split" : "centered";
  if (hero === "orbit" && imgs < 4) hero = imgs >= 3 ? "collage" : imgs ? "split" : "centered";
  // اختيار صاحب المتجر للحركة والعمق يعلو على اختيار المدير الفني.
  if (b.motionWish) design.motion.level = b.motionWish;
  if (typeof b.depthWish === "boolean") design.motion.depth = b.depthWish;
  if ((hero === "fullscreen" || hero === "split" || hero === "editorial" || hero === "product_spotlight") && imgs === 0) hero = "centered";

  return {
    theme: {
      mode,
      palette,
      fonts: { heading: fonts.heading, body: fonts.body, baseSize: 16 },
      radius: "lg",
      buttonStyle: "solid",
      shadow: "soft",
      motion: pick(raw?.motion, MOTIONS, "balanced"),
      productCardStyle: pick(raw?.cardStyle, CARD_STYLES, "elevated"),
      imageRatio: design.card.ratio === "landscape" ? "landscape" : design.card.ratio === "square" ? "square" : "portrait",
      backgroundPattern: "none",
      imageBackground: "none",
    },
    design,
    customCss: (raw?.css ?? "").slice(0, 6000),
    heroVariant: hero,
    headerVariant: pick(raw?.headerVariant, ["classic", "centered_logo", "minimal"] as const, "classic"),
    footerVariant: pick(raw?.footerVariant, ["rich", "minimal", "centered"] as const, "rich"),
  };
}

// ─── 2) كاتب المحتوى ─────────────────────────────────────────────────────────

const line = (max: number) => z.string().nullish().catch(undefined).transform((s) => stripEmoji(s ?? "").replace(/\s+/g, " ").trim().slice(0, max));
const para = (max: number) => z.string().nullish().catch(undefined).transform((s) => stripEmoji(s ?? "").replace(/[ \t]+/g, " ").trim().slice(0, max));
const list = <T extends z.ZodTypeAny>(item: T, max: number) =>
  z.array(item.catch(null as never)).nullish().catch(undefined).transform((a) => (a ?? []).filter(Boolean).slice(0, max) as z.infer<T>[]);
const titled = z.object({ eyebrow: line(30), title: line(60), subtitle: line(140) }).partial().catch({});

const copyOut = z.object({
  brandTagline: line(110),
  hero: z.object({ eyebrow: line(40), headline: line(80), subheadline: line(200), primaryCta: line(26), secondaryCta: line(26) }).partial().catch({}),
  announcements: list(z.object({ fact: line(30), text: line(110) }), 5),
  trust: list(z.object({ fact: line(30), title: line(38), text: line(88), icon: line(30) }), 4),
  sections: z.object({ featured: titled, newArrivals: titled, onSale: titled, categories: titled, bestSellers: titled, story: titled, faq: titled, reviews: titled, spotlight: titled }).partial().catch({}),
  story: z.object({ title: line(70), body: para(900), quote: line(180) }).partial().catch({}),
  faq: list(z.object({ q: line(130), a: para(500) }), 7),
  footerTagline: line(150),
  microcopy: z.record(z.string()).catch({}),
  seo: z.object({ title: line(65), description: line(155) }).partial().catch({}),
  checkoutSuccess: line(280),
  orderMessages: z.object({ confirmed: para(480), shipped: para(480), delivered: para(480), abandoned: para(480) }).partial().catch({}),
});
type CopyOut = z.infer<typeof copyOut>;

export type Titled = { eyebrow?: string; title?: string; subtitle?: string };
export type StudioCopy = {
  brandTagline: string;
  hero: { eyebrow?: string; headline: string; subheadline?: string; primaryCta: string; secondaryCta?: string };
  announcements: { fact?: string; text: string }[];
  trust: { fact: string; title: string; text?: string; icon: string }[];
  sections: Partial<Record<"featured" | "newArrivals" | "onSale" | "categories" | "bestSellers" | "story" | "faq" | "reviews" | "spotlight", Titled>>;
  story: { title?: string; body?: string; quote?: string };
  faq: { q: string; a: string }[];
  footerTagline: string;
  microcopy: StoreCopy;
  seo: { title?: string; description?: string };
  checkoutSuccess?: string;
  orderMessages: Partial<StoreBlueprint["orderMessages"]>;
};

function copyPrompt(b: StoreBrief, d: { concept?: string; heroVariant: string }): string {
  return `أنت كاتب محتوى تجاري مصري من الطراز الأول (Senior Brand Copywriter) تكتب كل كلمة في متجر واحد بعينه.

# المتجر
${JSON.stringify({ name: b.name, owner: b.owner, industry: b.industry, positioning: b.positioning, audience: b.audience, founderStory: b.founderStory?.slice(0, 700), designConcept: d.concept, heroLayout: d.heroVariant, stats: b.stats, products: b.products })}

# حقائق المتجر (المصدر الوحيد لأي وعد أو ميزة)
${JSON.stringify(b.facts.map((f) => ({ key: f.key, fact: f.detail })))}

# الأسلوب
${TONES[b.tone] ?? TONES.friendly_egyptian}.

# قواعد لا استثناء فيها
1. ممنوع أي إيموجي. ممنوع العبارات العامة مثل «أهلاً بك في متجرنا» أو «أفضل الأسعار» أو «جودة عالية» بلا تحديد. كل جملة يجب أن تخص هذا المتجر ومنتجاته الفعلية.
2. ممنوع اختراع أي رقم أو تقييم أو عدد عملاء أو تاريخ أو جائزة أو رأي عميل. ممنوع ذكر أي ميزة أو سياسة ليست في الحقائق أعلاه حرفياً (شحن، دفع، استبدال، معاينة، ضمان...).
3. hero: eyebrow حتى 4 كلمات، headline حتى 9 كلمات يقول ما يميز المتجر ومنتجاته تحديداً، subheadline حتى 24 كلمة، primaryCta حتى 3 كلمات (فعل واضح)، secondaryCta اختياري.
4. announcements: من 2 إلى 4 رسائل قصيرة جذابة، كل رسالة لها fact من مفاتيح الحقائق، أو "brand" لرسالة عن هوية المتجر لا تدّعي أي سياسة.
5. trust: من 3 إلى 4 عناصر بالضبط، كل عنصر fact من مفاتيح الحقائق (بلا تكرار)، title حتى 4 كلمات، text حتى 12 كلمة صحيح حرفياً، icon من: ${ICON_NAMES.join(" ")}.
6. sections: عناوين أقسام مبتكرة تناسب المتجر (featured, newArrivals, onSale, categories, bestSellers, story, faq, reviews, spotlight)، لكل منها eyebrow اختياري وtitle حتى 6 كلمات وsubtitle حتى 18 كلمة. لا تستخدم «منتجاتنا» أو «الأقسام» كعناوين جافة.
7. story: ${b.founderStory ? "اكتب قصة المتجر من كلام صاحبه فقط، بصياغة مؤثرة صادقة دون إضافة أحداث." : "لا توجد قصة: اكتب فلسفة المتجر في اختيار منتجاته وما يقدمه لعميله، بلا أحداث أو أرقام مخترعة."} title حتى 7 كلمات، body من 60 إلى 120 كلمة، quote جملة واحدة.
8. faq: من 4 إلى 6 أسئلة يسألها عملاء هذا النشاط فعلاً. أسئلة الشحن والدفع والاستبدال تجيبها من الحقائق حرفياً، وإن لم تكن الحقيقة موجودة فلا تسأل عنها. أسئلة المنتجات (المقاسات، الخامات، الاستخدام) من بيانات المنتجات فقط.
9. microcopy: نصوص أزرار الواجهة بصوت المتجر، مفاتيحها: addToCart buyNow soldOut viewAll cartTitle emptyCart continueShopping checkout searchPlaceholder newBadge saleBadge bestSellerBadge lowStock (فيه {n}) freeShippingGap (فيه {amount}) freeShippingReached orderSuccessTitle trackOrder menu allProducts. الأزرار حتى 3 كلمات.
10. orderMessages: رسائل واتساب للعميل تستخدم المتغيرات {name} {code} {total} {eta} {store} {tracking} {review_link} {items} كما هي.
11. seo: title حتى 60 حرفاً فيه اسم المتجر ونشاطه، description حتى 150 حرفاً.

أعد JSON فقط:
{"brandTagline":"","hero":{"eyebrow":"","headline":"","subheadline":"","primaryCta":"","secondaryCta":""},"announcements":[{"fact":"","text":""}],"trust":[{"fact":"","title":"","text":"","icon":""}],"sections":{"featured":{"eyebrow":"","title":"","subtitle":""}},"story":{"title":"","body":"","quote":""},"faq":[{"q":"","a":""}],"footerTagline":"","microcopy":{},"seo":{"title":"","description":""},"checkoutSuccess":"","orderMessages":{"confirmed":"","shipped":"","delivered":"","abandoned":""}}`;
}

/** محتوى مشتق من بيانات المتجر وحقائقه فقط، حين يتعذر الذكاء الاصطناعي. */
function derivedCopy(b: StoreBrief): StudioCopy {
  const cats = b.stats.categories.slice(0, 3);
  const top = b.products.find((p) => p.bestSeller) ?? b.products[0];
  const facts = b.facts;
  return {
    brandTagline: cats.length ? cats.join(" · ") : top?.name ?? b.name,
    hero: {
      eyebrow: b.stats.categories[0],
      headline: b.name,
      subheadline: [cats.length ? cats.join("، ") : top?.name, facts[0]?.detail].filter(Boolean).join(". "),
      primaryCta: "تسوّق الآن",
    },
    announcements: facts.slice(0, 3).map((f) => ({ fact: f.key, text: f.title })),
    trust: facts.slice(0, 4).map((f) => ({ fact: f.key, title: f.title, text: f.detail, icon: f.icon })),
    sections: {},
    story: b.founderStory ? { title: `حكاية ${b.name}`, body: b.founderStory } : {},
    faq: facts.slice(0, 5).map((f) => ({ q: `${f.title}؟`, a: f.detail })),
    footerTagline: b.positioning?.slice(0, 150) ?? "",
    microcopy: {},
    seo: { title: `${b.name}${cats[0] ? ` | ${cats[0]}` : ""}`.slice(0, 65) },
    orderMessages: {},
  };
}

function groundCopy(c: CopyOut, b: StoreBrief): StudioCopy {
  const derived = derivedCopy(b);
  const factKeys = new Set(b.facts.map((f) => f.key));
  const byKey = new Map(b.facts.map((f) => [f.key, f] as const));

  // الشارات: حقيقة موجودة فعلاً، بلا تكرار، وأيقونة مرسومة؛ وإلا نكملها من الحقائق.
  const seen = new Set<string>();
  const trust = c.trust
    .filter((t) => t.title && factKeys.has(t.fact as never) && !seen.has(t.fact) && seen.add(t.fact))
    .map((t) => ({ fact: t.fact, title: t.title, text: t.text || byKey.get(t.fact as never)?.detail, icon: safeIcon(t.icon, byKey.get(t.fact as never)?.icon ?? "sparkles") }));
  for (const f of b.facts) {
    if (trust.length >= Math.min(4, b.facts.length)) break;
    if (!seen.has(f.key)) {
      seen.add(f.key);
      trust.push({ fact: f.key, title: f.title, text: f.detail, icon: f.icon });
    }
  }

  // الإعلانات: مربوطة بحقيقة، أو رسالة هوية لا تدّعي سياسة.
  const announcements = c.announcements
    .filter((a) => a.text && (factKeys.has(a.fact as never) || (a.fact === "brand" && !claimedFact(a.text))))
    .map((a) => ({ fact: a.fact === "brand" ? undefined : a.fact, text: a.text }));

  // الأسئلة: لا نقبل جواباً يدّعي سياسة غير موجودة.
  const faq = c.faq.filter((f) => f.q && f.a).filter((f) => {
    const k = claimedFact(`${f.q} ${f.a}`);
    return !k || factKeys.has(k) || (k === "free_shipping" && factKeys.has("free_shipping_over"));
  });

  const micro = copySchema.safeParse(Object.fromEntries(Object.entries(c.microcopy).map(([k, v]) => [k, stripEmoji(String(v)).trim()]).filter(([, v]) => v)));
  const headline = c.hero.headline && !/أهلا|أهلاً|مرحبا|مرحباً/.test(c.hero.headline) ? c.hero.headline : derived.hero.headline;

  return {
    brandTagline: c.brandTagline || derived.brandTagline,
    hero: {
      eyebrow: c.hero.eyebrow || derived.hero.eyebrow,
      headline,
      subheadline: c.hero.subheadline || derived.hero.subheadline,
      primaryCta: c.hero.primaryCta || derived.hero.primaryCta,
      secondaryCta: c.hero.secondaryCta || undefined,
    },
    announcements: announcements.length >= 2 ? announcements : derived.announcements,
    trust,
    sections: Object.fromEntries(Object.entries(c.sections).filter(([, v]) => v && (v.title || v.subtitle))) as StudioCopy["sections"],
    story: c.story.body && c.story.body.length > 60 ? c.story : derived.story,
    faq: faq.length >= 3 ? faq : [...faq, ...derived.faq.filter((d) => !faq.some((f) => f.q === d.q))].slice(0, 6),
    footerTagline: c.footerTagline || derived.footerTagline,
    microcopy: micro.success ? micro.data : {},
    seo: { title: c.seo.title || derived.seo.title, description: c.seo.description || undefined },
    checkoutSuccess: c.checkoutSuccess || undefined,
    orderMessages: Object.fromEntries(Object.entries(c.orderMessages).filter(([, v]) => v && v.includes("{code}"))),
  };
}

export async function writeStore(
  intake: IntakeLike,
  plan: Plan,
  design: Pick<StudioDesign, "design" | "heroVariant">,
  storeId: string,
  degraded: Degraded[],
  facts?: StoreFact[]
): Promise<StudioCopy> {
  const b = storeBrief(intake, plan, facts);
  try {
    const res = await callAIJson<unknown>(copyPrompt(b, { concept: design.design.concept, heroVariant: design.heroVariant }), {
      tier: "compose",
      storeId,
      purpose: "build_copy",
      temperature: 0.7,
      maxTokens: 4500,
      ...BUILD_AI,
    });
    const parsed = copyOut.safeParse(res);
    if (!parsed.success) throw new Error("invalid copy output");
    return groundCopy(parsed.data, b);
  } catch (e) {
    degraded.push({ unit: "copy", reason: String(e).slice(0, 200) });
    return derivedCopy(b);
  }
}

export type { StoreFact };
