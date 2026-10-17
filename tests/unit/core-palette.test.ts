import { describe, expect, it } from "vitest";
import { deriveCorePalette, minPaletteContrast, normalizeHex } from "@/blueprint/core-palette";

describe("core palette", () => {
  const brands = ["#ffd400", "#0a0a0a", "#e11d48", "#14b8a6", "#ffffff", "#2f5bea", "#7c3aed"];
  for (const b of brands) {
    for (const mode of ["light", "dark"] as const) {
      it(`AA لكل الأزواج: ${b} ${mode}`, () => {
        expect(minPaletteContrast(deriveCorePalette(b, mode))).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
  it("تطبيع الألوان", () => {
    expect(normalizeHex("#ABC")).toBe("#aabbcc");
    expect(normalizeHex("nope")).toBe("#2f5bea");
  });
});
