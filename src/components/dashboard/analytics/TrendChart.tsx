"use client";

// TrendChart — منحنى يومي (بتوقيت القاهرة) بمؤشر يختاره التاجر: المبيعات أو الطلبات أو الزيارات. ألوانه من توكنات
// اللوحة (تعمل في الثيمين الفاتح والداكن)، والتواريخ والأرقام بالعربية.
import { useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { cn } from "@/lib/utils";
import { fmtNum } from "@/lib/format";
import { formatEgp } from "@/lib/money";

type Point = { day: string; sales: number; orders: number; visits: number };
type Metric = "sales" | "orders" | "visits";
const METRICS: { key: Metric; label: string }[] = [
  { key: "sales", label: "المبيعات" },
  { key: "orders", label: "الطلبات" },
  { key: "visits", label: "الزيارات" },
];

const dayLabel = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString("ar-EG-u-nu-latn", { day: "numeric", month: "short", timeZone: "UTC" });
const short = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 100) / 10}k` : String(Math.round(n)));

export function TrendChart({ data }: { data: Point[] }) {
  const [metric, setMetric] = useState<Metric>("sales");
  const rows = data.map((d) => ({ label: dayLabel(d.day), value: metric === "sales" ? d.sales / 100 : d[metric], raw: d }));
  const empty = rows.every((r) => r.value === 0);

  return (
    <div>
      <div role="tablist" aria-label="المؤشر" className="mb-3 inline-flex rounded-xl border border-edge/10 bg-edge/[0.03] p-1">
        {METRICS.map((m) => (
          <button
            key={m.key}
            type="button"
            role="tab"
            aria-selected={metric === m.key}
            onClick={() => setMetric(m.key)}
            className={cn("min-h-9 rounded-lg px-3 text-[12px] font-bold transition-colors", metric === m.key ? "bg-nova text-white shadow-sm" : "text-ink-3 hover:bg-edge/5 hover:text-ink")}
          >
            {m.label}
          </button>
        ))}
      </div>
      <div className="relative h-64 w-full text-ink-3" dir="ltr">
        {empty ? <p className="absolute inset-0 z-10 grid place-items-center text-[12.5px] font-bold text-ink-3">لا شيء في هذه الفترة بعد</p> : null}
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--dash-nova)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="var(--dash-nova)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="currentColor" strokeOpacity={0.12} strokeDasharray="3 3" />
            <XAxis dataKey="label" tick={{ fill: "currentColor", fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={24} reversed />
            <YAxis orientation="right" tick={{ fill: "currentColor", fontSize: 11 }} tickLine={false} axisLine={false} width={44} tickFormatter={short} allowDecimals={false} />
            <Tooltip
              cursor={{ stroke: "currentColor", strokeOpacity: 0.25 }}
              content={({ active, payload }) => {
                const p = active ? (payload?.[0]?.payload as (typeof rows)[number] | undefined) : undefined;
                if (!p) return null;
                return (
                  <div dir="rtl" className="rounded-xl border border-edge/15 bg-space-2 px-3 py-2 text-[12px] text-ink shadow-xl">
                    <p className="mb-1 font-black">{p.label}</p>
                    <p>المبيعات: <b>{formatEgp(p.raw.sales)}</b></p>
                    <p>الطلبات: <b>{fmtNum(p.raw.orders)}</b></p>
                    <p>الزيارات: <b>{fmtNum(p.raw.visits)}</b></p>
                  </div>
                );
              }}
            />
            <Area type="monotone" dataKey="value" stroke="var(--dash-nova)" strokeWidth={2.25} fill="url(#trendFill)" isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
