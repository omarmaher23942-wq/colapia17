"use client";

import { useEffect, useState } from "react";
import { Activity, Database, Zap, Brain, Server, RefreshCw, AlertTriangle, CheckCircle2 } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { checkSystemHealthAction } from "@/server/actions/platform-pipeline";
import { cn } from "@/lib/utils";

const SW = 1.75;

type HealthData = {
  db: { ok: boolean; latency: number };
  redis: { ok: boolean; latency: number };
  qstash: { ok: boolean; latency: number };
  ai: { ok: boolean; latency: number };
  totalLatency: number;
};

export function PlatformHealthScore() {
  const reduce = useReducedMotion();
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchHealth = async () => {
    const res = await checkSystemHealthAction();
    if (res.ok && res.data) setHealth(res.data);
    setLoading(false);
  };

  useEffect(() => {
    fetchHealth();
    const iv = setInterval(fetchHealth, 15000);
    return () => clearInterval(iv);
  }, []);

  const ServiceRow = ({ name, icon: Icon, data }: { name: string; icon: any; data?: { ok: boolean; latency: number } }) => {
    const isOk = data?.ok ?? false;
    return (
      <div className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] p-3">
        <div className="flex items-center gap-2.5">
          <span className={cn("grid size-8 place-items-center rounded-lg", isOk ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400")}>
            <Icon className="size-4" strokeWidth={SW} />
          </span>
          <span className="text-xs font-bold text-[#eaf0ff]">{name}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[10.5px] text-[#8d97c4]">{data?.latency ?? 0}ms</span>
          <span className="relative flex size-2.5">
            {isOk && !reduce && (
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            )}
            <span className={cn("relative inline-flex size-2.5 rounded-full", isOk ? "bg-emerald-400" : "bg-rose-500")} />
          </span>
        </div>
      </div>
    );
  };

  return (
    <section className="flex flex-col rounded-3xl border border-white/10 bg-[#0b0f2a] p-5 shadow-2xl">
      <header className="mb-4 flex items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <Activity className="size-4.5 text-[#8fa8ff]" strokeWidth={SW} />
          <h2 className="text-sm font-black text-white">نبض المنصة الحي</h2>
        </div>
        <button onClick={fetchHealth} disabled={loading} className="text-[#8d97c4] hover:text-white transition-colors disabled:opacity-50">
          <RefreshCw className={cn("size-3.5", loading && "animate-spin")} strokeWidth={SW} />
        </button>
      </header>

      <div className="flex-1 space-y-2">
        <ServiceRow name="Neon Postgres" icon={Database} data={health?.db} />
        <ServiceRow name="Upstash Redis" icon={Server} data={health?.redis} />
        <ServiceRow name="QStash Workflows" icon={Zap} data={health?.qstash} />
        <ServiceRow name="AI Providers" icon={Brain} data={health?.ai} />
      </div>

      <div className="mt-4 flex items-center justify-between rounded-xl bg-[#07091a] p-3 border border-white/5">
        <span className="text-[11px] font-bold text-[#8d97c4]">زمن الاستجابة الكلي</span>
        <span className="font-mono text-xs font-black text-[#8fa8ff]">{health?.totalLatency ?? 0}ms</span>
      </div>
    </section>
  );
}