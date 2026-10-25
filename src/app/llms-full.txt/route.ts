// /llms-full.txt لنطاق المنصة: كل محتوى الموقع في نص واحد لمحركات الإجابة (من المصدر الواحد lib/landing-content.ts).
import { llmsFullTxt, siteOrigin } from "@/lib/platform-seo";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

export async function GET() {
  if ((await headers()).get("x-store-subdomain")) return new Response("Not found", { status: 404 });
  return new Response(llmsFullTxt(siteOrigin()), {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
  });
}
