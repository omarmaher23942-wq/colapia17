// client-ip.ts — عنوان الزائر الحقيقي لحدود المعدل والبصمة.
//
// على Vercel يكتب المنصة نفسها x-forwarded-for وx-real-ip بعنوان العميل (وتستبدل أي قيمة أرسلها العميل)، فهما
// المصدر الموثوق. أما cf-connecting-ip فيصل من العميل كما هو ما لم يكن Cloudflare أمام الموقع فعلاً، فقراءته أولاً
// تسمح لأي زائر بتزوير عنوانه وتجاوز كل حد لكل IP. لذلك لا يُقرأ إلا إن ضُبط TRUST_CF_CONNECTING_IP=1
// (موقع خلف Cloudflare، حيث يصير x-forwarded-for الأخير عنوان Cloudflare نفسه).
export function clientIp(headers: Headers): string {
  if (process.env.TRUST_CF_CONNECTING_IP === "1") {
    const cf = headers.get("cf-connecting-ip")?.trim();
    if (cf) return cf;
  }
  const fwd = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (fwd) return fwd;
  return headers.get("x-real-ip")?.trim() || "0.0.0.0";
}

/**
 * مفتاح الحد لعنوان: IPv4 كما هو، وIPv6 بأول 64 بت (شبكة المشترك الواحد)، حتى لا يتجاوز مهاجم الحد بتدوير
 * العناوين داخل شبكته.
 */
export function ipBucket(ip: string): string {
  if (!ip.includes(":")) return ip;
  const [head = ""] = ip.split("%");
  const parts = head.split("::");
  const left = parts[0] ? parts[0].split(":") : [];
  const right = parts.length > 1 && parts[1] ? parts[1].split(":") : [];
  const full = parts.length > 1 ? [...left, ...Array(Math.max(0, 8 - left.length - right.length)).fill("0"), ...right] : left;
  return `${full.slice(0, 4).map((h) => (h || "0").toLowerCase().replace(/^0+(?=.)/, "")).join(":")}::/64`;
}
