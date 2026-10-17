// core-palette.ts — اشتقاق لوحة ألوان كاملة ومقروءة (WCAG AA) من لون العلامة وحده، للوضعين الفاتح والداكن.
// خالص (بلا server-only) ليُستخدم من الثيم والإعدادات والاختبارات.
import { contrastRatio, ensureContrast, hexToHsl, hslToHex, readableOn } from "./palette";
import type { Palette } from "./schema";

const HEX = /^#[0-9a-f]{6}$/i;

/** تطبيع #rgb إلى #rrggbb، وإلا لون احتياطي. */
export function normalizeHex(input: string | undefined | null, fallback = "#2f5bea"): string {
  const v = (input ?? "").trim();
  if (HEX.test(v)) return v.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(v)) return ("#" + v.slice(1).split("").map((c) => c + c).join("")).toLowerCase();
  return fallback;
}

/** خلفية محايدة مائلة قليلاً لدرجة العلامة (دفء/برودة خفيفة) بدل أبيض/أسود صرف. */
function surface(brand: string, mode: "light" | "dark", step: number): string {
  const { h } = hexToHsl(brand);
  return mode === "light"
    ? hslToHex({ h, s: 12, l: Math.max(80, 100 - step) })
    : hslToHex({ h, s: 14, l: Math.min(30, 7 + step) });
}

/**
 * لوحة كاملة: كل أزواج النص/الخلفية فيها تبلغ 4.5:1 على الأقل.
 * primary يُعدَّل (إن لزم) ليصلح كنص ورابط على الخلفية، وprimaryForeground يُختار فوقه بتباين AA.
 */
export function deriveCorePalette(brandHex: string, mode: "light" | "dark"): Palette {
  const brand = normalizeHex(brandHex);
  const background = mode === "light" ? "#ffffff" : surface(brand, "dark", 0);
  const card = mode === "light" ? "#ffffff" : surface(brand, "dark", 4);
  const muted = mode === "light" ? surface(brand, "light", 6) : surface(brand, "dark", 8);
  const border = mode === "light" ? surface(brand, "light", 14) : surface(brand, "dark", 16);
  const foreground = ensureContrast(mode === "light" ? "#14161c" : "#f3f4f7", background, 7);
  const mutedForeground = ensureContrast(mode === "light" ? "#5b6170" : "#a3a9b8", muted, 4.5);

  let primary = ensureContrast(brand, background, 4.5);
  // على خلفية فاتحة يصير اللون أغمق (نص أبيض عليه)، وعلى الداكنة أفتح (نص داكن عليه): نكمل في الاتجاه نفسه حتى يبلغ الزوجان AA.
  let primaryForeground = readableOn(primary);
  for (let i = 0; i < 40 && contrastRatio(primaryForeground, primary) < 4.5; i++) {
    const hsl = hexToHsl(primary);
    primary = hslToHex({ ...hsl, l: Math.max(0, Math.min(100, hsl.l + (mode === "light" ? -2 : 2))) });
    primaryForeground = readableOn(primary);
  }
  const { h } = hexToHsl(primary);
  const accent = ensureContrast(hslToHex({ h: (h + 30) % 360, s: 70, l: mode === "light" ? 40 : 68 }), background, 4.5);

  return {
    primary,
    primaryForeground,
    secondary: muted,
    secondaryForeground: foreground,
    accent,
    accentForeground: readableOn(accent),
    background,
    foreground,
    muted,
    mutedForeground,
    card,
    cardForeground: foreground,
    border,
    success: ensureContrast("#16a34a", background, 4.5),
    warning: ensureContrast("#b45309", background, 4.5),
    danger: ensureContrast("#dc2626", background, 4.5),
  };
}

/** أضعف تباين بين أزواج النص المهمة في لوحة (للاختبار ولتنبيه المحرر). */
export function minPaletteContrast(p: Palette): number {
  return Math.min(
    contrastRatio(p.foreground, p.background),
    contrastRatio(p.cardForeground, p.card),
    contrastRatio(p.mutedForeground, p.muted),
    contrastRatio(p.primaryForeground, p.primary),
    contrastRatio(p.primary, p.background)
  );
}
