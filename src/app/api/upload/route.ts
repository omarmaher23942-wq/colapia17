// POST /api/upload — إذن رفع إلى R2: يتحقق من الصلاحية (server/upload-policies) ونوع كل ملف وحجمه وعدده، ثم يعيد
// لكل ملف رابط PUT موقّعاً لعشر دقائق ورابطه العام وتذكرة التأكيد. المتصفح يرفع مباشرة إلى R2 ثم يستدعي
// /api/upload/complete. لا يعمل إلا مع NEXT_PUBLIC_MEDIA_PROVIDER=r2 ومفاتيح R2.
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { extensionFor, isMediaRoute, MEDIA_ROUTES } from "@/lib/media";
import { presignPut, publicUrl, r2Configured } from "@/server/r2";
import { authorizeUpload, UploadPolicyError } from "@/server/upload-policies";
import { issueTicket } from "@/server/upload-ticket";
import { allow, clientIp } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

const body = z.object({
  route: z.string().max(40),
  input: z.unknown().optional(),
  files: z.array(z.object({ name: z.string().max(200), type: z.string().max(100), size: z.number().int().positive() })).min(1).max(10),
});

export async function POST(req: Request) {
  if (!r2Configured()) return NextResponse.json({ error: "مساحة الملفات غير مضبوطة" }, { status: 503 });
  const p = body.safeParse(await req.json().catch(() => null));
  if (!p.success || !isMediaRoute(p.data.route)) return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  const route = p.data.route;
  if (!(await allow("upload", clientIp(req.headers)))) return NextResponse.json({ error: "رفع كتير في وقت قصير، استنى دقيقة." }, { status: 429 });
  const spec = MEDIA_ROUTES[route];
  if (p.data.files.length > spec.maxFiles) return NextResponse.json({ error: `حد أقصى ${spec.maxFiles} ملفات في المرة.` }, { status: 400 });
  for (const f of p.data.files) {
    if (!extensionFor(route, f.type)) return NextResponse.json({ error: spec.kind === "audio" ? "نوع التسجيل غير مدعوم." : "ارفع صورة JPG أو PNG أو WEBP." }, { status: 400 });
    if (f.size > spec.maxBytes) return NextResponse.json({ error: `الملف أكبر من ${Math.round(spec.maxBytes / (1 << 20))} ميجا.` }, { status: 400 });
  }
  let grant;
  try {
    grant = await authorizeUpload(route, { headers: req.headers, input: p.data.input });
  } catch (e) {
    if (e instanceof UploadPolicyError) return NextResponse.json({ error: e.message }, { status: 403 });
    throw e;
  }
  const uploads = await Promise.all(
    p.data.files.map(async (f) => {
      const type = f.type.split(";")[0]!.trim().toLowerCase();
      const key = `${grant.prefix}/${randomUUID()}.${extensionFor(route, type)}`;
      const put = await presignPut(key, type, f.size);
      return { key, url: publicUrl(key), putUrl: put.url, headers: put.headers, ticket: issueTicket({ r: route, k: key, t: type, s: f.size, m: grant.meta }) };
    })
  );
  return NextResponse.json({ uploads });
}
