"use client";

import { Activity, Thermometer, MessageSquare, Phone, ArrowUpRight } from "lucide-react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

const SW = 1.75;

export function LeadScoringCard({ score, stage, phone }: { score: number; stage: string; phone?: string | null }) {
  const pct = Math.max(0, Math.min(100, score));
  
  let status = "بارد";
  let color = "from-slate-500 to-slate-400";
  let textTone = "text-slate-300";
  let recommendation = "يحتاج إلى بناء ثقة وعرض قيمة المنصة بوضوح.";

  if (pct >= 80) {
    status = "ساخن جداً";
    color = "from-rose-500 to-amber-500";
    textTone = "text-rose-400";
    recommendation = "جاهز للإغلاق. أرسل رابط الدفع أو تواصل هاتفياً فوراً.";
  } else if (pct >= 50) {
    status = "دافئ";
    color = "from-amber-500 to-yellow-400";
    textTone = "text-amber-400";
    recommendation = "مهتم. أجب عن استفساراته ووجهه نحو التجربة المجانية.";
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0b0f2a] p-4 shadow-lg">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Thermometer className={cn("size-4", textTone)} strokeWidth={SW} />
          <h3 className="text-xs font-black text-white">الحرارة البيعية</h3>
        </div>
        <span className={cn("text-lg font-black font-mono", textTone)}>{pct}%</span>
      </div>

      <div className="h-2 w-full overflow-hidden rounded-full bg-[#07091a] mb-3">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
          className={cn("h-full rounded-full bg-gradient-to-r", color)}
        />
      </div>

      <div className="flex items-center justify-between text-[11px] mb-4">
        <span className="text-[#8d97c4]">التصنيف: <strong className={textTone}>{status}</strong></span>
        <span className="text-[#8d97c4]">المرحلة: <strong className="text-[#eaf0ff]">{stage}</strong></span>
      </div>

      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 mb-4">
        <p className="text-[10.5px] font-bold text-[#8fa8ff] mb-1 flex items-center gap-1.5">
          <Activity className="size-3" /> توصية النظام:
        </p>
        <p className="text-[11px] leading-relaxed text-[#c3cdf0]">{recommendation}</p>
      </div>

      <div className="flex gap-2">
        {phone ? (
          <a
            href={`https://wa.me/2${phone.replace(/\D/g, "")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#25D366] px-3 py-2 text-[11px] font-black text-white transition-transform hover:scale-105"
          >
            <MessageSquare className="size-3.5" strokeWidth={SW} />
            مراسلة واتساب
          </a>
        ) : (
          <button disabled className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-white/5 px-3 py-2 text-[11px] font-bold text-slate-500 cursor-not-allowed">
            <Phone className="size-3.5" strokeWidth={SW} />
            لا يوجد رقم
          </button>
        )}
      </div>
    </div>
  );
}