// ReportParts.tsx — أجزاء مشتركة لصفحات التقارير: شريط الفترة (جاهزة + مخصصة)، بطاقة، شريط نسبة، وزر طباعة.
import Link from "next/link";
import { Download } from "lucide-react";
import { PERIOD_LABEL, type Period } from "@/lib/reports";
import { cn } from "@/lib/utils";
import { PrintReportButton } from "./PrintReportButton";

const PRESETS = ["today", "7", "30", "month", "last_month"] as const;

export function PeriodBar({ basePath, period, exportKind }: { basePath: string; period: Period; exportKind?: string }) {
  const qs = exportKind ? `?period=${period.preset}${period.preset === "custom" ? `&from=${period.fromKey}&to=${period.toKey}` : ""}` : "";
  return (
    <div className="space-y-3 print:hidden">
      <div className="flex flex-wrap items-center gap-2">
        <nav aria-label="الفترة" className="inline-flex max-w-full overflow-x-auto rounded-xl border border-edge/10 bg-edge/[0.03] p-1">
          {PRESETS.map((p) => (
            <Link
              key={p}
              href={`${basePath}?period=${p}`}
              aria-current={p === period.preset ? "page" : undefined}
              className={cn("inline-flex min-h-9 shrink-0 items-center rounded-lg px-3 text-[12px] font-bold transition-colors", p === period.preset ? "bg-nova text-white shadow-sm" : "text-ink-3 hover:bg-edge/5 hover:text-ink")}
            >
              {PERIOD_LABEL[p]}
            </Link>
          ))}
        </nav>
        {exportKind ? (
          <a href={`/api/dashboard/export/${exportKind}${qs}`} download className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-edge/10 px-3.5 text-[12px] font-bold text-ink-2 hover:bg-edge/[0.05] hover:text-ink">
            <Download className="size-4" aria-hidden="true" />
            Excel
          </a>
        ) : null}
        <PrintReportButton />
      </div>
      <form method="get" action={basePath} className="flex flex-wrap items-end gap-2 text-[12px]">
        <input type="hidden" name="period" value="custom" />
        <label className="grid gap-1 font-bold text-ink-3">
          من
          <input type="date" name="from" defaultValue={period.fromKey} required className="min-h-10 rounded-lg border border-edge/10 bg-transparent px-2 text-ink" />
        </label>
        <label className="grid gap-1 font-bold text-ink-3">
          إلى
          <input type="date" name="to" defaultValue={period.toKey} required className="min-h-10 rounded-lg border border-edge/10 bg-transparent px-2 text-ink" />
        </label>
        <button type="submit" className="min-h-10 rounded-lg border border-edge/10 px-3 font-bold text-ink-2 hover:bg-edge/[0.05]">
          عرض الفترة
        </button>
      </form>
    </div>
  );
}

export function ReportCard({ title, hint, children, className }: { title: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("dash-card p-4 sm:p-5", className)}>
      <h2 className="text-[14px] font-black text-ink">{title}</h2>
      {hint ? <p className="mt-0.5 text-[11.5px] leading-5 text-ink-3">{hint}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function StatBox({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-edge/[0.03] p-3">
      <p className="text-[11.5px] font-bold text-ink-3">{label}</p>
      <p className="mt-1 truncate text-[17px] font-black tabular-nums text-ink">{value}</p>
      {note ? <p className="mt-0.5 text-[11px] text-ink-3">{note}</p> : null}
    </div>
  );
}

export function ShareBar({ pct }: { pct: number }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-edge/[0.07]" aria-hidden="true">
      <div className="h-full rounded-full bg-nova" style={{ width: `${Math.max(2, pct)}%` }} />
    </div>
  );
}
