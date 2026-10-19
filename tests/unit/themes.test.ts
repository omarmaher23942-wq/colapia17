import { describe, expect, it } from "vitest";
import { defaultBlueprint } from "@/blueprint/defaults";
import { blueprintSchema } from "@/blueprint/schema";
import { applyTheme, cardStyleOf, DEFAULT_THEME, isThemeId, setDisplayMode, THEMES, themePalettes, type ThemeId } from "@/blueprint/themes";
import { buildPalette, buttonPair, deriveScheme, isDarkColor, weakestContrast } from "@/blueprint/tokens";
import { contrastRatio } from "@/blueprint/palette";
import { themeStyleSheet } from "@/blueprint/theme";
import { designStyleSheet } from "@/blueprint/design";

const ids = THEMES.map((t) => t.id) as ThemeId[];

describe("التصميمات الثمانية", () => {
  it("ثمانية تصميمات بمعرّفات صالحة والافتراضي بينها", () => {
    expect(ids).toHaveLength(8);
    expect(ids).toContain(DEFAULT_THEME);
    expect(isThemeId("noir-gold")).toBe(true);
    expect(isThemeId("x")).toBe(false);
  });

  it.each(ids)("لوحتا %s (فاتح وداكن) تبلغان AA في كل الأزواج المهمة", (id) => {
    const { light, dark } = themePalettes(id);
    expect(weakestContrast(light)).toBeGreaterThanOrEqual(4.5);
    expect(weakestContrast(dark)).toBeGreaterThanOrEqual(4.5);
    expect(isDarkColor(dark.background)).toBe(true);
    expect(isDarkColor(light.background)).toBe(false);
  });

  it.each(ids)("applyTheme(%s) ينتج Blueprint صالحاً ويحفظ المحتوى", (id) => {
    const bp = defaultBlueprint({ name: "متجر نور", tagline: "سطر" });
    const out = applyTheme(bp, id);
    expect(blueprintSchema.safeParse(out).success).toBe(true);
    expect(out.design.theme).toBe(id);
    expect(out.brand).toEqual(bp.brand);
    expect(out.home).toEqual(bp.home);
    expect(out.theme.background?.color).toBe(out.theme.palette.background);
    // الخلفية في ورقة الأنماط هي لون التصميم نفسه، لا أبيض ثابت.
    expect(themeStyleSheet(out.theme)).toContain(`--background:${out.theme.palette.background}`);
  });

  it("المتجر الجديد يبدأ بالتصميم الافتراضي (إطار زئبقي، كحلي)", () => {
    const bp = defaultBlueprint({ name: "متجر" });
    expect(bp.design.theme).toBe("midnight-mercury");
    expect(cardStyleOf(bp)).toBe("mercury");
    expect(isDarkColor(bp.theme.palette.background)).toBe(true);
    expect(designStyleSheet(bp)).toContain("conic-gradient(from var(--s-angle)");
  });
});

describe("الخلفية توكن حقيقي (سبب الخلل الجذري)", () => {
  it("تغيير خلفية اللوحة يغيّر --background في الوضعين", () => {
    const bp = applyTheme(defaultBlueprint({ name: "متجر" }), "sage-minimal");
    const custom = { ...bp.theme, mode: "auto" as const, palette: buildPalette({ background: "#fde8ef", surface: "#ffffff", text: "#2a1520", primary: "#b0225a", accent: "#7a3cff" }), darkPalette: undefined };
    const css = themeStyleSheet(custom);
    expect(css).toContain("--background:#fde8ef");
    // الوضع الداكن مشتق من درجة الخلفية التي اختارها التاجر (وردية)، لا من لون العلامة وحده.
    const dark = deriveScheme(custom.palette, "dark");
    expect(isDarkColor(dark.background)).toBe(true);
    expect(css).toContain(`--background:${dark.background}`);
    expect(css).toContain("html:has(.storefront){background-color:#fde8ef}");
  });

  it("وضع العرض التلقائي يحتفظ بالهوية ويعيد النسخة الثابتة", () => {
    const bp = applyTheme(defaultBlueprint({ name: "متجر" }), "midnight-mercury");
    const auto = setDisplayMode(bp, "auto");
    expect(isDarkColor(auto.theme.palette.background)).toBe(false);
    expect(auto.theme.darkPalette?.background).toBe(bp.theme.palette.background);
    expect(blueprintSchema.safeParse(auto).success).toBe(true);
    const back = setDisplayMode(auto, "dark");
    expect(back.theme.palette.background).toBe(bp.theme.palette.background);
  });

  it("زر بنص مقروء دائماً حتى للألوان المتوسطة", () => {
    for (const c of ["#ff6b5b", "#22d3ee", "#d4af37", "#808080", "#ffff00"]) {
      const { bg, fg } = buttonPair(c);
      expect(contrastRatio(bg, fg)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("لوحة من أي ألوان يختارها التاجر تبلغ AA", () => {
    const cases = [
      { background: "#ffffff", surface: "#ffffff", text: "#cccccc", primary: "#ffee00", accent: "#00ffcc" },
      { background: "#111111", surface: "#1a1a1a", text: "#333333", primary: "#220044", accent: "#0000ff" },
      { background: "#7a7a7a", surface: "#8a8a8a", text: "#777777", primary: "#7f7f7f", accent: "#888888" },
    ];
    for (const t of cases) expect(weakestContrast(buildPalette(t))).toBeGreaterThanOrEqual(4.5);
  });
});
