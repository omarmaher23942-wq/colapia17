// التصميمات الكاملة (V3، docs/V3-PLAN.md القسم 2). العقد بين الشرائح:
// THEMES قائمة للعرض، وapplyTheme تطبّق هوية كاملة على الـ Blueprint (تنفيذها في شريحة التصميم W-A).
import type { StoreBlueprint } from "./schema";

export type ThemeId =
  | "midnight-mercury"
  | "ivory-atelier"
  | "noir-gold"
  | "coral-pop"
  | "sage-minimal"
  | "neon-tech"
  | "desert-sand"
  | "arctic-glass";

export type ThemeMeta = { id: ThemeId; name: string; tagline: string; swatch: [string, string, string] };

export const DEFAULT_THEME: ThemeId = "midnight-mercury";

export const THEMES: ThemeMeta[] = [
  { id: "midnight-mercury", name: "منتصف الليل", tagline: "كحلي عميق بإطار فضي متدفق", swatch: ["#0b1530", "#c9d6ea", "#7aa2ff"] },
  { id: "ivory-atelier", name: "عاجي", tagline: "دفء تحريري وأناقة هادئة", swatch: ["#f7f2ea", "#1f1b16", "#b0895b"] },
  { id: "noir-gold", name: "أسود وذهبي", tagline: "فخامة مخملية", swatch: ["#0c0b0a", "#d4af37", "#f3e7c4"] },
  { id: "coral-pop", name: "مرجاني", tagline: "مرح وحيوي", swatch: ["#ffffff", "#ff6b5b", "#6c4bff"] },
  { id: "sage-minimal", name: "مريمي", tagline: "بساطة تامة", swatch: ["#f4f5f0", "#5f7a61", "#2b2f2a"] },
  { id: "neon-tech", name: "نيون", tagline: "تقني مضيء", swatch: ["#070b14", "#22d3ee", "#a78bfa"] },
  { id: "desert-sand", name: "رملي", tagline: "دفء وأصالة", swatch: ["#f3e9da", "#b5532f", "#3b2a1e"] },
  { id: "arctic-glass", name: "جليدي", tagline: "زجاج متجمد وعمق", swatch: ["#f5f9ff", "#3b82f6", "#0f172a"] },
];

export const isThemeId = (v: unknown): v is ThemeId => THEMES.some((t) => t.id === v);

/** تطبّق التصميم كاملاً على نسخة من الـ Blueprint وتحفظ المحتوى كما هو. */
export function applyTheme(bp: StoreBlueprint, _id: ThemeId): StoreBlueprint {
  return bp;
}
