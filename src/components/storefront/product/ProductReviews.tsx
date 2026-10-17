"use client";

// تقييمات المنتج: ملخص (المتوسط والتوزيع من قاعدة البيانات كاملةً بـ GROUP BY) ثم المراجعات المعتمدة بصفحات «المزيد».
// صور التقييم تُفتح في العارض نفسه (ImageLightbox على <dialog>).
import { useState, useTransition } from "react";
import { Star, BadgeCheck, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { arCount, NOUN } from "@/lib/format";
import { moreReviewsAction } from "@/server/actions/product-page";
import { ImageLightbox } from "./ImageLightbox";

export type ReviewRow = {
  id: string;
  customerName: string | null;
  rating: number;
  body: string | null;
  imageUrls: string[] | null;
  isVerified: boolean;
  createdAt: string;
};
export type ReviewStatsView = { count: number; avg: number; dist: Record<number, number> };

const fmtDate = (iso: string) => new Intl.DateTimeFormat("ar-EG-u-nu-latn", { day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));

export function ProductReviews({ subdomain, productId, initial, stats }: { subdomain: string; productId: string; initial: ReviewRow[]; stats: ReviewStatsView }) {
  const [rows, setRows] = useState(initial);
  const [done, setDone] = useState(initial.length >= stats.count);
  const [pending, start] = useTransition();
  const [box, setBox] = useState<{ urls: string[]; i: number } | null>(null);
  if (!stats.count) return null;

  const max = Math.max(1, ...[5, 4, 3, 2, 1].map((n) => stats.dist[n] ?? 0));
  const more = () =>
    start(async () => {
      const next = await moreReviewsAction({ subdomain, productId, offset: rows.length });
      setRows((r) => [...r, ...next.filter((n) => !r.some((x) => x.id === n.id))]);
      if (next.length < 8) setDone(true);
    });

  return (
    <section className="mt-14 border-t pt-10" style={{ borderColor: "var(--border)" }} aria-labelledby="reviews-title">
      <h2 id="reviews-title" className="font-heading text-xl font-black">
        آراء العملاء
      </h2>
      <div className="mt-6 grid gap-8 md:grid-cols-[260px_1fr]">
        <div className="space-y-4 rounded-2xl border p-5 md:self-start" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
          <div className="flex items-end gap-2">
            <span className="font-heading text-5xl font-black leading-none tabular-nums">{stats.avg.toFixed(1)}</span>
            <span className="pb-1 text-sm opacity-60">من 5</span>
          </div>
          <Stars value={stats.avg} />
          <p className="text-xs opacity-70">بناءً على {arCount(stats.count, NOUN.review)}</p>
          <ul className="space-y-1.5">
            {[5, 4, 3, 2, 1].map((n) => (
              <li key={n} className="flex items-center gap-2 text-xs">
                <span className="w-3 font-bold">{n}</span>
                <Star className="size-3 fill-current" style={{ color: "var(--primary)" }} aria-hidden="true" />
                <span className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: "var(--muted)" }}>
                  <span className="block h-full rounded-full" style={{ width: `${((stats.dist[n] ?? 0) / max) * 100}%`, background: "var(--primary)" }} />
                </span>
                <span className="w-6 text-end tabular-nums opacity-60">{stats.dist[n] ?? 0}</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <ul className="space-y-4">
            {rows.map((r) => (
              <li key={r.id} className="rounded-2xl border p-5" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="grid size-9 place-items-center rounded-full text-sm font-black" style={{ background: "color-mix(in srgb, var(--primary) 14%, transparent)", color: "var(--primary)" }} aria-hidden="true">
                      {Array.from(r.customerName?.trim() || "ع")[0]}
                    </span>
                    <div>
                      <p className="text-sm font-bold">{r.customerName?.trim() || "عميل"}</p>
                      <p className="text-[12px] opacity-60">{fmtDate(r.createdAt)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {r.isVerified ? (
                      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-bold" style={{ background: "color-mix(in srgb, var(--success) 12%, transparent)", color: "var(--success)" }}>
                        <BadgeCheck className="size-3.5" aria-hidden="true" /> شراء مؤكد
                      </span>
                    ) : null}
                    <Stars value={r.rating} small />
                  </div>
                </div>
                {r.body ? <p className="mt-3 text-sm leading-7 opacity-85">{r.body}</p> : null}
                {r.imageUrls?.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {r.imageUrls.slice(0, 4).map((u, k) => (
                      <button key={u} type="button" onClick={() => setBox({ urls: r.imageUrls!.slice(0, 4), i: k })} className="overflow-hidden rounded-xl focus-visible:outline-none focus-visible:ring-2" aria-label={`فتح صورة التقييم ${k + 1}`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={u} alt="" loading="lazy" className="size-16 object-cover" />
                      </button>
                    ))}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
          {!done ? (
            <button type="button" onClick={more} disabled={pending} className="s-btn-ghost mt-5 h-11 w-full sm:w-auto sm:px-8">
              {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
              <span>المزيد من التقييمات</span>
            </button>
          ) : null}
        </div>
      </div>

      <ImageLightbox images={(box?.urls ?? []).map((url) => ({ url }))} index={box?.i ?? 0} open={!!box} onClose={() => setBox(null)} onIndex={(i) => setBox((b) => (b ? { ...b, i } : b))} label="صور التقييم" />
    </section>
  );
}

function Stars({ value, small }: { value: number; small?: boolean }) {
  return (
    <div className="flex" style={{ color: "var(--primary)" }} role="img" aria-label={`${value.toFixed(1)} من 5`}>
      {Array.from({ length: 5 }).map((_, k) => (
        <Star key={k} strokeWidth={1.75} className={cn(small ? "size-3.5" : "size-5", k < Math.round(value) ? "fill-current" : "opacity-25")} />
      ))}
    </div>
  );
}
