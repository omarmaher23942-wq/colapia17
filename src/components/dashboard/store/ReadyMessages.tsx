"use client";

// ReadyMessages — رسائل قصيرة جاهزة للنسخ لزبائن المتجر (تأكيد، شحن، تقييم…). النسخ بضغطة ثم اللصق في واتساب أو إنستجرام.
import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import type { ReadyMessage } from "@/lib/ready-messages";

export function ReadyMessages({ messages }: { messages: ReadyMessage[] }) {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (m: ReadyMessage) => {
    try {
      await navigator.clipboard.writeText(m.text);
      setCopied(m.key);
      setTimeout(() => setCopied((c) => (c === m.key ? null : c)), 1800);
    } catch {
      toast.error("تعذّر النسخ تلقائياً، حدّدوا النص وانسخوه يدوياً");
    }
  };
  return (
    <section className="dash-card p-4 sm:p-5" aria-labelledby="ready-msgs-h">
      <h2 id="ready-msgs-h" className="text-[14px] font-black text-ink">رسائل جاهزة لعملائكم</h2>
      <p className="mt-1 text-[12.5px] leading-6 text-ink-2">انسخوا الرسالة ثم الصقوها في المحادثة، وعدّلوا فيها ما يلزم.</p>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2">
        {messages.map((m) => (
          <li key={m.key} className="flex flex-col gap-2 rounded-xl border border-edge/10 bg-edge/[0.02] p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[13px] font-black text-ink">{m.title}</p>
                <p className="text-[11.5px] text-ink-3">{m.when}</p>
              </div>
              <button
                type="button"
                onClick={() => copy(m)}
                aria-label={`نسخ رسالة ${m.title}`}
                className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg border border-edge/10 px-3 text-[12px] font-bold text-ink hover:bg-edge/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova"
              >
                {copied === m.key ? <Check className="size-4 text-ok" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
                {copied === m.key ? "تم النسخ" : "نسخ"}
              </button>
            </div>
            <p className="whitespace-pre-line text-[12.5px] leading-6 text-ink-2">{m.text}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
