// /api/ownership/zip — تحميل مشروع متجرك (المتجر + لوحة التحكم) كملف ZIP، لمن يفضّل الكمبيوتر.
import { NextResponse } from "next/server";
import { getMerchantStoreOrNull } from "@/server/auth";
import { allow } from "@/lib/ratelimit";
import { buildZip } from "@/lib/zip";
import { log } from "@/lib/logger";
import { projectFilesFor } from "@/server/ownership/project";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const s = await getMerchantStoreOrNull();
  if (!s) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  if (s.store.status !== "active") return NextResponse.json({ error: "التحميل متاح بعد تفعيل متجرك بالدفع." }, { status: 403 });
  if (!(await allow("ownership", `zip:${s.storeId}`))) return NextResponse.json({ error: "طلبات كثيرة، انتظر دقائق" }, { status: 429 });

  const files = await projectFilesFor(s.store);
  const root = `${s.store.subdomain}-store`;
  const zip = buildZip(files.map((f) => ({ path: `${root}/${f.path}`, data: f.data })));
  log.info("store", "store_project_zip", { storeId: s.storeId, files: files.length, bytes: zip.length });
  return new Response(new Uint8Array(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${root}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
