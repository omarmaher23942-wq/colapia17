"use client";

// ui.tsx — عناصر استمارة طلب المتجر وصفحة المتابعة (رموز .dash dark، موبايل أولاً).
// المدخلات 16px بالبكسل (لا rem: جذر الصفحة 15.5px على الموبايل فيصير text-base أقل من 16 ويكبّر iOS الصفحة عند الكتابة)، وأهداف اللمس 44px فأكثر.
import { AlertCircle, Check, Cloud, CloudOff, Loader2, Sparkles, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export const inputCls =
  "h-12 w-full rounded-xl border border-edge/10 bg-edge/[0.04] px-3.5 text-[16px] font-bold text-ink outline-none transition placeholder:font-medium placeholder:text-ink-3/60 focus:border-nova focus:ring-2 focus:ring-nova/25 sm:text-[15px] aria-[invalid=true]:border-rose-400/70";

export function Card({
  n,
  icon: Icon,
  title,
  sub,
  action,
  children,
  id,
}: {
  n?: number;
  icon?: LucideIcon;
  title: string;
  sub?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <section id={id} className="dash-card scroll-mt-24 space-y-4 p-4 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-nova/15 text-[13px] font-black text-nova-2" aria-hidden="true">
            {Icon ? <Icon className="size-4.5" strokeWidth={1.9} /> : n}
          </span>
          <div className="min-w-0">
            <h2 className="text-[16px] font-black leading-7 text-ink">{title}</h2>
            {sub ? <p className="mt-0.5 text-[13px] leading-6 text-ink-2">{sub}</p> : null}
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Field({ label, hint, error, children, htmlFor, optional }: { label: string; hint?: string; error?: string; children: React.ReactNode; htmlFor?: string; optional?: boolean }) {
  return (
    <div className="space-y-2" data-field>
      {htmlFor ? (
        <label htmlFor={htmlFor} className="flex flex-wrap items-baseline gap-x-2 text-[14px] font-black text-ink">
          {label}
          {optional ? <span className="text-[12px] font-bold text-ink-3">(اختياري)</span> : null}
        </label>
      ) : (
        // سؤال لمجموعة أزرار (لا حقل واحد): نص عادي، والمجموعة نفسها مسمّاة بـ aria-label.
        <p className="flex flex-wrap items-baseline gap-x-2 text-[14px] font-black text-ink">
          {label}
          {optional ? <span className="text-[12px] font-bold text-ink-3">(اختياري)</span> : null}
        </p>
      )}
      {children}
      {hint && !error ? <p className="text-[12.5px] leading-6 text-ink-3">{hint}</p> : null}
      <ErrorText>{error}</ErrorText>
    </div>
  );
}

/** رسالة خطأ بجوار حقلها (data-invalid لـ revealFirstError): لا خطأ صامت. */
export function ErrorText({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" data-invalid="true" className="flex items-start gap-1.5 text-[13px] font-bold leading-6 text-rose-400">
      <AlertCircle className="mt-1 size-3.5 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

/** «سيبها للفريق»: يسلّم السؤال لفريق التصميم ويطوي خياراته. */
export function TeamToggle({ on, onChange, label = "سيبها للفريق", ariaLabel }: { on: boolean; onChange: (v: boolean) => void; label?: string; ariaLabel?: string }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={ariaLabel}
      onClick={() => onChange(!on)}
      className={cn(
        "inline-flex min-h-11 max-w-full shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-black transition",
        on ? "border-emerald-400/50 bg-emerald-400/15 text-emerald-300" : "border-edge/15 text-ink-2 hover:border-edge/30 hover:text-ink",
      )}
    >
      {on ? <Check className="size-4" aria-hidden="true" /> : <Sparkles className="size-4 text-aurora" aria-hidden="true" />}
      {label}
    </button>
  );
}

/** اختيار واحد أو متعدد كأقراص كبيرة. */
export function Choice<T extends string>({
  options,
  value,
  onToggle,
  label,
}: {
  options: readonly { id: T; label: string }[];
  value: T[];
  onToggle: (id: T) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value.includes(o.id);
        return (
          <button
            key={o.id}
            type="button"
            aria-pressed={on}
            onClick={() => onToggle(o.id)}
            className={cn(
              "inline-flex min-h-11 items-center gap-1.5 rounded-xl border px-4 text-[14px] font-black transition",
              on ? "border-nova/60 bg-nova/15 text-ink shadow-sm shadow-nova/20" : "border-edge/10 text-ink-2 hover:border-edge/25 hover:text-ink",
            )}
          >
            {on ? <Check className="size-4 text-nova-2" aria-hidden="true" /> : null}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export type SaveState = "idle" | "saving" | "saved" | "error";

export function SaveBadge({ state, online }: { state: SaveState; online: boolean }) {
  if (!online)
    return (
      <span className="inline-flex items-center gap-1.5 text-[12px] font-bold text-amber-400" aria-live="polite">
        <CloudOff className="size-4" aria-hidden="true" /> غير متصل، هنحفظ أول ما النت يرجع
      </span>
    );
  if (state === "idle") return null;
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[12px] font-bold", state === "error" ? "text-amber-400" : "text-ink-3")} aria-live="polite">
      {state === "saving" ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Cloud className={cn("size-4", state === "error" ? "" : "text-emerald-400")} aria-hidden="true" />}
      {state === "saving" ? "بنحفظ…" : state === "error" ? "هنحاول نحفظ تاني" : "محفوظ"}
    </span>
  );
}
