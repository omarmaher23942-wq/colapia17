"use client";

import { Smile, Meh, Frown, AlertTriangle, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

const SW = 1.75;

export function SentimentBadge({ score, text }: { score: number; text?: string }) {
  // تحليل مبسط للمشاعر بناءً على الـ Lead Score وبعض الكلمات المفتاحية
  let sentiment: "positive" | "neutral" | "hesitant" | "objecting" | "urgent" = "neutral";
  
  if (score >= 80) sentiment = "positive";
  else if (score >= 50) sentiment = "neutral";
  else if (score >= 30) sentiment = "hesitant";
  else sentiment = "objecting";

  if (text && /(بسرعة|ضروري|حالا|مستعجل|مشكلة|نصب)/i.test(text)) {
    sentiment = "urgent";
  }

  const config = {
    positive: { icon: Smile, label: "إيجابي ومتحمس", cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" },
    neutral: { icon: Meh, label: "محايد", cls: "border-[#8fa8ff]/30 bg-[#6f86ff]/10 text-[#8fa8ff]" },
    hesitant: { icon: Frown, label: "متردد", cls: "border-amber-500/30 bg-amber-500/10 text-amber-300" },
    objecting: { icon: AlertTriangle, label: "معترض", cls: "border-rose-500/30 bg-rose-500/10 text-rose-300" },
    urgent: { icon: Zap, label: "عاجل / حرج", cls: "border-rose-500/50 bg-rose-500/20 text-rose-200 animate-pulse" },
  };

  const { icon: Icon, label, cls } = config[sentiment];

  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10.5px] font-bold", cls)}>
      <Icon className="size-3.5" strokeWidth={SW} />
      {label}
    </span>
  );
}