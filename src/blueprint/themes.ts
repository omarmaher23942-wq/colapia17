// التصميمات الكاملة (V3، docs/V3-PLAN.md القسم 2، والمواصفة docs/STORE-DESIGN.md).
// كل تصميم هوية متناسقة: ألوان الوضعين، خطّان، زوايا، بطاقة، أزرار، هيدر، حركة، خلفية.
// applyTheme تطبّقه على نسخة من الـ Blueprint وتحفظ المحتوى كما هو (النصوص والأقسام والمنتجات لا تُمس).
import { designSchema, THEME_IDS, type CARD_STYLES, type Design, type Palette, type StoreBackground, type StoreBlueprint, type Theme } from "./schema";
import { buildPalette, deriveScheme, isDarkColor, type CoreTokens } from "./tokens";

export type ThemeId = (typeof THEME_IDS)[number];
export type CardStyle = (typeof CARD_STYLES)[number];

export type ThemeMeta = { id: ThemeId; name: string; tagline: string; swatch: [string, string, string] };

type Bg = { kind: StoreBackground["kind"]; color2?: string; texture?: StoreBackground["texture"] };

export type ThemeDef = ThemeMeta & {
  /** الوضع الأصلي للهوية. */
  native: "light" | "dark";
  light: CoreTokens;
  dark: CoreTokens;
  lightBg: Bg;
  darkBg: Bg;
  fonts: { heading: Theme["fonts"]["heading"]; body: Theme["fonts"]["body"] };
  radius: { card: number; button: number; input: number; image: number };
  button: Design["button"]["fill"];
  header: Design["header"]["surface"];
  card: CardStyle;
  heading: Design["heading"]["style"];
  align: Design["layout"]["headingAlign"];
  density: Design["layout"]["density"];
  ratio: Design["card"]["ratio"];
  imageBg: Design["card"]["imageBg"];
  price: Design["card"]["priceStyle"];
  divider: Design["surface"]["divider"];
  motion: { level: Design["motion"]["level"]; depth: boolean };
};

export const DEFAULT_THEME: ThemeId = "midnight-mercury";

export const THEME_DEFS: Record<ThemeId, ThemeDef> = {
  "midnight-mercury": {
    id: "midnight-mercury",
    name: "منتصف الليل",
    tagline: "كحلي عميق بإطار فضي متدفق",
    swatch: ["#0a1228", "#c9d6ea", "#8fb0ff"],
    native: "dark",
    dark: { background: "#0a1228", surface: "#101b38", surface2: "#16234a", text: "#eef2fb", muted: "#a9b6d3", primary: "#8fb0ff", accent: "#c9d6ea", border: "#26355f" },
    light: { background: "#f4f6fb", surface: "#ffffff", surface2: "#e9eef8", text: "#0b1530", muted: "#46557a", primary: "#1e3a8a", accent: "#4d6cc4", border: "#d4dcec" },
    darkBg: { kind: "gradient", color2: "#16295a" },
    lightBg: { kind: "gradient", color2: "#dfe7f7" },
    fonts: { heading: "el_messiri", body: "ibm_plex_arabic" },
    radius: { card: 14, button: 12, input: 12, image: 12 },
    button: "solid",
    header: "glass",
    card: "mercury",
    heading: "eyebrow",
    align: "start",
    density: "balanced",
    ratio: "portrait",
    imageBg: "tint",
    price: "bold",
    divider: "none",
    motion: { level: "lively", depth: false },
  },
  "ivory-atelier": {
    id: "ivory-atelier",
    name: "عاجي",
    tagline: "دفء تحريري وأناقة هادئة",
    swatch: ["#f7f2ea", "#1f1b16", "#a07a4c"],
    native: "light",
    light: { background: "#f7f2ea", surface: "#fffdf9", surface2: "#efe7da", text: "#1f1b16", muted: "#5f554a", primary: "#1f1b16", accent: "#8a6a3f", border: "#e2d8c7" },
    dark: { background: "#17140f", surface: "#1f1b15", surface2: "#29241c", text: "#f3ece0", muted: "#b7ab98", primary: "#e9dcc6", accent: "#c9a46e", border: "#3a3328" },
    lightBg: { kind: "solid" },
    darkBg: { kind: "solid" },
    fonts: { heading: "el_messiri", body: "almarai" },
    radius: { card: 6, button: 4, input: 6, image: 4 },
    button: "solid",
    header: "solid",
    card: "simple",
    heading: "ornament",
    align: "center",
    density: "airy",
    ratio: "tall",
    imageBg: "muted",
    price: "plain",
    divider: "line",
    motion: { level: "calm", depth: false },
  },
  "noir-gold": {
    id: "noir-gold",
    name: "أسود وذهبي",
    tagline: "فخامة مخملية بإطار ذهبي يلمع",
    swatch: ["#0c0b0a", "#d4af37", "#f3e7c4"],
    native: "dark",
    dark: { background: "#0c0b0a", surface: "#15130f", surface2: "#1d1a15", text: "#f5efe2", muted: "#b3a88f", primary: "#d4af37", accent: "#f3e7c4", border: "#2e2a20" },
    light: { background: "#fbf8f1", surface: "#ffffff", surface2: "#f2ecdf", text: "#16130d", muted: "#5c5442", primary: "#7d6310", accent: "#a8841f", border: "#e5dcc6" },
    darkBg: { kind: "texture", texture: "grain" },
    lightBg: { kind: "texture", texture: "grain" },
    fonts: { heading: "noto_kufi", body: "almarai" },
    radius: { card: 10, button: 10, input: 10, image: 8 },
    button: "gradient",
    header: "glass",
    card: "mercury",
    heading: "ornament",
    align: "center",
    density: "balanced",
    ratio: "portrait",
    imageBg: "muted",
    price: "accent",
    divider: "none",
    motion: { level: "lively", depth: false },
  },
  "coral-pop": {
    id: "coral-pop",
    name: "مرجاني",
    tagline: "مرح وحيوي للشباب",
    swatch: ["#ffffff", "#ff6b5b", "#6c4bff"],
    native: "light",
    light: { background: "#ffffff", surface: "#ffffff", surface2: "#fff1ee", text: "#1d1530", muted: "#5e5670", primary: "#d93d2e", accent: "#6c4bff", border: "#f1e3ea" },
    dark: { background: "#150f20", surface: "#1d162b", surface2: "#261d38", text: "#f7f2ff", muted: "#b9aed0", primary: "#ff7a6b", accent: "#9d85ff", border: "#352a4d" },
    lightBg: { kind: "gradient", color2: "#ffe9e4" },
    darkBg: { kind: "gradient", color2: "#2a1840" },
    fonts: { heading: "changa", body: "tajawal" },
    radius: { card: 20, button: 999, input: 14, image: 16 },
    button: "solid",
    header: "glass",
    card: "glow",
    heading: "underline",
    align: "start",
    density: "balanced",
    ratio: "square",
    imageBg: "tint",
    price: "pill",
    divider: "curve",
    motion: { level: "lively", depth: false },
  },
  "sage-minimal": {
    id: "sage-minimal",
    name: "مريمي",
    tagline: "بساطة تامة ومسافات واسعة",
    swatch: ["#f4f5f0", "#5f7a61", "#2b2f2a"],
    native: "light",
    light: { background: "#f4f5f0", surface: "#fbfbf8", surface2: "#e9ebe3", text: "#2b2f2a", muted: "#5a6058", primary: "#4f6b52", accent: "#7d7052", border: "#dde0d5" },
    dark: { background: "#121512", surface: "#191d19", surface2: "#212621", text: "#e9ece6", muted: "#a7aea4", primary: "#9fbea2", accent: "#c9b98d", border: "#2d332d" },
    lightBg: { kind: "solid" },
    darkBg: { kind: "solid" },
    fonts: { heading: "readex_pro", body: "ibm_plex_arabic" },
    radius: { card: 12, button: 10, input: 10, image: 10 },
    button: "solid",
    header: "bordered",
    card: "simple",
    heading: "plain",
    align: "start",
    density: "airy",
    ratio: "portrait",
    imageBg: "muted",
    price: "plain",
    divider: "none",
    motion: { level: "calm", depth: false },
  },
  "neon-tech": {
    id: "neon-tech",
    name: "نيون",
    tagline: "تقني مضيء للإلكترونيات",
    swatch: ["#070b14", "#22d3ee", "#a78bfa"],
    native: "dark",
    dark: { background: "#070b14", surface: "#0d1422", surface2: "#121b2d", text: "#e6f1ff", muted: "#8ea3c0", primary: "#22d3ee", accent: "#a78bfa", border: "#1c2a44" },
    light: { background: "#f5f8fc", surface: "#ffffff", surface2: "#e8eef7", text: "#0a1120", muted: "#4b5a73", primary: "#0e7490", accent: "#6d28d9", border: "#d6dfec" },
    darkBg: { kind: "texture", texture: "grid" },
    lightBg: { kind: "texture", texture: "grid" },
    fonts: { heading: "readex_pro", body: "cairo" },
    radius: { card: 14, button: 10, input: 10, image: 10 },
    button: "glass",
    header: "glass",
    card: "glow",
    heading: "eyebrow",
    align: "start",
    density: "compact",
    ratio: "square",
    imageBg: "gradient",
    price: "accent",
    divider: "line",
    motion: { level: "lively", depth: false },
  },
  "desert-sand": {
    id: "desert-sand",
    name: "رملي",
    tagline: "دفء وأصالة",
    swatch: ["#f3e9da", "#b5532f", "#3b2a1e"],
    native: "light",
    light: { background: "#f3e9da", surface: "#fbf5ec", surface2: "#eadcc7", text: "#3b2a1e", muted: "#654e3d", primary: "#9c4426", accent: "#7a5a2e", border: "#dccab0" },
    dark: { background: "#1a130e", surface: "#231a13", surface2: "#2d2219", text: "#f3e9da", muted: "#c2ad94", primary: "#e08a5e", accent: "#d4b07a", border: "#3d2f23" },
    lightBg: { kind: "texture", texture: "grain" },
    darkBg: { kind: "texture", texture: "grain" },
    fonts: { heading: "el_messiri", body: "tajawal" },
    radius: { card: 16, button: 12, input: 12, image: 12 },
    button: "solid",
    header: "solid",
    card: "simple",
    heading: "ornament",
    align: "center",
    density: "balanced",
    ratio: "portrait",
    imageBg: "muted",
    price: "underline",
    divider: "curve",
    motion: { level: "calm", depth: false },
  },
  "arctic-glass": {
    id: "arctic-glass",
    name: "جليدي",
    tagline: "زجاج متجمد وعمق ثلاثي الأبعاد",
    swatch: ["#f5f9ff", "#3b82f6", "#0f172a"],
    native: "light",
    light: { background: "#f5f9ff", surface: "#ffffff", surface2: "#e8f0fc", text: "#0f172a", muted: "#475569", primary: "#2563eb", accent: "#0369a1", border: "#d7e3f5" },
    dark: { background: "#0b1220", surface: "#111a2c", surface2: "#17223a", text: "#eaf2ff", muted: "#9fb0cc", primary: "#60a5fa", accent: "#38bdf8", border: "#22304d" },
    lightBg: { kind: "gradient", color2: "#dceaff" },
    darkBg: { kind: "gradient", color2: "#16264a" },
    fonts: { heading: "readex_pro", body: "cairo" },
    radius: { card: 18, button: 14, input: 12, image: 14 },
    button: "solid",
    header: "glass",
    card: "cinematic",
    heading: "eyebrow",
    align: "start",
    density: "balanced",
    ratio: "portrait",
    imageBg: "gradient",
    price: "bold",
    divider: "none",
    motion: { level: "lively", depth: true },
  },
};

export const THEMES: ThemeMeta[] = THEME_IDS.map((id) => {
  const { name, tagline, swatch } = THEME_DEFS[id];
  return { id, name, tagline, swatch };
});

export const isThemeId = (v: unknown): v is ThemeId => typeof v === "string" && (THEME_IDS as readonly string[]).includes(v);

export const CARD_STYLE_LABELS: Record<CardStyle, { name: string; hint: string }> = {
  mercury: { name: "زئبقي", hint: "إطار بلمعة معدنية تسري حوله" },
  cinematic: { name: "سينمائي", hint: "ميل ثلاثي الأبعاد ولمعة مع المؤشر" },
  glow: { name: "مضيء", hint: "توهج ناعم بلون الإبراز عند المرور" },
  simple: { name: "بسيط", hint: "نظيف بحد رفيع" },
};

/** لوحتا التصميم (فاتح وداكن) بتباين AA مضمون. */
export function themePalettes(id: ThemeId): { light: Palette; dark: Palette } {
  const d = THEME_DEFS[id];
  return { light: buildPalette(d.light), dark: buildPalette(d.dark) };
}

function bgOf(b: Bg, color: string): StoreBackground {
  return { kind: b.kind, color, color2: b.color2, texture: b.texture ?? "grain" };
}

const RADIUS_TOKEN = (px: number): Theme["radius"] => (px <= 2 ? "none" : px <= 6 ? "sm" : px <= 10 ? "md" : px <= 16 ? "lg" : "xl");

/** تطبّق التصميم كاملاً على نسخة من الـ Blueprint وتحفظ المحتوى كما هو. */
export function applyTheme(bp: StoreBlueprint, id: ThemeId): StoreBlueprint {
  const d = THEME_DEFS[isThemeId(id) ? id : DEFAULT_THEME];
  const { light, dark } = themePalettes(d.id);
  const nativePalette = d.native === "dark" ? dark : light;
  const base = designSchema.parse(bp.design ?? {});
  const design: Design = {
    ...base,
    theme: d.id,
    cardStyle: d.card,
    layout: { ...base.layout, density: d.density, headingAlign: d.align },
    shape: { ...base.shape, card: d.radius.card, button: d.radius.button, input: d.radius.input, image: d.radius.image },
    surface: { ...base.surface, background: "solid", divider: d.divider, grain: false, rhythm: base.surface.rhythm === "flat" ? "flat" : "alternate" },
    // الظل على التصميم الداكن أسود لا بلون النص الفاتح.
    elevation: { ...base.elevation, level: d.card === "simple" ? 0 : 1, border: 1, tint: d.native === "dark" ? "#000000" : undefined },
    card: { ...base.card, ratio: d.ratio, imageBg: d.imageBg, priceStyle: d.price, hover: d.card === "cinematic" ? "none" : "zoom" },
    button: { ...base.button, fill: d.button },
    heading: { style: d.heading },
    header: { ...base.header, surface: d.header },
    motion: { level: d.motion.level, depth: d.motion.depth },
  };
  return {
    ...bp,
    design,
    theme: {
      ...bp.theme,
      mode: d.native,
      palette: nativePalette,
      darkPalette: dark,
      background: bgOf(d.native === "dark" ? d.darkBg : d.lightBg, nativePalette.background),
      darkBackground: bgOf(d.darkBg, dark.background),
      fonts: { ...bp.theme.fonts, heading: d.fonts.heading, body: d.fonts.body },
      radius: RADIUS_TOKEN(d.radius.card),
      buttonStyle: d.button,
      productCardStyle: d.card === "simple" ? "bordered" : "elevated",
      backgroundPattern: "none",
      ambientBackdrop: undefined,
    },
  };
}

/**
 * وضع العرض: «ثابت» على هوية التصميم الأصلية، أو «يتبع جهاز الزائر» (فاتح/داكن تلقائياً بالهوية نفسها).
 * عند التلقائي: palette = الفاتحة وdarkPalette = الداكنة؛ من تصميم معروف إن وُجد، وإلا تُشتق من ألوان التاجر نفسه.
 */
export function setDisplayMode(bp: StoreBlueprint, mode: Theme["mode"]): StoreBlueprint {
  const id = bp.design?.theme;
  const cur = bp.theme.palette;
  const curDark = isDarkColor(cur.background);
  if (mode === "auto") {
    const light = curDark ? (id && isThemeId(id) ? themePalettes(id).light : deriveScheme(cur, "light")) : cur;
    const dark = curDark ? cur : bp.theme.darkPalette && isCompletePalette(bp.theme.darkPalette) ? (bp.theme.darkPalette as Palette) : deriveScheme(cur, "dark");
    const def = id && isThemeId(id) ? THEME_DEFS[id] : null;
    return {
      ...bp,
      theme: {
        ...bp.theme,
        mode,
        palette: light,
        darkPalette: dark,
        background: bp.theme.background && !curDark ? { ...bp.theme.background, color: light.background } : bgOf(def?.lightBg ?? { kind: "solid" }, light.background),
        darkBackground: bp.theme.darkBackground ? { ...bp.theme.darkBackground, color: dark.background } : bgOf(def?.darkBg ?? { kind: "solid" }, dark.background),
      },
    };
  }
  const want = mode === "dark";
  if (want === curDark) return { ...bp, theme: { ...bp.theme, mode } };
  // التبديل بين ثابت فاتح وثابت داكن: النسخة المقابلة المحفوظة أو المشتقة.
  const next = want
    ? bp.theme.darkPalette && isCompletePalette(bp.theme.darkPalette) ? (bp.theme.darkPalette as Palette) : deriveScheme(cur, "dark")
    : id && isThemeId(id) ? themePalettes(id).light : deriveScheme(cur, "light");
  const bgSrc = want ? bp.theme.darkBackground : undefined;
  return {
    ...bp,
    theme: {
      ...bp.theme,
      mode,
      palette: next,
      background: bgSrc ? { ...bgSrc, color: next.background } : bp.theme.background ? { ...bp.theme.background, color: next.background } : undefined,
    },
  };
}

const PALETTE_KEYS = ["primary", "primaryForeground", "accent", "accentForeground", "background", "foreground", "muted", "mutedForeground", "card", "border"] as const;
export function isCompletePalette(p: Partial<Palette>): boolean {
  return PALETTE_KEYS.every((k) => typeof p[k] === "string");
}

/** أسلوب البطاقة الفعلي: صريح من التصميم، وإلا يُشتق من الطابع القديم. */
export function cardStyleOf(bp: Pick<StoreBlueprint, "design" | "theme">): CardStyle {
  const explicit = bp.design?.cardStyle;
  if (explicit) return explicit;
  switch (bp.theme.productCardStyle) {
    case "minimal":
    case "editorial":
    case "bordered":
    case "brutalist":
      return "simple";
    case "glass":
    case "floating":
      return "glow";
    default:
      return "simple";
  }
}
