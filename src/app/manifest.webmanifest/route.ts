// manifest الديناميكي: على نطاق متجر يخدم هويته هو (اسمه وألوانه وشعاره)، وإلا هوية المنصة.
import { headers } from "next/headers";
import { getStoreBySubdomain, getBlueprintOrNull } from "@/lib/tenant";
import { platformManifest, storeManifest } from "@/lib/pwa";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const sub = (await headers()).get("x-store-subdomain");
  let body: object = platformManifest();
  if (sub) {
    // نطاق متجر: لا نعود لهوية المنصة حتى عند الخطأ.
    const store = await getStoreBySubdomain(sub).catch(() => null);
    if (!store) return new Response("Not found", { status: 404 });
    const bp = await getBlueprintOrNull(store.id).catch(() => null);
    body = storeManifest({
      name: bp?.brand.name ?? store.name,
      tagline: bp?.brand.tagline,
      logoUrl: bp?.brand.logo?.url,
      palette: bp?.theme.palette as { background?: unknown; primary?: unknown } | undefined,
    });
  }
  return new Response(JSON.stringify(body), {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=600",
    },
  });
}
