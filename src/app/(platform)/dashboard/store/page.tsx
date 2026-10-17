// dashboard/store/page.tsx — «متجري» (لصاحب المتجر): الرابط العام الصحيح (النطاق الخاص متى فُعّل)، وحالة المتجر بمعناها
// الحقيقي (التجربة وموعد نهايتها، أو الاستضافة وموعد تجديدها)، وأرقام حقيقية بلا الطلبات التجريبية، وآخر الطلبات.
import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { and, desc, eq, sql } from "drizzle-orm";
import { CalendarClock, ExternalLink, Globe, Palette, Settings, ShoppingCart, Store as StoreIcon, Wallet } from "lucide-react";
import { requireStoreArea } from "@/server/merchant-guard";
import { getMerchantSession } from "@/server/auth";
import { getTenantDb } from "@/db/tenant";
import { orders } from "@/db/schema/commerce";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { formatEgp } from "@/lib/money";
import { fmtNum } from "@/lib/format";
import { cn, publicStoreUrl } from "@/lib/utils";
import { hostingState } from "@/lib/hosting";
import { orderStatusLabel, orderStatusTone, TONE_CHIP } from "@/lib/order-status";
import { hostingGraceDays } from "@/server/hosting-grace";

export const dynamic = "force-dynamic";
export const metadata = { title: "متجري" };

const dateFmt = new Intl.DateTimeFormat("ar-EG-u-nu-latn", { timeZone: "Africa/Cairo", day: "numeric", month: "long", year: "numeric" });
const dateTimeFmt = new Intl.DateTimeFormat("ar-EG-u-nu-latn", { timeZone: "Africa/Cairo", weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit" });

type Tone = "ok" | "warn" | "bad" | "muted";
const TONE: Record<Tone, string> = { ok: "bg-ok/12 text-ok", warn: "bg-warn/12 text-warn", bad: "bg-bad/12 text-bad", muted: "bg-edge/[0.06] text-ink-3" };

type Store = NonNullable<NonNullable<Awaited<ReturnType<typeof getMerchantSession>>>["store"]>;

/** حالة المتجر بلغة صاحبه: ماذا يرى الزائر، ومتى يتغير ذلك. */
function statusOf(store: Store, graceDays: number): { label: string; tone: Tone; detail: string | null } {
  const h = hostingState(store, new Date(), undefined, graceDays);
  switch (store.status) {
    case "active":
      if (h.phase === "active") return { label: "مفعّل", tone: "ok", detail: `الاستضافة سارية حتى ${dateFmt.format(h.expiresAt)}.` };
      if (h.phase === "renew_soon") return { label: "مفعّل", tone: "warn", detail: `الاستضافة تنتهي ${dateFmt.format(h.expiresAt)}. التجديد متاح الآن من «الباقة والاستضافة».` };
      if (h.phase === "grace") return { label: "انتهت الاستضافة", tone: "warn", detail: `متجرك يعمل حتى ${dateFmt.format(h.pauseAt)} ثم يتوقف عن الظهور حتى التجديد.` };
      if (h.phase === "paused") return { label: "متوقف حتى التجديد", tone: "bad", detail: "الزوار يرون أن المتجر غير متاح. بياناتك محفوظة كما هي." };
      if (h.phase === "offline") return { label: "متوقف بطلبك", tone: "muted", detail: null };
      return { label: "مفعّل", tone: "ok", detail: null };
    case "trial":
      return { label: "تجربة نشطة", tone: "warn", detail: store.demoExpiresAt ? `تنتهي ${dateTimeFmt.format(store.demoExpiresAt)}. التفعيل من «الباقة والاستضافة».` : null };
    case "frozen":
      return { label: "متوقف بانتظار التفعيل", tone: "bad", detail: store.purgeAt ? `تُحذف بيانات التجربة ${dateTimeFmt.format(store.purgeAt)} إن لم يُفعَّل.` : "التفعيل من «الباقة والاستضافة»." };
    case "building":
    case "intake":
    case "review":
    case "pending_review":
      return { label: "فريقنا يجهّز متجرك", tone: "warn", detail: "يصلك بريد فور التسليم." };
    default:
      return { label: "غير متاح", tone: "muted", detail: null };
  }
}

export default async function StoreDetailPage() {
  const session = await getMerchantSession();
  if (!session) redirect("/login?redirect=/dashboard/store");
  if (!session.store) redirect("/start");
  await requireStoreArea("billing");

  const store = session.store;
  const status = statusOf(store, await hostingGraceDays().catch(() => 3));
  const url = publicStoreUrl(store);
  const host = url.replace(/^https?:\/\//, "");

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <header className="space-y-3">
        <div className="flex items-center gap-3">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-nova to-aurora text-lg font-black text-white">{store.name.charAt(0)}</span>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-black tracking-tight text-ink">{store.name}</h1>
            <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-mono text-[12px] text-ink-3 hover:text-nova-2" dir="ltr">
              {host}
              <ExternalLink className="size-3" aria-hidden="true" />
            </a>
          </div>
        </div>
        <div className="dash-card flex items-start gap-3 p-3.5">
          <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-[11.5px] font-black", TONE[status.tone])}>{status.label}</span>
          {status.detail ? <p className="text-[12.5px] leading-6 text-ink-2">{status.detail}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-gradient-to-b from-nova to-nova-deep px-4 text-[12.5px] font-black text-white shadow-md">
            <ExternalLink className="size-4" aria-hidden="true" /> فتح المتجر
          </a>
          <Link href="/dashboard/content" className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-edge/10 px-3.5 text-[12.5px] font-bold text-ink">
            <Palette className="size-4" aria-hidden="true" /> محرر المحتوى
          </Link>
          <Link href="/dashboard/settings" className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-edge/10 px-3.5 text-[12.5px] font-bold text-ink">
            <Settings className="size-4" aria-hidden="true" /> الرابط ورمز QR
          </Link>
          {store.status !== "active" || status.tone !== "ok" ? (
            <Link href="/dashboard/billing" className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-nova/30 bg-nova/10 px-3.5 text-[12.5px] font-black text-ink">
              <Wallet className="size-4" aria-hidden="true" /> الباقة والاستضافة
            </Link>
          ) : null}
        </div>
      </header>

      <Suspense fallback={<div className="h-32 animate-pulse rounded-2xl bg-edge/[0.04]" />}>
        <StoreNumbers storeId={store.id} />
      </Suspense>

      <section className="dash-card grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
        <Info icon={CalendarClock} label="تاريخ الإنشاء" value={dateFmt.format(store.createdAt)} />
        <Info icon={Globe} label="الرابط" value={host} ltr />
        {store.customDomain && store.customDomainStatus !== "active" ? <Info icon={Globe} label="النطاق الخاص" value={`${store.customDomain} · قيد الربط`} ltr /> : null}
        <Info icon={ShoppingCart} label="استقبال الطلبات" value={store.acceptingOrders ? "مفتوح" : "موقوف مؤقتاً"} />
      </section>

      <Suspense fallback={<div className="h-48 animate-pulse rounded-2xl bg-edge/[0.04]" />}>
        <RecentOrders storeId={store.id} />
      </Suspense>
    </div>
  );
}

async function StoreNumbers({ storeId }: { storeId: string }) {
  const db = await getTenantDb(storeId);
  const [s] = await db
    .select({
      count: sql<number>`count(*) filter (where ${orders.status} not in ('cancelled','returned'))`.mapWith(Number),
      delivered: sql<number>`count(*) filter (where ${orders.status} = 'delivered')`.mapWith(Number),
      revenue: sql<number>`coalesce(sum(${orders.totalPiasters}) filter (where ${orders.status} = 'delivered'), 0)`.mapWith(Number),
    })
    .from(orders)
    .where(and(eq(orders.storeId, storeId), eq(orders.isTest, false)));
  return (
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 [&>*:last-child]:col-span-2 sm:[&>*:last-child]:col-span-1">
      <KpiCard title="كل الطلبات" value={fmtNum(s?.count ?? 0)} hint="منذ الإنشاء، بلا الملغاة والمرتجعة" icon={ShoppingCart} href="/dashboard/orders" />
      <KpiCard title="تم تسليمها" value={fmtNum(s?.delivered ?? 0)} icon={StoreIcon} href="/dashboard/orders?status=delivered" />
      <KpiCard title="مبيعات مُسلَّمة" value={formatEgp(s?.revenue ?? 0)} icon={Wallet} href="/dashboard/analytics" />
    </section>
  );
}

async function RecentOrders({ storeId }: { storeId: string }) {
  const db = await getTenantDb(storeId);
  const recent = await db
    .select({ id: orders.id, code: orders.code, customerName: orders.customerName, status: orders.status, total: orders.totalPiasters, isTest: orders.isTest })
    .from(orders)
    .where(eq(orders.storeId, storeId))
    .orderBy(desc(orders.createdAt))
    .limit(5);
  return (
    <section className="dash-card p-4 sm:p-5">
      <header className="mb-2 flex items-center justify-between">
        <h2 className="text-[14px] font-black text-ink">آخر الطلبات</h2>
        <Link href="/dashboard/orders" className="text-[12px] font-bold text-nova-2">كل الطلبات</Link>
      </header>
      {recent.length === 0 ? (
        <p className="py-6 text-center text-[12.5px] text-ink-3">لا طلبات بعد.</p>
      ) : (
        <ul className="divide-y divide-edge/10">
          {recent.map((o) => (
            <li key={o.id}>
              <Link href={`/dashboard/orders/${o.id}`} className="flex items-center gap-3 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-bold text-ink">{o.customerName}</span>
                  <span className="font-mono text-[11px] text-ink-3" dir="ltr">{o.code}</span>
                </span>
                {o.isTest ? <span className="rounded-full bg-warn/12 px-2 py-0.5 text-[10.5px] font-black text-warn">تجريبي</span> : null}
                <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-black", TONE_CHIP[orderStatusTone(o.status)])}>{orderStatusLabel(o.status)}</span>
                <span className="shrink-0 text-[13px] font-black tabular-nums text-ink">{formatEgp(o.total)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Info({ icon: Icon, label, value, ltr }: { icon: typeof Globe; label: string; value: string; ltr?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-nova/10 text-nova-2">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-bold text-ink-3">{label}</p>
        <p className={cn("truncate text-[13px] font-bold text-ink", ltr && "font-mono")} dir={ltr ? "ltr" : undefined}>{value}</p>
      </div>
    </div>
  );
}
