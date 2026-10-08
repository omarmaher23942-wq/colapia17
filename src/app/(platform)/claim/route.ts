// /claim?token=… — استلام متجر عبر رابط التفعيل (على نطاق المنصة).
// بلا جلسة: نُرسل التاجر لتسجيل الدخول ثم نعيده إلى هنا بنفس التوكن.
import { NextResponse } from "next/server";
import { getMerchantSession, setActiveStore } from "@/server/auth";
import { claimStoreWithActivationToken } from "@/server/claims";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? "";
  if (!/^[A-Za-z0-9_-]{20,128}$/.test(token)) {
    return NextResponse.redirect(new URL("/dashboard?claim=invalid", req.url));
  }

  const session = await getMerchantSession();
  if (!session) {
    const login = new URL("/login", req.url);
    login.searchParams.set("redirect", `/claim?token=${token}`);
    login.searchParams.set("reason", "claim_requires_login");
    return NextResponse.redirect(login);
  }

  const result = await claimStoreWithActivationToken(token, session.merchantId);
  if (!result.ok) {
    return NextResponse.redirect(new URL(`/dashboard?claim=${result.reason}`, req.url));
  }

  await setActiveStore(result.storeId);
  return NextResponse.redirect(new URL("/dashboard?claim=ok", req.url));
}
