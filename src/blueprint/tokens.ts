// tokens.ts — توكنات الألوان الدلالية للمتجر (V3) مع ضمان تباين WCAG AA آلياً.
// خالص (بلا server-only): يستخدمه الثيم والتصميمات ومحرر التصميم والاختبارات.
//
// التاجر (أو التصميم) يحدد خمسة ألوان فقط: الخلفية، السطح، النص، الأساسي، الإبراز.
// كل الباقي يُشتق منها (السطح الثاني، النص الثانوي، الحدود، نص الأزرار)، وكل زوج نص/خلفية يبلغ 4.5:1 على الأقل.
import { contrastRatio, ensureContrast, hexToHsl, hexToRgb, hslToHex, rgbToHex } from "./palette";
import type { Palette } from "./schema";

export type CoreTokens = {
  background: string;
  surface: string;
  text: string;
  primary: string;
  accent: string;
  /** اختيارية: تُشتق إن غابت. */
  surface2?: string;
  muted?: string;
  border?: string;
};

const HEX6 = /^#[0-9a-f]{6}$/i;
const HEX3 = /^#[0-9a-f]{3}$/i;

export function cleanHex(v: unknown, fallback: string): string {
  if (typeof v !== "string") return fallback;
  const t = v.trim().toLowerCase();
  if (HEX6.test(t)) return t;
  if (HEX3.test(t)) return "#" + t.slice(1).split("").map((c) => c + c).join("");
  return fallback;
}

/** مزج لونين في sRGB: t=0 ⇒ a، t=1 ⇒ b. */
export function mix(a: string, b: string, t: number): string {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  const k = Math.max(0, Math.min(1, t));
  return rgbToHex({ r: x.r + (y.r - x.r) * k, g: x.g + (y.g - x.g) * k, b: x.b + (y.b - x.b) * k });
}

export const luminance = (hex: string) => {
  const { r, g, b } = hexToRgb(hex);
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};

export const isDarkColor = (hex: string) => luminance(hex) < 0.18;

/** نص مقروء على خلفية: يبقي اللون المفضل إن بلغ الحد، وإلا يعدّله، وإلا الأبيض أو الأسود الأقرب. */
export function aaText(preferred: string, bg: string, target: 4.5 | 7 = 4.5): string {
  if (contrastRatio(preferred, bg) >= target) return preferred;
  const fixed = ensureContrast(preferred, bg, target);
  if (contrastRatio(fixed, bg) >= target) return fixed;
  const white = "#ffffff";
  const ink = contrastRatio("#0b0f19", bg) >= target ? "#0b0f19" : "#000000";
  return contrastRatio(white, bg) >= contrastRatio(ink, bg) ? white : ink;
}

/**
 * لون زر ونصه بتباين 4.5:1: يُختار النص الأوضح من بين المرشحين، وإن لم يبلغ أحدها الحد
 * يُعتّم الزر (أو يُفتّح) بالتدريج حتى يبلغه. هكذا لا يظهر زر بنص باهت أبداً.
 */
export function buttonPair(hex: string, candidates: string[] = []): { bg: string; fg: string } {
  const pool = [...candidates.filter((c) => HEX6.test(c)), "#ffffff", "#0b0f19", "#000000"];
  const best = (c: string) => pool.reduce((a, b) => (contrastRatio(b, c) > contrastRatio(a, c) ? b : a), pool[0]!);
  let bg = cleanHex(hex, "#2f5bea");
  let fg = best(bg);
  const dir = contrastRatio("#ffffff", bg) >= contrastRatio("#0b0f19", bg) ? -2 : 2;
  for (let i = 0; i < 50 && contrastRatio(fg, bg) < 4.5; i++) {
    const hsl = hexToHsl(bg);
    bg = hslToHex({ ...hsl, l: Math.max(0, Math.min(100, hsl.l + dir)) });
    fg = best(bg);
  }
  return { bg, fg };
}

/** لوحة كاملة (بصيغة الـ Blueprint) من التوكنات الأساسية، بتباين AA مضمون لكل الأزواج المهمة. */
export function buildPalette(t: CoreTokens): Palette {
  const background = cleanHex(t.background, "#ffffff");
  const dark = isDarkColor(background);
  const surface = cleanHex(t.surface, background);
  const text = aaText(cleanHex(t.text, dark ? "#f3f4f7" : "#14161c"), background, 7);
  const cardForeground = aaText(text, surface, 4.5);
  const surface2 = cleanHex(t.surface2, mix(surface, text, dark ? 0.07 : 0.05));
  const muted = aaText(cleanHex(t.muted, mix(text, background, 0.38)), surface2, 4.5);
  const border = cleanHex(t.border, mix(background, text, dark ? 0.16 : 0.13));
  // الأساسي يُقرأ نصاً ورابطاً على الخلفية، ويصلح زراً بنص واضح.
  const primaryText = aaText(cleanHex(t.primary, "#2f5bea"), background, 4.5);
  const btn = buttonPair(primaryText, [background, text]);
  const accentRaw = cleanHex(t.accent, primaryText);
  const acc = buttonPair(accentRaw, [background, text]);
  return {
    primary: btn.bg,
    primaryForeground: btn.fg,
    secondary: surface2,
    secondaryForeground: aaText(text, surface2, 4.5),
    accent: acc.bg,
    accentForeground: acc.fg,
    background,
    foreground: text,
    muted: surface2,
    mutedForeground: muted,
    card: surface,
    cardForeground,
    border,
    success: aaText("#16a34a", background, 4.5),
    warning: aaText("#b45309", background, 4.5),
    danger: aaText("#dc2626", background, 4.5),
  };
}

/** التوكنات الأساسية من لوحة محفوظة (لمحرر الألوان). */
export function tokensOf(p: Partial<Palette>): CoreTokens {
  return {
    background: cleanHex(p.background, "#ffffff"),
    surface: cleanHex(p.card, cleanHex(p.background, "#ffffff")),
    text: cleanHex(p.foreground, "#14161c"),
    primary: cleanHex(p.primary, "#2f5bea"),
    accent: cleanHex(p.accent, cleanHex(p.primary, "#2f5bea")),
  };
}

/**
 * الوضع المقابل للوحة بالهوية نفسها: خلفية التاجر تُقلب (درجتها تبقى، والإضاءة تنعكس)، والأساسي يبقى لونه
 * ويُعدَّل ليُقرأ. كان الوضع الداكن يُشتق من لون العلامة وحده فيتجاهل الخلفية التي اختارها التاجر.
 */
export function deriveScheme(p: Partial<Palette>, target: "light" | "dark"): Palette {
  const t = tokensOf(p);
  const bgHsl = hexToHsl(t.background);
  const sat = Math.min(bgHsl.s, 34);
  const isDark = isDarkColor(t.background);
  if ((target === "dark") === isDark) return buildPalette(t);
  const background = target === "dark" ? hslToHex({ h: bgHsl.h, s: sat, l: 8 }) : hslToHex({ h: bgHsl.h, s: Math.min(sat, 30), l: 97 });
  const surface = target === "dark" ? hslToHex({ h: bgHsl.h, s: sat, l: 12 }) : "#ffffff";
  const text = target === "dark" ? hslToHex({ h: bgHsl.h, s: 12, l: 94 }) : hslToHex({ h: bgHsl.h, s: 18, l: 10 });
  const ph = hexToHsl(t.primary);
  const primary = hslToHex({ ...ph, l: target === "dark" ? Math.max(ph.l, 66) : Math.min(ph.l, 42) });
  const ah = hexToHsl(t.accent);
  const accent = hslToHex({ ...ah, l: target === "dark" ? Math.max(ah.l, 64) : Math.min(ah.l, 44) });
  return buildPalette({ background, surface, text, primary, accent });
}

/** أضعف تباين بين الأزواج المهمة (للاختبارات وتنبيه المحرر). */
export function weakestContrast(p: Palette): number {
  return Math.min(
    contrastRatio(p.foreground, p.background),
    contrastRatio(p.cardForeground, p.card),
    contrastRatio(p.mutedForeground, p.muted),
    contrastRatio(p.primaryForeground, p.primary),
    contrastRatio(p.accentForeground, p.accent),
    contrastRatio(p.primary, p.background)
  );
}

/** خلفية المتجر الفعلية للعرض: داكنة/فاتحة ثابتة، أو تلقائية حين يتبع جهاز الزائر وللوحة نسخة داكنة. */
export function schemeOf(theme: { mode?: string; palette: { background: string } }): "light" | "dark" | "auto" {
  const dark = isDarkColor(cleanHex(theme.palette.background, "#ffffff"));
  if (dark) return "dark";
  return theme.mode === "auto" ? "auto" : "light";
}
