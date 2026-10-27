// photo-quality.ts — فحص جودة صور المنتجات في المتصفح قبل الرفع (خالص ومختبَر على مصفوفات رمادية):
// وضوح (تباين لابلاس)، إضاءة، دقة، ومقارنة بصمات dHash لاكتشاف الصور المكررة.
export type Gray = { data: ArrayLike<number>; w: number; h: number };

/** يحوّل RGBA إلى تدرج رمادي (0-255). */
export function toGray(rgba: ArrayLike<number>, w: number, h: number): Gray {
  const g = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) g[i] = Math.round(0.299 * rgba[i * 4]! + 0.587 * rgba[i * 4 + 1]! + 0.114 * rgba[i * 4 + 2]!);
  return { data: g, w, h };
}

/** تباين لابلاس: كلما صغر زاد الضبابية. */
export function sharpness(g: Gray): number {
  const { data, w, h } = g;
  if (w < 3 || h < 3) return 0;
  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const l = 4 * data[i]! - data[i - 1]! - data[i + 1]! - data[i - w]! - data[i + w]!;
      sum += l;
      sumSq += l * l;
      n++;
    }
  const mean = sum / n;
  return sumSq / n - mean * mean;
}

export const meanBrightness = (g: Gray): number => {
  let s = 0;
  for (let i = 0; i < g.w * g.h; i++) s += g.data[i]!;
  return s / Math.max(1, g.w * g.h);
};

export type PhotoIssue = "blurry" | "dark" | "bright" | "small";
export const PHOTO_ISSUE_TEXT: Record<PhotoIssue, string> = {
  blurry: "الصورة تبدو غير واضحة. ثبّتوا الهاتف وصوّروا قرب نافذة أو ضوء النهار.",
  dark: "الصورة معتمة. صوّروا في إضاءة أقوى.",
  bright: "الصورة مضيئة جداً وقد تضيع التفاصيل. ابتعدوا عن الإضاءة المباشرة.",
  small: "دقة الصورة صغيرة وستبدو مشوشة في المتجر. استخدموا الكاميرا الأصلية للهاتف.",
};

/** يقيّم صورة مصغّرة (حوالي 256 بكسل) مع أبعاد الأصل. يعيد المشكلات فقط (فارغ = جيدة). */
export function assessPhoto(g: Gray, original: { w: number; h: number }): PhotoIssue[] {
  const out: PhotoIssue[] = [];
  if (Math.min(original.w, original.h) < 500) out.push("small");
  const b = meanBrightness(g);
  if (b < 45) out.push("dark");
  else if (b > 225) out.push("bright");
  // صورة بخلفية بيضاء ناصعة وتفاصيل قليلة ليست ضبابية: نتجاهل الوضوح مع السطوع العالي.
  if (b <= 225 && sharpness(g) < 12) out.push("blurry");
  return out;
}

/** بصمة dHash (64 بت كنص 0/1) من تدرج رمادي: تُصغَّر إلى 9×8 بالمتوسط. */
export function dHash(g: Gray): string {
  const W = 9;
  const H = 8;
  const cell = (cx: number, cy: number) => {
    const x0 = Math.floor((cx * g.w) / W);
    const x1 = Math.max(x0 + 1, Math.floor(((cx + 1) * g.w) / W));
    const y0 = Math.floor((cy * g.h) / H);
    const y1 = Math.max(y0 + 1, Math.floor(((cy + 1) * g.h) / H));
    let s = 0;
    let n = 0;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) (s += g.data[y * g.w + x]!), n++;
    return s / Math.max(1, n);
  };
  let bits = "";
  for (let y = 0; y < H; y++) for (let x = 0; x < W - 1; x++) bits += cell(x, y) > cell(x + 1, y) ? "1" : "0";
  return bits;
}

export const hamming = (a: string, b: string): number => {
  let d = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) d++;
  return d + Math.abs(a.length - b.length);
};

/** أزواج الصور شبه المتطابقة (مسافة ≤ 5 من 64). تعيد فهارس (i<j). */
export function duplicatePairs(hashes: string[], maxDistance = 5): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < hashes.length; i++) for (let j = i + 1; j < hashes.length; j++) if (hamming(hashes[i]!, hashes[j]!) <= maxDistance) out.push([i, j]);
  return out;
}
