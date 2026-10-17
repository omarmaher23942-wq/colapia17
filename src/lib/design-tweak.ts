// design-tweak.ts — «اكتبوا ما تريدون تغييره»: تعديل شكل المتجر بالكلام على قائمة بيضاء من إعدادات التصميم فقط.
// خالص (بلا خادم): يقرأ عمليات مقترحة { key, value }، يرفض كل مفتاح خارج القائمة أو قيمة غير صالحة، يطبّقها على نسخة
// من الـ Blueprint، ثم يضمن تباين النصوص (WCAG AA) ويصلحه آلياً، ويعيد وصفاً بشرياً لكل تغيير. لا CSS حر ولا HTML.
import { z } from "zod";
import { buildFullPalette, contrastRatio, ensureContrast, hexToHsl, hexToRgb, readableOn } from "@/blueprint/palette";
import type { StoreBlueprint } from "@/blueprint/schema";
import { FONT_PAIRS, normalizeHex } from "@/lib/onboarding";

// ─── مدخلات النموذج ──────────────────────────────────────────────────────────
export const tweakOpSchema = z.object({
  key: z.string().max(60),
  value: z.union([z.string().max(200), z.number(), z.boolean(), z.array(z.string().max(40)).max(24)]),
});
export const tweakResponseSchema = z.object({
  ops: z.array(tweakOpSchema).max(14),
  /** إن لم يُفهم الطلب أو لا يدخل في المسموح: سبب قصير بالعربية. */
  note: z.string().max(240).optional(),
});
export type TweakOp = z.infer<typeof tweakOpSchema>;

// المفاتيح المسموحة وقيمها (تُعرض للنموذج في البرومبت كما هي).
export const TWEAK_KEYS = {
  "theme.mode": "light | dark | auto (وضع المتجر: فاتح أو داكن أو تلقائي)",
  "color.primary": "لون hex لأزرار وعناصر العلامة",
  "color.accent": "لون hex مميز ثانوي",
  "color.background": "لون hex لخلفية المتجر",
  "color.foreground": "لون hex للنص الأساسي",
  "fonts.pair": `${FONT_PAIRS.map((p) => p.id).join(" | ")} (زوج خطوط جاهز)`,
  "text.size": "smaller | normal | larger | xlarge (حجم الخط)",
  corners: "sharp | soft | round | pill (استدارة الزوايا)",
  "button.style": "solid | soft | outline | gradient (شكل الأزرار)",
  density: "airy | balanced | compact (كثافة المسافات)",
  "hero.layout": "split | centered | fullscreen | editorial | cinematic (تخطيط الواجهة)",
  "hero.headline": "نص عنوان الواجهة (حتى 90 حرفاً)",
  "hero.subheadline": "نص فرعي للواجهة (حتى 220 حرفاً)",
  "announcement.text": "نص شريط الإعلان العلوي (حتى 120 حرفاً)، وفارغ يخفيه",
  "sections.hide": "قائمة أقسام تُخفى من الرئيسية",
  "sections.show": "قائمة أقسام تُظهر في الرئيسية",
  "sections.order": "ترتيب أقسام الرئيسية كاملاً أو جزئياً (من الأعلى للأسفل)",
} as const;
export type TweakKey = keyof typeof TWEAK_KEYS;
export const isTweakKey = (k: string): k is TweakKey => Object.hasOwn(TWEAK_KEYS, k);

/** أسماء الأقسام للمستخدم ← أنواعها في الـ Blueprint (الواجهة والإعلان لا تُخفى ولا تُرتَّب). */
export const SECTION_LABELS: Record<string, string> = {
  categories: "الأقسام",
  product_grid: "شبكة المنتجات",
  trust_badges: "شارات الثقة",
  testimonials: "آراء العملاء",
  faq: "الأسئلة الشائعة",
  about: "من نحن",
  brand_story: "قصة العلامة",
  steps: "كيف تطلبون",
  promo_banner: "بانر العرض",
  newsletter: "القائمة البريدية",
  contact: "تواصل معنا",
  instagram: "إنستجرام",
  stats: "أرقام",
  video: "فيديو",
  rich_text: "نص حر",
  bundle: "الطقم",
};
const LOCKED = new Set(["hero", "announcement"]);

const CORNERS = {
  sharp: { radius: "none", card: 0, button: 0, input: 0, image: 0, chip: 0 },
  soft: { radius: "md", card: 10, button: 10, input: 8, image: 10, chip: 999 },
  round: { radius: "xl", card: 18, button: 16, input: 12, image: 16, chip: 999 },
  pill: { radius: "full", card: 24, button: 999, input: 16, image: 22, chip: 999 },
} as const;
const TEXT = { smaller: { base: 15, head: 0.95 }, normal: { base: 16, head: 1 }, larger: { base: 18, head: 1.08 }, xlarge: { base: 19, head: 1.16 } } as const;
const HERO_OK = ["split", "centered", "fullscreen", "editorial", "cinematic"] as const;

// ─── أسماء ألوان لوصف التغيير ────────────────────────────────────────────────
const NAMED: [string, string][] = [
  ["#ffffff", "الأبيض"], ["#f5efe0", "الكريمي"], ["#d6c7a1", "البيج"], ["#111111", "الأسود"], ["#1e293b", "الكحلي"], ["#9ca3af", "الرمادي"],
  ["#dc2626", "الأحمر"], ["#7a1f3d", "العنابي"], ["#ea580c", "البرتقالي"], ["#eab308", "الأصفر"], ["#166534", "الأخضر"], ["#14b8a6", "التركوازي"],
  ["#1d4ed8", "الأزرق"], ["#7c3aed", "البنفسجي"], ["#f472b6", "الوردي"], ["#7c4a2d", "البني"], ["#d4a017", "الذهبي"],
];
export function describeColor(hex: string): string {
  const a = hexToRgb(hex);
  let best = NAMED[0]!;
  let bd = Infinity;
  for (const n of NAMED) {
    const b = hexToRgb(n[0]);
    const d = (a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2;
    if (d < bd) {
      bd = d;
      best = n;
    }
  }
  return best[1];
}

// ─── حارس التباين ────────────────────────────────────────────────────────────
type Palette = StoreBlueprint["theme"]["palette"];

/** يضمن AA على كل زوج نص/خلفية في اللوحة ويعيد ما أُصلح. */
export function guardContrast(p: Palette): { palette: Palette; fixes: string[] } {
  const out: Palette = { ...p };
  const fixes: string[] = [];
  const pairs: [keyof Palette, keyof Palette, string][] = [
    ["foreground", "background", "لون النص"],
    ["cardForeground", "card", "نص البطاقات"],
    ["mutedForeground", "background", "النص الثانوي"],
    ["mutedForeground", "muted", "النص الثانوي"],
  ];
  for (const [fg, bg, label] of pairs) {
    if (contrastRatio(out[fg], out[bg]) < 4.5) {
      out[fg] = ensureContrast(out[fg], out[bg], 4.5);
      if (!fixes.includes(label)) fixes.push(label);
    }
  }
  for (const [fg, bg] of [["primaryForeground", "primary"], ["accentForeground", "accent"], ["secondaryForeground", "secondary"]] as const) {
    if (contrastRatio(out[fg], out[bg]) < 4.5) {
      out[fg] = readableOn(out[bg]);
      // لون وسطي لا يبلغ 4.5 مع الأبيض ولا الأسود: نعدّل الخلفية نفسها حتى يقرأ النص عليها.
      if (contrastRatio(out[fg], out[bg]) < 4.5) out[bg] = ensureContrast(out[bg], out[fg], 4.5);
    }
  }
  // الأزرار الأساسية على خلفية المتجر يجب أن تبقى ظاهرة (3:1 على الأقل).
  if (contrastRatio(out.primary, out.background) < 3) {
    out.primary = ensureContrast(out.primary, out.background, 4.5);
    out.primaryForeground = readableOn(out.primary);
    fixes.push("لون الأزرار");
  }
  return { palette: out, fixes };
}

// ─── التطبيق ─────────────────────────────────────────────────────────────────
export type TweakResult = {
  blueprint: StoreBlueprint;
  /** سطر عربي لكل تغيير طُبّق. */
  changes: string[];
  /** ما رُفض مع السبب (مفتاح غير مسموح أو قيمة غير صالحة). */
  rejected: string[];
  /** ما أصلحه حارس التباين تلقائياً. */
  contrastFixes: string[];
};

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export function applyTweak(bp: StoreBlueprint, ops: readonly TweakOp[]): TweakResult {
  const next: StoreBlueprint = structuredClone(bp);
  const changes: string[] = [];
  const rejected: string[] = [];
  let palette: Palette = { ...next.theme.palette };
  let paletteTouched = false;
  const seen = new Set<string>();

  const setBase = (bg: string, primary: string, accent: string) => {
    const full = buildFullPalette(bg, primary, accent);
    palette = { ...palette, ...full };
    paletteTouched = true;
  };

  for (const op of ops) {
    if (!isTweakKey(op.key)) {
      rejected.push(`«${op.key.slice(0, 30)}» ليس من التعديلات المتاحة`);
      continue;
    }
    if (seen.has(op.key)) continue;
    seen.add(op.key);
    const v = op.value;
    switch (op.key) {
      case "theme.mode": {
        if (v === "light" || v === "dark" || v === "auto") {
          next.theme.mode = v;
          changes.push(v === "light" ? "جعلنا المتجر فاتحاً" : v === "dark" ? "جعلنا المتجر داكناً" : "جعلنا وضع المتجر تلقائياً بحسب جهاز الزائر");
        } else rejected.push("وضع غير معروف");
        break;
      }
      case "color.primary":
      case "color.accent":
      case "color.background":
      case "color.foreground": {
        const hex = normalizeHex(str(v));
        if (!hex) {
          rejected.push("لون غير صالح");
          break;
        }
        const p = op.key === "color.primary" ? hex : palette.primary;
        const a = op.key === "color.accent" ? hex : palette.accent;
        const b = op.key === "color.background" ? hex : palette.background;
        setBase(b, p, a);
        if (op.key === "color.foreground") palette.foreground = hex;
        const name = describeColor(hex);
        changes.push(op.key === "color.primary" ? `غيّرنا لون الأزرار والعلامة إلى ${name}` : op.key === "color.accent" ? `غيّرنا اللون المميز إلى ${name}` : op.key === "color.background" ? `غيّرنا لون الخلفية إلى ${name}` : `غيّرنا لون النص إلى ${name}`);
        break;
      }
      case "fonts.pair": {
        const pair = FONT_PAIRS.find((x) => x.id === str(v));
        if (!pair) {
          rejected.push("زوج خطوط غير معروف");
          break;
        }
        next.theme.fonts.heading = pair.heading;
        next.theme.fonts.body = pair.body;
        changes.push(`غيّرنا الخطوط إلى زوج «${pair.name}»`);
        break;
      }
      case "text.size": {
        const t = TEXT[str(v) as keyof typeof TEXT];
        if (!t) {
          rejected.push("حجم خط غير معروف");
          break;
        }
        next.theme.fonts.baseSize = t.base;
        next.design.type.headingScale = t.head;
        changes.push(str(v) === "smaller" ? "صغّرنا حجم الخط" : str(v) === "normal" ? "أعدنا حجم الخط إلى المعتاد" : "كبّرنا حجم الخط");
        break;
      }
      case "corners": {
        const c = CORNERS[str(v) as keyof typeof CORNERS];
        if (!c) {
          rejected.push("نوع زوايا غير معروف");
          break;
        }
        next.theme.radius = c.radius;
        next.design.shape = { ...next.design.shape, card: c.card, button: c.button, input: c.input, image: c.image, chip: c.chip };
        changes.push(str(v) === "sharp" ? "جعلنا الزوايا حادة" : str(v) === "soft" ? "جعلنا الزوايا ناعمة قليلاً" : str(v) === "round" ? "جعلنا الزوايا أكثر استدارة" : "جعلنا الزوايا دائرية بالكامل");
        break;
      }
      case "button.style": {
        const s = str(v);
        if (s !== "solid" && s !== "soft" && s !== "outline" && s !== "gradient") {
          rejected.push("شكل أزرار غير معروف");
          break;
        }
        next.theme.buttonStyle = s;
        next.design.button = { ...next.design.button, fill: s };
        changes.push(`غيّرنا شكل الأزرار إلى ${s === "solid" ? "مصمت" : s === "soft" ? "ناعم" : s === "outline" ? "بإطار" : "متدرج"}`);
        break;
      }
      case "density": {
        const d = str(v);
        if (d !== "airy" && d !== "balanced" && d !== "compact") {
          rejected.push("كثافة غير معروفة");
          break;
        }
        next.design.layout = { ...next.design.layout, density: d };
        changes.push(d === "airy" ? "وسّعنا المسافات بين العناصر" : d === "compact" ? "قلّلنا المسافات لعرض أكثر في الشاشة" : "أعدنا المسافات إلى التوازن المعتاد");
        break;
      }
      case "hero.layout": {
        const l = str(v) as (typeof HERO_OK)[number];
        const i = next.home.findIndex((s) => s.type === "hero");
        const hero = i >= 0 ? next.home[i] : null;
        if (!hero || hero.type !== "hero" || !HERO_OK.includes(l)) {
          rejected.push("تخطيط الواجهة غير متاح (بعض التخطيطات تحتاج صوراً أو فيديو يُختار من «واجهة المتجر»)");
          break;
        }
        hero.variant = l;
        changes.push("غيّرنا تخطيط واجهة المتجر");
        break;
      }
      case "hero.headline":
      case "hero.subheadline": {
        const t = str(v).slice(0, op.key === "hero.headline" ? 90 : 220);
        const hero = next.home.find((s) => s.type === "hero");
        if (!hero || hero.type !== "hero" || (op.key === "hero.headline" && !t)) {
          rejected.push("نص الواجهة غير صالح");
          break;
        }
        if (op.key === "hero.headline") hero.headline = t;
        else hero.subheadline = t || undefined;
        changes.push(op.key === "hero.headline" ? "عدّلنا عنوان واجهة المتجر" : "عدّلنا النص الفرعي في الواجهة");
        break;
      }
      case "announcement.text": {
        const t = str(v).slice(0, 120);
        const i = next.home.findIndex((s) => s.type === "announcement");
        const cur = i >= 0 ? next.home[i] : null;
        if (!t) {
          if (cur && cur.type === "announcement") {
            cur.enabled = false;
            changes.push("أخفينا شريط الإعلان");
          } else rejected.push("لا يوجد شريط إعلان لإخفائه");
          break;
        }
        if (cur && cur.type === "announcement") {
          cur.enabled = true;
          cur.messages = [{ text: t }];
        } else {
          next.home.unshift({ id: "announcement-1", type: "announcement", enabled: true, spacing: "normal", background: "primary", reveal: "none", variant: "static", messages: [{ text: t }], dismissible: true, sticky: true });
        }
        changes.push("حدّثنا نص شريط الإعلان");
        break;
      }
      case "sections.hide":
      case "sections.show": {
        const list = Array.isArray(v) ? v : [];
        const labels: string[] = [];
        for (const raw of list) {
          const type = String(raw);
          if (LOCKED.has(type) || !Object.hasOwn(SECTION_LABELS, type)) {
            rejected.push(`القسم «${type.slice(0, 20)}» لا يمكن تغييره من هنا`);
            continue;
          }
          const hit = next.home.filter((s) => s.type === type);
          if (!hit.length) continue;
          for (const s of hit) s.enabled = op.key === "sections.show";
          labels.push(SECTION_LABELS[type]!);
        }
        if (labels.length) changes.push(`${op.key === "sections.hide" ? "أخفينا" : "أظهرنا"} ${labels.join(" و")}`);
        break;
      }
      case "sections.order": {
        const order = (Array.isArray(v) ? v : []).map(String).filter((t) => Object.hasOwn(SECTION_LABELS, t) && !LOCKED.has(t));
        if (!order.length) {
          rejected.push("ترتيب أقسام غير صالح");
          break;
        }
        const head = next.home.filter((s) => LOCKED.has(s.type));
        const movable = next.home.filter((s) => !LOCKED.has(s.type));
        const rank = (t: string) => {
          const i = order.indexOf(t);
          return i < 0 ? order.length : i;
        };
        const sorted = [...movable].sort((a, b) => rank(a.type) - rank(b.type));
        const same = sorted.every((s, i) => s === movable[i]);
        if (!same) {
          next.home = [...head, ...sorted];
          changes.push("أعدنا ترتيب أقسام الرئيسية");
        }
        break;
      }
    }
  }

  const contrastFixes: string[] = [];
  if (paletteTouched) {
    const g = guardContrast(palette);
    next.theme.palette = g.palette;
    contrastFixes.push(...g.fixes);
    // اللون الجديد للخلفية يحدد الوضع: خلفية داكنة ≠ وضع فاتح.
    const dark = hexToHsl(g.palette.background).l < 40;
    if (!seen.has("theme.mode")) next.theme.mode = dark ? "dark" : next.theme.mode === "dark" ? "light" : next.theme.mode;
  }
  return { blueprint: next, changes, rejected, contrastFixes };
}

/** وصف واحد مفهوم لما تغيّر، أو لماذا لم يتغير شيء. */
export function summarizeTweak(r: Pick<TweakResult, "changes" | "contrastFixes" | "rejected">, note?: string): string {
  if (!r.changes.length) return note?.trim() || (r.rejected.length ? "لم نتمكن من تنفيذ هذا الطلب. جرّبوا وصفاً أبسط مثل: غيّروا لون الأزرار إلى الأخضر." : "لم نفهم التعديل المطلوب. اكتبوه بجملة قصيرة وواضحة.");
  const base = r.changes.join("، ") + ".";
  return r.contrastFixes.length ? `${base} ضبطنا ${r.contrastFixes.join(" و")} ليبقى مقروءاً بوضوح.` : base;
}

// ─── واجهة المتجر: اختيار الوسائط ────────────────────────────────────────────
export type HeroMediaChoice =
  | { kind: "auto" }
  | { kind: "video_fashion" }
  | { kind: "video_electronics" }
  | { kind: "video_upload"; url: string; poster?: string }
  | { kind: "side_image"; url: string };

export const READY_VIDEOS = {
  video_fashion: { path: "/demo/media/hero-fashion.mp4", poster: "/demo/media/hero-fashion.jpg" },
  video_electronics: { path: "/demo/media/hero-electronics.mp4", poster: "/demo/media/hero-electronics.jpg" },
} as const;

/** يطبّق اختيار الوسائط على واجهة المتجر. origin = أصل المنصة التي تحمل الفيديوهات الجاهزة. */
export function applyHeroMedia(bp: StoreBlueprint, choice: HeroMediaChoice, origin: string, fallbackImages: { url: string; alt: string }[] = []): { blueprint: StoreBlueprint; summary: string } | { error: string } {
  const next: StoreBlueprint = structuredClone(bp);
  const hero = next.home.find((s) => s.type === "hero");
  if (!hero || hero.type !== "hero") return { error: "لا توجد واجهة في الصفحة الرئيسية" };
  const abs = (p: string) => `${origin.replace(/\/$/, "")}${p}`;
  const img = (url: string, alt: string) => ({ url, alt, focalX: 0.5, focalY: 0.4 });
  switch (choice.kind) {
    case "video_fashion":
    case "video_electronics": {
      const v = READY_VIDEOS[choice.kind];
      hero.videoUrl = abs(v.path);
      hero.images = [img(abs(v.poster), "")];
      hero.variant = "fullscreen";
      hero.overlayOpacity = Math.max(hero.overlayOpacity, 0.4);
      return { blueprint: next, summary: "ضبطنا فيديو الواجهة" };
    }
    case "video_upload": {
      if (!/^https:\/\//.test(choice.url)) return { error: "رابط الفيديو غير صالح" };
      hero.videoUrl = choice.url;
      if (choice.poster && /^https:\/\//.test(choice.poster)) hero.images = [img(choice.poster, "")];
      if (!hero.images.length) return { error: "أضيفوا صورة غلاف للفيديو ليظهر المتجر فوراً قبل تحميله" };
      hero.variant = "fullscreen";
      hero.overlayOpacity = Math.max(hero.overlayOpacity, 0.4);
      return { blueprint: next, summary: "ضبطنا فيديو الواجهة" };
    }
    case "side_image": {
      if (!/^https:\/\//.test(choice.url)) return { error: "رابط الصورة غير صالح" };
      hero.videoUrl = undefined;
      hero.images = [img(choice.url, "")];
      hero.variant = "split";
      return { blueprint: next, summary: "ضبطنا صورة الواجهة الجانبية" };
    }
    case "auto": {
      hero.videoUrl = undefined;
      const imgs = fallbackImages.filter((i) => /^https:\/\//.test(i.url)).slice(0, 4).map((i) => img(i.url, i.alt));
      hero.images = imgs;
      hero.variant = imgs.length >= 4 ? "collage" : imgs.length ? "split" : "centered";
      return { blueprint: next, summary: "الواجهة الآن تُبنى تلقائياً من منتجاتكم" };
    }
  }
}
