// /admin/stores/[id]/project — مشروع المتجر المستقل ZIP (المتجر + لوحته + بياناته المحقونة) لتسليم الكود لعميل
// طلبه (المرحلة 7: التسليم بيد الفريق بدل «امتلك متجرك» الذاتي). للمالك والمدير.
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { stores } from "@/db/schema";
import { platformUser } from "@/server/platform-guard";
import { projectFilesFor } from "@/server/ownership/project";
import { buildZip } from "@/lib/zip";
import { logActivity } from "@/agency/activity";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await platformUser({ cap: "stores.manage" });
  if (!u) return new Response("غير مصرح", { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("غير موجود", { status: 404 });
  const [store] = await db.select().from(stores).where(eq(stores.id, id)).limit(1);
  if (!store) return new Response("غير موجود", { status: 404 });
  const files = await projectFilesFor(store);
  const root = `${store.subdomain}-store`;
  const zip = buildZip(files.map((f) => ({ path: `${root}/${f.path}`, data: f.data })));
  await logActivity(u.id, "store.code_exported", `store:${store.id}`, { files: files.length });
  return new Response(new Uint8Array(zip), {
    headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${root}.zip"`, "Cache-Control": "no-store" },
  });
}
