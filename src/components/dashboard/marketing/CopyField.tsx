"use client";

// CopyField — رابط للقراءة مع زر نسخ (روابط الكتالوج والحملات).
import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyField({ value, label }: { value: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <input readOnly dir="ltr" value={value} aria-label={label} onFocus={(e) => e.currentTarget.select()} className="min-w-0 flex-1 rounded-xl border border-edge/10 bg-edge/[0.03] px-3 py-2.5 text-[13px] text-ink outline-none" />
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard.writeText(value).then(() => {
            setDone(true);
            setTimeout(() => setDone(false), 1500);
          });
        }}
        className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl border border-edge/10 px-3 text-[12.5px] font-bold text-ink-2 hover:bg-edge/5"
      >
        {done ? <Check className="size-4 text-ok" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
        {done ? "نُسخ" : "نسخ"}
      </button>
    </div>
  );
}
