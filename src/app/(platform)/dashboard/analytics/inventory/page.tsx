// dashboard/analytics/inventory — تقرير المخزون: كم تساوي بضاعتكم (بالبيع وبالتكلفة)، وأيام التغطية من معدل البيع،
// والمنتجات الراكدة (بلا بيع منذ 60 يوماً). المنتج بلا تتبع مخزون أو بلا كمية لا يدخل القيمة.
import Link from "next/link";
import { redirect } from "next/navigation";
import { getMerchantSession } from "@/server/auth";
import { requireStoreArea } from "@/server/merchant-guard";
import { NO_STORE_HREF } from "@/lib/edition";
import { DEAD_STOCK_DAYS, resolvePeriod } from "@/lib/reports";
import { inventoryReportData } from "@/server/repos/reports";
import { formatEgp } from "@/lib/money";
import { fmtNum } from "@/lib/format";
import { PeriodBar, ReportCard, StatBox } from "@/components/dashboard/analytics/ReportParts";

export const dynamic = "force-dynamic";
export const metadata = { title: "تقرير المخزون" };

export default async function InventoryReportPage({ searchParams }: { searchParams: Promise<{ period?: string; from?: string; to?: string }> }) {
  const session = await getMerchantSession();
  if (!session) redirect("/login?redirect=/dashboard/analytics/inventory");
  if (!session.store) redirect(NO_STORE_HREF);
  await requireStoreArea("analytics");
  const period = resolvePeriod(await searchParams);
  const days = Math.max(1, Math.round((period.to.getTime() - period.from.getTime()) / 86_400_000));
  const inv = await inventoryReportData(session.store.id, days);
  const dead = inv.lines.filter((l) => l.dead);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header>
        <h1 className="text-xl font-black text-ink">تقرير المخزون</h1>
        <p className="mt-1 text-[12.5px] text-ink-3">أيام التغطية تُحسب من مبيعات {period.label}. الراكد: بلا أي بيع منذ {DEAD_STOCK_DAYS} يوماً أو أكثر.</p>
      </header>
      <PeriodBar basePath="/dashboard/analytics/inventory" period={period} exportKind="inventory" />

      <section aria-label="الملخص" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatBox label="القطع في المخزون" value={fmtNum(inv.units)} />
        <StatBox label="قيمتها بسعر البيع" value={formatEgp(inv.retailValue)} />
        <StatBox label="قيمتها بالتكلفة" value={inv.costValue === null ? "—" : formatEgp(inv.costValue)} note={inv.costValue === null ? `التكلفة مسجلة لـ ${fmtNum(inv.costKnownPct)}% فقط من المنتجات` : undefined} />
        <StatBox label="مخزون راكد" value={fmtNum(inv.deadCount)} note={inv.deadCount ? `يجمّد ${formatEgp(inv.deadValue)} بسعر البيع` : "لا شيء راكد"} />
      </section>

      {dead.length ? (
        <ReportCard title="مخزون راكد" hint="فكروا بخصم أو عرض أو دمجه في طقم ليتحرك رأس المال.">
          <ul className="divide-y divide-edge/[0.06] text-[12.5px]">
            {dead.slice(0, 12).map((l) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <Link href={`/dashboard/products/${l.id}`} className="min-w-0 truncate font-bold text-ink hover:text-nova-2">{l.name}</Link>
                <span className="text-[11.5px] tabular-nums text-ink-3">{fmtNum(l.stock ?? 0)} قطعة · {formatEgp(l.retailValue)}</span>
              </li>
            ))}
          </ul>
        </ReportCard>
      ) : null}

      <ReportCard title="كل المنتجات بمخزون">
        {!inv.lines.length ? (
          <p className="py-6 text-center text-[12px] text-ink-3">لا منتجات بكمية في المخزون.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-start text-[12.5px]">
              <thead className="text-[11px] text-ink-3">
                <tr>
                  <th className="py-2 text-start font-bold">المنتج</th>
                  <th className="py-2 text-start font-bold">الكمية</th>
                  <th className="py-2 text-start font-bold">القيمة</th>
                  <th className="py-2 text-start font-bold">تكفي</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-edge/[0.06]">
                {inv.lines.map((l) => (
                  <tr key={l.id}>
                    <td className="max-w-[16rem] truncate py-2.5 font-bold text-ink"><Link href={`/dashboard/products/${l.id}`} className="hover:text-nova-2">{l.name}</Link></td>
                    <td className="py-2.5 tabular-nums">{fmtNum(l.stock ?? 0)}</td>
                    <td className="py-2.5 tabular-nums">{formatEgp(l.retailValue)}</td>
                    <td className="py-2.5 tabular-nums">{l.daysCover === null ? "لا مبيعات" : `${fmtNum(l.daysCover)} يوماً`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ReportCard>
    </div>
  );
}
