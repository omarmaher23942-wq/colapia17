"use client";

// ReadMore — يقصّ المحتوى الطويل (وصف المنتج) على الموبايل بزر «عرض المزيد»؛ على الشاشات الواسعة يبقى كاملاً.
import { useState } from "react";
import { cn } from "@/lib/utils";

export function ReadMore({ children, lines = 8 }: { children: React.ReactNode; lines?: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <div className={cn("relative overflow-hidden md:max-h-none", !open && "max-h-[14rem]")} style={!open ? { maxHeight: `${lines * 1.75}rem` } : undefined}>
        {children}
        {!open ? <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-12 md:hidden" style={{ background: "linear-gradient(transparent, var(--background))" }} /> : null}
      </div>
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="mt-2 text-[13px] font-black underline underline-offset-4 md:hidden">
          عرض المزيد
        </button>
      ) : null}
    </div>
  );
}
