// logo-palette.ts — ألوان العلامة من الشعار (خالص ومختبَر): ألوان مهيمنة بتكميم، تناسق ألوان، وتقييم جودة الشعار.
import { hexToHsl, hslToHex, rgbToHex } from "@/blueprint/palette";
import { luminance } from "@/blueprint/tokens";

/** أبرز الألوان في بكسلات RGBA: يتجاهل الشفاف والأبيض/الأسود شبه الصافي والرمادي الباهت، ويكمّم لـ 4 بتات لكل قناة. */
export function dominantColors(rgba: ArrayLike<number>, max = 4): string[] {
  const bins = new Map<number, { n: number; r: number; g: number; b: number }>();
  for (let i = 0; i + 3 < rgba.length; i += 4) {
    const a = rgba[i + 3]!;
    if (a < 128) continue;
    const r = rgba[i]!;
    const g = rgba[i + 1]!;
    const b = rgba[i + 2]!;
    const mx = Math.max(r, g, b);
    const mn = Math.min(r, g, b);
    if (mx > 240 && mn > 235) continue;
    if (mx < 24) continue;
    if (mx - mn < 14) continue; // رمادي بلا لون
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const e = bins.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    e.n++;
    e.r += r;
    e.g += g;
    e.b += b;
    bins.set(key, e);
  }
  const ranked = [...bins.values()].sort((x, y) => y.n - x.n);
  const out: string[] = [];
  for (const e of ranked) {
    const hex = rgbToHex({ r: Math.round(e.r / e.n), g: Math.round(e.g / e.n), b: Math.round(e.b / e.n) });
    const h = hexToHsl(hex).h;
    // لا نكرر لوناً قريباً من لون اخترناه (فرق الدرجة < 25).
    if (out.every((o) => { const d = Math.abs(hexToHsl(o).h - h); return Math.min(d, 360 - d) >= 25; })) out.push(hex);
    if (out.length >= max) break;
  }
  return out;
}

export type Harmony = { id: "complementary" | "analogous" | "triadic" | "split"; name: string; colors: string[] };
const rot = (hex: string, deg: number) => {
  const c = hexToHsl(hex);
  return hslToHex({ h: (c.h + deg + 360) % 360, s: c.s, l: c.l });
};
/** ألوان متناسقة مع لون العلامة، للتمييز في الأزرار والشارات. */
export function harmonies(primary: string): Harmony[] {
  return [
    { id: "complementary", name: "متكامل", colors: [rot(primary, 180)] },
    { id: "analogous", name: "متجاور", colors: [rot(primary, -30), rot(primary, 30)] },
    { id: "triadic", name: "ثلاثي", colors: [rot(primary, 120), rot(primary, 240)] },
    { id: "split", name: "متكامل مقسّم", colors: [rot(primary, 150), rot(primary, 210)] },
  ];
}

export type LogoTip = { id: "small" | "wide" | "tall" | "opaque_bg" | "ok"; text: string };
/** نصائح جودة الشعار. cornerOpaqueLight: هل زوايا الصورة بيضاء معتمة (خلفية بيضاء غير شفافة). */
export function assessLogo(i: { w: number; h: number; hasAlpha: boolean; cornerOpaqueLight: boolean }): LogoTip[] {
  const tips: LogoTip[] = [];
  if (Math.max(i.w, i.h) < 240) tips.push({ id: "small", text: "الشعار صغير الدقة وقد يبدو مشوشاً. الأفضل عرض 400 بكسل فأكثر." });
  const ratio = i.w / Math.max(1, i.h);
  if (ratio > 5) tips.push({ id: "wide", text: "الشعار عريض جداً وسيظهر صغيراً في الهاتف. جرّبوا نسخة مربعة أو أقل عرضاً." });
  if (ratio < 0.25) tips.push({ id: "tall", text: "الشعار طويل جداً. جرّبوا نسخة أقل ارتفاعاً." });
  if (!i.hasAlpha && i.cornerOpaqueLight) tips.push({ id: "opaque_bg", text: "للشعار خلفية بيضاء، وستظهر كمربع على الخلفيات الداكنة. الأفضل نسخة PNG بخلفية شفافة." });
  return tips.length ? tips : [{ id: "ok", text: "الشعار مناسب." }];
}

/** نسبة التباين بين لون وخلفية الزر (للعرض الفوري في الهوية). */
export function buttonContrast(bg: string, fg: string): number {
  const a = luminance(bg);
  const b = luminance(fg);
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}
