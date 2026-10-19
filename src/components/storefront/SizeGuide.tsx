"use client";

// SizeGuide.tsx — «دليل المقاسات» في صفحة المنتج: جدول التاجر كما كتبه، ومساعد يقترح المقاس من الطول والوزن (إن كان
// الجدول يحمل مداهما)، وزر يختار المقاس المقترح مباشرة إن كان متاحاً. القياسات تُحفظ على جهاز العميل لهذا المتجر فقط.
import { useEffect, useMemo, useState } from "react";
import { Ruler } from "lucide-react";
import { canRecommend, recommendSize, type Fit, type SizeChart } from "@/lib/size-guide";
import { cn } from "@/lib/utils";
import { SheetDialog } from "./SheetDialog";

const FITS: { v: Fit; label: string }[] = [
  { v: "tight", label: "ضيق" },
  { v: "regular", label: "مظبوط" },
  { v: "loose", label: "واسع" },
];

type Saved = { height?: number; weight?: number; fit?: Fit };
const load = (key: string): Saved => {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "{}") as Saved;
  } catch {
    return {};
  }
};

export function SizeGuideButton({ chart, storeId, isAvailable, onPick }: { chart: SizeChart; storeId: string; isAvailable: (size: string) => boolean; onPick: (size: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex min-h-11 items-center gap-1 text-xs font-bold underline underline-offset-4 opacity-80 hover:opacity-100">
        <Ruler className="size-3.5" aria-hidden="true" /> دليل المقاسات
      </button>
      <SheetDialog open={open} onClose={() => setOpen(false)} title={chart.name || "دليل المقاسات"} side="bottom">
        <Sheet chart={chart} storeKey={`clp:size:${storeId}`} isAvailable={isAvailable} onPick={(s) => (onPick(s), setOpen(false))} />
      </SheetDialog>
    </>
  );
}

function Sheet({ chart, storeKey, isAvailable, onPick }: { chart: SizeChart; storeKey: string; isAvailable: (s: string) => boolean; onPick: (s: string) => void }) {
  const [m, setM] = useState<Saved>({});
  useEffect(() => setM(load(storeKey)), [storeKey]);
  const update = (patch: Saved) =>
    setM((cur) => {
      const next = { ...cur, ...patch };
      try {
        localStorage.setItem(storeKey, JSON.stringify(next));
      } catch {}
      return next;
    });
  const helper = canRecommend(chart);
  const idx = (size: string) => chart.rows.findIndex((r) => r.size === size);
  const rec = useMemo(() => (helper ? recommendSize(chart, m) : null), [chart, m, helper]);

  return (
    <div>
        {helper ? (
          <section className="mt-4 space-y-3 rounded-2xl border p-4" style={{ borderColor: "var(--border)" }} aria-label="اقتراح المقاس">
            <p className="text-sm font-black">اقتراح المقاس المناسب</p>
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1 text-xs font-bold">
                الطول (سم)
                <input type="number" inputMode="numeric" min={100} max={230} value={m.height ?? ""} onChange={(e) => update({ height: e.target.value ? Number(e.target.value) : undefined })} className="s-input h-11 w-full rounded-xl border px-3 text-sm" style={{ borderColor: "var(--border)", background: "var(--background)" }} placeholder="170" />
              </label>
              <label className="space-y-1 text-xs font-bold">
                الوزن (كجم)
                <input type="number" inputMode="numeric" min={20} max={250} value={m.weight ?? ""} onChange={(e) => update({ weight: e.target.value ? Number(e.target.value) : undefined })} className="s-input h-11 w-full rounded-xl border px-3 text-sm" style={{ borderColor: "var(--border)", background: "var(--background)" }} placeholder="70" />
              </label>
            </div>
            <div className="flex gap-2" role="radiogroup" aria-label="طريقة اللبس المفضلة">
              {FITS.map((f) => (
                <button key={f.v} type="button" role="radio" aria-checked={(m.fit ?? "regular") === f.v} onClick={() => update({ fit: f.v })} className={cn("s-chip h-10 flex-1 border-2 text-xs font-bold", (m.fit ?? "regular") === f.v ? "border-[var(--primary)] text-[var(--primary)]" : "border-[var(--border)]")}>
                  {f.label}
                </button>
              ))}
            </div>
            {rec ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl p-3" style={{ background: "color-mix(in oklab, var(--primary) 10%, transparent)" }} aria-live="polite">
                <p className="text-sm">
                  المقاس المناسب: <b className="text-lg" style={{ color: "var(--primary)" }}>{rec.size}</b>
                  {!rec.exact && rec.alternative ? <span className="block text-xs opacity-75">بين مقاسين؛ {rec.alternative} عند تفضيل لبس {idx(rec.alternative) > idx(rec.size) ? "أوسع" : "أضيق"}.</span> : null}
                </p>
                {isAvailable(rec.size) ? (
                  <button type="button" onClick={() => onPick(rec.size)} className="s-btn h-10 px-4 text-sm">اختيار {rec.size}</button>
                ) : (
                  <span className="text-xs font-bold opacity-70">{rec.size} غير متاح حالياً</span>
                )}
              </div>
            ) : m.height || m.weight ? (
              <p className="text-xs opacity-70">لا تكفي بيانات الجدول لاقتراح دقيق؛ الجدول تحت يساعدك.</p>
            ) : null}
          </section>
        ) : null}

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[280px] text-center text-sm">
            <thead>
              <tr className="text-xs opacity-70">
                <th className="whitespace-nowrap p-2 font-bold">المقاس</th>
                {chart.columns.map((c) => (
                  <th key={c} className="p-2 font-bold">{c} ({chart.unit})</th>
                ))}
                {helper ? <th className="p-2 font-bold">الطول / الوزن</th> : null}
              </tr>
            </thead>
            <tbody>
              {chart.rows.map((r) => (
                <tr key={r.size} className={cn("border-t", rec?.size === r.size && "font-black")} style={{ borderColor: "var(--border)", ...(rec?.size === r.size ? { color: "var(--primary)" } : {}) }}>
                  <td className="p-2 font-bold">{r.size}</td>
                  {chart.columns.map((_, i) => (
                    <td key={i} className="p-2 tabular-nums">{r.cells[i] || "—"}</td>
                  ))}
                  {helper ? (
                    <td className="p-2 text-xs tabular-nums opacity-80" dir="ltr">
                      {r.heightFrom != null && r.heightTo != null ? `${r.heightFrom}–${r.heightTo}cm` : ""}
                      {r.weightFrom != null && r.weightTo != null ? ` · ${r.weightFrom}–${r.weightTo}kg` : ""}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {chart.note ? <p className="mt-3 text-xs opacity-70">{chart.note}</p> : null}
    </div>
  );
}
