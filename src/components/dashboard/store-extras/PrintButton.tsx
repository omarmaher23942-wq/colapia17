"use client";
import { Printer } from "lucide-react";

export function PrintButton({ label = "طباعة" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-edge/10 bg-edge/[0.04] px-4 text-[13px] font-bold text-ink transition-colors hover:bg-edge/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova print:hidden"
    >
      <Printer className="size-4" aria-hidden="true" />
      {label}
    </button>
  );
}
