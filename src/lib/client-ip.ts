// client-ip.ts — عنوان الزائر الحقيقي أياً كان المضيف.
// خلف Cloudflare (Railway أو Render أو خادم خاص) يكون x-real-ip/x-forwarded-for الأخير عنوان Cloudflare نفسه،
// فتصير كل الزيارات «زائراً واحداً» في حدود المعدل والبصمة. لذلك نقرأ cf-connecting-ip أولاً، ثم أول عنوان
// في x-forwarded-for (العميل الأصلي)، ثم x-real-ip (Vercel).
export function clientIp(headers: Headers): string {
  const cf = headers.get("cf-connecting-ip")?.trim();
  if (cf) return cf;
  const fwd = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (fwd) return fwd;
  return headers.get("x-real-ip")?.trim() || "0.0.0.0";
}
