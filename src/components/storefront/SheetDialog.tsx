"use client";

// SheetDialog — ورقة/درج على <dialog> أصلي (طبقة عليا) محمولة داخل .storefront. side="end" درج جانبي، وإلا ورقة سفلية.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function SheetDialog({
  open,
  onClose,
  title,
  side = "end",
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  side?: "end" | "bottom";
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [host, setHost] = useState<Element | null>(null);
  useLayoutEffect(() => setHost(document.querySelector(".storefront") ?? document.body), []);
  useEffect(() => {
    const d = ref.current;
    if (!d || !host) return;
    if (open && !d.open) {
      d.showModal();
      const html = document.documentElement;
      const prev = html.style.overflow;
      html.style.overflow = "hidden";
      return () => {
        html.style.overflow = prev;
        if (d.open) d.close();
      };
    }
    if (!open && d.open) d.close();
  }, [open, host]);
  if (!host) return null;
  return createPortal(
    <dialog
      ref={ref}
      aria-label={title}
      className="clp-drawer"
      data-side={side}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className={cn("clp-drawer-panel")} dir="rtl">
        <header className="flex items-center justify-between gap-3 border-b px-4 py-3" style={{ borderColor: "var(--border)" }}>
          <h2 className="font-heading text-base font-black">{title}</h2>
          <button type="button" onClick={onClose} aria-label="إغلاق" className="grid size-10 place-items-center rounded-full hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2">
            <X className="size-4" aria-hidden="true" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{open ? children : null}</div>
        {footer ? (
          <footer className="border-t px-4 py-3" style={{ borderColor: "var(--border)", paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
            {footer}
          </footer>
        ) : null}
      </div>
    </dialog>,
    host
  );
}
