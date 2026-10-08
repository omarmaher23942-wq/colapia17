"use client";

// ui.tsx — عناصر الاستمارة المشتركة: واضحة، كبيرة بما يكفي للمس، وتعمل بالكامل من لوحة المفاتيح.
import { Loader2, Cloud, CloudOff, Sparkles, AlertCircle, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export const inputCls =
  "h-11 w-full rounded-xl border border-edge/10 bg-edge/[0.03] px-3.5 text-[14px] font-bold text-ink outline-none transition placeholder:font-medium placeholder:text-ink-3/60 focus:border-nova focus:ring-2 focus:ring-nova/20";

export function StepHeading({ eyebrow, title, sub }: { eyebrow: string; title: string; sub: string }) {
  return (
    <div className="space-y-2">
      <p className="text-[12px] font-black text-nova-2">{eyebrow}</p>
      <h1 className="text-[28px] font-black leading-tight tracking-tight text-ink md:text-4xl">{title}</h1>
      <p className="max-w-2xl text-[14px] leading-7 text-ink-2">{sub}</p>
    </div>
  );
}

export function Section({
  icon: Icon,
  title,
  sub,
  action,
  children,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  sub?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("dash-card space-y-4 p-4 sm:p-5", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          {Icon ? (
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-nova/15 text-nova-2">
              <Icon className="size-4.5" strokeWidth={1.9} />
            </span>
          ) : null}
          <div>
            <h2 className="text-[15px] font-black text-ink">{title}</h2>
            {sub ? <p className="mt-0.5 text-[12.5px] leading-6 text-ink-2">{sub}</p> : null}
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Field({ label, hint, error, children, htmlFor }: { label: string; hint?: string; error?: string; children: React.ReactNode; htmlFor?: string }) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <label htmlFor={htmlFor} className="text-[13px] font-black text-ink">
          {label}
        </label>
        {hint ? <span className="text-[11.5px] text-ink-3">{hint}</span> : null}
      </div>
      {children}
      <ErrorText>{error}</ErrorText>
    </div>
  );
}

/**
 * رسالة خطأ موحّدة لكل الحقول. تحمل data-invalid حتى يجدها revealFirstError ويمرّر الشاشة إليها،
 * فلا يوجد خطأ صامت: كل خطأ له نص ظاهر بجوار حقله.
 */
export function ErrorText({ children, className }: { children?: React.ReactNode; className?: string }) {
  if (!children) return null;
  return (
    <p role="alert" data-invalid="true" className={cn("flex items-start gap-1.5 text-[12px] font-bold leading-5 text-rose-400", className)}>
      <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

/** بطاقة تبديل كبيرة (تشغيل/إيقاف) بعنوان ووصف. */
export function SwitchCard({
  icon: Icon,
  title,
  sub,
  on,
  onChange,
  badge,
  children,
}: {
  icon: LucideIcon;
  title: string;
  sub: string;
  on: boolean;
  onChange: (v: boolean) => void;
  badge?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("rounded-2xl border transition", on ? "border-nova/50 bg-nova/[0.08]" : "border-edge/10 bg-edge/[0.02]")}>
      <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className="flex w-full items-center gap-3 p-4 text-start">
        <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl transition", on ? "bg-nova text-white" : "bg-edge/[0.06] text-ink-3")}>
          <Icon className="size-5" strokeWidth={1.8} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2 text-[13.5px] font-black text-ink">
            {title}
            {badge ? <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10.5px] text-emerald-500 dark:text-emerald-300">{badge}</span> : null}
          </span>
          <span className="mt-0.5 block text-[12px] leading-5 text-ink-3">{sub}</span>
        </span>
        <span className={cn("relative h-6 w-10 shrink-0 rounded-full transition", on ? "bg-nova" : "bg-edge/15")} aria-hidden="true">
          <span className={cn("absolute top-1 size-4 rounded-full bg-white shadow transition-all", on ? "start-5" : "start-1")} />
        </span>
      </button>
      {on && children ? <div className="border-t border-edge/[0.06] p-4">{children}</div> : null}
    </div>
  );
}

/** اختيارات سريعة كأقراص (اختيار واحد). */
export function Chips<T extends string | number>({
  options,
  value,
  onChange,
  label,
  className,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("flex flex-wrap gap-2", className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "min-h-10 rounded-xl border px-3.5 text-[13px] font-black transition",
              active ? "border-nova/60 bg-nova/15 text-ink shadow-sm shadow-nova/20" : "border-edge/10 text-ink-2 hover:border-edge/25 hover:text-ink"
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** اختيارات متعددة كأقراص. */
export function MultiChips({ options, value, onChange, label }: { options: string[]; value: string[]; onChange: (v: string[]) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value.includes(o);
        return (
          <button
            key={o}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== o) : [...value, o])}
            className={cn(
              "rounded-xl border px-3 py-2 text-start text-[12.5px] font-bold leading-5 transition",
              on ? "border-nova/50 bg-nova/10 text-ink" : "border-edge/10 text-ink-3 hover:border-edge/25 hover:text-ink-2"
            )}
          >
            {on ? "✓ " : "+ "}
            {o}
          </button>
        );
      })}
    </div>
  );
}

export function Segmented<T extends string>({ options, value, onChange, label }: { options: { value: T; label: string; icon?: LucideIcon }[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="grid auto-cols-fr grid-flow-col gap-1 rounded-2xl border border-edge/10 bg-edge/[0.03] p-1">
      {options.map((o) => {
        const Icon = o.icon;
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl px-2 text-[12.5px] font-black transition",
              active ? "bg-nova text-white shadow-lg shadow-nova/30" : "text-ink-2 hover:text-ink"
            )}
          >
            {Icon ? <Icon className="size-4" /> : null}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function MoneyInput({
  value,
  onChange,
  placeholder,
  invalid,
  className,
  ariaLabel,
}: {
  value: number | undefined;
  onChange: (v: number) => void;
  placeholder?: string;
  invalid?: boolean;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <input
        value={value ? String(value) : ""}
        onChange={(e) => onChange(Number(e.target.value.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1")) || 0)}
        inputMode="decimal"
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        aria-invalid={invalid}
        className={cn(inputCls, "h-10 pe-8 text-end font-mono", invalid && "border-rose-400/60")}
      />
      <span className="pointer-events-none absolute inset-y-0 end-3 grid place-items-center text-[11px] font-bold text-ink-3">ج</span>
    </div>
  );
}

export function NumberInput({
  value,
  onChange,
  min = 0,
  max = 999,
  suffix,
  ariaLabel,
  className,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  suffix?: string;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <input
        value={String(value)}
        onChange={(e) => {
          const n = Number(e.target.value.replace(/[^\d]/g, ""));
          onChange(Math.max(min, Math.min(max, Number.isFinite(n) ? n : min)));
        }}
        inputMode="numeric"
        aria-label={ariaLabel}
        className={cn(inputCls, "h-10 text-center font-mono", suffix && "pe-10")}
      />
      {suffix ? <span className="pointer-events-none absolute inset-y-0 end-2.5 grid place-items-center text-[11px] font-bold text-ink-3">{suffix}</span> : null}
    </div>
  );
}

export function SmartHint({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-1.5 text-[12px] leading-6 text-ink-3">
      <Sparkles className="mt-1 size-3.5 shrink-0 text-aurora" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

export function QuickButton({ children, onClick, icon: Icon }: { children: React.ReactNode; onClick: () => void; icon?: LucideIcon }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-nova/30 bg-nova/10 px-3 text-[12px] font-black text-nova-2 transition hover:bg-nova/20"
    >
      {Icon ? <Icon className="size-3.5" /> : null}
      {children}
    </button>
  );
}

export function SaveBadge({ state, online }: { state: string; online: boolean }) {
  if (!online)
    return (
      <span className="inline-flex items-center gap-1.5 text-[11.5px] font-bold text-amber-400">
        <CloudOff className="size-4" /> غير متصل، نحفظ عند العودة
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 text-[11.5px] font-bold text-ink-3" aria-live="polite">
      {state === "saving" ? <Loader2 className="size-4 animate-spin" /> : <Cloud className="size-4 text-emerald-400" />}
      <span className="hidden sm:inline">{state === "saving" ? "جارٍ الحفظ" : "محفوظ تلقائياً"}</span>
    </span>
  );
}
