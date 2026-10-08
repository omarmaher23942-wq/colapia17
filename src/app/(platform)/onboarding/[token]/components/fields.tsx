"use client";

// تحديثات: prefixIcon/suffixIcon/loading في Input؛ FieldError/Hint/Success؛
// FormRow؛ data-field للـ analytics (E22)؛ VoiceInputButton slot عبر headerActions.
import {
  forwardRef,
  useId,
  useState,
  type ReactNode,
  type InputHTMLAttributes,
  type TextareaHTMLAttributes,
  type SelectHTMLAttributes,
  type ButtonHTMLAttributes,
  type ComponentType,
} from "react";
import {
  AlertCircle,
  Loader2,
  Sparkles,
  Info,
  X,
  CheckCircle2,
  Lightbulb,
  HelpCircle,
  type LucideProps,
} from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

const SW = 1.75;

const INPUT_BASE =
  "w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-3 text-[13px] text-[#eaf0ff] outline-none transition-colors placeholder:text-[#6f7aa8] hover:border-white/20 focus:border-[#8fa8ff] focus:ring-4 focus:ring-[#6f86ff]/15 disabled:cursor-not-allowed disabled:opacity-50";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  prefixIcon?: ComponentType<LucideProps>;
  suffixIcon?: ComponentType<LucideProps>;
  loading?: boolean;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    { className, prefixIcon: Prefix, suffixIcon: Suffix, loading, ...props },
    ref
  ) => {
    const hasDecor = Boolean(Prefix || Suffix || loading);
    if (!hasDecor) {
      return <input ref={ref} {...props} className={cn(INPUT_BASE, className)} />;
    }
    return (
      <div className="relative">
        {Prefix ? (
          <span className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-[#8d97c4]">
            <Prefix className="size-4" strokeWidth={SW} />
          </span>
        ) : null}
        <input
          ref={ref}
          {...props}
          className={cn(
            INPUT_BASE,
            Prefix && "ps-10",
            (Suffix || loading) && "pe-10",
            className
          )}
        />
        {loading ? (
          <Loader2
            className="absolute end-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-[#8fa8ff]"
            strokeWidth={SW}
          />
        ) : Suffix ? (
          <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-[#8d97c4]">
            <Suffix className="size-4" strokeWidth={SW} />
          </span>
        ) : null}
      </div>
    );
  }
);
Input.displayName = "Input";

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    {...props}
    className={cn(INPUT_BASE, "leading-7", className)}
  />
));
Textarea.displayName = "Textarea";

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <div className="relative">
    <select
      ref={ref}
      {...props}
      className={cn(INPUT_BASE, "appearance-none pe-10", className)}
    >
      {children}
    </select>
    <svg
      className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-[#8fa8ff]"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  </div>
));
Select.displayName = "Select";

export type FieldGuideInfo = {
  title: string;
  whatIsIt: string;
  whereItAppears: string;
  tips: string[];
  externalHelp?: string;
};

export function Field({
  label,
  hint,
  error,
  success,
  required,
  fieldKey,
  guide,
  onAiGenerate,
  headerActions,
  children,
  className,
}: {
  label?: string;
  hint?: string;
  error?: string;
  success?: string;
  required?: boolean;
  fieldKey?: string;
  guide?: FieldGuideInfo;
  onAiGenerate?: () => void;
  headerActions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const [showGuide, setShowGuide] = useState(false);
  const hintId = useId();
  const errorId = useId();

  return (
    <div
      className={cn("block space-y-1.5", className)}
      data-onb-field={fieldKey}
      data-field={fieldKey}
    >
      {label ? (
        <div className="flex items-center justify-between gap-2">
          <label className="flex items-baseline gap-1.5 text-[11.5px] font-black text-[#eaf0ff]">
            <span>{label}</span>
            {required ? <span className="text-rose-400">*</span> : null}
            {hint ? (
              <span
                id={hintId}
                className="text-[10.5px] font-normal text-[#8d97c4]"
              >
                · {hint}
              </span>
            ) : null}
          </label>

          <div className="flex items-center gap-1.5">
            {headerActions}
            {onAiGenerate ? (
              <button
                type="button"
                onClick={onAiGenerate}
                className="inline-flex items-center gap-1 rounded-lg border border-[#8fa8ff]/30 bg-[#6f86ff]/15 px-2 py-0.5 text-[10.5px] font-bold text-[#8fa8ff] transition-colors hover:bg-[#6f86ff]/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8fa8ff]"
              >
                <Sparkles className="size-3" strokeWidth={SW} />
                اكتب بالـ AI
              </button>
            ) : null}
            {guide ? (
              <button
                type="button"
                onClick={() => setShowGuide(true)}
                className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10.5px] font-bold text-[#c3cdf0] transition-colors hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6f86ff]"
              >
                <HelpCircle className="size-3 text-[#8fa8ff]" strokeWidth={SW} />
                شرح
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {children}

      <FieldError id={errorId} message={error} />
      <FieldSuccess message={success} />

      {guide && showGuide ? (
        <GuideDialog guide={guide} onClose={() => setShowGuide(false)} />
      ) : null}
    </div>
  );
}

export function FieldError({ id, message }: { id?: string; message?: string }) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence initial={false}>
      {message ? (
        <motion.p
          id={id}
          role="alert"
          data-invalid="true"
          initial={reduce ? false : { opacity: 0, y: -3 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? undefined : { opacity: 0, y: -3 }}
          transition={{ duration: reduce ? 0 : 0.16, ease: "easeOut" }}
          className="flex items-start gap-1.5 pt-1 text-[11px] font-bold text-rose-300"
        >
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" strokeWidth={SW} />
          {message}
        </motion.p>
      ) : null}
    </AnimatePresence>
  );
}

export function FieldHint({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-1.5 pt-1 text-[11px] text-[#8d97c4]">
      <Info className="mt-0.5 size-3.5 shrink-0 text-[#8fa8ff]" strokeWidth={SW} />
      {children}
    </p>
  );
}

export function FieldSuccess({ message }: { message?: string }) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence initial={false}>
      {message ? (
        <motion.p
          initial={reduce ? false : { opacity: 0, y: -3 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? undefined : { opacity: 0, y: -3 }}
          transition={{ duration: reduce ? 0 : 0.16, ease: "easeOut" }}
          className="flex items-start gap-1.5 pt-1 text-[11px] font-bold text-emerald-300"
        >
          <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" strokeWidth={2.5} />
          {message}
        </motion.p>
      ) : null}
    </AnimatePresence>
  );
}

export function FormRow({
  children,
  cols = 2,
  className,
}: {
  children: ReactNode;
  cols?: 1 | 2 | 3;
  className?: string;
}) {
  const c = {
    1: "grid-cols-1",
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  }[cols];
  return <div className={cn("grid gap-4", c, className)}>{children}</div>;
}

function GuideDialog({
  guide,
  onClose,
}: {
  guide: FieldGuideInfo;
  onClose: () => void;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduce ? 0 : 0.16 }}
      className="fixed inset-0 z-[80] grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={guide.title}
        initial={reduce ? false : { opacity: 0, y: 10, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: reduce ? 0 : 0.18, ease: "easeOut" }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md space-y-3.5 rounded-2xl border border-white/10 bg-[#0b0f2a] p-5 text-start shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <h3 className="flex items-center gap-2 text-[13px] font-black text-white">
            <Lightbulb className="size-4 text-[#8fa8ff]" strokeWidth={SW} />
            {guide.title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="rounded-lg p-1 text-[#8d97c4] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6f86ff]"
          >
            <X className="size-4" strokeWidth={SW} />
          </button>
        </div>

        <div className="space-y-2.5 text-[12px] leading-relaxed text-[#c3cdf0]">
          <p>
            <span className="font-black text-white">ما هو هذا العنصر؟</span>{" "}
            {guide.whatIsIt}
          </p>
          <p>
            <span className="font-black text-white">
              أين سيظهر في متجرك؟
            </span>{" "}
            {guide.whereItAppears}
          </p>

          <div>
            <p className="mb-1 font-black text-white">نصائح للحصول عليه:</p>
            <ul className="list-inside list-disc space-y-1 text-[11.5px] text-[#8d97c4]">
              {guide.tips.map((tip, idx) => (
                <li key={idx}>{tip}</li>
              ))}
            </ul>
          </div>

          {guide.externalHelp ? (
            <div className="flex items-start gap-2 rounded-xl border border-[#6f86ff]/30 bg-[#6f86ff]/10 p-2.5 text-[11.5px] text-[#eaf0ff]">
              <Lightbulb
                className="mt-0.5 size-3.5 shrink-0 text-[#8fa8ff]"
                strokeWidth={SW}
              />
              <div>
                <span className="font-black">مساعدة سريعة: </span>
                {guide.externalHelp}
              </div>
            </div>
          ) : null}
        </div>

        <PrimaryButton
          type="button"
          onClick={onClose}
          className="w-full py-2.5 text-[12px]"
        >
          فهمت، شكراً
        </PrimaryButton>
      </motion.div>
    </motion.div>
  );
}

export function PrimaryButton({
  children,
  className,
  loading,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) {
  return (
    <button
      type="button"
      {...props}
      disabled={props.disabled || loading}
      className={cn(
        "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[#6f86ff] to-[#5b74ff] px-5 py-3 text-[12.5px] font-black text-white shadow-lg shadow-[#6f86ff]/25 transition-all hover:shadow-xl hover:shadow-[#6f86ff]/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8fa8ff] focus-visible:ring-offset-2 focus-visible:ring-offset-[#07091a] active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none",
        className
      )}
    >
      {loading ? <Loader2 className="size-4 animate-spin" strokeWidth={SW} /> : null}
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-[12.5px] font-bold text-[#c3cdf0] transition-colors hover:border-white/20 hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6f86ff] active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
    >
      {children}
    </button>
  );
}

export function ChoiceGrid<T extends string>({
  value,
  onChange,
  options,
  columns = 2,
}: {
  value: T | undefined;
  onChange: (v: T) => void;
  options: readonly { value: T; label: string; description?: string }[];
  columns?: 1 | 2 | 3 | 4;
}) {
  const cols = {
    1: "grid-cols-1",
    2: "grid-cols-2",
    3: "grid-cols-2 sm:grid-cols-3",
    4: "grid-cols-2 sm:grid-cols-4",
  }[columns];

  return (
    <div role="radiogroup" className={cn("grid gap-2", cols)}>
      {options.map((o) => {
        const on = value === o.value;
        return (
          <button
            type="button"
            role="radio"
            aria-checked={on}
            key={o.value}
            onClick={() => onChange(o.value)}
            className={cn(
              "rounded-xl border p-3.5 text-start transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6f86ff] active:scale-[.98]",
              on
                ? "border-[#8fa8ff]/40 bg-[#6f86ff]/10"
                : "border-white/10 bg-white/[0.02] hover:border-white/20"
            )}
          >
            <span
              className={cn(
                "block text-[12px] font-black",
                on ? "text-white" : "text-[#eaf0ff]"
              )}
            >
              {o.label}
            </span>
            {o.description ? (
              <span className="mt-0.5 block text-[10.5px] leading-4 text-[#8d97c4]">
                {o.description}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function Toggle({
  value,
  onChange,
  label,
  hint,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3.5">
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={cn(
          "relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6f86ff]",
          value ? "bg-[#6f86ff]" : "bg-white/10"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-5 rounded-full bg-white shadow transition-all",
            value ? "start-[22px]" : "start-0.5"
          )}
        />
      </button>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-black text-[#eaf0ff]">{label}</p>
        {hint ? (
          <p className="mt-0.5 text-[11px] leading-5 text-[#8d97c4]">{hint}</p>
        ) : null}
      </div>
    </div>
  );
}

export function SectionTitle({
  title,
  subtitle,
  icon,
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start gap-3">
      {icon ? (
        <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-[#8fa8ff]/25 bg-[#6f86ff]/10 text-[#8fa8ff]">
          {icon}
        </span>
      ) : null}
      <div className="min-w-0">
        <h3 className="text-[13px] font-black text-white">{title}</h3>
        {subtitle ? (
          <p className="mt-1 text-[11.5px] leading-5 text-[#8d97c4]">
            {subtitle}
          </p>
        ) : null}
      </div>
    </div>
  );
}