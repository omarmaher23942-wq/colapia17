"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Loader2,
  Sparkles,
  Check,
  Copy,
  LayoutDashboard,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { DEFAULT_STAGES } from "@/ai/build/stages";

const SW = 1.75;
const BASE_INTERVAL_MS = 2500;
const MAX_INTERVAL_MS = 8000;

type JobStep = {
  key: string;
  label: string;
  status: "pending" | "running" | "done" | "failed";
};

type StatusResponse = {
  status: "building" | "ready" | "failed" | "waiting_submission";
  progress?: number;
  steps?: JobStep[];
  subdomain?: string;
  storeName?: string;
  storeUrl?: string;
  adminUrl?: string;
  error?: string;
};

const DEFAULT_STEPS: JobStep[] = DEFAULT_STAGES;

export function LiveBuildingScreen({
  token,
  subdomain,
  storeName,
}: {
  token: string;
  subdomain: string;
  storeName: string;
}) {
  const reduce = useReducedMotion();
  const [data, setData] = useState<StatusResponse>({
    status: "building",
    progress: 0,
    steps: DEFAULT_STEPS,
  });
  const stoppedRef = useRef(false);
  const failureCountRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      if (cancelled || stoppedRef.current) return;
      try {
        const res = await fetch(
          `/api/onboarding/${encodeURIComponent(token)}/status`,
          { cache: "no-store" }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as StatusResponse;
        if (cancelled) return;
        failureCountRef.current = 0;
        
        setData((prev) => {
          // الحماية من المصفوفة الفارغة
          const newSteps = json.steps && json.steps.length > 0 ? json.steps : prev.steps;
          return {
            ...prev,
            ...json,
            steps: newSteps,
          };
        });

        if (json.status === "ready" || json.status === "failed") {
          stoppedRef.current = true;
          return;
        }
      } catch {
        failureCountRef.current += 1;
      }
      const delay = Math.min(
        BASE_INTERVAL_MS * Math.pow(1.5, failureCountRef.current),
        MAX_INTERVAL_MS
      );
      timer = setTimeout(poll, delay);
    };

    poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [token]);

  if (data.status === "ready") {
    return (
      <ReadyScreen
        subdomain={data.subdomain ?? subdomain}
        storeName={data.storeName ?? storeName}
        storeUrl={data.storeUrl ?? `https://${subdomain}.colapia.com/?preview=owner`}
        adminUrl={data.adminUrl ?? `https://${subdomain}.colapia.com/admin/login`}
      />
    );
  }

  if (data.status === "failed") {
    return (
      <FailedScreen
        error={data.error}
        onRetry={async () => {
          // إعادة بناء فعلية (مهمة جديدة)، ثم نعود لشاشة التقدم.
          const r = await fetch(`/api/onboarding/${encodeURIComponent(token)}/retry`, { method: "POST" }).catch(() => null);
          if (r && !r.ok && r.status !== 409) {
            const j = (await r.json().catch(() => ({}))) as { error?: string };
            return j.error ?? "تعذّر إعادة البناء الآن، أعد المحاولة بعد دقيقة.";
          }
          window.location.reload();
          return null;
        }}
      />
    );
  }

  const displaySteps = data.steps && data.steps.length > 0 ? data.steps : DEFAULT_STEPS;

  return (
    <div
      dir="rtl"
      className="grid min-h-dvh place-items-center bg-[#07091a] px-5 py-10"
    >
      <div className="relative w-full max-w-md">
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-10 -z-10"
        >
          <div className="absolute start-1/2 top-1/3 size-72 -translate-x-1/2 rounded-full bg-[#6f86ff]/15 blur-3xl" />
          <div className="absolute bottom-0 end-1/4 size-56 rounded-full bg-[#a78bfa]/10 blur-3xl" />
        </div>

        <div className="space-y-6 rounded-3xl border border-white/10 bg-white/[0.02] p-6 text-center sm:p-8">
          <div className="relative mx-auto size-20" aria-hidden="true">
            <motion.div
              animate={reduce ? undefined : { rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="absolute inset-0 rounded-full border-4 border-white/[0.06] border-t-[#6f86ff]"
            />
            <motion.div
              animate={reduce ? undefined : { rotate: -360 }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              className="absolute inset-2 rounded-full border-4 border-transparent border-b-[#a78bfa]/60"
            />
            <div className="absolute inset-0 grid place-items-center">
              <Sparkles className="size-7 text-[#8fa8ff]" strokeWidth={SW} />
            </div>
          </div>

          <div className="space-y-1.5">
            <h2 className="text-lg font-black text-white">
              جاري بناء متجر {storeName} بالذكاء الاصطناعي
            </h2>
            <p className="text-[12.5px] leading-relaxed text-[#8d97c4]">
              لا تغلق الصفحة. سيتم تحديث الحالة تلقائياً عند الجاهزية.
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between text-[11px] font-bold">
              <span className="text-[#8d97c4]">التقدم</span>
              <span className="tabular-nums text-[#eaf0ff]">
                {Math.round(data.progress ?? 0)}%
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#232b66]">
              <motion.div
                initial={false}
                animate={{ width: `${data.progress ?? 0}%` }}
                transition={{ duration: reduce ? 0 : 0.7, ease: [0.22, 1, 0.36, 1] }}
                className="h-full rounded-full bg-gradient-to-r from-[#6f86ff] via-[#8fa8ff] to-[#a78bfa]"
              />
            </div>
          </div>

          <ul className="space-y-2 text-start">
            {displaySteps.map((step) => (
              <StepRow key={step.key ?? step.label} step={step} />
            ))}
          </ul>

          <p className="text-[11px] text-[#6f7aa8]">
            تستغرق العملية عادة من دقيقة إلى دقيقتين.
          </p>
        </div>
      </div>
    </div>
  );
}

function StepRow({ step }: { step: JobStep }) {
  const reduce = useReducedMotion();
  const map = {
    pending: {
      icon: <span className="size-3 rounded-full border border-[#3f4fbf]" />,
      cls: "text-[#8d97c4]",
    },
    running: {
      icon: (
        <Loader2
          className={cn("size-3.5 text-[#8fa8ff]", !reduce && "animate-spin")}
          strokeWidth={2.5}
          aria-hidden="true"
        />
      ),
      cls: "text-[#eaf0ff]",
    },
    done: {
      icon: (
        <Check
          className="size-3.5 text-emerald-400"
          strokeWidth={3}
          aria-hidden="true"
        />
      ),
      cls: "text-emerald-300",
    },
    failed: {
      icon: (
        <AlertTriangle
          className="size-3.5 text-rose-400"
          strokeWidth={2.5}
          aria-hidden="true"
        />
      ),
      cls: "text-rose-300",
    },
  } as const;
  // أي حالة غير معروفة تُعرض كـ"قيد الانتظار" بدل أن تُسقط الصفحة.
  const s = map[step.status as keyof typeof map] ?? map.pending;
  return (
    <li className={cn("flex items-center gap-2.5 text-[11.5px] font-bold", s.cls)}>
      <span className="grid size-5 shrink-0 place-items-center">{s.icon}</span>
      <span>{step.label}</span>
    </li>
  );
}

function ReadyScreen({
  subdomain,
  storeName,
  storeUrl,
  adminUrl,
}: {
  subdomain: string;
  storeName: string;
  storeUrl: string;
  adminUrl: string;
}) {
  const reduce = useReducedMotion();
  const [copied, setCopied] = useState(false);

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(`https://${subdomain}.colapia.com`);
      setCopied(true);
      toast.success("تم نسخ الرابط");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("تعذّر النسخ. انسخ يدوياً.");
    }
  };

  return (
    <div
      dir="rtl"
      className="grid min-h-dvh place-items-center bg-[#07091a] px-5 py-10"
    >
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: reduce ? 0 : 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-md"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-12 -z-10"
        >
          <div className="absolute start-1/2 top-1/4 size-72 -translate-x-1/2 rounded-full bg-emerald-500/15 blur-3xl" />
        </div>

        <div className="space-y-5 rounded-3xl border border-emerald-500/25 bg-white/[0.02] p-6 text-center sm:p-8">
          <motion.div
            initial={reduce ? false : { scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{
              delay: reduce ? 0 : 0.15,
              duration: reduce ? 0 : 0.35,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="mx-auto grid size-20 place-items-center rounded-full bg-emerald-500/15 text-emerald-400"
          >
            <CheckCircle2 className="size-10" strokeWidth={1.5} aria-hidden="true" />
          </motion.div>

          <div className="space-y-1.5">
            <span className="inline-block rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-black text-emerald-300">
              متجرك مكتمل وجاهز
            </span>
            <h1 className="pt-2 text-2xl font-black text-white">
              مبروك، متجر {storeName} شغال
            </h1>
            <p className="text-[12.5px] leading-relaxed text-[#8d97c4]">
              تم بناء المتجر بمنتجاتك وتصميمه الفاخر. بدأت تجربتك النشطة (180
              دقيقة).
            </p>
          </div>

          <div className="space-y-1 rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-start">
            <span className="block text-[10.5px] font-bold text-[#6f7aa8]">
              رابط متجرك المباشر
            </span>
            <div className="flex items-center justify-between gap-2">
              <a
                href={storeUrl}
                target="_blank"
                rel="noopener noreferrer"
                dir="ltr"
                className="flex min-w-0 flex-1 items-center gap-1.5 font-mono text-[12px] font-black text-[#eaf0ff] transition-colors hover:text-white"
              >
                <span className="truncate">{subdomain}.colapia.com</span>
                <ExternalLink className="size-3.5 shrink-0 text-[#8d97c4]" aria-hidden="true" />
              </a>
              <button
                type="button"
                onClick={copyUrl}
                aria-label="نسخ الرابط"
                className="grid size-8 shrink-0 place-items-center rounded-lg border border-[#232b66] text-[#8d97c4] transition-colors hover:bg-white/5 hover:text-white"
              >
                {copied ? (
                  <Check className="size-3.5 text-emerald-400" strokeWidth={2.5} aria-hidden="true" />
                ) : (
                  <Copy className="size-3.5" strokeWidth={2} aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          <div className="space-y-2.5 pt-1">
            <a
              href={storeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-emerald-500 to-emerald-600 text-[12.5px] font-black text-white shadow-lg shadow-emerald-500/25 transition-all hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            >
              <Eye className="size-4" strokeWidth={2.25} aria-hidden="true" />
              معاينة متجرك الحي
            </a>

            <a
              href={adminUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-white/[0.06] text-[12.5px] font-bold text-[#eaf0ff] transition-colors hover:bg-white/[0.1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8fa8ff]/60"
            >
              <LayoutDashboard className="size-4" strokeWidth={2.25} aria-hidden="true" />
              فتح لوحة التحكم
            </a>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function FailedScreen({
  error,
  onRetry,
}: {
  error?: string;
  onRetry: () => Promise<string | null>;
}) {
  const [pending, setPending] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  return (
    <div
      dir="rtl"
      className="grid min-h-dvh place-items-center bg-[#07091a] px-5 py-10"
    >
      <div className="w-full max-w-md space-y-5 rounded-3xl border border-rose-500/25 bg-white/[0.02] p-6 text-center sm:p-8">
        <div className="mx-auto grid size-20 place-items-center rounded-full bg-rose-500/15 text-rose-400">
          <AlertTriangle className="size-10" strokeWidth={1.5} aria-hidden="true" />
        </div>
        <div className="space-y-1.5">
          <h1 className="text-xl font-black text-white">تعثّر بناء المتجر</h1>
          <p className="text-[12.5px] leading-relaxed text-[#8d97c4]">
            حدث تعثّر مؤقت أثناء تجهيز متجرك، وكل بياناتك محفوظة. اضغط «أعد البناء» وسنكمل من جديد خلال دقائق.
          </p>
        </div>
        {retryError ? <p role="alert" className="text-[12px] font-bold text-rose-300">{retryError}</p> : null}
        <button
          type="button"
          disabled={pending}
          onClick={async () => {
            setPending(true);
            setRetryError(await onRetry());
            setPending(false);
          }}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[#6f86ff] to-[#5b74ff] text-[12.5px] font-black text-white shadow-lg shadow-[#6f86ff]/25 transition-all hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8fa8ff]"
        >
          {pending ? "نعيد البناء..." : "أعد البناء"}
        </button>
      </div>
    </div>
  );
}