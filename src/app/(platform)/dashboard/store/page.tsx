// dashboard/store/page.tsx — صفحة "متجري".
import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { eq, sql, desc } from "drizzle-orm";
import {
  Store as StoreIcon,
  ExternalLink,
  ShoppingCart,
  Wallet,
  Package,
  Settings,
  QrCode,
  ArrowLeft,
  Calendar,
  Globe,
  Sparkles,
  Palette,
} from "lucide-react";
import { getMerchantSession } from "@/server/auth";
import { getTenantDb } from "@/db/tenant";
import { orders } from "@/db/schema/commerce";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { formatEgp } from "@/lib/money";
import { storeUrl } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "متجري" };

const STATUS_LABEL: Record<
  string,
  { label: string; tone: "emerald" | "amber" | "rose" | "neutral" }
> = {
  active: { label: "مفعّل مدى الحياة", tone: "emerald" },
  trial: { label: "تجربة نشطة", tone: "amber" },
  building: { label: "قيد البناء", tone: "amber" },
  review: { label: "قيد التجهيز", tone: "amber" },
  pending_review: { label: "قيد المراجعة", tone: "amber" },
  intake: { label: "قيد التجهيز", tone: "amber" },
  frozen: { label: "مجمّد — بانتظار الدفع", tone: "rose" },
  suspended: { label: "معلّق", tone: "rose" },
};

export default async function StoreDetailPage() {
  const session = await getMerchantSession();
  if (!session) redirect("/login?redirect=/dashboard/store");
  if (!session.store) redirect("/dashboard/onboarding");

  const store = session.store;
  const meta = STATUS_LABEL[store.status] ?? {
    label: store.status,
    tone: "neutral" as const,
  };
  const url = storeUrl(store.subdomain);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-edge/10 pb-5">
        <div className="min-w-0 flex-1">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-[11px] font-bold text-ink-3 transition-colors hover:text-ink"
          >
            <ArrowLeft className="size-3" strokeWidth={2.5} aria-hidden="true" />
            رجوع للداشبورد
          </Link>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-nova to-aurora text-lg font-black text-white shadow-lg">
              {store.name.charAt(0)}
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-black tracking-tight text-ink">
                {store.name}
              </h1>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-0.5 inline-flex items-center gap-1 font-mono text-[11.5px] text-ink-3 transition-colors hover:text-nova-2"
                dir="ltr"
              >
                {store.subdomain}.colapia.com
                <ExternalLink className="size-3" strokeWidth={2.25} aria-hidden="true" />
              </a>
            </div>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10.5px] font-black ${
                meta.tone === "emerald"
                  ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
                  : meta.tone === "amber"
                  ? "border-amber-400/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                  : meta.tone === "rose"
                  ? "border-rose-400/30 bg-rose-500/10 text-rose-600 dark:text-rose-300"
                  : "border-edge/10 bg-edge/5 text-ink-3"
              }`}
            >
              <span
                aria-hidden
                className={`size-1.5 rounded-full ${
                  meta.tone === "emerald"
                    ? "bg-emerald-400"
                    : meta.tone === "amber"
                    ? "animate-pulse bg-amber-400"
                    : meta.tone === "rose"
                    ? "bg-rose-400"
                    : "bg-ink-3"
                }`}
              />
              {meta.label}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/dashboard/content"
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-nova-2/30 bg-nova/15 px-3.5 text-xs font-bold text-nova-2 transition-colors hover:bg-nova/25"
          >
            <Palette className="size-3.5" strokeWidth={2.25} aria-hidden="true" />
            محرر المحتوى
          </Link>
          <Link
            href="/dashboard/settings"
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-edge/10 bg-edge/[0.03] px-3.5 text-xs font-bold text-ink transition-colors hover:bg-edge/[0.06]"
          >
            <Settings className="size-3.5" strokeWidth={2.25} aria-hidden="true" />
            الإعدادات
          </Link>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-gradient-to-l from-nova to-nova-2 px-4 text-xs font-black text-space shadow-md transition-all hover:brightness-105"
          >
            <ExternalLink className="size-3.5" strokeWidth={2.5} aria-hidden="true" />
            معاينة المتجر
          </a>
        </div>
      </header>

      <Suspense fallback={<div className="h-32 animate-pulse rounded-2xl bg-edge/[0.02]" />}>
        <StoreKpis storeId={store.id} statusLabel={meta.label} />
      </Suspense>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-edge/10 bg-edge/[0.02] p-5 lg:col-span-2">
          <header className="mb-4 flex items-center gap-2 border-b border-edge/5 pb-3">
            <StoreIcon className="size-4 text-nova-2" strokeWidth={2.25} aria-hidden="true" />
            <h2 className="text-sm font-black text-ink">معلومات المتجر</h2>
          </header>

          <dl className="grid gap-3 sm:grid-cols-2">
            <InfoRow
              icon={Calendar}
              label="تاريخ الإنشاء"
              value={new Date(store.createdAt).toLocaleDateString("ar-EG", {
                timeZone: "Africa/Cairo",
                dateStyle: "long",
              })}
            />
            <InfoRow
              icon={Globe}
              label="النطاق الفرعي"
              value={`${store.subdomain}.colapia.com`}
              ltr
            />
            {store.demoExpiresAt && store.status !== "active" ? (
              <InfoRow
                icon={Calendar}
                label="نهاية التجربة"
                value={new Date(store.demoExpiresAt).toLocaleString("ar-EG", {
                  timeZone: "Africa/Cairo",
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              />
            ) : null}
            <InfoRow
              icon={ShoppingCart}
              label="استقبال الطلبات"
              value={store.acceptingOrders ? "مفعّل" : "موقوف مؤقتاً"}
            />
          </dl>
        </div>

        <div className="rounded-2xl border border-edge/10 bg-edge/[0.02] p-5">
          <header className="mb-4 flex items-center gap-2 border-b border-edge/5 pb-3">
            <Sparkles className="size-4 text-nova-2" strokeWidth={2.25} aria-hidden="true" />
            <h2 className="text-sm font-black text-ink">إجراءات سريعة</h2>
          </header>

          <ul className="space-y-2">
            <QuickAction href="/dashboard/products/new" icon={Package} label="إضافة منتج جديد" />
            <QuickAction href="/dashboard/orders" icon={ShoppingCart} label="عرض الطلبات" />
            <QuickAction href="/dashboard/discounts" icon={Sparkles} label="إنشاء كود خصم" />
            <QuickAction href="/dashboard/settings" icon={QrCode} label="تحميل كود QR للمتجر" />
            <QuickAction
              href="/dashboard/billing"
              icon={Wallet}
              label={store.status === "active" ? "الفوترة" : "تفعيل المتجر للأبد"}
              highlight={store.status !== "active"}
            />
          </ul>
        </div>
      </section>

      <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-edge/[0.02]" />}>
        <RecentOrdersPreview storeId={store.id} />
      </Suspense>
    </div>
  );
}

async function StoreKpis({
  storeId,
  statusLabel,
}: {
  storeId: string;
  statusLabel: string;
}) {
  const db = await getTenantDb(storeId);
  const stats = await db
    .select({
      count: sql<number>`count(*)`.mapWith(Number),
      revenue: sql<number>`coalesce(sum(${orders.totalPiasters}) filter (where ${orders.status} not in ('cancelled','returned')), 0)`.mapWith(Number),
    })
    .from(orders)
    .where(eq(orders.storeId, storeId));

  const s = stats[0] ?? { count: 0, revenue: 0 };

  return (
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <KpiCard title="إجمالي الطلبات" value={s.count.toLocaleString("ar-EG")} icon={ShoppingCart} delta={0} deltaType="neutral" />
      <KpiCard title="الإيرادات" value={formatEgp(s.revenue)} icon={Wallet} delta={0} deltaType="neutral" />
      <KpiCard title="حالة المتجر" value={statusLabel} icon={StoreIcon} delta={0} deltaType="neutral" />
    </section>
  );
}

async function RecentOrdersPreview({ storeId }: { storeId: string }) {
  const db = await getTenantDb(storeId);
  const recent = await db
    .select({
      id: orders.id,
      code: orders.code,
      customerName: orders.customerName,
      status: orders.status,
      total: orders.totalPiasters,
    })
    .from(orders)
    .where(eq(orders.storeId, storeId))
    .orderBy(desc(orders.createdAt))
    .limit(5);

  return (
    <section className="rounded-2xl border border-edge/10 bg-edge/[0.02] p-5">
      <header className="mb-4 flex items-center justify-between border-b border-edge/5 pb-3">
        <h2 className="flex items-center gap-2 text-sm font-black text-ink">
          <ShoppingCart className="size-3.5 text-nova-2" strokeWidth={2.25} aria-hidden="true" />
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

      {recent.length === 0 ? (
        <p className="py-8 text-center text-xs text-ink-3">
          لا توجد طلبات بعد.
        </p>
      ) : (
        <ul className="divide-y divide-edge/5">
          {recent.map((o) => (
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
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
  ltr,
}: {
  icon: typeof Calendar;
  label: string;
  value: string;
  ltr?: boolean;
}) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-edge/5 bg-edge/[0.02] p-3">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-nova/10 text-nova-2">
        <Icon className="size-3.5" strokeWidth={2.25} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[10.5px] font-bold text-ink-3">{label}</p>
        <p
          className={`mt-0.5 truncate text-xs font-bold text-ink ${ltr ? "font-mono" : ""}`}
          dir={ltr ? "ltr" : undefined}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

function QuickAction({
  href,
  icon: Icon,
  label,
  highlight,
}: {
  href: string;
  icon: typeof Package;
  label: string;
  highlight?: boolean;
}) {
  return (
    <li>
      <Link
        href={href}
        className={`flex items-center gap-2.5 rounded-xl border p-2.5 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova ${
          highlight
            ? "border-nova-2/40 bg-nova/15 text-white hover:bg-nova/25"
            : "border-edge/5 bg-edge/[0.02] text-ink-2 hover:border-edge/15 hover:bg-edge/[0.05]"
        }`}
      >
        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-nova/10 text-nova-2">
          <Icon className="size-3.5" strokeWidth={2.25} aria-hidden="true" />
        </span>
        <span className="flex-1">{label}</span>
        <ArrowLeft className="size-3 shrink-0 text-ink-3" strokeWidth={2.25} aria-hidden="true" />
      </Link>
    </li>
  );
}