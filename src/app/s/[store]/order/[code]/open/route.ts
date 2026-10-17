// /order/<رقم>/open?k=<رمز> — «رابط طلباتي» الموقّع: من يفتحه يربط الطلب بجهازه فيظهر في «طلباتي» وتُفتح صفحة الطلب كاملة،
// دون حساب. الرمز مرتبط بمعرّف الطلب والمتجر (HMAC)، فلا يصلح لطلب آخر ولا يُخمَّن.
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getStoreBySubdomain } from "@/lib/tenant";
import { getTenantDb } from "@/db/tenant";
import { orders } from "@/db/schema";
import { ensureDeviceId, grantOrderAccess, validOrderLinkToken } from "@/lib/order-access";
import { allow, clientIp } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ store: string; code: string }> }) {
  const { store: sub, code: rawCode } = await params;
  const url = new URL(req.url);
  const home = new URL("/track", url);
  if (!(await allow("track", clientIp(req.headers)))) return NextResponse.redirect(home, 303);
  let code = rawCode;
  try {
    code = decodeURIComponent(rawCode);
  } catch {
    /* يبقى كما هو */
  }
  const store = await getStoreBySubdomain(sub);
  if (!store) return NextResponse.redirect(home, 303);
  const db = await getTenantDb(store.id);
  const [o] = await db
    .select({ id: orders.id, code: orders.code, visitorId: orders.visitorId })
    .from(orders)
    .where(and(eq(orders.storeId, store.id), eq(orders.code, code.trim().toUpperCase())))
    .limit(1);
  if (!o || !validOrderLinkToken(store.id, o.id, url.searchParams.get("k"))) return NextResponse.redirect(home, 303);

  const device = await ensureDeviceId(store.id);
  await grantOrderAccess(store.id, o.code);
  if (o.visitorId !== device) await db.update(orders).set({ visitorId: device }).where(and(eq(orders.id, o.id), eq(orders.storeId, store.id)));
  const res = NextResponse.redirect(new URL(`/order/${encodeURIComponent(o.code)}`, url), 303);
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
}
