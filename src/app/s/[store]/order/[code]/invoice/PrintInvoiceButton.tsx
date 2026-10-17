"use client";

import { Printer } from "lucide-react";

export function PrintInvoiceButton() {
  return (
    <button type="button" onClick={() => window.print()} className="s-btn h-11 px-5 text-sm">
      <Printer className="size-4" strokeWidth={1.75} aria-hidden="true" /> طباعة أو حفظ PDF
    </button>
  );
}
