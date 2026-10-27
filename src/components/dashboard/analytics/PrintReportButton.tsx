"use client";
import { Printer } from "lucide-react";

export function PrintReportButton() {
  return (
    <button type="button" onClick={() => window.print()} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-edge/10 px-3.5 text-[12px] font-bold text-ink-2 hover:bg-edge/[0.05] hover:text-ink print:hidden">
      <Printer className="size-4" aria-hidden="true" />
      طباعة التقرير
    </button>
  );
}
