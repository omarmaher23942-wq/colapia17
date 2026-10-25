// /llms.txt لنطاق المنصة: فهرس مختصر لمحركات الذكاء الاصطناعي (llmstxt.org). متاجر العملاء لها ملفها الخاص.
import { llmsTxt, siteOrigin } from "@/lib/platform-seo";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

export async function GET() {
  // على نطاق متجر لا يُخدم محتوى المنصة أبداً.
  if ((await headers()).get("x-store-subdomain")) return new Response("Not found", { status: 404 });
  return new Response(llmsTxt(siteOrigin()), {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
  });
}
