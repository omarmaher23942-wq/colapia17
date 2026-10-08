"use client";

import { DollarSign, Cpu, Clock, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

const SW = 1.75;

export function CostLiveCounter({
  totalUsd,
  totalTokens,
  p50,
  p95,
  errorRate,
}: any) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 shadow-lg">
        <div className="flex items-center gap-2 text-emerald-400 mb-2">
          <DollarSign className="size-4" strokeWidth={SW} />
          <span className="text-xs font-bold">التكلفة التقديرية</span>
        </div>
        <p className="text-2xl font-black font-mono text-emerald-300">
          ${totalUsd.toFixed(2)}
        </p>
        <p className="text-[10px] text-emerald-500/80 mt-1">
          ≈ {(totalUsd * 50).toFixed(0)} ج.م
        </p>
      </div>

      <div className="rounded-2xl border border-[#8fa8ff]/30 bg-[#6f86ff]/10 p-4 shadow-lg">
        <div className="flex items-center gap-2 text-[#8fa8ff] mb-2">
          <Cpu className="size-4" strokeWidth={SW} />
          <span className="text-xs font-bold">استهلاك التوكنز</span>
        </div>
        <p className="text-2xl font-black font-mono text-white">
          {(totalTokens / 1000000).toFixed(2)}M
        </p>
        <p className="text-[10px] text-[#8d97c4] mt-1">إجمالي الدخل والخرج</p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 shadow-lg">
        <div className="flex items-center gap-2 text-slate-400 mb-2">
          <Clock className="size-4" strokeWidth={SW} />
          <span className="text-xs font-bold">زمن الاستجابة (p50)</span>
        </div>
        <p className="text-2xl font-black font-mono text-white">
          {(p50 / 1000).toFixed(1)}s
        </p>
        <p className="text-[10px] text-slate-500 mt-1">المتوسط الطبيعي</p>
      </div>

      <div
        className={cn(
          "rounded-2xl border p-4 shadow-lg",
          p95 > 20000
            ? "border-amber-500/30 bg-amber-500/10"
            : "border-white/10 bg-white/[0.02]"
        )}
      >
        <div
          className={cn(
            "flex items-center gap-2 mb-2",
            p95 > 20000 ? "text-amber-400" : "text-slate-400"
          )}
        >
          <Activity className="size-4" strokeWidth={SW} />
          <span className="text-xs font-bold">زمن الاستجابة (p95)</span>
        </div>
        <p
          className={cn(
            "text-2xl font-black font-mono",
            p95 > 20000 ? "text-amber-300" : "text-white"
          )}
        >
          {(p95 / 1000).toFixed(1)}s
        </p>
        <p
          className={cn(
            "text-[10px] mt-1",
            p95 > 20000 ? "text-amber-500/80" : "text-slate-500"
          )}
        >
          الحد الأقصى للغالبية
        </p>
      </div>

      <div
        className={cn(
          "rounded-2xl border p-4 shadow-lg",
          errorRate > 5
            ? "border-rose-500/30 bg-rose-500/10"
            : "border-white/10 bg-white/[0.02]"
        )}
      >
        <div
          className={cn(
            "flex items-center gap-2 mb-2",
            errorRate > 5 ? "text-rose-400" : "text-slate-400"
          )}
        >
          <Activity className="size-4" strokeWidth={SW} />
          <span className="text-xs font-bold">معدل الأخطاء</span>
        </div>
        <p
          className={cn(
            "text-2xl font-black font-mono",
            errorRate > 5 ? "text-rose-300" : "text-white"
          )}
        >
          {errorRate.toFixed(1)}%
        </p>
        <p
          className={cn(
            "text-[10px] mt-1",
            errorRate > 5 ? "text-rose-500/80" : "text-slate-500"
          )}
        >
          نسبة الفشل والـ Fallback
        </p>
      </div>
    </div>
  );
}