// middleware.ts — توجيه النطاقات وعزل المتاجر.
//
// القواعد:
//  1) {sub}.root → إعادة كتابة داخلية إلى /s/{sub}/… (المتجر لا يرى أبداً مسارات المنصة).
//  2) /s/* محظور مباشرة على كل النطاقات: المتجر يُفتح من نطاقه فقط، فلا يشترك متجران
//     في origin واحد (localStorage/كوكيز) ولا تظهر بيانات متجر داخل نطاق المنصة.
//  3) ملفات الهوية (robots/sitemap/manifest/favicon) على نطاق المتجر تُخدم بهوية المتجر.
//  4) x-store-subdomain و x-pathname و x-req-id و x-store-preview تُكتب من هنا فقط (ونحذف أي نسخة من العميل).
//  5) معاينة الفريق (lib/store-preview.ts): ?store=<slug> على نشرات المعاينة، و?preview=<مفتاح> على نطاق المتجر.
import { NextRequest, NextResponse } from "next/server";
import { RESERVED_SUBDOMAINS, DEMO_SUBDOMAIN } from "@/lib/subdomains";
import { REQ_ID_HEADER, newRequestId, isWellFormedRequestId } from "@/lib/correlation";
import {
  PREVIEW_HEADER,
  PREVIEW_KEY_COOKIE,
  PREVIEW_STORE_COOKIE,
  isPreviewDeployment,
  isPreviewSlug,
  previewKeyMatches,
} from "@/lib/store-preview";
import { OWNER_COOKIE, OWNER_COOKIE_TTL_S, safeLandingPath, verifyOwnerPass } from "@/lib/owner-pass";
import { subdomainRedirectKey } from "@/lib/subdomain-change";

const ROOT = (process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000").toLowerCase();

const STORE_HEADER = "x-store-subdomain";
const PATH_HEADER = "x-pathname";
const MERCHANT_COOKIE = "clp_m";
const PLATFORM_COOKIE = "clp_p";
/** صفحات دخول المالك لا تحتاج جلسة. */
const ADMIN_PUBLIC = ["/admin/login", "/admin/bootstrap"];

/** ملفات بيانات وصفية تُخدم من مسارات الجذر نفسها بهوية المتجر (بدون إعادة كتابة). */
const STORE_METADATA_PATHS = new Set(["/robots.txt", "/sitemap.xml", "/manifest.webmanifest"]);
const STORE_ICON_PATH = "/api/storefront/icon";

export { RESERVED_SUBDOMAINS };

// ─── النطاقات الخاصة (المرحلة 7) ───────────────────────────────────────────
// خريطة النطاق ← المتجر في Redis (server/domains.ts يكتبها عند التفعيل): cd:<host> = النطاق الفرعي، وcdr:<sub> = النطاق
// الخاص. يُقرأ بـ REST مباشرة (يعمل في Edge) مع ذاكرة قصيرة 60 ثانية لكل نسخة، وأي فشل = كأن لا نطاق خاص.
const DOMAIN_TTL_MS = 60_000;
const domainCache = new Map<string, { v: string | null; at: number }>();

async function redisGet(key: string): Promise<string | null> {
  const hit = domainCache.get(key);
  if (hit && Date.now() - hit.at < DOMAIN_TTL_MS) return hit.v;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  try {
    const r = await fetch(`${url}/get/${encodeURIComponent(key)}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    const body = (await r.json()) as { result?: string | null };
    const v = typeof body.result === "string" ? body.result.replace(/^"|"$/g, "") : null;
    domainCache.set(key, { v, at: Date.now() });
    if (domainCache.size > 2000) domainCache.clear();
    return v;
  } catch {
    return null;
  }
}

/** عدة مفاتيح بالتوازي (كل مفتاح بذاكرته القصيرة نفسها)؛ أي فشل = لا قيمة لذلك المفتاح. */
const redisGetMany = (keys: string[]) => Promise.all(keys.map(redisGet));

/** نطاقات المزود نفسه (نشرات Vercel وروابط Cloudflare Workers): تُعامل كالمنصة، لا كنطاق متجر. */
const isProviderHost = (h: string) => h.endsWith(".vercel.app") || h.endsWith(".workers.dev");

/** مضيف ليس المنصة ولا نطاقاً فرعياً لها ولا نطاق المزود ولا تطويراً محلياً = نطاق خاص محتمل لمتجر. */
function isCustomHost(host: string): boolean {
  const h = host.toLowerCase().split(":")[0]!;
  if (!h || h === ROOT.split(":")[0] || h.endsWith(`.${ROOT.split(":")[0]}`)) return false;
  if (isProviderHost(h) || h === "localhost" || h.endsWith(".localhost") || /^[\d.]+$/.test(h)) return false;
  return true;
}

function extractSubdomain(hostHeader: string): string | null {
  const host = hostHeader.toLowerCase();
  if (isProviderHost(host.split(":")[0]!)) return null;
  if (host === ROOT || !host.endsWith(`.${ROOT}`)) return null;
  const sub = host.slice(0, -(ROOT.length + 1)).split(".")[0] ?? "";
  return sub || null;
}

/** هيدرات موثوقة: نحذف أي نسخة أرسلها العميل من الهيدرات الحساسة ثم نضع قيمنا. */
function trustedHeaders(req: NextRequest, sub: string | null, preview = false): Headers {
  const h = new Headers(req.headers);
  h.delete(STORE_HEADER);
  h.delete(PATH_HEADER);
  h.delete(REQ_ID_HEADER);
  h.delete(PREVIEW_HEADER);
  if (preview) h.set(PREVIEW_HEADER, "1");

  const incoming = req.headers.get(REQ_ID_HEADER);
  h.set(REQ_ID_HEADER, isWellFormedRequestId(incoming) ? incoming : newRequestId());
  h.set(PATH_HEADER, req.nextUrl.pathname);
  if (sub) h.set(STORE_HEADER, sub);
  return h;
}

const notFound = () => new NextResponse("Not found", { status: 404 });
const isUnder = (pathname: string, prefix: string) =>
  pathname === prefix || pathname.startsWith(`${prefix}/`);

const PREVIEW_COOKIE_OPTS = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 12 };

/** يحذف معامل المعاينة من الرابط ويعيد التوجيه إليه نظيفاً (حتى لا يُنسخ المفتاح مع الرابط). */
function cleanRedirect(url: URL, param: string): NextResponse {
  const clean = new URL(url);
  clean.searchParams.delete(param);
  if (param === "store") clean.searchParams.delete("key");
  return NextResponse.redirect(clean, 307);
}

/**
 * معاينة متجر على نشرة معاينة: ?store=<slug> يُحفظ في كوكي، و?store=off يلغيه. على Cloudflare لا يميَّز إصدار المعاينة
 * ببيئة، فروابط *.workers.dev تعمل بها المعاينة بشرط مفتاح STORE_PREVIEW_KEY دائماً (الرابط عام بلا حماية Vercel).
 */
function previewStore(req: NextRequest): { sub: string | null; response?: NextResponse } {
  const key = process.env.STORE_PREVIEW_KEY;
  const workersDev = (req.headers.get("host") ?? "").toLowerCase().split(":")[0]!.endsWith(".workers.dev");
  if (!isPreviewDeployment() && !(workersDev && key)) return { sub: null };
  const param = req.nextUrl.searchParams.get("store");
  if (param !== null) {
    const res = cleanRedirect(req.nextUrl, "store");
    if (param === "off" || !isPreviewSlug(param)) {
      res.cookies.delete(PREVIEW_STORE_COOKIE);
      return { sub: null, response: res };
    }
    const given = req.nextUrl.searchParams.get("key");
    if (key && !previewKeyMatches(given ?? req.cookies.get(PREVIEW_KEY_COOKIE)?.value, key)) return { sub: null, response: notFound() };
    res.cookies.set(PREVIEW_STORE_COOKIE, param, PREVIEW_COOKIE_OPTS);
    if (key && given) res.cookies.set(PREVIEW_KEY_COOKIE, given, PREVIEW_COOKIE_OPTS);
    return { sub: null, response: res };
  }
  const chosen = req.cookies.get(PREVIEW_STORE_COOKIE)?.value;
  if (!isPreviewSlug(chosen)) return { sub: null };
  if (key && !previewKeyMatches(req.cookies.get(PREVIEW_KEY_COOKIE)?.value, key)) return { sub: null };
  return { sub: chosen };
}

async function route(req: NextRequest) {
  const host = req.headers.get("host") ?? "";
  let sub = extractSubdomain(host);
  const url = req.nextUrl.clone();
  const { pathname } = url;
  // نطاق خاص لمتجر: يُخدم المتجر نفسه كأنه على نطاقه الفرعي. نطاق غير معروف = 404 (لا نعرض المنصة على نطاق غريب).
  let onCustomDomain = false;
  if (!sub && isCustomHost(host)) {
    const mapped = await redisGet(`cd:${host.toLowerCase().split(":")[0]}`);
    if (!mapped) return notFound();
    sub = mapped;
    onCustomDomain = true;
  }

  // مسار المتاجر الداخلي لا يُطلب مباشرة من أي نطاق.
  if (isUnder(pathname, "/s")) return notFound();

  // نشرة معاينة بلا نطاق متجر: المتجر المختار بـ ?store= (للفريق فقط) يُعرض كأنه على نطاقه.
  let preview = false;
  if (!sub) {
    const picked = previewStore(req);
    if (picked.response) return picked.response;
    if (picked.sub) {
      sub = picked.sub;
      preview = true;
    }
  }

  // ─── نطاق المنصة ──────────────────────────────────────────────────────
  if (!sub) {
    if (isUnder(pathname, "/dashboard") && !req.cookies.get(MERCHANT_COOKIE)?.value) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("redirect", `${pathname}${url.search}`);
      loginUrl.searchParams.set("reason", "no_session_cookie");
      return NextResponse.redirect(loginUrl);
    }
    // لوحة المالك: بلا كوكي جلسة لا يصل الطلب لأي صفحة. هذا الحاجز الأول فقط (وجود الكوكي)، والتحقق الفعلي
    // يتكرر في أول كل صفحة (requirePlatformPage) لأن التخطيط وحده يُتجاوز بطلب RSC مصنوع.
    if (isUnder(pathname, "/admin") && !ADMIN_PUBLIC.some((p) => isUnder(pathname, p)) && !req.cookies.get(PLATFORM_COOKIE)?.value) {
      return NextResponse.redirect(new URL("/admin/login", req.url));
    }
    return NextResponse.next({ request: { headers: trustedHeaders(req, null) } });
  }

  // ─── نطاق متجر ────────────────────────────────────────────────────────
  if (sub === "www") {
    return NextResponse.redirect(`${url.protocol}//${ROOT}${pathname}${url.search}`, 308);
  }
  if (RESERVED_SUBDOMAINS.has(sub) && sub !== DEMO_SUBDOMAIN) return notFound();

  // نطاق المتجر قبل التسليم: ?preview=<STORE_PREVIEW_KEY> يحفظ كوكي يرى به الفريق المتجر خلف بوابة «قيد التجهيز».
  const key = process.env.STORE_PREVIEW_KEY;
  const previewParam = url.searchParams.get("preview");
  if (previewParam !== null && key) {
    const res = cleanRedirect(req.nextUrl, "preview");
    if (previewKeyMatches(previewParam, key)) res.cookies.set(PREVIEW_KEY_COOKIE, previewParam, PREVIEW_COOKIE_OPTS);
    else res.cookies.delete(PREVIEW_KEY_COOKIE);
    return res;
  }
  if (!preview && key && previewKeyMatches(req.cookies.get(PREVIEW_KEY_COOKIE)?.value, key)) preview = true;

  // تمرير المالك (lib/owner-pass.ts): /__owner?t=<رمز>&to=<مسار> يحفظ كوكي لهذا المضيف وحده ثم يفتح الوجهة؛ وبعده
  // يُعامل الطلب كمعاينة فريق (يتجاوز بوابة الحالة، والطلبات تجريبية). الرمز مرتبط بالنطاق الفرعي لهذا المتجر.
  const authSecret = process.env.AUTH_SECRET ?? "";
  if (pathname === "/__owner") {
    const t = url.searchParams.get("t");
    const ok = await verifyOwnerPass(t, authSecret, { sub });
    const dest = new URL(ok ? safeLandingPath(url.searchParams.get("to")) : "/", req.url);
    const res = NextResponse.redirect(dest, 307);
    if (ok && t) res.cookies.set(OWNER_COOKIE, t, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: OWNER_COOKIE_TTL_S });
    return res;
  }
  if (!preview) {
    const oc = req.cookies.get(OWNER_COOKIE)?.value;
    if (oc && (await verifyOwnerPass(oc, authSecret, { sub }))) preview = true;
  }

  // متجر له نطاق خاص مفعّل: نطاقه الفرعي يحوّل إليه (نفس المسار)، عدا الفريق في المعاينة ومسارات الـ API.
  // ورابط قديم لمتجر غيّر رابطه من الإعدادات (sdr:<القديم>، 30 يوماً): يحوّل 308 للرابط الجديد بنفس المسار.
  if (!onCustomDomain && !preview && (req.method === "GET" || req.method === "HEAD") && !isUnder(pathname, "/api")) {
    const [custom, renamed] = await redisGetMany([`cdr:${sub}`, subdomainRedirectKey(sub)]);
    if (custom) return NextResponse.redirect(`https://${custom}${pathname}${url.search}`, 308);
    if (renamed && renamed !== sub && /^[a-z0-9-]{3,30}$/.test(renamed)) {
      return NextResponse.redirect(`${url.protocol}//${renamed}.${ROOT}${pathname}${url.search}`, 308);
    }
  }

  const headers = trustedHeaders(req, sub, preview);

  if (pathname === "/favicon.ico") {
    url.pathname = STORE_ICON_PATH;
    return NextResponse.rewrite(url, { request: { headers } });
  }
  if (isUnder(pathname, "/api") || STORE_METADATA_PATHS.has(pathname)) {
    return NextResponse.next({ request: { headers } });
  }

  url.pathname = `/s/${sub}${pathname === "/" ? "" : pathname}`;
  return NextResponse.rewrite(url, { request: { headers } });
}

/** يضيف معرّف الطلب إلى الاستجابة ليراه من يبلّغ عن مشكلة (يظهر أيضاً في صفحات الخطأ وسجلات الخادم). */
export async function middleware(req: NextRequest) {
  const res = await route(req);
  const id = res.headers.get(`x-middleware-request-${REQ_ID_HEADER}`);
  if (id && isWellFormedRequestId(id)) res.headers.set(REQ_ID_HEADER, id);
  return res;
}

export const config = {
  matcher: [
    // الأصول الثابتة المشتركة تُخدم مباشرة بدون middleware.
    "/((?!_next/static|_next/image|icons/|brand/|sounds/|demo/|sw.js|offline.html).*)",
  ],
};
