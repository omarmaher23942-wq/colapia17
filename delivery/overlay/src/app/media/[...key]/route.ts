// GET /media/<مسار> — يخدم فيديو واجهة المتجر من حاوية R2 (ربط MEDIA) بنفس موقعك، مع دعم Range ليبدأ التشغيل قبل اكتمال
// التحميل. لا يخدم إلا فيديو mp4/webm من المسارات التي يرفع إليها المشروع (hero/…)، فلا يتحول إلى تصفح عام للحاوية.
import { mediaBucket } from "@/server/cf-bindings";

export const dynamic = "force-dynamic";

const KEY_RE = /^[a-z0-9][a-z0-9/_.-]{3,200}\.(mp4|webm)$/i;

export async function GET(req: Request, ctx: { params: Promise<{ key: string[] }> }) {
  const { key: parts } = await ctx.params;
  const key = parts.map((p) => decodeURIComponent(p)).join("/");
  if (!KEY_RE.test(key) || key.includes("..") || key.includes("//")) return new Response("Not found", { status: 404 });

  const bucket = await mediaBucket();
  if (!bucket) return new Response("media storage is not configured", { status: 503, headers: { "cache-control": "no-store" } });

  const range = req.headers.get("range");
  const obj = await bucket.get(key, range ? { range: req.headers } : undefined).catch(() => null);
  if (!obj) return new Response("Not found", { status: 404, headers: { "cache-control": "public, max-age=30" } });

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("etag", obj.httpEtag);
  headers.set("accept-ranges", "bytes");
  headers.set("cache-control", "public, max-age=31536000, immutable");
  headers.set("x-content-type-options", "nosniff");
  if (!headers.get("content-type")) headers.set("content-type", key.endsWith(".webm") ? "video/webm" : "video/mp4");
  if (req.method === "HEAD") return new Response(null, { status: 200, headers });

  let status = 200;
  if (obj.range && range) {
    status = 206;
    headers.set("content-range", `bytes ${obj.range.offset}-${obj.range.offset + obj.range.length - 1}/${obj.size}`);
    headers.set("content-length", String(obj.range.length));
  } else {
    headers.set("content-length", String(obj.size));
  }
  return new Response(obj.body ?? null, { status, headers });
}
