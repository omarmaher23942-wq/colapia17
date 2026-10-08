import Link from "next/link";
import { sql, gte, desc, eq, and } from "drizzle-orm";
import { db } from "@/db/client";
import { aiCalls, systemEvents, buildJobs, stores, scheduledJobs } from "@/db/schema";
import { CostLiveCounter } from "@/components/platform/CostLiveCounter";
import { ProviderCostComparison } from "@/components/platform/ProviderCostComparison";

export const dynamic = "force-dynamic";

const PRICE: Record<string, [number, number]> = { morpheus: [3, 15], groq: [0, 0], google: [0, 0] };
const usd = (p: string, tin: number, tout: number) => ((PRICE[p]?.[0] ?? 0) * tin + (PRICE[p]?.[1] ?? 0) * tout) / 1e6;

export default async function CostsPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const { days = "7" } = await searchParams; 
  const since = new Date(Date.now() - Number(days) * 864e5);
  
  const [byPurpose, byProvider, daily, health] = await Promise.all([
    db.select({ k: aiCalls.purpose, calls: sql<number>`count(*)`.mapWith(Number), tin: sql<number>`coalesce(sum(tokens_in),0)`.mapWith(Number), tout: sql<number>`coalesce(sum(tokens_out),0)`.mapWith(Number), p50: sql<number>`coalesce(percentile_cont(.5) within group (order by latency_ms),0)`.mapWith(Number), p95: sql<number>`coalesce(percentile_cont(.95) within group (order by latency_ms),0)`.mapWith(Number), errs: sql<number>`count(*) filter (where ok=false)`.mapWith(Number) }).from(aiCalls).where(gte(aiCalls.createdAt, since)).groupBy(aiCalls.purpose).orderBy(desc(sql`count(*)`)),
    db.select({ k: aiCalls.provider, calls: sql<number>`count(*)`.mapWith(Number), tin: sql<number>`coalesce(sum(tokens_in),0)`.mapWith(Number), tout: sql<number>`coalesce(sum(tokens_out),0)`.mapWith(Number), errs: sql<number>`count(*) filter (where ok=false)`.mapWith(Number), p95: sql<number>`coalesce(percentile_cont(.95) within group (order by latency_ms),0)`.mapWith(Number) }).from(aiCalls).where(gte(aiCalls.createdAt, since)).groupBy(aiCalls.provider),
    db.select({ day: sql<string>`to_char(created_at at time zone 'Africa/Cairo','MM-DD')`, tokens: sql<number>`coalesce(sum(tokens_in+tokens_out),0)`.mapWith(Number) }).from(aiCalls).where(gte(aiCalls.createdAt, since)).groupBy(sql`1`).orderBy(sql`1`),
    db.select({ calls1h: sql<number>`count(*) filter (where created_at > now() - interval '1 hour')`.mapWith(Number), errs1h: sql<number>`count(*) filter (where ok=false and created_at > now() - interval '1 hour')`.mapWith(Number), p95chat: sql<number>`coalesce(percentile_cont(.95) within group (order by latency_ms) filter (where purpose='support_auto_reply' and created_at > now() - interval '24 hours'),0)`.mapWith(Number) }).from(aiCalls),
  ]);

  const h = health[0]!; 
  const errRate = h.calls1h ? (h.errs1h / h.calls1h) * 100 : 0;
  const totalUsd = byProvider.reduce((a, r) => a + usd(r.k, r.tin, r.tout), 0); 
  const totalTokens = byProvider.reduce((a, r) => a + r.tin + r.tout, 0);

  const providersData = byProvider.map(r => ({ ...r, usd: usd(r.k, r.tin, r.tout) }));

  return (
    <div className="space-y-6 bg-[#07091a] text-[#eaf0ff]" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <h1 className="text-2xl font-black text-white">التكاليف والمراقبة (FinOps)</h1>
          <p className="mt-1 text-xs text-slate-400">مراقبة استهلاك التوكنز لأسطول الدعم والتحليلات</p>
        </div>
      </div>

      <CostLiveCounter totalUsd={totalUsd} totalTokens={totalTokens} p50={byPurpose[0]?.p50 ?? 0} p95={h.p95chat} errorRate={errRate} />

      <div className="grid gap-6 lg:grid-cols-2">
        <ProviderCostComparison providers={providersData} />
        
        <div className="rounded-3xl border border-white/10 bg-[#0b0f2a] p-5 shadow-2xl">
          <h2 className="mb-4 text-sm font-black text-white">استهلاك التوكنز حسب الغرض</h2>
          <table className="w-full text-xs text-start">
            <thead className="border-b border-white/5 text-slate-400">
              <tr>
                <th className="py-2 text-start font-bold">الغرض</th>
                <th className="py-2 text-start font-bold">الاستدعاءات</th>
                <th className="py-2 text-start font-bold">التوكنز</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {byPurpose.map((r) => (
                <tr key={r.k} className="hover:bg-white/[0.02] transition-colors">
                  <td className="py-3 font-bold text-[#8fa8ff]">{r.k}</td>
                  <td className="py-3 font-mono text-slate-300">{r.calls.toLocaleString()}</td>
                  <td className="py-3 font-mono text-emerald-400">{((r.tin + r.tout) / 1000).toFixed(1)}k</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}