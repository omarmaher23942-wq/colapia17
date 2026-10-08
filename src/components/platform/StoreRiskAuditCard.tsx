"use client";

import { useEffect, useState, useTransition } from "react";
import { AlertTriangle, ShieldCheck, Activity, MessageCircle, Loader2, RefreshCw } from "lucide-react";
import { motion } from "motion/react";
import { calculateStoreRiskAction } from "@/server/actions/platform-stores-governance";
import { cn } from "@/lib/utils";

const SW = 1.75;

type RiskData = {
  riskScore: number;
  factors: string[];
  recommendations: string[];
  merchantPhone?: string | null;
};

export function StoreRiskAuditCard({ storeId }: { storeId: string }) {
  const [data, setData] = useState<RiskData | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, start] = useTransition();

  const fetchRisk = () => {
    start(async () => {
      setLoading(true);
      const res = await calculateStoreRiskAction(storeId);
      if (res.ok && res.data) setData(res.data);
      setLoading(false);
    });
  };

  useEffect(() => {
    fetchRisk();
  }, [storeId]);

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center rounded-3xl border border-white/10 bg-[#0b0f2a] shadow-xl">
        <Loader2 className="size-6 animate-spin text-[#8fa8ff]" strokeWidth={SW} />
      </div>
    );
  }

  if (!data) return null;

  const isHighRisk = data.riskScore >= 60;
  const isMediumRisk = data.riskScore >= 30 && data.riskScore < 60;

  const colorClass = isHighRisk
    ? "text-rose-400"
    : isMediumRisk
    ? "text-amber-400"
    : "text-emerald-400";

  const bgClass = isHighRisk
    ? "bg-rose-500/10 border-rose-500/30"
    : isMediumRisk
    ? "bg-amber-500/10 border-amber-500/30"
    : "bg-emerald-500/10 border-emerald-500/30";

  return (
    <div className={cn("rounded-3xl border p-5 shadow-xl", bgClass)}>
      <header className="mb-4 flex items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <Activity className={cn("size-5", colorClass)} strokeWidth={SW} />
          <h2 className="text-sm font-black text-white">مؤشر مخاطر التوقف (Churn Risk)</h2>
        </div>
        <button onClick={fetchRisk} disabled={pending} className="text-slate-400 hover:text-white transition-colors">
          <RefreshCw className={cn("size-4", pending && "animate-spin")} strokeWidth={SW} />
        </button>
      </header>

      <div className="flex items-center gap-6">
        <div className="relative flex size-24 shrink-0 items-center justify-center">
          <svg className="size-full -rotate-90" viewBox="0 0 36 36">
            <path
              className="text-white/10"
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
            />
            <motion.path
              className={colorClass}
              strokeDasharray={`${data.riskScore}, 100`}
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              initial={{ strokeDasharray: "0, 100" }}
              animate={{ strokeDasharray: `${data.riskScore}, 100` }}
              transition={{ duration: 1, ease: "easeOut" }}
            />
          </svg>
          <div className="absolute flex flex-col items-center">
            <span className={cn("text-xl font-black font-mono", colorClass)}>{data.riskScore}%</span>
            <span className="text-[9px] text-slate-400 uppercase">Risk</span>
          </div>
        </div>

        <div className="flex-1 space-y-3">
          {data.factors.length > 0 ? (
            <ul className="space-y-1.5">
              {data.factors.map((f, i) => (
                <li key={i} className="flex items-start gap-1.5 text-xs text-slate-300">
                  <AlertTriangle className="size-3.5 shrink-0 text-amber-400 mt-0.5" strokeWidth={SW} />
                  {f}
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-emerald-300">
              <ShieldCheck className="size-4" strokeWidth={SW} />
              المتجر في حالة صحية ممتازة ولا توجد مخاطر.
            </div>
          )}
        </div>
      </div>

      {data.recommendations.length > 0 && (
        <div className="mt-4 border-t border-white/10 pt-4">
          <p className="mb-2 text-[11px] font-bold text-[#8fa8ff]">توصيات تشغيلية:</p>
          <ul className="mb-4 space-y-1 text-[11px] text-slate-300 list-disc list-inside">
            {data.recommendations.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
          
          {data.merchantPhone && (
            <a
              href={`https://wa.me/2${data.merchantPhone}?text=${encodeURIComponent("أهلاً بك يا بطل، لاحظنا إنك محتاج مساعدة في متجرك على كولابيا، إحنا معاك خطوة بخطوة، إيه الأخبار؟")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#25D366] px-4 py-2 text-xs font-black text-white shadow-md hover:brightness-110 transition-all"
            >
              <MessageCircle className="size-4" strokeWidth={SW} />
              مراسلة التاجر فوراً
            </a>
          )}
        </div>
      )}
    </div>
  );
}