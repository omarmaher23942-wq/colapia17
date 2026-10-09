// dashboard/analytics — التحليلات: ما بعد أرقام «نظرة عامة» (بنفس تعريفاتها): المنحنى اليومي، وقمع الشراء بالزوار،
// ومن أين يأتي زوارك وطلباتك، ومتى يطلب عملاؤك، والأجهزة، والمحافظات، والمنتجات الأكثر مبيعاً، والعملاء الجدد والعائدون.
// كل رقم من قاعدة المتجر؛ ما لا بيانات له يظهر فارغاً بشرح، لا رقماً مخترعاً.
import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Download, Monitor, Smartphone } from "lucide-react";
import { getMerchantSession } from "@/server/auth";
import { NO_STORE_HREF } from "@/lib/edition";
import { analyticsReport, ANALYTICS_RANGES, parseRange, type RangeDays, type Report } from "@/server/repos/analytics";
import { pctChange } from "@/server/repos/overview";
import { formatEgp } from "@/lib/money";
import { arCount, fmtDec, fmtNum, NOUN } from "@/lib/format";
import { cn } from "@/lib/utils";
import { TrendChart } from "@/components/dashboard/analytics/TrendChart";

export const dynamic = "force-dynamic";
export const metadata = { title: "التحليلات" };

const RANGE_LABEL: Record<RangeDays, string> = { 7: "7 أيام", 30: "30 يوماً", 90: "90 يوماً" };
const WEEKDAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const session = await getMerchantSession();
  if (!session) redirect("/login?redirect=/dashboard/analytics");
  if (!session.store) redirect(NO_STORE_HREF);
  const days = parseRange((await searchParams).days);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-ink">التحليلات</h1>
          <p className="mt-1 text-[12.5px] text-ink-3">آخر {RANGE_LABEL[days]}، مقارنةً بالفترة نفسها قبلها. الطلبات المحققة فقط (بلا الملغاة والمرتجعة وطلبات التجربة).</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <nav aria-label="الفترة" className="inline-flex rounded-xl border border-edge/10 bg-edge/[0.03] p-1">
            {ANALYTICS_RANGES.map((d) => (
              <Link
                key={d}
                href={d === 30 ? "/dashboard/analytics" : `/dashboard/analytics?days=${d}`}
                aria-current={d === days ? "page" : undefined}
                className={cn("inline-flex min-h-9 items-center rounded-lg px-3 text-[12px] font-bold transition-colors", d === days ? "bg-nova text-white shadow-sm" : "text-ink-3 hover:bg-edge/5 hover:text-ink")}
              >
                {RANGE_LABEL[d]}
              </Link>
            ))}
          </nav>
          <a href={`/api/dashboard/analytics/export?days=${days}`} download className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-edge/10 px-3.5 text-[12px] font-bold text-ink-2 hover:bg-edge/[0.05] hover:text-ink">
            <Download className="size-4" aria-hidden="true" />
            Excel
          </a>
        </div>
      </header>

      <Suspense key={days} fallback={<div className="dash-card h-96 animate-pulse" aria-label="جارٍ التحميل" />}>
        <Body storeId={session.store.id} days={days} />
      </Suspense>
    </div>
  );
}

async function Body({ storeId, days }: { storeId: string; days: RangeDays }) {
  const r = await analyticsReport(storeId, days);
  const c = r.current;
  const p = r.previous;
  const aov = c.orders ? c.sales / c.orders : null;
  const prevAov = p.orders ? p.sales / p.orders : null;
  const conv = c.visitors ? (c.orders / c.visitors) * 100 : null;
  const prevConv = p.visitors ? (p.orders / p.visitors) * 100 : null;

  return (
    <>
      <section className="dash-card space-y-4 p-4 sm:p-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Stat label="المبيعات" value={formatEgp(c.sales)} delta={pctChange(c.sales, p.sales)} />
          <Stat label="الطلبات" value={fmtNum(c.orders)} delta={pctChange(c.orders, p.orders)} />
          <Stat label="متوسط الطلب" value={aov === null ? "—" : formatEgp(Math.round(aov / 100) * 100)} delta={aov !== null && prevAov !== null ? pctChange(aov, prevAov) : null} />
          <Stat label="الزيارات" value={fmtNum(c.visits)} delta={pctChange(c.visits, p.visits)} />
          <Stat label="معدل التحويل" value={conv === null ? "—" : `${fmtDec(conv)}%`} delta={conv !== null && prevConv !== null ? Math.round((conv - prevConv) * 10) / 10 : null} unit="pt" />
        </div>
        <TrendChart data={r.daily} />
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <Funnel f={r.funnel} />
        <Sources rows={r.sources} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Timing hours={r.hours} weekdays={r.weekdays} />
        <Audience r={r} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <TopProducts rows={r.products} />
        <Governorates rows={r.governorates} />
      </div>
    </>
  );
}

function Stat({ label, value, delta, unit = "%" }: { label: string; value: string; delta: number | null; unit?: "%" | "pt" }) {
  return (
    <div className="min-w-0 rounded-xl bg-edge/[0.03] p-3">
      <p className="text-[11.5px] font-bold text-ink-3">{label}</p>
      <p className="mt-1 truncate text-[17px] font-black tabular-nums text-ink">{value}</p>
      <p className={cn("mt-0.5 text-[11px] font-bold tabular-nums", delta === null || delta === 0 ? "text-ink-3" : delta > 0 ? "text-ok" : "text-bad")}>
        {delta === null ? "لا فترة سابقة للمقارنة" : delta === 0 ? "بلا تغيير" : `${delta > 0 ? "+" : "−"}${fmtDec(Math.abs(delta))}${unit === "%" ? "%" : " نقطة"}`}
      </p>
    </div>
  );
}

function Card({ title, hint, children, className }: { title: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("dash-card p-4 sm:p-5", className)}>
      <h2 className="text-[14px] font-black text-ink">{title}</h2>
      {hint ? <p className="mt-0.5 text-[11.5px] leading-5 text-ink-3">{hint}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

const Empty = ({ children }: { children: React.ReactNode }) => <p className="py-6 text-center text-[12px] text-ink-3">{children}</p>;

function Bar({ value, max, tone = "nova" }: { value: number; max: number; tone?: "nova" | "ok" }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-edge/[0.07]" aria-hidden="true">
      <div className={cn("h-full rounded-full", tone === "ok" ? "bg-ok" : "bg-nova")} style={{ width: `${max > 0 ? Math.max(2, (value / max) * 100) : 0}%` }} />
    </div>
  );
}

function Funnel({ f }: { f: Report["funnel"] }) {
  const steps = [
    { label: "زاروا المتجر", n: f.visitors },
    { label: "شاهدوا منتجاً", n: f.viewers },
    { label: "أضافوا للسلة", n: f.carters },
    { label: "بدؤوا الدفع", n: f.checkouts },
    { label: "طلبوا", n: f.buyers },
  ];
  return (
    <Card title="رحلة الشراء" hint="كم زائراً وصل لكل خطوة، ونسبة من انتقل من الخطوة السابقة">
      {f.visitors === 0 ? (
        <Empty>لا زيارات في هذه الفترة بعد. شارك رابط متجرك لتبدأ الأرقام.</Empty>
      ) : (
        <ol className="space-y-3">
          {steps.map((s, i) => {
            const prev = i > 0 ? steps[i - 1]!.n : null;
            const rate = prev ? Math.round((s.n / prev) * 100) : null;
            return (
              <li key={s.label} className="space-y-1.5">
                <div className="flex items-baseline justify-between gap-2 text-[12.5px]">
                  <span className="font-bold text-ink">{s.label}</span>
                  <span className="tabular-nums text-ink-2">
                    <b className="text-ink">{fmtNum(s.n)}</b>
                    {rate !== null ? <span className="ms-2 text-[11px] text-ink-3">{fmtNum(rate)}% من السابقة</span> : null}
                  </span>
                </div>
                <Bar value={s.n} max={f.visitors} />
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}

function Sources({ rows }: { rows: Report["sources"] }) {
  const maxV = Math.max(0, ...rows.map((r) => r.visitors));
  return (
    <Card title="من أين يأتي زوارك" hint="أول صفحة للزائر في الفترة. أضف ?utm_source=instagram لروابطك لتمييزها بدقة">
      {!rows.length ? (
        <Empty>لا زيارات في هذه الفترة بعد.</Empty>
      ) : (
        <ul className="space-y-3">
          {rows.map((s) => (
            <li key={s.key} className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-2 text-[12.5px]">
                <span className="font-bold text-ink">{s.label}</span>
                <span className="text-[11.5px] tabular-nums text-ink-3">
                  {arCount(s.visitors, NOUN.visitor)}
                  {s.orders ? (
                    <>
                      {" · "}
                      <b className="text-ok">{arCount(s.orders, NOUN.order)}</b> ({formatEgp(s.sales)})
                    </>
                  ) : null}
                </span>
              </div>
              <Bar value={s.visitors} max={maxV} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function Timing({ hours, weekdays }: { hours: number[]; weekdays: number[] }) {
  const total = hours.reduce((a, b) => a + b, 0);
  const maxH = Math.max(0, ...hours);
  const maxD = Math.max(0, ...weekdays);
  const peak = hours.indexOf(maxH);
  const peakDay = weekdays.indexOf(maxD);
  const hourLabel = (h: number) => `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? "ص" : "م"}`;
  return (
    <Card title="متى يطلب عملاؤك" hint="بتوقيت القاهرة. انشر عروضك قبل ساعات الذروة">
      {total === 0 ? (
        <Empty>لا طلبات في هذه الفترة بعد.</Empty>
      ) : (
        <div className="space-y-5">
          <div>
            <p className="mb-2 text-[12px] text-ink-2">
              أكثر ساعة: <b className="text-ink">{hourLabel(peak)}</b>
              {total >= 7 ? (
                <>
                  ، وأكثر يوم: <b className="text-ink">{WEEKDAYS[peakDay]}</b>
                </>
              ) : null}
            </p>
            <div className="flex h-24 items-end gap-[2px]" dir="ltr" role="img" aria-label="الطلبات حسب الساعة">
              {hours.map((n, h) => (
                <div key={h} className="flex h-full flex-1 flex-col justify-end" title={`${hourLabel(h)}: ${fmtNum(n)}`}>
                  <div className={cn("w-full rounded-t-sm", h === peak ? "bg-nova" : "bg-nova/35")} style={{ height: `${maxH ? Math.max(n ? 6 : 0, (n / maxH) * 100) : 0}%` }} />
                </div>
              ))}
            </div>
            <div className="mt-1 flex justify-between text-[10.5px] text-ink-3" dir="ltr">
              <span>12 ص</span>
              <span>6 ص</span>
              <span>12 م</span>
              <span>6 م</span>
              <span>11 م</span>
            </div>
          </div>
          <ul className="space-y-1.5">
            {WEEKDAYS.map((d, i) => (
              <li key={d} className="grid grid-cols-[4.5rem_1fr_2.5rem] items-center gap-2 text-[12px]">
                <span className="font-bold text-ink-2">{d}</span>
                <Bar value={weekdays[i] ?? 0} max={maxD} />
                <span className="text-end tabular-nums text-ink-3">{fmtNum(weekdays[i] ?? 0)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

function Audience({ r }: { r: Report }) {
  const dev = r.devices.mobile + r.devices.desktop;
  const buyers = r.buyers.newBuyers + r.buyers.returning;
  return (
    <Card title="جمهورك" hint="أجهزة الزوار، ومن اشترى لأول مرة ومن عاد">
      <div className="space-y-5">
        {dev ? (
          <div className="grid grid-cols-2 gap-3">
            <Share icon={Smartphone} label="موبايل" n={r.devices.mobile} total={dev} />
            <Share icon={Monitor} label="كمبيوتر" n={r.devices.desktop} total={dev} />
          </div>
        ) : (
          <Empty>لا زيارات بعد.</Empty>
        )}
        {buyers ? (
          <div>
            <p className="mb-2 text-[12px] font-bold text-ink-2">المشترون في الفترة: {arCount(buyers, NOUN.customer)}</p>
            <div className="flex h-3 overflow-hidden rounded-full bg-edge/[0.07]" aria-hidden="true">
              <div className="bg-nova" style={{ width: `${(r.buyers.newBuyers / buyers) * 100}%` }} />
              <div className="bg-ok" style={{ width: `${(r.buyers.returning / buyers) * 100}%` }} />
            </div>
            <div className="mt-2 flex flex-wrap justify-between gap-2 text-[12px]">
              <span className="text-ink-2">
                <span className="me-1 inline-block size-2 rounded-full bg-nova" aria-hidden="true" />
                جدد: <b className="text-ink">{fmtNum(r.buyers.newBuyers)}</b>
              </span>
              <span className="text-ink-2">
                <span className="me-1 inline-block size-2 rounded-full bg-ok" aria-hidden="true" />
                عادوا للشراء: <b className="text-ink">{fmtNum(r.buyers.returning)}</b>
              </span>
            </div>
          </div>
        ) : (
          <Empty>لا مشترين في هذه الفترة بعد.</Empty>
        )}
      </div>
    </Card>
  );
}

function Share({ icon: Icon, label, n, total }: { icon: typeof Smartphone; label: string; n: number; total: number }) {
  return (
    <div className="rounded-xl bg-edge/[0.03] p-3">
      <p className="flex items-center gap-1.5 text-[12px] font-bold text-ink-2">
        <Icon className="size-4 text-ink-3" aria-hidden="true" />
        {label}
      </p>
      <p className="mt-1 text-[17px] font-black tabular-nums text-ink">{fmtNum(Math.round((n / total) * 100))}%</p>
      <p className="text-[11px] tabular-nums text-ink-3">{arCount(n, NOUN.visitor)}</p>
    </div>
  );
}

function TopProducts({ rows }: { rows: Report["products"] }) {
  const max = Math.max(0, ...rows.map((r) => r.sales));
  return (
    <Card title="الأكثر مبيعاً" hint="بقيمة المبيعات">
      {!rows.length ? (
        <Empty>لا مبيعات في هذه الفترة بعد.</Empty>
      ) : (
        <ol className="space-y-3">
          {rows.map((p, i) => (
            <li key={`${p.id}-${i}`} className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-2 text-[12.5px]">
                {p.id ? (
                  <Link href={`/dashboard/products/${p.id}`} className="min-w-0 truncate font-bold text-ink hover:text-nova-2">
                    {p.name}
                  </Link>
                ) : (
                  <span className="min-w-0 truncate font-bold text-ink">{p.name}</span>
                )}
                <span className="shrink-0 text-[11.5px] tabular-nums text-ink-3">
                  {arCount(p.qty, NOUN.piece)} · <b className="text-ink">{formatEgp(p.sales)}</b>
                </span>
              </div>
              <Bar value={p.sales} max={max} />
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

function Governorates({ rows }: { rows: Report["governorates"] }) {
  const max = Math.max(0, ...rows.map((r) => r.orders));
  const total = rows.reduce((a, r) => a + r.orders, 0);
  return (
    <Card title="المحافظات" hint="أين يسكن من يطلب منك">
      {!rows.length ? (
        <Empty>لا طلبات في هذه الفترة بعد.</Empty>
      ) : (
        <ul className="space-y-3">
          {rows.slice(0, 10).map((g) => (
            <li key={g.code} className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-2 text-[12.5px]">
                <span className="font-bold text-ink">{g.name}</span>
                <span className="text-[11.5px] tabular-nums text-ink-3">
                  {arCount(g.orders, NOUN.order)} ({fmtNum(Math.round((g.orders / total) * 100))}%) · <b className="text-ink">{formatEgp(g.sales)}</b>
                </span>
              </div>
              <Bar value={g.orders} max={max} tone="ok" />
            </li>
          ))}
          {rows.length > 10 ? <li className="text-[11.5px] text-ink-3">و{arCount(rows.length - 10, NOUN.governorate)} أخرى في ملف Excel</li> : null}
        </ul>
      )}
    </Card>
  );
}
