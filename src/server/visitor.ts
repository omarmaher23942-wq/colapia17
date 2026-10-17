import "server-only";
// visitor.ts — هوية الزائر في تحليلات المتجر.
//
// الزيارة تُحسب لكل جهاز مرة واحدة في اليوم مهما حدّث الصفحة أو خرج ودخل. الجهاز يُعرف بكوكي من الخادم
// (httpOnly، سنة كاملة) لا بقيمة يرسلها المتصفح، فلا يمكن تضخيم الأرقام من الـ JavaScript. وإن مُنعت الكوكيز
// نستخدم بصمة ثابتة من عنوان الشبكة ونوع المتصفح (مُجزّأة، لا نخزن العنوان نفسه).
import { createHash } from "node:crypto";
import { clientIp } from "@/lib/ratelimit";
import { DEVICE_ID_RE, newDeviceId } from "@/lib/signed-token";
import { OWNER_COOKIE } from "@/lib/owner-pass";
import { PREVIEW_HEADER } from "@/lib/store-preview";

export const VISITOR_COOKIE = "clp_v";

// برامج الفحص والمعاينات (واتساب وفيسبوك ومحركات البحث والمتصفحات الآلية) لا تُحسب زيارات.
const BOT = /bot|crawl|spider|slurp|facebookexternalhit|whatsapp|telegram|preview|headless|lighthouse|pingdom|uptime|monitor|python|curl|wget|axios|node-fetch|go-http/i;

export function isBot(headers: Headers): boolean {
  const ua = headers.get("user-agent") ?? "";
  return !ua || BOT.test(ua);
}

function readCookie(headers: Headers, name: string): string | null {
  const raw = headers.get("cookie") ?? "";
  for (const part of raw.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

/**
 * صاحب المتجر (أو فريقه) يتصفح متجره: زياراته لا تُحسب. على نطاق المتجر يعني تمرير المالك (كوكي clp_own الذي يتحقق منه
 * middleware ويحوّله إلى هيدر المعاينة)، وعلى نطاق المنصة كوكي الجلسة.
 */
export function isStoreOwner(headers: Headers): boolean {
  return Boolean(readCookie(headers, "clp_m")) || Boolean(readCookie(headers, OWNER_COOKIE)) || headers.get(PREVIEW_HEADER) === "1";
}

/**
 * هوية الجهاز. `id` عشوائي من الخادم (crypto.randomUUID) ويُحفظ في كوكي httpOnly: هو الوحيد الذي تُنسب به الطلبات، فلا
 * يمكن تخمينه من الشبكة ولا المتصفح. `analyticsId` للتحليلات فقط: الكوكي إن وُجد وإلا بصمة مُجزّأة من الشبكة والمتصفح
 * (تمنع تضخيم الزيارات عند رفض الكوكي) ولا تُخزَّن أبداً كهوية جهاز.
 */
export function visitorOf(headers: Headers, storeId: string): { id: string; analyticsId: string; setCookie: string | null } {
  const existing = readCookie(headers, VISITOR_COOKIE);
  if (existing && DEVICE_ID_RE.test(existing)) return { id: existing, analyticsId: existing, setCookie: null };
  const fp = createHash("sha256")
    .update(`${storeId}|${clientIp(headers)}|${headers.get("user-agent") ?? ""}|${headers.get("accept-language") ?? ""}`)
    .digest("hex")
    .slice(0, 32);
  const id = newDeviceId();
  const secure = (headers.get("x-forwarded-proto") ?? "https") === "https" ? "; Secure" : "";
  return { id, analyticsId: `d-${fp}`, setCookie: `${VISITOR_COOKIE}=${id}; Path=/; Max-Age=${400 * 86400}; HttpOnly; SameSite=Lax${secure}` };
}
