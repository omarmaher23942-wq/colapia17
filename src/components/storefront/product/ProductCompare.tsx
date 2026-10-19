"use client";

// ProductCompare — مقارنة المنتج الحالي بمنتج آخر من القسم نفسه (S4)، من السمات الحقيقية فقط (specs.ts):
// اختيار المنتج من قائمة بصوره، ثم جدول جنباً إلى جنب يميّز المختلف، والسعر الحالي لكل منهما.
import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRightLeft, ShoppingBag } from "lucide-react";
import { SheetDialog } from "../SheetDialog";
import { formatEgp } from "@/lib/money";
import { compareRows, type SpecInput } from "./specs";
import { cn } from "@/lib/utils";

export type CompareItem = SpecInput & { slug: string; name: string; pricePiasters: number; image: string | null };

export function ProductCompare({ current, candidates }: { current: CompareItem; candidates: CompareItem[] }) {
  const [open, setOpen] = useState(false);
  const [other, setOther] = useState<CompareItem | null>(null);
  const rows = useMemo(() => (other ? compareRows(current, other) : []), [current, other]);
  if (!candidates.length) return null;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="s-btn-ghost mt-4 w-full sm:w-auto">
        <ArrowRightLeft className="size-4" aria-hidden="true" />
        مقارنة بمنتج آخر
      </button>
      <SheetDialog open={open} onClose={() => setOpen(false)} title={other ? "المقارنة" : "اختيار منتج للمقارنة"}>
        {!other ? (
          <ul className="grid grid-cols-2 gap-3">
            {candidates.map((c) => (
              <li key={c.slug}>
                <button type="button" onClick={() => setOther(c)} className="block w-full rounded-2xl border p-2 text-start transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
                  <span className="relative block aspect-square overflow-hidden rounded-xl" style={{ background: "var(--muted)" }}>
                    {c.image ? <Image src={c.image} alt="" fill sizes="160px" className="object-cover" /> : <ShoppingBag className="m-auto mt-[35%] size-8 opacity-30" aria-hidden="true" />}
                  </span>
                  <span className="mt-2 line-clamp-2 block text-[13px] font-bold">{c.name}</span>
                  <span className="block text-[12px] font-black tabular-nums opacity-80">{formatEgp(c.pricePiasters)}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {[current, other].map((x) => (
                <div key={x.slug} className="min-w-0">
                  <span className="relative block aspect-square overflow-hidden rounded-xl" style={{ background: "var(--muted)" }}>
                    {x.image ? <Image src={x.image} alt="" fill sizes="160px" className="object-cover" /> : null}
                  </span>
                  <Link href={`/p/${encodeURIComponent(x.slug)}`} className="mt-2 line-clamp-2 block text-[13px] font-bold hover:underline" onClick={() => setOpen(false)}>
                    {x.name}
                  </Link>
                  <p className="text-[13px] font-black tabular-nums">{formatEgp(x.pricePiasters)}</p>
                </div>
              ))}
            </div>
            {rows.length ? (
              <table className="w-full border-separate border-spacing-0 overflow-hidden rounded-xl border text-[13px]" style={{ borderColor: "var(--border)" }}>
                <caption className="sr-only">مقارنة السمات</caption>
                <thead>
                  <tr>
                    <th scope="col" className="sr-only">السمة</th>
                    <th scope="col" className="sr-only">{current.name}</th>
                    <th scope="col" className="sr-only">{other.name}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.label} className={cn(r.differs && "font-bold")} style={r.differs ? { background: "color-mix(in srgb, var(--primary) 7%, transparent)" } : undefined}>
                      <th scope="row" className="w-[30%] border-b px-3 py-2 text-start align-top font-bold opacity-75" style={{ borderColor: "var(--border)" }}>
                        {r.label}
                      </th>
                      <td className="border-b px-3 py-2 align-top" style={{ borderColor: "var(--border)" }}>{r.a}</td>
                      <td className="border-b px-3 py-2 align-top" style={{ borderColor: "var(--border)" }}>{r.b}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-[13px] opacity-75">لم يكتب المتجر سمات لهذين المنتجين بعد؛ قارنوا بالسعر والصور.</p>
            )}
            <button type="button" onClick={() => setOther(null)} className="s-btn-ghost w-full">
              اختيار منتج آخر
            </button>
          </div>
        )}
      </SheetDialog>
    </>
  );
}
