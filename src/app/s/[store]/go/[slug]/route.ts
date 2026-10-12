// /go/<slug> على نطاق المتجر — رابط الحملة الإعلانية: يعدّ النقرة، ويحفظ الحملة في كوكي 30 يوماً (لتُنسب إليها الطلبات)،
// ويحوّل للوجهة بمعاملات UTM وكود الخصم. حملة غير موجودة = الرئيسية.
import { NextResponse } from "next/server";
import { getBlueprintOrNull, getStoreBySubdomain, isStorePubliclyVisible } from "@/lib/tenant";
import { CAMPAIGN_COOKIE, CAMPAIGN_DAYS, campaignDestination } from "@/lib/campaigns";
import { redis } from "@/lib/redis";
import { storeUrl } from "@/lib/utils";

export const dynamic = "force-dynamic";

const BOT = /bot|crawler|spider|facebookexternalhit|preview|slurp|whatsapp/i;

export async function GET(req: Request, ctx: { params: Promise<unknown> }) {
  const { store: sub, slug } = (await ctx.params) as { store: string; slug: string };
  const store = await getStoreBySubdomain(sub);
  if (!store || !isStorePubliclyVisible(store)) return new Response("Not found", { status: 404 });
  const bp = await getBlueprintOrNull(store.id);
  const c = bp?.campaigns.find((x) => x.slug === slug.toLowerCase());
  const base = storeUrl(store.subdomain);
  if (!c) return NextResponse.redirect(new URL("/", base), 302);
  // معاينات الروابط في ميتا وواتساب ليست نقرات.
  if (!BOT.test(req.headers.get("user-agent") ?? "")) await redis.incr(`cmp:${store.id}:${c.slug}:clicks`).catch(() => {});
  const res = NextResponse.redirect(new URL(campaignDestination(c), base), 302);
  res.cookies.set(CAMPAIGN_COOKIE, c.slug, { path: "/", sameSite: "lax", httpOnly: true, secure: process.env.NODE_ENV === "production", maxAge: CAMPAIGN_DAYS * 86400 });
  return res;
}
