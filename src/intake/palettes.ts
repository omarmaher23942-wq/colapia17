// palettes.ts — لوحات ألوان جاهزة يختار منها العميل في الاستمارة (الفريق يضبط الدرجات النهائية).
export const INTAKE_PALETTES = [
  { id: "night-gold", name: "ليلي فاخر", colors: ["#0f172a", "#c8a24a", "#f8f5ef"] },
  { id: "soft-rose", name: "وردي ناعم", colors: ["#d9467a", "#fbe3ec", "#2b1a21"] },
  { id: "natural-green", name: "أخضر طبيعي", colors: ["#2f6b4f", "#e9f2ea", "#c48a3a"] },
  { id: "trust-blue", name: "أزرق موثوق", colors: ["#1d4ed8", "#e8efff", "#0b1220"] },
  { id: "vivid-orange", name: "برتقالي حيوي", colors: ["#ea580c", "#fff3e8", "#1c1917"] },
  { id: "modern-violet", name: "بنفسجي عصري", colors: ["#7c3aed", "#f3edff", "#151026"] },
  { id: "bold-red", name: "أحمر جريء", colors: ["#dc2626", "#fff1f1", "#111111"] },
  { id: "calm-beige", name: "بيج هادئ", colors: ["#8b6b4a", "#f6efe6", "#2d241c"] },
] as const;

export type PaletteId = (typeof INTAKE_PALETTES)[number]["id"];
export const paletteById = (id: string | undefined | null) => INTAKE_PALETTES.find((p) => p.id === id) ?? null;
