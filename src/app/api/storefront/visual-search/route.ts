// POST /api/storefront/visual-search — «البحث بالصورة» على نطاق المتجر. الصورة تصل مضغوطة من المتصفح (multipart،
// حتى 2 ميجا، JPEG/PNG/WEBP فقط) ولا تُخزَّن. حد لكل شبكة وحد شهري لكل متجر (server/visual-search.ts).
import { NextResponse } from "next/server";
import { getStoreBySubdomain, isStorePubliclyVisible } from "@/lib/tenant";
import { clientIp, ipBucket } from "@/lib/client-ip";
import { hit } from "@/intake/guard";
import { runVisualSearch } from "@/server/visual-search";

export const dynamic = "force-dynamic";
export const maxDuration = 45;

const TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 2 << 20;

export async function POST(req: Request) {
  const sub = req.headers.get("x-store-subdomain");
  const store = sub ? await getStoreBySubdomain(sub) : null;
  if (!store || !isStorePubliclyVisible(store)) return NextResponse.json({ error: "المتجر غير متاح" }, { status: 404 });
  if (!(await hit(`vs:ip:${ipBucket(clientIp(req.headers))}`, 20, 3600))) {
    return NextResponse.json({ error: "عدد كبير من محاولات البحث في وقت قصير. حاول مرة أخرى بعد قليل." }, { status: 429 });
  }
  const form = await req.formData().catch(() => null);
  const file = form?.get("image");
  if (!(file instanceof File) || !TYPES.has(file.type) || file.size === 0 || file.size > MAX_BYTES) {
    return NextResponse.json({ error: "الصورة لازم تكون JPG أو PNG أو WEBP وأصغر من 2 ميجا." }, { status: 400 });
  }
  try {
    const r = await runVisualSearch(store.id, new Uint8Array(await file.arrayBuffer()), file.type);
    return NextResponse.json(r, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[visual-search] failed", store.id, e);
    return NextResponse.json({ error: "تعذر البحث بالصورة الآن. يمكنك البحث بالكلمات أو التواصل مع المتجر." }, { status: 502 });
  }
}
