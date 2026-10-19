// POST /api/upload — رفع الصور عبر الخادم (multipart): يتحقق من الصلاحية (server/upload-policies) ثم من حجم كل ملف
// ونوعه الحقيقي من بايتاته (لا من النوع الذي يعلنه المتصفح)، ويكتبه في مساحة الملفات المضبوطة على الخادم (R2 ثم
// UploadThing)، ويسجّله إن لزم (ملفات الاستمارة). المتصفح لا يتصل بأي مضيف آخر، فلا CORS ولا سياسة أمان محتوى ولا
// قرار وقت بناء: الرفع يعمل متى كانت مساحة ملفات واحدة مضبوطة على الخادم. المتصفح يرسل ملفاً واحداً في كل طلب.
import { NextResponse } from "next/server";
import { extensionFor, isMediaRoute, looksHeic, MEDIA_ROUTES, sniffImageType, sniffVideoType, VIDEO_ROUTES } from "@/lib/media";
import { mediaApi } from "@/server/media-host";
import { afterUpload, authorizeUpload, UploadPolicyError } from "@/server/upload-policies";
import { allow, clientIp } from "@/lib/ratelimit";
import { checkUploadQuota, recordUpload } from "@/server/usage";

// مسارات رفع التاجر التي تُحسب على حد الاستخدام الشهري (رفع الزوار لإيصالات وتقييمات له حدود معدل خاصة).
const METERED = new Set(["productImage", "brandAsset", "brandVideo"]);

export const dynamic = "force-dynamic";

// الصور حتى 8 ميجا لكل منها (حتى 10 في الطلب نظرياً، والمتصفح يرسل واحدة)، والفيديو حتى 40 ميجا.
const MAX_BODY = 42 << 20;
const fail = (error: string, status: number) => NextResponse.json({ error }, { status, headers: { "cache-control": "no-store" } });

export async function POST(req: Request) {
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY) return fail("الملف كبير. الحد الأقصى 40 ميجابايت للفيديو و8 ميجا لكل صورة.", 413);
  const form = await req.formData().catch(() => null);
  if (!form) return fail("طلب غير صالح", 400);

  const route = form.get("route");
  if (!isMediaRoute(route)) return fail("طلب غير صالح", 400);
  const spec = MEDIA_ROUTES[route];

  let input: unknown;
  const rawInput = form.get("input");
  if (typeof rawInput === "string" && rawInput) {
    try {
      input = JSON.parse(rawInput);
    } catch {
      return fail("طلب غير صالح", 400);
    }
  }

  const isVideo = VIDEO_ROUTES.has(route);
  const files = form.getAll("file").filter((f): f is File => typeof f !== "string");
  if (!files.length) return fail(isVideo ? "اختاروا فيديو للرفع." : "اختاروا صورة للرفع.", 400);
  if (files.length > spec.maxFiles) return fail(`حد أقصى ${spec.maxFiles} ملفات في المرة.`, 400);
  if (files.some((f) => f.size > spec.maxBytes))
    return fail(isVideo ? "الفيديو أكبر من 40 ميجابايت. اختصروه أو اضغطوه ثم ارفعوه." : `الصورة أكبر من ${Math.round(spec.maxBytes / (1 << 20))} ميجا.`, 400);
  if (files.some((f) => f.size < 12)) return fail("الملف فارغ أو تالف.", 400);

  if (!(await allow("upload", clientIp(req.headers)))) return fail("رفع كثير في وقت قصير. انتظروا دقيقة ثم تابعوا.", 429);

  let grant;
  try {
    grant = await authorizeUpload(route, { headers: req.headers, input });
  } catch (e) {
    if (e instanceof UploadPolicyError) return fail(e.message, 403);
    throw e;
  }

  const meteredStore = METERED.has(route) && typeof grant.meta.storeId === "string" ? grant.meta.storeId : null;
  const kind = isVideo ? "video" : "image";
  if (meteredStore) {
    const q = await checkUploadQuota(meteredStore, files.reduce((n, f) => n + f.size, 0), kind, files.length);
    if (!q.ok) return fail(q.message, 429);
  }

  const host = await mediaApi();
  if (!host) {
    console.error("[upload] لا مساحة ملفات مضبوطة: ضع R2_* أو UPLOADTHING_TOKEN (التفاصيل في /admin/launch)");
    return fail("رفع الملفات غير متاح مؤقتاً. حاولوا بعد قليل.", 503);
  }

  const out: { key: string; url: string; type: string; size: number }[] = [];
  for (const f of files) {
    const bytes = new Uint8Array(await f.arrayBuffer());
    let type: string | null;
    let ext: string | null;
    if (isVideo) {
      const vt = sniffVideoType(bytes);
      if (vt === "quicktime") return fail("صيغة MOV لا تعمل في كثير من المتصفحات. صدّروا الفيديو بصيغة MP4 ثم ارفعوه.", 400);
      if (!vt) return fail("ارفعوا فيديو بصيغة MP4 أو WEBM.", 400);
      type = vt.type;
      ext = vt.ext;
    } else {
      type = sniffImageType(bytes);
      ext = type ? extensionFor(type) : null;
    }
    if (!type || !ext) {
      await host.remove(out.map((o) => o.key)).catch(() => false);
      return fail(looksHeic(bytes) ? "صيغة الصورة (HEIC) غير مدعومة. صوّروها أو احفظوها بصيغة JPG أو PNG." : "ارفعوا صورة بصيغة JPG أو PNG أو WEBP.", 400);
    }
    const up = await host.upload({ bytes, name: `upload.${ext}`, type, ext, prefix: grant.prefix });
    if (!up) {
      await host.remove(out.map((o) => o.key)).catch(() => false);
      return fail(isVideo ? "تعذر حفظ الفيديو. حاولوا مرة أخرى." : "تعذر حفظ الصورة. حاولوا مرة أخرى.", 502);
    }
    try {
      await afterUpload(route, grant.meta, { key: up.key, url: up.url, type, size: bytes.length });
    } catch (e) {
      console.error("[upload] afterUpload failed", e);
      await host.remove([up.key, ...out.map((o) => o.key)]).catch(() => false);
      return fail("تعذر تسجيل الملف. حاولوا مرة أخرى.", 500);
    }
    out.push({ key: up.key, url: up.url, type, size: bytes.length });
  }
  if (meteredStore) await recordUpload(meteredStore, out.reduce((n, f) => n + f.size, 0), kind, out.length);
  return NextResponse.json({ files: out }, { headers: { "cache-control": "no-store" } });
}
