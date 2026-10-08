// middleware.ts — توجيه النطاقات وعزل المتاجر.
//
// القواعد:
//  1) {sub}.root → إعادة كتابة داخلية إلى /s/{sub}/… (المتجر لا يرى أبداً مسارات المنصة).
//  2) /s/* محظور مباشرة على كل النطاقات: المتجر يُفتح من نطاقه فقط، فلا يشترك متجران
//     في origin واحد (localStorage/كوكيز) ولا تظهر بيانات متجر داخل نطاق المنصة.
//  3) ملفات الهوية (robots/sitemap/manifest/favicon) على نطاق المتجر تُخدم بهوية المتجر.
//  4) x-store-subdomain و x-pathname و x-req-id تُكتب من هنا فقط (ونحذف أي نسخة من العميل).
import { NextRequest, NextResponse } from "next/server";
import { RESERVED_SUBDOMAINS } from "@/lib/subdomains";
import { REQ_ID_HEADER, newRequestId, isWellFormedRequestId } from "@/lib/correlation";

const ROOT = (process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000").toLowerCase();

const STORE_HEADER = "x-store-subdomain";
const PATH_HEADER = "x-pathname";
const MERCHANT_COOKIE = "clp_m";

/** ملفات بيانات وصفية تُخدم من مسارات الجذر نفسها بهوية المتجر (بدون إعادة كتابة). */
const STORE_METADATA_PATHS = new Set(["/robots.txt", "/sitemap.xml", "/manifest.webmanifest"]);
const STORE_ICON_PATH = "/api/storefront/icon";

export { RESERVED_SUBDOMAINS };

function extractSubdomain(hostHeader: string): string | null {
  const host = hostHeader.toLowerCase();
  if (host.endsWith(".vercel.app")) return null;
  if (host === ROOT || !host.endsWith(`.${ROOT}`)) return null;
  const sub = host.slice(0, -(ROOT.length + 1)).split(".")[0] ?? "";
  return sub || null;
}

/** هيدرات موثوقة: نحذف أي نسخة أرسلها العميل من الهيدرات الحساسة ثم نضع قيمنا. */
function trustedHeaders(req: NextRequest, sub: string | null): Headers {
  const h = new Headers(req.headers);
  h.delete(STORE_HEADER);
  h.delete(PATH_HEADER);
  h.delete(REQ_ID_HEADER);

  const incoming = req.headers.get(REQ_ID_HEADER);
  h.set(REQ_ID_HEADER, isWellFormedRequestId(incoming) ? incoming : newRequestId());
  h.set(PATH_HEADER, req.nextUrl.pathname);
  if (sub) h.set(STORE_HEADER, sub);
  return h;
}

const notFound = () => new NextResponse("Not found", { status: 404 });
const isUnder = (pathname: string, prefix: string) =>
  pathname === prefix || pathname.startsWith(`${prefix}/`);

export function middleware(req: NextRequest) {
  const sub = extractSubdomain(req.headers.get("host") ?? "");
  const url = req.nextUrl.clone();
  const { pathname } = url;

  // مسار المتاجر الداخلي لا يُطلب مباشرة من أي نطاق.
  if (isUnder(pathname, "/s")) return notFound();

  // ─── نطاق المنصة ──────────────────────────────────────────────────────
  if (!sub) {
    if (isUnder(pathname, "/dashboard") && !req.cookies.get(MERCHANT_COOKIE)?.value) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("redirect", `${pathname}${url.search}`);
      loginUrl.searchParams.set("reason", "no_session_cookie");
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next({ request: { headers: trustedHeaders(req, null) } });
  }

  // ─── نطاق متجر ────────────────────────────────────────────────────────
  if (sub === "www") {
    return NextResponse.redirect(`${url.protocol}//${ROOT}${pathname}${url.search}`, 308);
  }
  if (RESERVED_SUBDOMAINS.has(sub)) return notFound();

  const headers = trustedHeaders(req, sub);

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

export const config = {
  matcher: [
    // الأصول الثابتة المشتركة تُخدم مباشرة بدون middleware.
    "/((?!_next/static|_next/image|icons/|brand/|sounds/|sw.js).*)",
  ],
};
