"use client";

import { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { Hammer, CheckCircle2, AlertTriangle, Loader2, Play, Pause } from "lucide-react";
import { useRealtimeChannel } from "@/lib/realtime-hooks";
import { channels, type BuildProgressPayload, type BuildCompletedPayload } from "@/server/realtime/events";
import { cn } from "@/lib/utils";

const SW = 1.75;

type ActiveJob = BuildProgressPayload & { updatedAt: number };

export function BuildQueueVisualizer() {
  const reduce = useReducedMotion();
  const [activeJobs, setActiveJobs] = useState<Map<string, ActiveJob>>(new Map());

  useRealtimeChannel(channels.platform(), {
    "build:progress": (data: BuildProgressPayload) => {
      setActiveJobs((prev) => {
        const next = new Map(prev);
        next.set(data.jobId, { ...data, updatedAt: Date.now() });
        return next;
      });
    },
    "build:completed": (data: BuildCompletedPayload) => {
      setActiveJobs((prev) => {
        const next = new Map(prev);
        next.delete(data.jobId);
        return next;
      });
    },
  });

  const jobsList = Array.from(activeJobs.values()).sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <section className="flex flex-col rounded-3xl border border-white/10 bg-[#0b0f2a] p-5 shadow-2xl">
      <header className="mb-4 flex items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <Hammer className="size-4.5 text-[#8fa8ff]" strokeWidth={SW} />
          <h2 className="text-sm font-black text-white">خط الإنتاج اللحظي</h2>
        </div>
        <span className="rounded-full bg-[#6f86ff]/20 px-2.5 py-0.5 font-mono text-[10px] font-black text-[#8fa8ff]">
          {jobsList.length} جاري البناء
        </span>
      </header>

      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        <AnimatePresence>
          {jobsList.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid h-32 place-items-center text-center text-[#8d97c4]"
            >
              <div className="space-y-2">
                <CheckCircle2 className="mx-auto size-6 opacity-40" strokeWidth={SW} />
                <p className="text-xs font-bold">لا توجد متاجر قيد البناء حالياً</p>
              </div>
            </motion.div>
          ) : (
            jobsList.map((job) => (
              <motion.div
                key={job.jobId}
                initial={reduce ? false : { opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={reduce ? undefined : { opacity: 0, scale: 0.95 }}
                className="rounded-xl border border-white/10 bg-white/[0.03] p-3"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-[#eaf0ff] truncate pr-2">
                    {job.step}
                  </span>
                  <span className="font-mono text-[10px] text-[#8fa8ff]">{job.progress}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#07091a]">
                  <motion.div
                    className={cn("h-full rounded-full", job.status === "failed" ? "bg-rose-500" : "bg-gradient-to-l from-[#6f86ff] to-[#a78bfa]")}
                    initial={{ width: 0 }}
                    animate={{ width: `${job.progress}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[10px] text-[#8d97c4] truncate max-w-[180px]">
                    {job.message}
                  </span>
                  {job.status === "failed" ? (
                    <AlertTriangle className="size-3.5 text-rose-400" strokeWidth={SW} />
                  ) : (
                    <Loader2 className="size-3.5 animate-spin text-[#8fa8ff]" strokeWidth={SW} />
                  )}
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}