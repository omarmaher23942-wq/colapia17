"use client";

// نموذج اقتراح المقاس: يقيس بُعد الطول والوزن عن مدى كل مقاس ويختار الأقرب (نفس منطق دليل المقاسات في النواة).
import { useMemo, useState } from "react";

type Row = { size: string; h: [number, number] | null; w: [number, number] | null };
type Fit = "tight" | "regular" | "loose";

const outside = (v: number, r: [number, number] | null) => (r == null ? null : v < r[0] ? r[0] - v : v > r[1] ? v - r[1] : 0);

function recommend(rows: Row[], height: number, weight: number, fit: Fit) {
  const scored = rows
    .map((r, i) => {
      const h = height ? outside(height, r.h) : null;
      const w = weight ? outside(weight, r.w) : null;
      if (h == null && w == null) return null;
      const bigger = (height && r.h && height > r.h[1]) || (weight && r.w && weight > r.w[1]);
      return { i, score: (h ?? 0) / 10 + (w ?? 0) / 6, exact: (h ?? 0) === 0 && (w ?? 0) === 0, bigger: Boolean(bigger) };
    })
    .filter((x): x is { i: number; score: number; exact: boolean; bigger: boolean } => x !== null);
  if (!scored.length) return null;
  const best = scored.reduce((a, b) => (b.score < a.score ? b : a));
  let i = best.i;
  if (fit === "loose" && i < rows.length - 1) i += 1;
  else if (fit === "tight" && !best.exact && i > 0) i -= 1;
  const other = best.exact ? null : rows[best.i + (best.bigger ? 1 : -1)]?.size ?? null;
  const size = rows[i]!.size;
  return { size, alt: other && other !== size ? other : null };
}

const FITS: { id: Fit; label: string }[] = [
  { id: "tight", label: "قريبة من الجسم" },
  { id: "regular", label: "عادية" },
  { id: "loose", label: "مريحة" },
];

export default function FitFinderForm({ rows }: { rows: Row[] }) {
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [fit, setFit] = useState<Fit>("regular");
  const result = useMemo(() => {
    const h = Number(height);
    const w = Number(weight);
    if (!(h >= 120 && h <= 220) && !(w >= 30 && w <= 200)) return null;
    return recommend(rows, h >= 120 && h <= 220 ? h : 0, w >= 30 && w <= 200 ? w : 0, fit);
  }, [rows, height, weight, fit]);
  return (
    <div className="dm-fit-card">
      <div className="dm-fit-grid">
        <label>
          الطول (سم)
          <input type="number" inputMode="numeric" min={120} max={220} placeholder="مثال: 165" value={height} onChange={(e) => setHeight(e.target.value)} />
        </label>
        <label>
          الوزن (كجم)
          <input type="number" inputMode="numeric" min={30} max={200} placeholder="مثال: 62" value={weight} onChange={(e) => setWeight(e.target.value)} />
        </label>
      </div>
      <div>
        <p className="mb-2 text-[13px] font-bold">القصّة المفضلة</p>
        <div className="dm-seg" role="group" aria-label="القصّة المفضلة">
          {FITS.map((f) => (
            <button key={f.id} type="button" aria-pressed={fit === f.id} onClick={() => setFit(f.id)}>
              {f.label}
            </button>
          ))}
        </div>
      </div>
      <div className="dm-result" aria-live="polite">
        {result ? (
          <>
            <span className="dm-size">{result.size}</span>
            <p className="text-sm">
              المقاس المقترح <b>{result.size}</b>
              {result.alt ? <>، وأنتم بين مقاسين فقد يناسب <b>{result.alt}</b> أيضاً.</> : "."}
            </p>
          </>
        ) : (
          <p className="text-sm opacity-70">أدخلوا الطول أو الوزن ليظهر الاقتراح.</p>
        )}
      </div>
    </div>
  );
}
