// image-loader.ts — محمّل صور next/image لمشروعك: صور ImageKit تُعرض بتحويلات في الرابط نفسه (العرض والجودة والصيغة
// التلقائية)، وما عداها (صور ثابتة من public/ أو روابط خارجية) يُعاد كما هو. لا يحتاج خدمة تحسين صور إضافية.
export default function imageLoader({ src, width, quality }: { src: string; width: number; quality?: number }): string {
  if (src.startsWith("data:") || src.startsWith("blob:")) return src;
  let host = "";
  try {
    host = new URL(src, "https://local.invalid").hostname.toLowerCase();
  } catch {
    return src;
  }
  if (host !== "ik.imagekit.io" && !host.endsWith(".imagekit.io")) return src;
  if (/[?&]tr=/.test(src)) return src;
  const q = Math.min(100, Math.max(30, Math.round(quality ?? 75)));
  return `${src}${src.includes("?") ? "&" : "?"}tr=w-${Math.round(width)},q-${q},f-auto`;
}
