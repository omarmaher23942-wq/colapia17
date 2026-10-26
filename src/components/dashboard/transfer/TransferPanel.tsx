"use client";

// TransferPanel — «نقل البيانات» إلى قاعدة Neon الخاصة بالعميل: لصق الرابط، تقدم عربي حي، وإعادة المحاولة.
// المتصفح يقود الخطوات بالتتابع (كل استدعاء يعمل ضمن ميزانية زمنية) حتى يكتمل النقل.
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { CheckCircle2, DatabaseZap, Loader2, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { retryTransferAction, startTransferAction, stepTransferAction } from "@/server/actions/data-transfer";
import type { StepResult } from "@/server/transfer";

export type TransferInit = {
  state: "none" | "running" | "failed" | "done";
  jobId: string | null;
  percent: number;
  label: string;
  error: string | null;
  hostHint: string | null;
  purgeLabel: string | null;
};

const STEP_LABEL: Record<StepResult["status"], string> = {
  queued: "تجهيز الجداول في قاعدتكم",
  copying: "نسخ بيانات المتجر",
  syncing: "المزامنة النهائية ومطابقة الأعداد",
  switching: "تحويل المتجر إلى قاعدتكم",
  done: "اكتمل النقل",
  failed: "تعذر إكمال النقل",
};

export function TransferPanel({ init }: { init: TransferInit }) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [jobId, setJobId] = useState(init.jobId);
  const [running, setRunning] = useState(init.state === "running");
  const [pct, setPct] = useState(init.percent);
  const [label, setLabel] = useState(init.label);
  const [error, setError] = useState<string | null>(init.error);
  const [done, setDone] = useState(init.state === "done");
  const [pending, start] = useTransition();
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const apply = useCallback(
    (s: StepResult) => {
      setPct(s.percent);
      setLabel(STEP_LABEL[s.status]);
      if (s.status === "done") {
        setRunning(false);
        setDone(true);
        setError(null);
        router.refresh();
      } else if (s.status === "failed") {
        setRunning(false);
        setError(s.error ?? "تعذر إكمال النقل.");
      }
      return s.status !== "done" && s.status !== "failed";
    },
    [router]
  );

  // يتابع الخطوات تلقائياً ما دام النقل جارياً (يستأنف أيضاً بعد إعادة فتح الصفحة).
  useEffect(() => {
    if (!running || !jobId) return;
    let stop = false;
    (async () => {
      while (!stop && alive.current) {
        const r = await stepTransferAction(jobId);
        if (!r.ok) {
          setRunning(false);
          setError(r.error);
          return;
        }
        if (!apply(r.step)) return;
        await new Promise((res) => setTimeout(res, 400));
      }
    })();
    return () => {
      stop = true;
    };
  }, [running, jobId, apply]);

  const begin = () =>
    start(async () => {
      setError(null);
      const r = await startTransferAction(url);
      if (!r.ok) return setError(r.error);
      setUrl(""); // الرابط لا يبقى في الصفحة
      setJobId(r.jobId);
      setLabel(STEP_LABEL[r.step.status]);
      setPct(r.step.percent);
      setRunning(apply(r.step));
    });

  const retry = () =>
    start(async () => {
      if (!jobId) return;
      setError(null);
      const r = await retryTransferAction(jobId);
      if (!r.ok) return setError(r.error);
      setRunning(apply(r.step));
    });

  if (done) {
    return (
      <section className="dash-card p-5" aria-live="polite">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-nova" aria-hidden />
          <div>
            <h2 className="text-[16px] font-black text-ink">بيانات متجركم الآن في قاعدتكم الخاصة</h2>
            <p className="mt-1 text-[13px] leading-6 text-ink-2">
              تُقرأ الطلبات والمنتجات والعملاء وتُكتب مباشرة في قاعدة Neon التي تملكونها{init.hostHint ? ` (${init.hostHint})` : ""}.
              {init.purgeLabel ? ` تبقى نسخة احتياطية مؤقتة عندنا ${init.purgeLabel}، ثم تُحذف.` : ""}
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="dash-card p-5" aria-labelledby="transfer-title">
      <div className="flex items-start gap-3">
        <DatabaseZap className="mt-0.5 size-6 shrink-0 text-nova" aria-hidden />
        <div className="min-w-0">
          <h2 id="transfer-title" className="text-[16px] font-black text-ink">
            نقل البيانات إلى قاعدتكم
          </h2>
          <p className="mt-1 text-[13px] leading-6 text-ink-2">
            أنشئوا قاعدة فارغة في حسابكم على Neon والصقوا رابطها هنا. تُنشأ الجداول وتُنسخ بيانات المتجر كلها ثم يتحول المتجر إلى قاعدتكم بعد مطابقة الأعداد. يستمر المتجر في العمل أثناء النسخ، وتتوقف الطلبات الجديدة لحظات قصيرة في المزامنة الأخيرة.
          </p>
        </div>
      </div>

      {running ? (
        <div className="mt-4" aria-live="polite">
          <div className="flex items-center justify-between text-[13px] font-bold text-ink">
            <span className="inline-flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" aria-hidden /> {label}
            </span>
            <span className="tabular-nums">{pct}%</span>
          </div>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-edge/[0.08]" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="تقدم النقل">
            <div className="h-full rounded-full bg-nova transition-[width]" style={{ width: `${Math.max(pct, 3)}%` }} />
          </div>
          <p className="mt-2 text-[12px] text-ink-3">أبقوا هذه الصفحة مفتوحة حتى يكتمل النقل. إن أُغلقت تُستأنف عند فتحها من جديد.</p>
        </div>
      ) : (
        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!pending) begin();
          }}
        >
          <label className="block text-[13px] font-bold text-ink" htmlFor="transfer-url">
            رابط قاعدة Neon
          </label>
          <input
            id="transfer-url"
            dir="ltr"
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="postgresql://…neon.tech/…?sslmode=require"
            className="w-full rounded-xl border border-edge/20 bg-transparent px-3 py-2.5 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-nova/50"
          />
          {error ? (
            <p role="alert" className="rounded-lg bg-bad/10 px-3 py-2 text-[13px] leading-6 text-bad">
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={pending || !url.trim()} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-nova px-4 text-[14px] font-black text-white disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova/50">
              {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              بدء النقل
            </button>
            {init.state === "failed" || (error && jobId) ? (
              <button type="button" onClick={retry} disabled={pending || !jobId} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-edge/20 px-4 text-[14px] font-bold text-ink disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova/50">
                <RotateCcw className="size-4" aria-hidden /> إعادة المحاولة من حيث توقف
              </button>
            ) : null}
          </div>
        </form>
      )}
      {running && error ? <p role="alert" className="mt-3 text-[13px] text-bad">{error}</p> : null}
    </section>
  );
}
