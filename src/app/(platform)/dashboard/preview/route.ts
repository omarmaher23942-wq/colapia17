// GET /dashboard/preview?to=<مسار> — «معاينة متجري»: يحوّل صاحب المتجر أو أي عضو في فريقه إلى نطاق المتجر العام
// (الفرعي أو الخاص) ومعه تمرير موقّع قصير العمر (lib/owner-pass.ts). هناك يتجاوز بوابة «قيد التجهيز/متوقف»،
// وتكون طلباته تجريبية وزياراته غير محسوبة. بلا جلسة ← الدخول ثم العودة.
import { NextResponse } from "next/server";
import { getMerchantStoreOrNull } from "@/server/auth";
import { env } from "@/lib/env";
import { OWNER_LINK_TTL_S, safeLandingPath, signOwnerPass } from "@/lib/owner-pass";
import { publicStoreUrl } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const s = await getMerchantStoreOrNull();
  if (!s) {
    const login = new URL("/login", url);
    login.searchParams.set("redirect", `${url.pathname}${url.search}`);
    return NextResponse.redirect(login, 307);
  }
  const to = safeLandingPath(url.searchParams.get("to"));
  const token = await signOwnerPass({ storeId: s.store.id, sub: s.store.subdomain, merchantId: s.merchant.id, ttlSeconds: OWNER_LINK_TTL_S }, env.AUTH_SECRET);
  const dest = new URL(publicStoreUrl(s.store, "/__owner"));
  dest.searchParams.set("t", token);
  dest.searchParams.set("to", to);
  const res = NextResponse.redirect(dest, 307);
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
}
