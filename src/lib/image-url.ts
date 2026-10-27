// image-url.ts — روابط الصور بأحجام مناسبة (خالص ومختبَر). ImageKit يدعم التحويل بمعامل tr؛ بقية المضيفات تُرجع كما هي.
const isImageKit = (u: URL) => /(^|\.)ik\.imagekit\.io$/i.test(u.hostname);

export type Transform = { w?: number; h?: number; q?: number; fit?: "cover" | "contain" };

/** يضيف تحويلات الحجم والجودة والصيغة التلقائية لروابط ImageKit فقط. */
export function transformImage(url: string, t: Transform = {}): string {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return url;
  }
  if (u.protocol !== "https:" || !isImageKit(u)) return url;
  const parts: string[] = [];
  if (t.w) parts.push(`w-${Math.round(Math.min(4000, Math.max(16, t.w)))}`);
  if (t.h) parts.push(`h-${Math.round(Math.min(4000, Math.max(16, t.h)))}`);
  if (t.w && t.h) parts.push(t.fit === "contain" ? "c-at_max" : "c-maintain_ratio");
  parts.push(`q-${Math.round(Math.min(100, Math.max(30, t.q ?? 80)))}`, "f-auto");
  u.searchParams.set("tr", parts.join(","));
  return u.toString();
}

/** srcset بعدة عروض لروابط ImageKit، أو undefined لغيرها (لا فائدة من تكراره). */
export function imageSrcSet(url: string, widths: number[] = [320, 640, 960, 1280]): string | undefined {
  try {
    if (!isImageKit(new URL(url))) return undefined;
  } catch {
    return undefined;
  }
  return widths.map((w) => `${transformImage(url, { w })} ${w}w`).join(", ");
}

/** صورة مصغّرة مربعة للقوائم والمراجعة. */
export const thumbUrl = (url: string, size = 160) => transformImage(url, { w: size, h: size, q: 70 });
