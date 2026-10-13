// media.ts — يخدم ملفات المتاجر على media.<النطاق> من R2 داخل عامل Cloudflare نفسه. الرفع يكتب في R2 من الخادم
// (src/server/r2.ts) والعرض من هنا: يكفي أن يصل طلب media.* إلى العامل (مسار *.colapia.com/* يلتقطه)، فلا حاجة لربط
// نطاق مخصص على الـ bucket ولا لاستثناء مسار. القراءة من R2 بواجهة S3 بمفاتيح الخادم نفسها، والنتيجة تُخزَّن في ذاكرة
// Cloudflare (Cache API) فلا تتكرر قراءة R2 للصورة نفسها. إن رُبط نطاق مخصص على الـ bucket واستُثني media.* من المسار
// فلا يصل الطلب إلى هنا أصلاً وكل شيء يعمل كما هو.
import { AwsClient } from "aws4fetch";

export type MediaEnv = {
  ROOT_DOMAIN?: string;
  NEXT_PUBLIC_ROOT_DOMAIN?: string;
  MEDIA_BASE_URL?: string;
  NEXT_PUBLIC_MEDIA_BASE_URL?: string;
  R2_ACCOUNT_ID?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  R2_BUCKET?: string;
  R2_ENDPOINT?: string;
};
type Ctx = { waitUntil(p: Promise<unknown>): void };
export type ObjectFetcher = (key: string) => Promise<Response>;

/** مضيف الملفات: من الرابط الصريح وإلا media.<النطاق الرئيسي>. */
export function mediaHostname(env: MediaEnv): string | null {
  const explicit = (env.MEDIA_BASE_URL || env.NEXT_PUBLIC_MEDIA_BASE_URL || "").trim();
  if (explicit) {
    try {
      return new URL(explicit).hostname.toLowerCase();
    } catch {
      return null;
    }
  }
  const root = (env.ROOT_DOMAIN || env.NEXT_PUBLIC_ROOT_DOMAIN || "").trim().toLowerCase();
  return root && !root.startsWith("localhost") ? `media.${root}` : null;
}

const KEY_RE = /^[a-z0-9][a-z0-9/_.-]{3,200}$/i;

/** مفتاح الملف من مسار الطلب، أو null إن لم يكن مفتاحاً صالحاً (لا «..» ولا مسارات غريبة). */
export function mediaKey(pathname: string): string | null {
  let key: string;
  try {
    key = decodeURIComponent(pathname.replace(/^\/+/, ""));
  } catch {
    return null;
  }
  return KEY_RE.test(key) && !key.includes("..") && !key.includes("//") ? key : null;
}

const SAFE_IMAGE = /^image\/(?:jpeg|png|webp|gif|avif)$/;
const text = (body: string, status: number, cache = "no-store") => new Response(body, { status, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": cache } });

function r2Fetcher(env: MediaEnv): ObjectFetcher | null {
  if (!env.R2_ACCOUNT_ID || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY || !env.R2_BUCKET) return null;
  const aws = new AwsClient({ accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY, service: "s3", region: "auto" });
  const endpoint = (env.R2_ENDPOINT || `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`).replace(/\/+$/, "");
  const bucket = env.R2_BUCKET;
  return (key) => aws.fetch(`${endpoint}/${bucket}/${key.split("/").map(encodeURIComponent).join("/")}`, { method: "GET" });
}

/** يجيب طلب ملف على مضيف الملفات، أو null إن لم يكن الطلب لمضيف الملفات (فيكمل إلى التطبيق). */
export async function serveMedia(request: Request, env: MediaEnv, ctx: Ctx, fetchObject?: ObjectFetcher): Promise<Response | null> {
  const host = mediaHostname(env);
  const url = new URL(request.url);
  if (!host || url.hostname.toLowerCase() !== host) return null;
  if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method Not Allowed", { status: 405, headers: { allow: "GET, HEAD" } });

  const key = mediaKey(url.pathname);
  if (!key) return text("Not found", 404, "public, max-age=60");
  const fetcher = fetchObject ?? r2Fetcher(env);
  if (!fetcher) return text("media storage is not configured", 503);

  const cache = typeof caches !== "undefined" ? (caches as unknown as { default?: Cache }).default : undefined;
  const cacheKey = new Request(`${url.origin}${url.pathname}`, { method: "GET" });
  const cached = await cache?.match(cacheKey).catch(() => undefined);
  if (cached) return request.method === "HEAD" ? new Response(null, { status: cached.status, headers: cached.headers }) : cached;

  const r = await fetcher(key).catch(() => null);
  if (!r) return text("storage unavailable", 502);
  if (r.status === 404 || r.status === 403) return text("Not found", 404, "public, max-age=30");
  if (!r.ok) return text("storage error", 502);

  const type = (r.headers.get("content-type") ?? "").split(";")[0]!.trim().toLowerCase();
  const headers = new Headers({
    "content-type": SAFE_IMAGE.test(type) ? type : "application/octet-stream",
    "cache-control": "public, max-age=31536000, immutable",
    "access-control-allow-origin": "*",
    "cross-origin-resource-policy": "cross-origin",
    "x-content-type-options": "nosniff",
  });
  if (!SAFE_IMAGE.test(type)) headers.set("content-disposition", "attachment");
  const etag = r.headers.get("etag");
  if (etag) headers.set("etag", etag);
  const len = r.headers.get("content-length");
  if (len) headers.set("content-length", len);

  const res = new Response(r.body, { status: 200, headers });
  if (cache && request.method === "GET") ctx.waitUntil(cache.put(cacheKey, res.clone()).catch(() => undefined));
  return request.method === "HEAD" ? new Response(null, { status: 200, headers }) : res;
}
