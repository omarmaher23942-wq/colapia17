"use client";

// SizeGuide.tsx — «دليل المقاسات» في صفحة المنتج: جدول التاجر كما كتبه، ومساعد يقترح المقاس من الطول والوزن (إن كان
// الجدول يحمل مداهما)، وزر يختار المقاس المقترح مباشرة إن كان متاحاً. القياسات تُحفظ على جهاز العميل لهذا المتجر فقط.
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Ruler, X } from "lucide-react";
import { canRecommend, recommendSize, type Fit, type SizeChart } from "@/lib/size-guide";
import { cn } from "@/lib/utils";

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
  const btnRef = useRef<HTMLButtonElement>(null);
  const [host, setHost] = useState<Element | null>(null);
  useEffect(() => setHost(btnRef.current?.closest(".storefront") ?? document.body), []);
  return (
    <>
      <button ref={btnRef} type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1 text-xs font-bold underline underline-offset-4 opacity-80 hover:opacity-100">
        <Ruler className="size-3.5" aria-hidden="true" /> دليل المقاسات
      </button>
      {open && host ? createPortal(<Sheet chart={chart} storeKey={`clp:size:${storeId}`} isAvailable={isAvailable} onPick={(s) => (onPick(s), setOpen(false))} onClose={() => setOpen(false)} />, host) : null}
    </>
  );
}

function Sheet({ chart, storeKey, isAvailable, onPick, onClose }: { chart: SizeChart; storeKey: string; isAvailable: (s: string) => boolean; onPick: (s: string) => void; onClose: () => void }) {
  const [m, setM] = useState<Saved>({});
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setM(load(storeKey));
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [storeKey, onClose]);
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
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label="دليل المقاسات"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl p-5 outline-none sm:max-w-lg sm:rounded-3xl"
        style={{ background: "var(--card)", color: "var(--foreground)" }}
        dir="rtl"
      >
        <div className="flex items-start justify-between gap-3">
          <p className="flex items-center gap-2 font-heading text-lg font-black">
            <Ruler className="size-5" style={{ color: "var(--primary)" }} aria-hidden="true" /> {chart.name}
          </p>
          <button type="button" onClick={onClose} className="grid size-9 place-items-center rounded-xl opacity-60 hover:opacity-100" aria-label="إغلاق">
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        {helper ? (
          <section className="mt-4 space-y-3 rounded-2xl border p-4" style={{ borderColor: "var(--border)" }} aria-label="اقتراح المقاس">
            <p className="text-sm font-black">نقترح لك المقاس</p>
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
                  {!rec.exact && rec.alternative ? <span className="block text-xs opacity-75">بين مقاسين؛ {rec.alternative} لو تفضّل لبساً {idx(rec.alternative) > idx(rec.size) ? "أوسع" : "أضيق"}.</span> : null}
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
    </div>
  );
}
