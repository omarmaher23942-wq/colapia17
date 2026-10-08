"use client";

// تحديثات: caching, cancellation، copy button، preview bar، dark theme.
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Check,
  X,
  Loader2,
  AlertTriangle,
  Link2,
  Copy,
  ExternalLink,
} from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { Field } from "./fields";
import { track } from "../analytics";
import { cn } from "@/lib/utils";

const SW = 1.75;

type Status =
  | "idle"
  | "checking"
  | "ok"
  | "invalid"
  | "reserved"
  | "taken"
  | "error";

const MESSAGES: Record<Status, string> = {
  idle: "اكتب الاسم بحروف إنجليزية صغيرة، أرقام، أو شرطة.",
  checking: "جاري فحص توفر الاسم...",
  ok: "متاح! حجزناه لك مؤقتاً.",
  invalid:
    "الاسم غير صالح (حروف إنجليزية وأرقام فقط، حرفان على الأقل، بدون شرطة في البداية أو النهاية).",
  reserved: "هذا الاسم محجوز من قِبل المنصة، اختر اسماً آخر.",
  taken: "هذا الاسم مستخدم بالفعل، جرّب أحد المقترحات بالأسفل.",
  error: "تعذر التحقق من الاسم، حاول مجدداً.",
};

const TONE: Record<Status, string> = {
  idle: "border-white/10 bg-white/[0.02] text-[#8d97c4]",
  checking: "border-[#6f86ff]/30 bg-[#6f86ff]/[0.06] text-[#8fa8ff]",
  ok: "border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-300",
  invalid: "border-rose-500/30 bg-rose-500/[0.06] text-rose-300",
  reserved: "border-amber-500/30 bg-amber-500/[0.06] text-amber-300",
  taken: "border-rose-500/30 bg-rose-500/[0.06] text-rose-300",
  error: "border-amber-500/30 bg-amber-500/[0.06] text-amber-300",
};

const RULE = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;

export function SubdomainField({
  token,
  value,
  onChange,
  error,
}: {
  token: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const seq = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const cacheRef = useRef(
    new Map<string, { status: Status; suggestions: string[] }>()
  );
  const reduce = useReducedMotion();

  useEffect(() => {
    const v = value.trim().toLowerCase();
    if (!v) {
      setStatus("idle");
      setSuggestions([]);
      return;
    }
    if (!RULE.test(v) || v.includes("--")) {
      setStatus("invalid");
      setSuggestions([]);
      return;
    }

    const cached = cacheRef.current.get(v);
    if (cached) {
      setStatus(cached.status);
      setSuggestions(cached.suggestions);
      return;
    }

    const my = ++seq.current;
    setStatus("checking");
    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const r = await fetch(
          `/api/onboarding/${encodeURIComponent(token)}/subdomain`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ subdomain: v }),
            signal: ctrl.signal,
          }
        );
        if (my !== seq.current) return;
        if (!r.ok) {
          setStatus("error");
          return;
        }
        const j = await r.json();
        const nextStatus = (j.status as Status) ?? "error";
        const nextSuggestions = Array.isArray(j.suggestions)
          ? j.suggestions
          : [];
        if (nextStatus !== "checking") {
          cacheRef.current.set(v, {
            status: nextStatus,
            suggestions: nextSuggestions,
          });
        }
        setStatus(nextStatus);
        setSuggestions(nextSuggestions);
        track({
          name: "onboarding_subdomain_checked",
          subdomain: v,
          status: nextStatus,
        });
      } catch (e) {
        if ((e as { name?: string }).name === "AbortError") return;
        if (my === seq.current) setStatus("error");
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [token, value]);

  useEffect(
    () => () => {
      abortRef.current?.abort();
    },
    []
  );

  const fullUrl = value ? `${value}.colapia.com` : "";
  const copy = useCallback(async () => {
    if (!fullUrl) return;
    try {
      await navigator.clipboard.writeText(`https://${fullUrl}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard قد يكون محجوباً — تجاهل بهدوء.
    }
  }, [fullUrl]);

  return (
    <Field
      label="رابط متجرك المخصص"
      hint="عنوانك على الإنترنت"
      required
      error={error}
      fieldKey="desiredSubdomain"
    >
      <div
        className={cn(
          "flex items-center overflow-hidden rounded-xl border bg-white/[0.03] transition-all",
          "focus-within:border-[#8fa8ff] focus-within:ring-4 focus-within:ring-[#6f86ff]/15",
          error
            ? "border-rose-500/40"
            : status === "ok"
              ? "border-emerald-500/40"
              : "border-white/10 hover:border-white/20"
        )}
      >
        <span className="ps-3.5 text-[#8d97c4]" aria-hidden>
          <Link2 className="size-4" strokeWidth={SW} />
        </span>

        <input
          className="min-w-0 flex-1 bg-transparent px-3 py-3 font-mono text-[13px] font-bold text-[#eaf0ff] outline-none placeholder:font-normal placeholder:text-[#6f7aa8]"
          placeholder="mystore"
          dir="ltr"
          value={value}
          onChange={(e) =>
            onChange(
              e.target.value
                .toLowerCase()
                .replace(/[^a-z0-9-]/g, "")
                .slice(0, 30)
            )
          }
          maxLength={30}
          autoComplete="off"
          spellCheck={false}
          aria-invalid={error ? true : undefined}
        />

        <span className="pe-3">
          {status === "checking" ? (
            <Loader2
              className="size-4 animate-spin text-[#8fa8ff]"
              strokeWidth={SW}
            />
          ) : status === "ok" ? (
            <Check className="size-4 text-emerald-400" strokeWidth={2.5} />
          ) : status === "invalid" ||
            status === "reserved" ||
            status === "taken" ? (
            <X className="size-4 text-rose-400" strokeWidth={2.5} />
          ) : status === "error" ? (
            <AlertTriangle className="size-4 text-amber-400" strokeWidth={SW} />
          ) : null}
        </span>

        <span
          className="shrink-0 border-s border-white/10 bg-white/[0.04] px-3.5 py-3 font-mono text-[12px] font-black text-[#c3cdf0]"
          dir="ltr"
        >
          .colapia.com
        </span>
      </div>

      <AnimatePresence initial={false}>
        {fullUrl && status !== "invalid" ? (
          <motion.div
            initial={reduce ? false : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: -4 }}
            transition={{ duration: reduce ? 0 : 0.16 }}
            className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-3.5 py-2.5"
          >
            <div className="flex min-w-0 items-center gap-2">
              <ExternalLink
                className="size-3.5 shrink-0 text-[#8d97c4]"
                strokeWidth={SW}
              />
              <span
                dir="ltr"
                className="truncate font-mono text-[11.5px] font-bold text-[#c3cdf0]"
              >
                {fullUrl}
              </span>
            </div>
            <button
              type="button"
              onClick={copy}
              aria-label="نسخ الرابط"
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10.5px] font-bold text-[#c3cdf0] transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6f86ff]"
            >
              {copied ? (
                <>
                  <Check className="size-3 text-emerald-400" strokeWidth={2.5} />
                  <span>تم النسخ</span>
                </>
              ) : (
                <>
                  <Copy className="size-3" strokeWidth={SW} />
                  <span>نسخ</span>
                </>
              )}
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div
        aria-live="polite"
        aria-atomic="true"
        className={cn(
          "mt-2 flex items-start gap-1.5 rounded-lg border p-2.5 text-[11px] transition-colors",
          TONE[status]
        )}
      >
        <span className="mt-0.5 shrink-0">
          {status === "checking" ? (
            <Loader2 className="size-3.5 animate-spin" strokeWidth={SW} />
          ) : status === "ok" ? (
            <Check className="size-3.5" strokeWidth={2.5} />
          ) : status === "invalid" ||
            status === "reserved" ||
            status === "taken" ? (
            <X className="size-3.5" strokeWidth={2.5} />
          ) : status === "error" ? (
            <AlertTriangle className="size-3.5" strokeWidth={SW} />
          ) : (
            <Link2 className="size-3.5" strokeWidth={SW} />
          )}
        </span>
        <span className="leading-relaxed">{MESSAGES[status]}</span>
      </div>

      <AnimatePresence initial={false}>
        {suggestions.length > 0 &&
        (status === "taken" || status === "reserved") ? (
          <motion.div
            initial={reduce ? false : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: -4 }}
            transition={{ duration: reduce ? 0 : 0.16 }}
            className="mt-2.5"
          >
            <p className="mb-1.5 text-[10.5px] font-bold text-[#8d97c4]">
              اقتراحات متاحة:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onChange(s)}
                  dir="ltr"
                  className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 font-mono text-[11px] font-bold text-[#eaf0ff] transition-colors hover:border-[#8fa8ff]/40 hover:bg-[#6f86ff]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6f86ff]"
                >
                  {s}
                </button>
              ))}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </Field>
  );
}