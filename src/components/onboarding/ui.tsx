"use client";

// ui.tsx — لبنات واجهة «إعداد المتجر» المشتركة: أزرار، رقائق قابلة للاختيار، بطاقات خيارات، رسائل حالة.
// تعتمد توكنات اللوحة (.dash) وتعيد استخدام Field/Switch/ChipsInput من محرر المنتج.
import type { ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export { Field, Switch, ChipsInput, inputCls } from "@/components/dashboard/product/parts";

export const btnPrimary =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-nova px-5 text-[13.5px] font-black text-white shadow-sm transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova/50 focus-visible:ring-offset-2 focus-visible:ring-offset-space disabled:cursor-not-allowed disabled:opacity-50 dark:text-space";
export const btnGhost =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-edge/15 bg-transparent px-4 text-[13px] font-bold text-ink-2 transition hover:border-edge/30 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova/50 disabled:cursor-not-allowed disabled:opacity-50";
export const btnQuiet =
  "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-3 text-[12.5px] font-bold text-ink-3 transition hover:bg-edge/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova/50 disabled:opacity-50";

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("size-4 animate-spin", className)} aria-hidden="true" />;
}

/** رقاقة اختيار (مقاس/لون/خيار): زر مبدّل بحالة aria-pressed. */
export function Chip({ on, onClick, children, swatch, className, title }: { on: boolean; onClick: () => void; children: ReactNode; swatch?: string | null; className?: string; title?: string }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      title={title}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-9 items-center gap-1.5 rounded-lg border px-3 text-[12.5px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova/50",
        on ? "border-nova bg-nova/12 text-nova-2" : "border-edge/12 bg-transparent text-ink-2 hover:border-edge/30",
        className
      )}
    >
      {swatch ? <span aria-hidden="true" className="size-3.5 rounded-full border border-edge/20" style={{ background: swatch }} /> : null}
      {children}
    </button>
  );
}

/** بطاقة خيار واحد من عدة (راديو): عنوان ووصف قصير وحالة اختيار واضحة. */
export function OptionCard({
  selected,
  onSelect,
  title,
  description,
  icon,
  children,
  name,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  description?: string;
  icon?: ReactNode;
  children?: ReactNode;
  name: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-3.5 transition",
        selected ? "border-nova bg-nova/[0.07] ring-1 ring-nova/30" : "border-edge/12 hover:border-edge/30"
      )}
    >
      <label className="flex cursor-pointer items-start gap-3">
        <input type="radio" name={name} checked={selected} onChange={onSelect} className="peer sr-only" />
        <span aria-hidden="true" className={cn("mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-2 transition peer-focus-visible:ring-2 peer-focus-visible:ring-nova/50", selected ? "border-nova" : "border-edge/30")}>
          {selected ? <span className="size-2.5 rounded-full bg-nova" /> : null}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 text-[13.5px] font-black text-ink">
            {icon}
            {title}
          </span>
          {description ? <span className="mt-0.5 block text-[12px] leading-5 text-ink-3">{description}</span> : null}
        </span>
      </label>
      {selected && children ? <div className="mt-3 ps-8">{children}</div> : null}
    </div>
  );
}

export function Notice({ tone = "info", children, className }: { tone?: "info" | "warn" | "ok" | "bad"; children: ReactNode; className?: string }) {
  const Icon = tone === "ok" ? CheckCircle2 : tone === "info" ? Info : AlertCircle;
  return (
    <div
      role={tone === "bad" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-[12.5px] leading-6",
        tone === "ok" && "border-ok/30 bg-ok/10 text-ok",
        tone === "warn" && "border-warn/30 bg-warn/10 text-warn",
        tone === "bad" && "border-bad/30 bg-bad/10 text-bad",
        tone === "info" && "border-edge/12 bg-edge/[0.04] text-ink-2",
        className
      )}
    >
      <Icon className="mt-1 size-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("dash-card p-4 sm:p-5", className)}>{children}</div>;
}

/** عنوان خطوة: عنوان واحد واضح وسطر «لماذا يهم». */
export function StepHeader({ index, total, title, why }: { index: number; total: number; title: string; why: string }) {
  return (
    <header className="mb-5">
      <p className="text-[11.5px] font-bold tracking-wide text-nova-2">
        الخطوة {index} من {total}
      </p>
      <h1 className="mt-1 text-[22px] font-black leading-tight text-ink sm:text-[26px]">{title}</h1>
      <p className="mt-1.5 max-w-prose text-[13px] leading-6 text-ink-3">{why}</p>
    </header>
  );
}
