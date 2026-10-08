// dashboard/store/[id]/page.tsx — تفاصيل متجر محدد (multi-store support).
//
// السبب الجذري:
// مع دعم multi-store، التاجر يحتاج يشوف تفاصيل متجر معيّن (KPIs، حالته،
// آخر الطلبات) بدون أن يبدّل الـ session.
import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, desc, eq, sql } from "drizzle-orm";
import {
  Store as StoreIcon,
  ExternalLink,
  ShoppingCart,
  Wallet,
  Package,
  Users,
  Settings,
  ArrowLeft,
  Sparkles,
} from "lucide-react";
import { getMerchantSession } from "@/server/auth";
import { db } from "@/db/client";
import { getTenantDb } from "@/db/tenant";
import { stores } from "@/db/schema";
import { orders, customers } from "@/db/schema/commerce";
import { products } from "@/db/schema";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { formatEgp } from "@/lib/money";
import { storeUrl } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function StoreDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getMerchantSession();
  if (!session) redirect("/login");

  // التحقق من ملكية المتجر.
  const [store] = await db
    .select()
    .from(stores)
    .where(and(eq(stores.id, id), eq(stores.merchantId, session.merchantId)))
    .limit(1);

  if (!store) notFound();

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-edge/10 pb-5">
        <div className="min-w-0 flex-1">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-[11px] font-bold text-ink-3 transition-colors hover:text-ink"
          >
            <ArrowLeft className="size-3" strokeWidth={2.5} aria-hidden="true" />
            رجوع
          </Link>
          <h1 className="mt-2 flex flex-wrap items-baseline gap-2 text-2xl font-black text-ink">
            {store.name}
            <span
              className="truncate font-mono text-sm font-normal text-ink-3"
              dir="ltr"
            >
              {store.subdomain}.colapia.com
            </span>
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <a
            href={storeUrl(store.subdomain)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-edge/10 bg-edge/[0.03] px-3.5 text-xs font-bold text-ink transition-colors hover:bg-edge/[0.06]"
          >
            <ExternalLink className="size-3.5" strokeWidth={2.25} aria-hidden="true" />
            معاينة المتجر
          </a>
          <Link
            href="/dashboard/settings"
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-edge/10 bg-edge/[0.03] px-3.5 text-xs font-bold text-ink transition-colors hover:bg-edge/[0.06]"
          >
            <Settings className="size-3.5" strokeWidth={2.25} aria-hidden="true" />
            الإعدادات
          </Link>
        </div>
      </header>

      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-edge/[0.02]" />}>
        <StoreStats storeId={id} />
      </Suspense>
    </div>
  );
}

async function StoreStats({ storeId }: { storeId: string }) {
  const since30 = new Date(Date.now() - 30 * 86_400_000);
  const tdb = await getTenantDb(storeId);

  const [ordersStats, productsCount, customersCount, recentOrders] =
    await Promise.all([
      tdb
        .select({
          count: sql<number>`count(*)`.mapWith(Number),
          revenue: sql<number>`coalesce(sum(${orders.totalPiasters}) filter (where ${orders.status} not in ('cancelled','returned')), 0)`.mapWith(Number),
          pending: sql<number>`count(*) filter (where ${orders.status}='new')`.mapWith(Number),
          ordersThisMonth: sql<number>`count(*) filter (where ${orders.createdAt} >= ${since30.toISOString()})`.mapWith(Number),
        })
        .from(orders)
        .where(eq(orders.storeId, storeId)),

      tdb
        .select({ c: sql<number>`count(*)`.mapWith(Number) })
        .from(products)
        .where(eq(products.storeId, storeId)),

      tdb
        .select({ c: sql<number>`count(*)`.mapWith(Number) })
        .from(customers)
        .where(eq(customers.storeId, storeId)),

      tdb
        .select({
          id: orders.id,
          code: orders.code,
          customerName: orders.customerName,
          status: orders.status,
          total: orders.totalPiasters,
          createdAt: orders.createdAt,
        })
        .from(orders)
        .where(eq(orders.storeId, storeId))
        .orderBy(desc(orders.createdAt))
        .limit(5),
    ]);

  const s = ordersStats[0]!;

  return (
    <>
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="إجمالي الطلبات"
          value={s.count.toLocaleString("ar-EG")}
          icon={ShoppingCart}
          delta={0}
          deltaType="neutral"
        />
        <KpiCard
          title="الإيرادات"
          value={formatEgp(s.revenue)}
          icon={Wallet}
          delta={0}
          deltaType="neutral"
        />
        <KpiCard
          title="المنتجات"
          value={(productsCount[0]?.c ?? 0).toLocaleString("ar-EG")}
          icon={Package}
          delta={0}
          deltaType="neutral"
        />
        <KpiCard
          title="العملاء"
          value={(customersCount[0]?.c ?? 0).toLocaleString("ar-EG")}
          icon={Users}
          delta={0}
          deltaType="neutral"
        />
      </section>

      {/* Recent orders */}
      <section className="rounded-2xl border border-edge/10 bg-edge/[0.02] p-5">
        <header className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-black text-ink">
            <Sparkles className="size-3.5 text-nova-2" strokeWidth={2.25} aria-hidden="true" />
            آخر الطلبات
          </h2>
          <Link
            href="/dashboard/orders"
            className="inline-flex items-center gap-1 text-[11px] font-bold text-nova-2 transition-colors hover:text-ink"
          >
            عرض الكل
            <ArrowLeft className="size-3" aria-hidden="true" />
          </Link>
        </header>

        {recentOrders.length === 0 ? (
          <p className="py-8 text-center text-xs text-ink-3">
            لا توجد طلبات بعد.
          </p>
        ) : (
          <ul className="divide-y divide-edge/5">
            {recentOrders.map((o) => (
              <li key={o.id}>
                <Link
                  href={`/dashboard/orders/${o.id}`}
                  className="flex items-center justify-between gap-3 py-3 transition-opacity hover:opacity-90"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-xs font-black text-ink">
                      {o.code}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-ink-3">
                      {o.customerName}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-md bg-nova/10 px-2 py-1 text-[10.5px] font-bold text-nova-2">
                    {o.status}
                  </span>
                  <span className="shrink-0 font-mono text-sm font-black text-ink">
                    {formatEgp(o.total)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}