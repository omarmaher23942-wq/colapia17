"use client";

import { Server, CheckCircle2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

const SW = 1.75;

export function ProviderCostComparison({ providers }: { providers: any[] }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-[#0b0f2a] p-5 shadow-2xl">
      <header className="mb-4 flex items-center gap-2 border-b border-white/10 pb-3">
        <Server className="size-4.5 text-[#8fa8ff]" strokeWidth={SW} />
        <h2 className="text-sm font-black text-white">
          أداء وتكلفة مزودي الذكاء الاصطناعي
        </h2>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full text-xs text-start">
          <thead className="border-b border-white/5 text-slate-400">
            <tr>
              <th className="py-3 px-2 text-start font-bold">
                المزود (Provider)
              </th>
              <th className="py-3 px-2 text-start font-bold">الاستدعاءات</th>
              <th className="py-3 px-2 text-start font-bold">التوكنز (M)</th>
              <th className="py-3 px-2 text-start font-bold">p95 Latency</th>
              <th className="py-3 px-2 text-start font-bold">الأخطاء</th>
              <th className="py-3 px-2 text-start font-bold">التكلفة ($)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {providers.map((p) => (
              <tr
                key={p.k}
                className="hover:bg-white/[0.02] transition-colors"
              >
                <td className="py-3 px-2 font-black text-white flex items-center gap-2">
                  <span
                    className={cn(
                      "size-2 rounded-full",
                      p.k === "groq"
                        ? "bg-orange-500"
                        : p.k === "google"
                        ? "bg-blue-500"
                        : "bg-purple-500"
                    )}
                  />
                  {p.k.toUpperCase()}
                </td>
                <td className="py-3 px-2 font-mono text-slate-300">
                  {p.calls.toLocaleString()}
                </td>
                <td className="py-3 px-2 font-mono text-slate-300">
                  {((p.tin + p.tout) / 1000000).toFixed(2)}
                </td>
                <td className="py-3 px-2 font-mono text-slate-300">
                  {(p.p95 / 1000).toFixed(1)}s
                </td>
                <td className="py-3 px-2">
                  {p.errs > 0 ? (
                    <span className="inline-flex items-center gap-1 rounded-md bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold text-rose-300">
                      <AlertTriangle className="size-3" /> {p.errs}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-emerald-400 text-[10px] font-bold">
                      <CheckCircle2 className="size-3" /> 0
                    </span>
                  )}
                </td>
                <td className="py-3 px-2 font-mono font-black text-emerald-400">
                  ${p.usd.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}