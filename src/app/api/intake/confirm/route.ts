// تأكيد بريد العميل (رابط في بريد استلام الطلب). البريد المؤكد هو حساب دخول لوحة المتجر لاحقاً.
import { NextResponse } from "next/server";
import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { storeRequestEvents, storeRequests } from "@/db/schema/agency";
import { derivedToken, derivedTokenMatches } from "@/intake/tokens";
import { clientEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("r") ?? "";
  const token = url.searchParams.get("t");
  const base = clientEnv.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  if (!UUID_RE.test(id) || !derivedTokenMatches("confirm", id, token)) return NextResponse.redirect(`${base}/start?confirm=invalid`, 303);
  try {
    const [done] = await db
      .update(storeRequests)
      .set({ emailConfirmedAt: new Date() })
      .where(and(eq(storeRequests.id, id), isNotNull(storeRequests.email), isNull(storeRequests.emailConfirmedAt)))
      .returning({ id: storeRequests.id });
    if (done) await db.insert(storeRequestEvents).values({ requestId: id, type: "note", internalNote: "العميل أكّد بريده", actor: "client" });
  } catch (e) {
    console.error("[intake/confirm]", e);
  }
  return NextResponse.redirect(`${base}/follow/${derivedToken("track", id)}?confirmed=1`, 303);
}
