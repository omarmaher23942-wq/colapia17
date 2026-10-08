// /api/ownership/github/start — يفتح صفحة موافقة GitHub لإنشاء مستودع متجر التاجر.
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getMerchantStoreOrNull } from "@/server/auth";
import { GITHUB_STATE_COOKIE, githubAuthorizeUrl, githubEnabled, newGithubState } from "@/server/ownership/github";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const back = (q: string) => NextResponse.redirect(new URL(`/dashboard/own?${q}`, req.url));
  const s = await getMerchantStoreOrNull();
  if (!s) return NextResponse.redirect(new URL("/login?redirect=/dashboard/own", req.url));
  if (!githubEnabled()) return back("github=disabled");
  if (s.store.status !== "active") return back("github=not_active");

  // ?mode=update: تحديث مستودع المتجر الموجود بآخر إصدار بدل إنشاء مستودع جديد.
  const update = new URL(req.url).searchParams.get("mode") === "update";
  if (update && !s.store.ownedRepo) return back("github=error&message=" + encodeURIComponent("لا يوجد مستودع لمتجرك بعد."));
  const { state, nonce } = newGithubState(s.storeId, s.merchantId, update);
  (await cookies()).set(GITHUB_STATE_COOKIE, nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/ownership/github",
    maxAge: 15 * 60,
  });
  return NextResponse.redirect(githubAuthorizeUrl(state));
}
