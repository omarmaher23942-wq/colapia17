// /api/storefront/cart-check — التحقق الحي من سلة هذا الجهاز (توفر وأسعار وخصومات تلقائية وشحن مجاني واقتراحات).
import { NextResponse } from "next/server";
import { getStoreBySubdomain, getBlueprint, isStorePubliclyVisible } from "@/lib/tenant";
import { allow, clientIp } from "@/lib/ratelimit";
import { isTeamPreview } from "@/server/store-preview";
import { cartCheck, cartCheckSchema } from "@/server/cart-check";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };

export async function POST(req: Request) {
  const sub = req.headers.get("x-store-subdomain");
  const store = sub ? await getStoreBySubdomain(sub) : null;
  if (!store || (!isStorePubliclyVisible(store) && !(await isTeamPreview()))) return NextResponse.json({ ok: false }, { status: 404, headers });
  if (!(await allow("quote", clientIp(req.headers)))) return NextResponse.json({ ok: false, error: "rate" }, { status: 429, headers });
  const parsed = cartCheckSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400, headers });
  try {
    const bp = await getBlueprint(store.id);
    return NextResponse.json({ ok: true, ...(await cartCheck(store.id, bp, parsed.data)) }, { headers });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500, headers });
  }
}
