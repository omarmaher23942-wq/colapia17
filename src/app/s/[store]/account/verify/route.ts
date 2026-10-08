// /account/verify?token=…&redirect=… — استهلاك رابط الدخول السريع للعميل.
// Route Handler (لا صفحة) لأنه يكتب كوكي الجلسة ثم يعيد التوجيه.
import { NextResponse } from "next/server";
import { getStoreBySubdomain } from "@/lib/tenant";
import { consumeCustomerMagicLink } from "@/server/auth";
import { allow, clientIp } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

function safePath(input: string | null): string {
  if (!input || !input.startsWith("/") || input.startsWith("//") || input.includes("\\")) {
    return "/account";
  }
  return input.slice(0, 300);
}

export async function GET(req: Request, ctx: { params: Promise<{ store: string }> }) {
  const { store: sub } = await ctx.params;
  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? "";
  // الطلب وصل عبر rewrite من نطاق المتجر؛ نبني الوجهة على المسار العام للمتجر.
  const back = (path: string) => new NextResponse(null, { status: 303, headers: { Location: path } });

  if (!(await allow("login", `cust-verify:${clientIp(req.headers)}`))) {
    return back("/account/login?error=rate_limited");
  }

  const store = await getStoreBySubdomain(sub);
  if (!store || !/^[A-Za-z0-9_-]{20,128}$/.test(token)) {
    return back("/account/login?error=invalid_link");
  }

  const ok = await consumeCustomerMagicLink(token, store.id);
  return back(ok ? safePath(url.searchParams.get("redirect")) : "/account/login?error=invalid_link");
}
