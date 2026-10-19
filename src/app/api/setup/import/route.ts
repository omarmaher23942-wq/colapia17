// POST /api/setup/import — ملف يرفعه التاجر (xlsx/csv/pdf/docx/txt/صور) لأداة استيراد المنتجات.
// يقرأ نوعه الحقيقي من بايتاته ثم يردّ بحسب النوع:
//  - جدول ← مرشّحون مباشرة (بلا حد ذكي)،  - نص (txt/docx) ← أسطر يفرزها المتصفح على دفعات بتقدم ظاهر،
//  - PDF ← مرشّحون (قراءة بصرية)،  - صور ← تُرفع لمساحة المتجر وتعود روابطها لتفرز على دفعات.
import { NextResponse } from "next/server";
import { storeFor } from "@/server/merchant-guard";
import { allow } from "@/lib/ratelimit";
import { clientIp } from "@/lib/client-ip";
import { extractFile, IMPORT_FILE_MAX_BYTES } from "@/server/import/extract";
import { analyzePdf, analyzeTable } from "@/server/import/analyze";
import { splitProductText } from "@/lib/import-candidates";
import { mediaApi } from "@/server/media-host";
import { extensionFor } from "@/lib/media";
import { checkUploadQuota, recordUpload } from "@/server/usage";

export const dynamic = "force-dynamic";
const MAX_IMAGES = 12;
const fail = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status, headers: { "cache-control": "no-store" } });

function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? new URL(req.url).host);
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail("طلب غير مسموح", 403);
  if (Number(req.headers.get("content-length") ?? 0) > IMPORT_FILE_MAX_BYTES * MAX_IMAGES + (1 << 20)) return fail("الملفات كبيرة. الحد 12 ميجابايت لكل ملف.", 413);
  const s = await storeFor("products");
  if (!s) return fail("انتهت جلستكم، سجّلوا الدخول من جديد", 401);
  if (!(await allow("upload", `imp:${clientIp(req.headers)}`))) return fail("ملفات كثيرة في وقت قصير. انتظروا دقيقة ثم تابعوا.", 429);

  const form = await req.formData().catch(() => null);
  const files = form?.getAll("file").filter((f): f is File => typeof f !== "string") ?? [];
  if (!files.length) return fail("اختاروا ملفاً للرفع");
  if (files.length > MAX_IMAGES) return fail(`حد أقصى ${MAX_IMAGES} ملفاً في المرة`);

  // ملف واحد غير صور: جدول/نص/PDF. عدة ملفات: صور فقط.
  const read = await Promise.all(files.map(async (f) => ({ f, bytes: new Uint8Array(await f.arrayBuffer()) })));
  const first = await extractFile(read[0]!.f.name, read[0]!.f.type, read[0]!.bytes);

  if (first.kind === "unsupported") return fail(first.reason);
  if (first.kind === "table") {
    const r = analyzeTable(first.table);
    return r.ok ? NextResponse.json({ ok: true, kind: "candidates", candidates: r.candidates, notice: r.notice }) : fail(r.error);
  }
  if (first.kind === "text") {
    const entries = splitProductText(first.text);
    return entries.length ? NextResponse.json({ ok: true, kind: "entries", entries: entries.slice(0, 400) }) : fail("لم نجد في الملف أسماء منتجات. اكتبوا كل منتج في سطر.");
  }
  if (first.kind === "pdf") {
    const r = await analyzePdf(s.storeId, read[0]!.bytes);
    return r.ok ? NextResponse.json({ ok: true, kind: "candidates", candidates: r.candidates }) : fail(r.error);
  }

  // صور: كلها يجب أن تكون صوراً حقيقية، وتُرفع لمساحة المتجر لتصير صور المنتجات نفسها.
  const total = read.reduce((n, r) => n + r.bytes.byteLength, 0);
  const quota = await checkUploadQuota(s.storeId, total, "image");
  if (!quota.ok) return fail(quota.message, 403);
  const host = await mediaApi();
  if (!host) return fail("رفع الصور غير متاح مؤقتاً. حاولوا بعد قليل.", 503);
  const urls: string[] = [];
  for (const r of read) {
    const ex = await extractFile(r.f.name, r.f.type, r.bytes);
    if (ex.kind !== "image") return fail("لا يمكن خلط الصور بملفات أخرى في رفعة واحدة");
    const ext = extensionFor(ex.type);
    if (!ext) return fail("ارفعوا صوراً بصيغة JPG أو PNG أو WEBP");
    const up = await host.upload({ bytes: r.bytes, name: `import.${ext}`, type: ex.type, ext, prefix: `stores/${s.storeId}/products` });
    if (!up) {
      return fail("تعذر حفظ الصور. حاولوا مرة أخرى.", 502);
    }
    urls.push(up.url);
  }
  await recordUpload(s.storeId, total, "image");
  return NextResponse.json({ ok: true, kind: "images", urls });
}
