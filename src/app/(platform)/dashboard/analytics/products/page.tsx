// dashboard/analytics/products — تقرير المنتجات: المبيعات والوحدات والتكلفة والربح والهامش لكل منتج،
// والمبيعات بحسب القسم والقناة، ومعدل العملاء العائدين. بفترة جاهزة أو مخصصة، ويُصدَّر Excel ويُطبع.
import Link from "next/link";
import { redirect } from "next/navigation";
import { getMerchantSession } from "@/server/auth";
import { requireStoreArea } from "@/server/merchant-guard";
import { NO_STORE_HREF } from "@/lib/edition";
import { resolvePeriod } from "@/lib/reports";
import { channelsReport, productsReport, repeatReport } from "@/server/repos/reports";
import { formatEgp } from "@/lib/money";
import { fmtNum } from "@/lib/format";
import { PeriodBar, ReportCard, ShareBar, StatBox } from "@/components/dashboard/analytics/ReportParts";

export const dynamic = "force-dynamic";
export const metadata = { title: "تقرير المنتجات" };

export default async function ProductsReportPage({ searchParams }: { searchParams: Promise<{ period?: string; from?: string; to?: string }> }) {
  const session = await getMerchantSession();
  if (!session) redirect("/login?redirect=/dashboard/analytics/products");
  if (!session.store) redirect(NO_STORE_HREF);
  await requireStoreArea("analytics");
  const period = resolvePeriod(await searchParams);
  const id = session.store.id;
  const [rep, channels, repeat] = await Promise.all([productsReport(id, period), channelsReport(id, period), repeatReport(id, period)]);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header>
        <h1 className="text-xl font-black text-ink">تقرير المنتجات</h1>
        <p className="mt-1 text-[12.5px] text-ink-3">
          {period.label} ({period.fromKey} ← {period.toKey}). الطلبات المحققة فقط (بلا الملغاة والمرتجعة وطلبات التجربة). الربح = سعر البيع بعد الخصم − سعر التكلفة المسجل حالياً.
        </p>
      </header>
      <PeriodBar basePath="/dashboard/analytics/products" period={period} exportKind="profit" />

      <section aria-label="الملخص" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatBox label="المبيعات" value={formatEgp(rep.revenue)} />
        <StatBox label="القطع المباعة" value={fmtNum(rep.units)} />
        <StatBox label="الربح التقديري" value={rep.profit === null ? "—" : formatEgp(rep.profit)} note={rep.profit === null ? (rep.rows.length ? `سعر التكلفة مسجل لـ ${fmtNum(rep.costCoveragePct)}% من المنتجات المباعة` : undefined) : undefined} />
        <StatBox label="عملاء عادوا للشراء" value={repeat.repeatPct === null ? "—" : `${fmtNum(repeat.repeatPct)}%`} note={repeat.customers ? `${fmtNum(repeat.repeaters)} من ${fmtNum(repeat.customers)} عميل · متوسط ${repeat.avgValuePiasters ? formatEgp(repeat.avgValuePiasters) : "—"} للعميل` : "لا عملاء بعد"} />
      </section>

      <ReportCard title="ربحية كل منتج" hint="مرتبة بالمبيعات. المنتج بلا سعر تكلفة يظهر ربحه «—»؛ سجّلوا التكلفة من صفحة المنتج.">
        {!rep.rows.length ? (
          <p className="py-6 text-center text-[12px] text-ink-3">لا مبيعات في هذه الفترة.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-start text-[12.5px]">
              <thead className="text-[11px] text-ink-3">
                <tr>
                  <th className="py-2 text-start font-bold">المنتج</th>
                  <th className="py-2 text-start font-bold">الوحدات</th>
                  <th className="py-2 text-start font-bold">المبيعات</th>
                  <th className="py-2 text-start font-bold">الربح</th>
                  <th className="py-2 text-start font-bold">الهامش</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-edge/[0.06]">
                {rep.rows.map((r) => (
                  <tr key={r.key}>
                    <td className="max-w-[16rem] truncate py-2.5 font-bold text-ink">{r.key.startsWith("n:") ? r.name : <Link href={`/dashboard/products/${r.key}`} className="hover:text-nova-2">{r.name}</Link>}</td>
                    <td className="py-2.5 tabular-nums">{fmtNum(r.qty)}</td>
                    <td className="py-2.5 tabular-nums">{formatEgp(r.revenuePiasters)}</td>
                    <td className="py-2.5 tabular-nums">{r.profitPiasters === null ? "—" : formatEgp(r.profitPiasters)}</td>
                    <td className="py-2.5 tabular-nums">{r.marginPct === null ? "—" : `${fmtNum(r.marginPct)}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ReportCard>

      <div className="grid gap-5 lg:grid-cols-2">
        <ReportCard title="المبيعات بحسب القسم">
          <Slices rows={rep.categories.map((c) => ({ ...c }))} empty="لا مبيعات في هذه الفترة." />
        </ReportCard>
        <ReportCard title="المبيعات بحسب القناة" hint="من أين جاء الطلب: واجهة المتجر، حملة إعلانية، أو طلب سجلتموه من الشات.">
          <Slices rows={channels} empty="لا طلبات في هذه الفترة." />
        </ReportCard>
      </div>
    </div>
  );
}

function Slices({ rows, empty }: { rows: { key: string; label: string; revenuePiasters: number; orders: number; sharePct: number }[]; empty: string }) {
  if (!rows.length) return <p className="py-6 text-center text-[12px] text-ink-3">{empty}</p>;
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.key} className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-2 text-[12.5px]">
            <span className="min-w-0 truncate font-bold text-ink">{r.label}</span>
            <span className="shrink-0 text-[11.5px] tabular-nums text-ink-3">
              {fmtNum(r.sharePct)}% · <b className="text-ink">{formatEgp(r.revenuePiasters)}</b>
            </span>
          </div>
          <ShareBar pct={r.sharePct} />
        </li>
      ))}
    </ul>
  );
}
