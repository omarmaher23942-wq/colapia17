import Link from "next/link";
import { sql, gte, desc, eq, and, inArray } from "drizzle-orm";
import { Workflow, MessagesSquare, Wallet, Store, TrendingUp, Flame, Activity, Mail, Star } from "lucide-react";
import { db } from "@/db/client";
import { groupStoresByTenantDb } from "@/db/tenant";
import { stores, conversations, platformPayments, aiCalls, systemEvents, orders, platformReviews, merchants } from "@/db/schema";
import { formatEgp } from "@/lib/money";
import { AutoRefresh } from "@/components/platform/AutoRefresh";
import { BroadcastEmailForm } from "@/components/platform/BroadcastEmailForm";
import { PlatformHealthScore } from "@/components/platform/PlatformHealthScore";
import { BuildQueueVisualizer } from "@/components/platform/BuildQueueVisualizer";
import { HotLeadsWidget } from "@/components/platform/HotLeadsWidget";

export const dynamic = "force-dynamic";

// مبيعات كل المتاجر خلال الفترة، من قاعدة كل متجر (قاعدة المنصة أو قاعدة التاجر بعد الانتقال).
async function platformGmv(since: Date): Promise<[{ n: number; v: number }]> {
  const ids = (await db.select({ id: stores.id }).from(stores)).map((r) => r.id);
  const parts = await Promise.all(
    [...(await groupStoresByTenantDb(ids))].map(([tdb, storeIds]) =>
      tdb
        .select({ n: sql<number>`count(*)`.mapWith(Number), v: sql<number>`coalesce(sum(total_piasters),0)`.mapWith(Number) })
        .from(orders)
        .where(and(gte(orders.createdAt, since), inArray(orders.storeId, storeIds)))
    )
  );
  return [parts.flat().reduce((a, r) => ({ n: a.n + r.n, v: a.v + r.v }), { n: 0, v: 0 })];
}

export default async function AdminCommandCenter() {
  const d30 = new Date(Date.now() - 30 * 864e5);
  const d1 = new Date(Date.now() - 864e5);

  const [byStatus, [conv], [rev], [gmv], [merchantStats]] = await Promise.all([
    db.select({ status: stores.status, c: sql<number>`count(*)`.mapWith(Number) }).from(stores).groupBy(stores.status),
    db.select({ total: sql<number>`count(*)`.mapWith(Number), hot: sql<number>`count(*) filter (where lead_score >= 70 and stage not in ('activated','lost'))`.mapWith(Number) }).from(conversations),
    db.select({ egp: sql<number>`coalesce(sum(amount_piasters) filter (where status='confirmed' and created_at > ${d30}),0)`.mapWith(Number), pending: sql<number>`count(*) filter (where status='under_review')`.mapWith(Number) }).from(platformPayments),
    platformGmv(d30),
    db.select({ total: sql<number>`count(*)`.mapWith(Number) }).from(merchants),
  ]);

  const countFor = (st: string) => byStatus.find((x) => x.status === st)?.c ?? 0;
  const inPipeline = countFor("review") + countFor("building") + countFor("pending_review");

  return (
    <div className="space-y-8" dir="rtl">
      <AutoRefresh everyMs={15_000} />

      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <h1 className="text-2xl font-black text-white sm:text-3xl">مركز القيادة التنفيذي</h1>
          <p className="mt-1 text-xs text-[#8d97c4]">مراقبة حية للمنصة، خط الإنتاج، والمبيعات.</p>
        </div>
      </div>

      {/* Top Widgets Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <PlatformHealthScore />
        <BuildQueueVisualizer />
        <HotLeadsWidget />
      </div>

      {/* 4 KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard href="/admin/payments" label="إيرادات المنصة (30 يوماً)" value={formatEgp(rev?.egp ?? 0)} note={`${rev?.pending ?? 0} تحويل معلق`} tone="emerald" icon={Wallet} />
        <KpiCard href="/admin/pipeline" label="المتاجر النشطة" value={String(countFor("active"))} note={`${countFor("trial")} تجربة · ${inPipeline} بالخط`} tone="blue" icon={Store} />
        <KpiCard href="/admin/conversations" label="المحادثات والليدز" value={String(conv?.total ?? 0)} note={`${conv?.hot ?? 0} تاجر مهتم جداً`} noteIcon={Flame} tone="violet" icon={MessagesSquare} />
        <KpiCard label="GMV (مبيعات التجار)" value={formatEgp(gmv?.v ?? 0)} note={`${gmv?.n ?? 0} طلب تم تنفيذه`} tone="emerald" icon={TrendingUp} />
      </div>

      {/* Broadcast */}
      <section className="space-y-4 rounded-3xl border border-white/10 bg-[#0e1424] p-6">
        <header className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <Mail className="size-5 text-[#8fa8ff]" strokeWidth={2} />
            <h2 className="text-sm font-black text-white">برودكاست بريدي لكل التجار</h2>
          </div>
          <span className="font-mono text-xs text-[#8d97c4]">إجمالي التجار: {merchantStats?.total ?? 0}</span>
        </header>
        <BroadcastEmailForm />
      </section>
    </div>
  );
}

function KpiCard({ href, label, value, note, noteIcon: NoteIcon, tone = "emerald", icon: Icon }: any) {
  const toneMap: any = {
    emerald: { ring: "hover:border-emerald-500/40", color: "text-emerald-400" },
    blue: { ring: "hover:border-blue-500/40", color: "text-blue-400" },
    violet: { ring: "hover:border-violet-500/40", color: "text-violet-400" },
  };
  const t = toneMap[tone];

  const content = (
    <>
      <div className="flex items-center justify-between text-[#8d97c4]">
        <span className="text-xs font-bold">{label}</span>
        <Icon className={`size-4 ${t.color}`} strokeWidth={1.75} />
      </div>
      <p className="mt-2 font-mono text-3xl font-black tabular-nums text-white">{value}</p>
      {note && (
        <p className="mt-1 flex items-center gap-1 text-xs font-bold text-[#8d97c4]">
          {NoteIcon && <NoteIcon className="size-3 text-amber-400" strokeWidth={2.5} />}
          {note}
        </p>
      )}
    </>
  );

  const baseCls = "rounded-2xl border border-white/10 bg-white/[0.02] p-5 backdrop-blur-xl transition-all";
  return href ? <Link href={href} className={`${baseCls} ${t.ring} hover:bg-white/[0.04]`}>{content}</Link> : <div className={baseCls}>{content}</div>;
}