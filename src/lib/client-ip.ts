// client-ip.ts — عنوان الزائر الحقيقي لحدود المعدل والبصمة.
//
// على Vercel يكتب المنصة نفسها x-forwarded-for وx-real-ip بعنوان العميل (وتستبدل أي قيمة أرسلها العميل)، فهما
// المصدر الموثوق. أما cf-connecting-ip فيصل من العميل كما هو ما لم يكن Cloudflare أمام الموقع فعلاً، فقراءته أولاً
// تسمح لأي زائر بتزوير عنوانه وتجاوز كل حد لكل IP. لذلك لا يُقرأ إلا إن ضُبط TRUST_CF_CONNECTING_IP=1
// (موقع خلف Cloudflare، حيث يصير x-forwarded-for الأخير عنوان Cloudflare نفسه).

const V4 = /^(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;

/**
 * ينقّي قيمة عنوان من هيدر: يزيل المنفذ (`1.2.3.4:5678` و`[::1]:80`) ونطاق IPv6 (`%eth0`)، ويفك الشكل المغلّف
 * `::ffff:1.2.3.4` إلى IPv4. يعيد null لما ليس عنواناً صالحاً (نص عشوائي، فارغ، طويل).
 */
export function cleanIp(raw: string | null | undefined): string | null {
  let s = (raw ?? "").trim();
  if (!s || s.length > 60) return null;
  const bracket = s.match(/^\[([^\]]+)\](?::\d+)?$/);
  if (bracket) s = bracket[1]!;
  else if (/^\d+\.\d+\.\d+\.\d+:\d+$/.test(s)) s = s.slice(0, s.lastIndexOf(":"));
  s = s.split("%")[0]!;
  const mapped = s.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (mapped) s = mapped[1]!;
  if (V4.test(s)) return s;
  return s.includes(":") && /^[0-9a-f:]+$/i.test(s) && s.length <= 39 ? s.toLowerCase() : null;
}

export function clientIp(headers: Headers): string {
  if (process.env.TRUST_CF_CONNECTING_IP === "1") {
    const cf = cleanIp(headers.get("cf-connecting-ip"));
    if (cf) return cf;
  }
  for (const part of (headers.get("x-forwarded-for") ?? "").split(",")) {
    const ip = cleanIp(part);
    if (ip) return ip;
  }
  return cleanIp(headers.get("x-real-ip")) ?? "0.0.0.0";
}

/**
 * مفتاح الحد لعنوان: IPv4 كما هو، وIPv6 بأول 64 بت (شبكة المشترك الواحد)، حتى لا يتجاوز مهاجم الحد بتدوير
 * العناوين داخل شبكته.
 */
export function ipBucket(ip: string): string {
  const clean = cleanIp(ip);
  if (!clean) return "0.0.0.0";
  if (!clean.includes(":")) return clean;
  const parts = clean.split("::");
  const left = parts[0] ? parts[0].split(":") : [];
  const right = parts.length > 1 && parts[1] ? parts[1].split(":") : [];
  const full = parts.length > 1 ? [...left, ...Array(Math.max(0, 8 - left.length - right.length)).fill("0"), ...right] : left;
  return `${full.slice(0, 4).map((h) => (h || "0").replace(/^0+(?=.)/, "")).join(":")}::/64`;
}
