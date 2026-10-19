// preview.ts — ملخص بصري صغير لشكل المتجر (ألوان، خطوط، زوايا، أزرار، عنوان) لعرض «قبل/بعد» قبل التطبيق.
// خالص: يُحسب على الخادم للحالتين ويُرسم في المتصفح دون تحميل المتجر كاملاً.
import type { StoreBlueprint } from "@/blueprint/schema";

export type PreviewTokens = {
  mode: "light" | "dark" | "auto";
  background: string;
  card: string;
  muted: string;
  border: string;
  text: string;
  mutedText: string;
  cardText: string;
  primary: string;
  primaryText: string;
  accent: string;
  accentText: string;
  fontHeading: string;
  fontBody: string;
  baseSize: number;
  headingScale: number;
  headingWeight: number;
  cardRadius: number;
  buttonRadius: number;
  buttonFill: string;
  brand: string;
  headline: string;
  announcement: string | null;
};

const FONT_VAR: Record<string, string> = {
  cairo: "var(--font-cairo)",
  tajawal: "var(--font-tajawal)",
  ibm_plex_arabic: "var(--font-ibm-plex-arabic)",
  almarai: "var(--font-almarai)",
  changa: "var(--font-changa)",
  el_messiri: "var(--font-el-messiri)",
  readex_pro: "var(--font-readex-pro)",
  noto_kufi: "var(--font-noto-kufi)",
};
const font = (k: string) => `${FONT_VAR[k] ?? FONT_VAR.cairo}, system-ui, sans-serif`;

export function previewTokens(bp: StoreBlueprint): PreviewTokens {
  const p = bp.theme.palette;
  const hero = bp.home.find((s) => s.type === "hero");
  const ann = bp.header.announcement;
  return {
    mode: bp.theme.mode,
    background: p.background,
    card: p.card,
    muted: p.muted,
    border: p.border,
    text: p.foreground,
    mutedText: p.mutedForeground,
    cardText: p.cardForeground,
    primary: p.primary,
    primaryText: p.primaryForeground,
    accent: p.accent,
    accentText: p.accentForeground,
    fontHeading: font(bp.theme.fonts.heading),
    fontBody: font(bp.theme.fonts.body),
    baseSize: bp.theme.fonts.baseSize,
    headingScale: bp.design.type.headingScale,
    headingWeight: bp.design.type.headingWeight,
    cardRadius: bp.design.shape.card,
    buttonRadius: Math.min(bp.design.shape.button, 999),
    buttonFill: bp.design.button.fill,
    brand: bp.brand.name,
    headline: hero && hero.type === "hero" ? hero.headline : bp.brand.tagline ?? bp.brand.name,
    announcement: ann?.enabled && ann.items[0]?.text ? ann.items[0].text : null,
  };
}
