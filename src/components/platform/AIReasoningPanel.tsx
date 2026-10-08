"use client";

import { Brain, Database, Activity, Target, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

const SW = 1.75;

type AIReasoningProps = {
  thinking?: string;
  stage?: string;
  leadScore?: number;
  extracted?: Record<string, unknown>;
  finalize?: unknown;
};

export function AIReasoningPanel({ meta }: { meta: AIReasoningProps }) {
  if (!meta) return null;

  const isEmptyExtracted = !meta.extracted || Object.keys(meta.extracted).length === 0;
  const hasFinalize = Boolean(meta.finalize);

  return (
    <div className="mt-2 overflow-hidden rounded-2xl border border-[#6f86ff]/20 bg-[#0b0f2a]/80 shadow-lg backdrop-blur-xl">
      <header className="flex items-center justify-between border-b border-white/10 bg-[#07091a]/50 px-3 py-2">
        <div className="flex items-center gap-2">
          <Brain className="size-4 text-[#8fa8ff]" strokeWidth={SW} />
          <span className="text-xs font-black text-[#eaf0ff]">تفكير المساعد الذكي</span>
        </div>
        <div className="flex items-center gap-1.5">
          {meta.stage && (
            <span className="inline-flex items-center gap-1 rounded-full border border-[#8fa8ff]/30 bg-[#6f86ff]/10 px-2 py-0.5 text-[10px] font-bold text-[#8fa8ff]">
              <Target className="size-3" strokeWidth={SW} />
              {meta.stage}
            </span>
          )}
          {typeof meta.leadScore === "number" && (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-300">
              <Activity className="size-3" strokeWidth={SW} />
              {meta.leadScore}
            </span>
          )}
          {hasFinalize && (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
              <CheckCircle2 className="size-3" strokeWidth={SW} />
              FINALIZE
            </span>
          )}
        </div>
      </header>

      <div className="p-3 space-y-3">
        {meta.thinking && (
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-[#8d97c4] uppercase tracking-wider">التحليل المنطقي</span>
            <p className="text-[11px] leading-relaxed text-[#c3cdf0] whitespace-pre-wrap">
              {meta.thinking}
            </p>
          </div>
        )}

        {!isEmptyExtracted && (
          <div className="space-y-1 border-t border-white/5 pt-2">
            <span className="flex items-center gap-1 text-[10px] font-bold text-[#8d97c4] uppercase tracking-wider">
              <Database className="size-3" strokeWidth={SW} />
              البيانات المستخرجة
            </span>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {Object.entries(meta.extracted as Record<string, unknown>).map(([k, v]) => (
                <div key={k} className="rounded-lg border border-white/5 bg-white/[0.02] p-2">
                  <span className="block text-[9px] text-[#8d97c4]">{k}</span>
                  <span className="block text-[11px] font-bold text-[#eaf0ff] truncate" title={String(v)}>
                    {String(v)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}