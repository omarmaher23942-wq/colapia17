import type { StoreBlueprint } from "@/blueprint/schema";

type T = StoreBlueprint["theme"];

const baseLight = {
  primaryForeground: "#ffffff",
  secondary: "#f8fafc",
  secondaryForeground: "#0f172a",
  accentForeground: "#ffffff",
  background: "#ffffff",
  foreground: "#0f172a",
  muted: "#f1f5f9",
  mutedForeground: "#64748b",
  card: "#ffffff",
  cardForeground: "#0f172a",
  border: "#e2e8f0",
  success: "#16a34a",
  warning: "#f59e0b",
  danger: "#dc2626",
};

export const THEME_PRESETS: {
  name: string;
  desc: string;
  theme: Partial<T> & { palette: T["palette"] };
}[] = [
  {
    name: "تركواز كولابيا الفاخر",
    desc: "أناقة وتناسق عالي لكل المتاجر",
    theme: {
      palette: { ...baseLight, primary: "#0f766e", accent: "#d97706", primaryForeground: "#ffffff" },
      fonts: { heading: "cairo", body: "cairo", baseSize: 16 },
      radius: "lg",
      buttonStyle: "solid",
      shadow: "soft",
      productCardStyle: "elevated",
      imageRatio: "square",
      motion: "balanced",
    },
  },
  {
    name: "كحلي ملكي راقي",
    desc: "ملابس رجالي، ساعات، وعطور",
    theme: {
      palette: { ...baseLight, primary: "#1e3a8a", accent: "#ca8a04", primaryForeground: "#ffffff" },
      fonts: { heading: "readex_pro", body: "cairo", baseSize: 16 },
      radius: "md",
      buttonStyle: "solid",
      shadow: "medium",
      productCardStyle: "editorial",
      imageRatio: "portrait",
      motion: "balanced",
    },
  },
  {
    name: "وردي سواريه أنيق",
    desc: "أزياء نسائية، ميك اب، وعبايات",
    theme: {
      palette: { ...baseLight, primary: "#db2777", accent: "#9333ea", background: "#fffafc", muted: "#fdf2f8" },
      fonts: { heading: "cairo", body: "cairo", baseSize: 16 },
      radius: "xl",
      buttonStyle: "gradient",
      shadow: "soft",
      productCardStyle: "minimal",
      imageRatio: "portrait",
      motion: "expressive",
    },
  },
  {
    name: "أسود وفحمي فخم",
    desc: "ستريت وير، إلكترونيات، وأحذية",
    theme: {
      palette: { ...baseLight, primary: "#111827", accent: "#2563eb", primaryForeground: "#ffffff" },
      fonts: { heading: "cairo", body: "readex_pro", baseSize: 16 },
      radius: "lg",
      buttonStyle: "solid",
      shadow: "dramatic",
      productCardStyle: "bordered",
      imageRatio: "square",
      motion: "balanced",
    },
  },
];