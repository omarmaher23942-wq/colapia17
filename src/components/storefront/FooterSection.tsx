"use client";

// عمود تذييل: أكورديون على الموبايل (مغلق افتراضياً)، ومفتوح دائماً على الحاسوب. المحتوى في DOM دائماً (للزواحف).
import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function FooterSection({ title, className, children }: { title: string; className?: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <section className={cn("border-t py-1 md:border-0 md:py-0", className)} style={{ borderColor: "var(--border)" }}>
      <h3>
        <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)} className="flex min-h-12 w-full items-center justify-between text-[15px] font-black focus-visible:outline-none focus-visible:ring-2 md:pointer-events-none md:min-h-0 md:pb-3">
          {title}
          <ChevronDown className={cn("size-4 transition-transform md:hidden", open && "rotate-180")} aria-hidden="true" />
        </button>
      </h3>
      <div id={id} className={cn(open ? "block" : "hidden", "pb-3 md:block md:pb-0")}>
        {children}
      </div>
    </section>
  );
}
