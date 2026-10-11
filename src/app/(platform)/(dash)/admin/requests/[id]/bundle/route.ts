// /admin/requests/[id]/bundle — مجلد stores/<slug>/ للطلب ZIP (BRIEF.md، المسودة الأولى، seed.json، DELIVERY.md،
// روابط الصور) لمن يعمل بلا توكن GitHub: يفكّه في جذر المستودع ويبدأ Claude Code. للمدير والمنفّذ المسند فقط.
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { stores } from "@/db/schema";
import { storeRequests } from "@/db/schema/agency";
import { platformUser } from "@/server/platform-guard";
import { can } from "@/agency/roles";
import { canViewRequest } from "@/agency/production";
import { prepareFolder } from "@/agency/provision";
import { suggestSlug } from "@/agency/slug";
import { readData } from "@/intake/repo";
import { socialUrl } from "@/intake/schema";
import { buildZip } from "@/lib/zip";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await platformUser();
  if (!u) return new Response("غير مصرح", { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("غير موجود", { status: 404 });
  const [row] = await db.select().from(storeRequests).where(eq(storeRequests.id, id)).limit(1);
  if (!row || row.status !== "submitted" || !canViewRequest(row, { id: u.id, role: u.role as never })) return new Response("غير موجود", { status: 404 });
  if (!(can(u.role, "requests.assign") || (row.builderId === u.id && can(u.role, "requests.work")))) return new Response("غير مصرح", { status: 403 });
  let slug = row.slug;
  if (!slug) {
    const taken = new Set((await db.select({ s: stores.subdomain }).from(stores)).map((x) => x.s));
    const d = readData(row.data);
    slug = suggestSlug({ storeName: d.store.name, socialUrl: socialUrl(d.social.url), code: row.code }, (s) => taken.has(s));
  }
  const { files } = await prepareFolder(row, slug);
  const zip = buildZip(Object.entries(files).map(([path, data]) => ({ path, data: Buffer.from(data, "utf8") })));
  return new Response(new Uint8Array(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="stores-${slug}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
