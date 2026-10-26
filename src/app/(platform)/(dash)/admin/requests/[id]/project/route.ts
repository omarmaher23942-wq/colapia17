// GET /admin/requests/<id>/project — تنزيل مشروع تسليم العميل (ZIP). لمن يملك صلاحية التسليم فقط.
import { NextResponse } from "next/server";
import { z } from "zod";
import { platformUser } from "@/server/platform-guard";
import { projectFilesForRequest } from "@/delivery/project";
import { buildZip } from "@/lib/zip";
import { log } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const u = await platformUser({ cap: "requests.deliver" });
  if (!u) return new NextResponse("Forbidden", { status: 403 });
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return new NextResponse("Not found", { status: 404 });
  try {
    const files = await projectFilesForRequest(id);
    const zip = buildZip(Object.entries(files).map(([path, data]) => ({ path, data })));
    const slug = (JSON.parse(String(files["package.json"])) as { name?: string }).name ?? "store";
    return new NextResponse(new Uint8Array(zip), {
      headers: { "content-type": "application/zip", "content-disposition": `attachment; filename="${slug}.zip"`, "cache-control": "no-store" },
    });
  } catch (e) {
    log.error("ops", "delivery_project_failed", { requestId: id }, "", e);
    return new NextResponse(`تعذّر توليد المشروع: ${(e as Error).message}`, { status: 500 });
  }
}
