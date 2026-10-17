// dashboard/page.tsx — «نظرة عامة»: ما ينتظر التاجر الآن، ثم أداء الفترة المختارة (7/30/90 يوماً) مقارنةً
// بالفترة المساوية قبلها، والأرباح، وأحدث الطلبات، وجاهزية المتجر، والسلات المتروكة، وملاحظات من أرقامه.
import { Suspense } from "react";
import { requireStoreArea } from "@/server/merchant-guard";
import Link from "next/link";
import { Eye, Percent, Plus, ShoppingCart, Wallet } from "lucide-react";
import { getMerchantSession } from "@/server/auth";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { NO_STORE_HREF } from "@/lib/edition";
import { GoalCard } from "@/components/dashboard/overview/GoalCard";
import { ShareStoreCard } from "@/components/dashboard/overview/ShareStoreCard";
import { growthData } from "@/server/repos/growth";
import { TrialCard } from "@/components/dashboard/TrialCard";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { AttentionStrip } from "@/components/dashboard/overview/AttentionStrip";
import { AbandonedCarts } from "@/components/dashboard/overview/AbandonedCarts";
import { cartToken, reviewToken } from "@/lib/order-access";
import { TodayTasks } from "@/components/dashboard/overview/TodayTasks";
import { todayData } from "@/server/repos/today-tasks";
import { orderMessage } from "@/lib/order-messages";
import { waLink } from "@/lib/whatsapp";
import { memberPerms } from "@/server/merchant-guard";
import { allows, OWNER_PERMS } from "@/lib/store-perms";
import { publicStoreUrl, storeUrl } from "@/lib/utils";
import { listDiscounts } from "@/server/repos/discounts-list";
import { discountState, discountValueLabel } from "@/lib/discounts";
import {
  EarningsCard,
  NotesCard,
  RangeTabs,
  ReadinessCard,
  RecentOrdersCard,
  TopProductsCard,
} from "@/components/dashboard/overview/OverviewCards";
import { readinessScore, readinessSteps } from "@/lib/store-readiness";
import { buildNotes } from "@/components/dashboard/overview/notes";
import { overviewData, pctChange, OVERVIEW_RANGES, type OverviewRange } from "@/server/repos/overview";
import { getBlueprintOrNull } from "@/lib/tenant";
import { formatEgp } from "@/lib/money";
import { fmtDec, fmtNum } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "نظرة عامة" };

type SearchParams = { onboarding?: string; reason?: string; range?: string };

export default async function DashboardHomePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await getMerchantSession();
  if (!session) return null;
  await requireStoreArea("analytics");
  const params = await searchParams;

  if (!session.store) redirect(NO_STORE_HREF);

  const store = session.store;
  const range = (OVERVIEW_RANGES as number[]).includes(Number(params.range)) ? (Number(params.range) as OverviewRange) : 30;
  const showTrial = store.status !== "active" && (store.trialEndsAt ?? store.demoExpiresAt) != null;

  return (
    <div className="mx-auto max-w-6xl space-y-5 sm:space-y-6">

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-ink">نظرة عامة</h1>
          <p className="mt-1 text-[12.5px] text-ink-3">أداء {store.name} مقارنةً بالفترة المساوية التي قبلها.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <RangeTabs active={range} />
          <Link
            href="/dashboard/products/new"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-gradient-to-b from-nova to-nova-deep px-4 text-[12.5px] font-black text-white shadow-md transition-all hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova-2"
          >
            <Plus className="size-4" strokeWidth={2.25} aria-hidden="true" />
            منتج جديد
          </Link>
        </div>
      </header>

      {showTrial ? <TrialCard store={store} /> : null}

      <Suspense fallback={<AttentionStrip />}>
        <TodaySection storeId={store.id} subdomain={store.subdomain} storeName={store.name} canMessage={allows(memberPerms(session) ?? OWNER_PERMS, "orders", "manage")} />
      </Suspense>

      <Suspense fallback={null}>
        <GrowthSection storeId={store.id} prefs={store.prefs} storeUrlValue={publicStoreUrl(store)} storeName={store.name} />
      </Suspense>

      <Suspense key={range} fallback={<OverviewSkeleton />}>
        <OverviewBody storeId={store.id} subdomain={store.subdomain} storeName={store.name} range={range} customDomainActive={store.customDomainStatus === "active"} />
      </Suspense>
    </div>
  );
}

async function GrowthSection({ storeId, prefs, storeUrlValue, storeName }: { storeId: string; prefs: unknown; storeUrlValue: string; storeName: string }) {
  const g = await growthData(storeId, prefs).catch(() => null);
  const shareDone = Boolean((prefs as { shareDone?: boolean } | null)?.shareDone);
  const qr = shareDone ? "" : await QRCode.toDataURL(storeUrlValue, { width: 280, margin: 1 }).catch(() => "");
  return (
    <>
      {g ? <GoalCard g={g} /> : null}
      {shareDone ? null : <ShareStoreCard url={storeUrlValue} storeName={storeName} qr={qr} />}
    </>
  );
}

async function TodaySection({ storeId, subdomain, storeName, canMessage }: { storeId: string; subdomain: string; storeName: string; canMessage: boolean }) {
  const t = await todayData(storeId).catch(() => null);
  if (!t) return <AttentionStrip />;
  const { reviewAsks, reviewAsksTotal, ...extras } = t;
  const asks = reviewAsks.map((o) => ({
    id: o.id,
    code: o.code,
    name: o.customerName,
    href: waLink(
      o.customerPhone,
      orderMessage("delivered", { ...o, reviewUrl: storeUrl(subdomain, `/review?o=${encodeURIComponent(o.code)}&t=${reviewToken(storeId, o.id)}`) }, storeName)
    ),
  }));
  return <TodayTasks extras={extras} asks={asks} asksTotal={reviewAsksTotal} canMessage={canMessage} />;
}

async function OverviewBody({ storeId, subdomain, storeName, range, customDomainActive }: { storeId: string; subdomain: string; storeName: string; range: OverviewRange; customDomainActive: boolean }) {
  const [data, bp] = await Promise.all([overviewData(storeId, range), getBlueprintOrNull(storeId)]);
  const { current: c, previous: p, series } = data;
  const shareHref = "/dashboard/store";

  const conv = c.visitors > 0 ? (c.orders / c.visitors) * 100 : null;
  const prevConv = p.visitors > 0 ? (p.orders / p.visitors) * 100 : null;
  const convDelta = conv !== null && prevConv !== null ? Math.round((conv - prevConv) * 10) / 10 : null;
  // متوسط الطلب بالجنيه الصحيح (بلا قروش) لأنه رقم استرشادي.
  const aov = c.orders > 0 ? Math.round(c.sales / c.orders / 100) * 100 : 0;
  const trend = (d: number | null): "up" | "down" | "neutral" => (d === null || d === 0 ? "neutral" : d > 0 ? "up" : "down");

  const salesDelta = pctChange(c.sales, p.sales);
  const ordersDelta = pctChange(c.orders, p.orders);
  const visitsDelta = pctChange(c.visits, p.visits);

  const pm = bp?.payments;
  const ready = readinessSteps(
    {
      ...data.readiness,
      flatShipping: bp?.shipping.flatRatePiasters != null,
      hasSizeChart: Boolean(bp?.sizeGuide?.charts.some((c) => c.rows.length)),
      hasLogo: Boolean(bp?.brand.logo),
      hasWhatsapp: Boolean(bp?.channels.whatsappNumber),
      payments: {
        cod: Boolean(pm?.cod.enabled),
        vodafoneCash: { enabled: Boolean(pm?.vodafoneCash.enabled), ready: Boolean(pm?.vodafoneCash.number) },
        instapay: { enabled: Boolean(pm?.instapay.enabled), ready: Boolean(pm?.instapay.address || pm?.instapay.number) },
      },
      policySet: Boolean(bp && (bp.returns.windowDays > 0 || bp.returns.allowExchange || bp.returns.allowRefund || bp.returns.defectPolicy !== "none")),
      hasPixel: Boolean(bp?.seo?.metaPixelId || bp?.seo?.tiktokPixelId || bp?.seo?.gaMeasurementId),
      customDomain: Boolean(customDomainActive),
    },
    shareHref
  );
  const readyDone = readinessScore(ready).pct === 100;

  const notes = buildNotes({
    days: range,
    current: c,
    previous: p,
    topProduct: data.topProducts[0] ? { name: data.topProducts[0].name, qty: data.topProducts[0].qty } : null,
    viewedNotBought: data.viewedNotBought,
    silentRepeat: data.silentRepeat,
    hasOrdersEver: data.readiness.hasOrders,
    shareHref,
  });

  return (
    <>
      <section aria-label="المؤشرات الرئيسية" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <KpiCard
          title="المبيعات"
          value={formatEgp(c.sales)}
          hint={c.orders > 0 ? `متوسط الطلب ${formatEgp(aov)}` : undefined}
          icon={Wallet}
          delta={salesDelta}
          deltaType={trend(salesDelta)}
          sparkline={series.map((d) => d.sales)}
          href="/dashboard/analytics"
        />
        <KpiCard
          title="الطلبات"
          value={fmtNum(c.orders)}
          hint="بلا الملغاة والمرتجعة"
          icon={ShoppingCart}
          delta={ordersDelta}
          deltaType={trend(ordersDelta)}
          sparkline={series.map((d) => d.orders)}
          href="/dashboard/orders"
        />
        <KpiCard
          title="الزيارات"
          value={fmtNum(c.visits)}
          hint={`الزوار المختلفون: ${fmtNum(c.visitors)}`}
          icon={Eye}
          delta={visitsDelta}
          deltaType={trend(visitsDelta)}
          sparkline={series.map((d) => d.visits)}
          href="/dashboard/analytics"
        />
        <KpiCard
          title="معدل التحويل"
          value={conv === null ? "—" : `${fmtDec(conv)}%`}
          hint={conv === null ? "يظهر مع أول زيارات لمتجرك" : "من الزوار إلى طلب"}
          icon={Percent}
          delta={conv === null ? undefined : convDelta}
          deltaUnit="pt"
          deltaType={trend(convDelta)}
          href="/dashboard/analytics"
        />
      </section>

      <EarningsCard data={data} />

      <NotesCard notes={notes} />

      <div className="grid gap-5 lg:grid-cols-3 lg:gap-6">
        <RecentOrdersCard rows={data.recentOrders} />
        {readyDone ? <TopProductsCard rows={data.topProducts} days={range} /> : <ReadinessCard steps={ready} />}
      </div>

      <AbandonedCarts
        storeName={storeName}
        rows={data.carts.map((r) => ({
          id: r.id,
          name: r.name,
          phone: r.phone ?? "",
          subtotal: r.subtotal,
          firstItem: r.items[0]?.name ?? null,
          itemsCount: r.items.length,
          lastSeenAt: r.lastSeenAt.toISOString(),
          contacted: r.contactedAt !== null,
          restoreUrl: storeUrl(subdomain, `/cart/restore?c=${r.id}&t=${cartToken(storeId, r.id)}`),
        }))}
        template={bp?.orderMessages?.abandoned ?? null}
        promos={data.carts.length ? (await listDiscounts(storeId).catch(() => [])).filter((d) => discountState(d) === "active").map((d) => ({ code: d.code, label: discountValueLabel(d) })) : []}
      />

      {!readyDone && data.topProducts.length > 0 ? <TopProductsCard rows={data.topProducts} days={range} /> : null}
    </>
  );
}

function OverviewSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="جارٍ تحميل الأرقام">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-36 animate-pulse rounded-2xl bg-edge/[0.04]" />
        ))}
      </div>
      <div className="h-32 animate-pulse rounded-2xl bg-edge/[0.04]" />
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="h-72 animate-pulse rounded-2xl bg-edge/[0.04] lg:col-span-2" />
        <div className="h-72 animate-pulse rounded-2xl bg-edge/[0.04]" />
      </div>
    </div>
  );
}
