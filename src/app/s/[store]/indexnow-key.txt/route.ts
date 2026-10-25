// /indexnow-key.txt: ملف تحقق IndexNow (يحوي مفتاح المتجر وحده). بلا إعداد IndexNow في البيئة = 404.
import { getStoreBySubdomain } from "@/lib/tenant";
import { indexNowKeyFor } from "@/lib/seo-indexnow";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<unknown> }) {
  const { store: sub } = (await ctx.params) as { store: string };
  const store = await getStoreBySubdomain(sub);
  const key = store ? await indexNowKeyFor(store.id) : null;
  if (!key) return new Response("Not found", { status: 404 });
  return new Response(key, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" } });
}
