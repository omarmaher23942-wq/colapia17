// POST /api/setup/hero-video — فيديو واجهة المتجر يرفعه التاجر (mp4 أو webm حتى 40 ميجابايت).
// النوع الحقيقي من بايتات الملف (لا من اسمه)، وحد الفيديو الشهري (server/usage)، والكتابة في مساحة ملفات المتجر.
// الغلاف (الصورة التي تظهر فوراً قبل تحميل الفيديو) يلتقطه المتصفح من الفيديو ويرفعه كصورة عادية.
import { NextResponse } from "next/server";
import { getMerchantStoreOrNull } from "@/server/auth";
import { allows } from "@/lib/store-perms";
import { sessionPerms } from "@/server/merchant-guard";
import { allow } from "@/lib/ratelimit";
import { clientIp } from "@/lib/client-ip";
import { mediaApi } from "@/server/media-host";
import { checkUploadQuota, recordUpload } from "@/server/usage";

export const dynamic = "force-dynamic";
const MAX = 40 << 20;
const fail = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status, headers: { "cache-control": "no-store" } });

function videoType(b: Uint8Array): { type: string; ext: string } | null {
  const at = (i: number, s: string) => s.split("").every((c, k) => b[i + k] === c.charCodeAt(0));
  if (b.length > 12 && at(4, "ftyp")) return { type: "video/mp4", ext: "mp4" };
  if (b.length > 4 && b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return { type: "video/webm", ext: "webm" };
  return null;
}

export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  if (origin) {
    try {
      if (new URL(origin).host !== (req.headers.get("x-forwarded-host") ?? req.headers.get("host"))) return fail("طلب غير مسموح", 403);
    } catch {
      return fail("طلب غير مسموح", 403);
    }
  }
  if (Number(req.headers.get("content-length") ?? 0) > MAX + (1 << 20)) return fail("الفيديو أكبر من 40 ميجابايت. اختصروه أو اضغطوه ثم ارفعوه.", 413);
  const s = await getMerchantStoreOrNull();
  if (!s || !allows(sessionPerms(s), "content", "manage")) return fail("انتهت جلستكم، سجّلوا الدخول من جديد", 401);
  if (!(await allow("upload", `vid:${clientIp(req.headers)}`))) return fail("رفع كثير في وقت قصير. انتظروا دقيقة ثم تابعوا.", 429);

  const form = await req.formData().catch(() => null);
  const f = form?.get("file");
  if (!f || typeof f === "string") return fail("اختاروا فيديو للرفع");
  if (f.size > MAX) return fail("الفيديو أكبر من 40 ميجابايت. اختصروه أو اضغطوه ثم ارفعوه.", 413);
  const bytes = new Uint8Array(await f.arrayBuffer());
  const vt = videoType(bytes);
  if (!vt) return fail("ارفعوا فيديو بصيغة MP4 أو WEBM");

  const quota = await checkUploadQuota(s.storeId, bytes.byteLength, "video");
  if (!quota.ok) return fail(quota.message, 403);
  const host = await mediaApi();
  if (!host) return fail("رفع الملفات غير متاح مؤقتاً. حاولوا بعد قليل.", 503);
  const up = await host.upload({ bytes, name: `hero.${vt.ext}`, type: vt.type, ext: vt.ext, prefix: `stores/${s.storeId}/hero` });
  if (!up) return fail("تعذر حفظ الفيديو. حاولوا مرة أخرى.", 502);
  await recordUpload(s.storeId, bytes.byteLength, "video");
  return NextResponse.json({ ok: true, url: up.url, key: up.key }, { headers: { "cache-control": "no-store" } });
}
