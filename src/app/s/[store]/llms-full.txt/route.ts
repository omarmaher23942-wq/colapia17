// /llms-full.txt على نطاق المتجر: النسخة الكاملة (الإجابات عن الشحن والدفع والاستبدال، وكل المنتجات بأوصافها وأسعارها).
import { llmsForStore } from "@/server/seo-data";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<unknown> }) {
  const { store } = (await ctx.params) as { store: string };
  const text = await llmsForStore(store, true);
  if (!text) return new Response("Not found", { status: 404 });
  return new Response(text, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=900" } });
}
