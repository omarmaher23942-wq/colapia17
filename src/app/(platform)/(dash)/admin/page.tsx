import { redirect } from "next/navigation";
import { can } from "@/agency/roles";
import Link from "next/link";
import { sql, gte, eq, and, inArray } from "drizzle-orm";
import { MessagesSquare, Wallet, Store, TrendingUp, Flame, Mail } from "lucide-react";
import { db } from "@/db/client";
import { groupStoresByTenantDb } from "@/db/tenant";
import { stores, conversations, platformPayments, orders, merchants } from "@/db/schema";
import { formatEgp } from "@/lib/money";
import { AutoRefresh } from "@/components/platform/AutoRefresh";
import { BroadcastEmailForm } from "@/components/platform/BroadcastEmailForm";
import { PlatformHealthScore } from "@/components/platform/PlatformHealthScore";
import { HotLeadsWidget } from "@/components/platform/HotLeadsWidget";
import { requirePlatformPage } from "@/server/platform-guard";
import { SalesFunnel } from "@/components/platform/SalesFunnel";
import { salesFunnel } from "@/server/repos/sales-funnel";
import { FUNNEL_RANGES, type FunnelRange } from "@/lib/sales-funnel";
import { goldenStatus } from "@/server/pricing";

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

export default async function AdminCommandCenter({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const me = await requirePlatformPage();
  // لوحة القيادة فيها الإيرادات والمدفوعات: للمالك والمدير. باقي الفريق يبدأ من المحادثات.
  if (!can(me.role, "stores.manage")) redirect(can(me.role, "conversations") ? "/admin/conversations" : "/admin/changes");
  const sp = await searchParams;
  const range: FunnelRange = (FUNNEL_RANGES as readonly number[]).includes(Number(sp.range)) ? (Number(sp.range) as FunnelRange) : 30;
  const [funnel, golden] = await Promise.all([salesFunnel(range), goldenStatus()]);
  const d30 = new Date(Date.now() - 30 * 864e5);

  const [byStatus, [conv], [rev], [gmv], [merchantStats]] = await Promise.all([
    db.select({ status: stores.status, c: sql<number>`count(*)`.mapWith(Number) }).from(stores).groupBy(stores.status),
    db.select({ total: sql<number>`count(*)`.mapWith(Number), hot: sql<number>`count(*) filter (where lead_score >= 70 and stage not in ('activated','lost'))`.mapWith(Number) }).from(conversations),
    db.select({ egp: sql<number>`coalesce(sum(amount_piasters) filter (where status='confirmed' and created_at > ${d30}),0)`.mapWith(Number), pending: sql<number>`count(*) filter (where status='under_review')`.mapWith(Number) }).from(platformPayments),
    platformGmv(d30),
    db.select({ total: sql<number>`count(*)`.mapWith(Number) }).from(merchants),
  ]);

  // متاجر أنشأها الوكيل ولم يكتمل إعدادها بعد، وما مضى عليه منها أكثر من 3 أيام.
  const [setups] = await db
    .select({
      open: sql<number>`count(*)`.mapWith(Number),
      stale: sql<number>`count(*) filter (where ${stores.setupStartedAt} < now() - interval '3 days')`.mapWith(Number),
    })
    .from(stores)
    .where(eq(stores.status, "setup"))
    .catch(() => [{ open: 0, stale: 0 }]);

  // اشتراكات تنتهي خلال 30 يوماً (المتاجر المفعّلة فقط).
  const [renewals] = await db
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(stores)
    .where(and(eq(stores.status, "active"), gte(stores.hostingExpiresAt, new Date()), sql`${stores.hostingExpiresAt} < now() + interval '30 days'`))
    .catch(() => [{ n: 0 }]);

  const countFor = (st: string) => byStatus.find((x) => x.status === st)?.c ?? 0;
  const inPipeline = countFor("setup");

  return (
    <div className="space-y-8" dir="rtl">
      <AutoRefresh everyMs={15_000} />

      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <h1 className="text-2xl font-black text-white sm:text-3xl">مركز القيادة التنفيذي</h1>
          <p className="mt-1 text-xs text-[#8d97c4]">مراقبة حية للمنصة والمبيعات.</p>
        </div>
      </div>

      {setups && setups.open > 0 ? (
        <Link href="/admin/stores" className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-[#8fa8ff]/30 bg-[#6f86ff]/10 p-4 transition hover:bg-[#6f86ff]/15">
          <span className="text-sm font-black text-white">
            {setups.open} متجر قيد الإعداد عند أصحابه
            {setups.stale > 0 ? <span className="text-rose-300"> · {setups.stale} مضى عليها أكثر من 3 أيام</span> : null}
          </span>
          <span className="text-xs font-bold text-[#8fa8ff]">افتح المتاجر ←</span>
        </Link>
      ) : null}

      <SalesFunnel counts={funnel} range={range} golden={{ used: golden.seatsUsed, seats: golden.seats }} />

      {/* Top Widgets Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <PlatformHealthScore />
        <HotLeadsWidget />
      </div>

      {/* 4 KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard href="/admin/payments" label="إيرادات المنصة (30 يوماً)" value={formatEgp(rev?.egp ?? 0)} note={`${rev?.pending ?? 0} تحويل معلق`} tone="emerald" icon={Wallet} />
        <KpiCard href="/admin/stores" label="المتاجر النشطة" value={String(countFor("active"))} note={`${countFor("trial")} تجربة · ${inPipeline} قيد الإعداد`} tone="blue" icon={Store} />
        <KpiCard href="/admin/conversations" label="المحادثات والليدز" value={String(conv?.total ?? 0)} note={`${conv?.hot ?? 0} تاجر مهتم جداً`} noteIcon={Flame} tone="violet" icon={MessagesSquare} />
        <KpiCard label="GMV (مبيعات التجار)" value={formatEgp(gmv?.v ?? 0)} note={`${gmv?.n ?? 0} طلب تم تنفيذه`} tone="emerald" icon={TrendingUp} />
      </div>

      {/* مسار المتجر من المحادثة إلى الاشتراك */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard href="/admin/stores" label="قيد الإعداد" value={String(inPipeline)} note={setups && setups.stale > 0 ? `${setups.stale} تجاوزت 3 أيام` : "عند أصحابها"} tone="blue" icon={Store} />
        <KpiCard href="/admin/stores" label="في التجربة" value={String(countFor("trial"))} note={`${countFor("frozen")} متوقفة بانتظار الدفع`} tone="violet" icon={Store} />
        <KpiCard href="/admin/stores" label="تجديدات خلال 30 يوماً" value={String(renewals?.n ?? 0)} note="اشتراكات تنتهي قريباً" tone="emerald" icon={Wallet} />
        <KpiCard href="/admin/pricing" label="مقاعد الدائرة الذهبية" value={`${golden.confirmed + golden.underReview}/${golden.seats}`} note={golden.enabled ? "العرض مفعّل" : "العرض متوقف"} tone="violet" icon={Flame} />
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