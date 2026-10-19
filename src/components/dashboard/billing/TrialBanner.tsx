"use client";

// TrialBanner — عدّاد التجربة التنازلي أعلى كل صفحات اللوحة (V3، D3)، ولافتة القفل حين يتجمد المتجر أو يتوقف (D4).
// العدّاد حي: كل ثانية في الساعة الأخيرة، وكل 30 ثانية قبلها، ويتوقف حين تكون الصفحة مخفية. عند الصفر يحدّث الصفحة
// فيأتي قرار الخادم (التجميد يقفل اللوحة). الأرقام ثابتة العرض فلا تهتز اللافتة.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Clock, Hourglass, Lock, PauseCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { countdownParts } from "@/lib/trial-countdown";

export function TrialBanner({ endsAt, reviewPending }: { endsAt: string; reviewPending: boolean }) {
  const router = useRouter();
  const end = new Date(endsAt).getTime();
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let refreshed = false;
    const tick = () => {
      const t = Date.now();
      setNow(t);
      const left = end - t;
      if (left <= 0) {
        if (!refreshed) {
          refreshed = true;
          router.refresh();
        }
        return;
      }
      if (document.visibilityState === "hidden") return;
      timer = setTimeout(tick, left <= 3_600_000 ? 1000 : 30_000);
    };
    const onVis = () => {
      if (document.visibilityState === "visible") {
        if (timer) clearTimeout(timer);
        tick();
      }
    };
    tick();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [end, router]);

  const p = countdownParts(end - (now ?? end - 1));
  const urgent = p.totalMs <= 2 * 3_600_000;
  const label = reviewPending ? "إيصالكم قيد المراجعة، ولن يتجمد المتجر أثناءها" : p.totalMs <= 0 ? "انتهت التجربة المجانية" : "التجربة المجانية تنتهي خلال";

  return (
    <div
      role="status"
      aria-live="off"
      className={cn(
        "mb-5 flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border p-3.5 sm:p-4",
        urgent && !reviewPending ? "border-bad/35 bg-bad/[0.07]" : "border-nova/30 bg-nova/[0.06]"
      )}
    >
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl text-white", urgent && !reviewPending ? "bg-bad" : "bg-nova")} aria-hidden="true">
        {reviewPending ? <Clock className="size-5" /> : <Hourglass className="size-5" />}
      </span>
      <div className="min-w-0 flex-1 basis-52">
        <p className="text-[13px] font-black text-ink">{label}</p>
        {!reviewPending && p.totalMs > 0 ? (
          <p className="mt-1 flex items-baseline gap-1.5 font-black tabular-nums text-ink" dir="ltr" aria-label={p.spoken}>
            {now === null ? (
              <span className="inline-block h-6 w-40 animate-pulse rounded bg-edge/10" />
            ) : (
              <>
                {p.days > 0 ? <Unit n={p.days} u="ي" /> : null}
                <Unit n={p.hours} u="س" />
                <Unit n={p.minutes} u="د" />
                {p.days === 0 ? <Unit n={p.seconds} u="ث" /> : null}
              </>
            )}
          </p>
        ) : (
          <p className="mt-0.5 text-[12px] leading-5 text-ink-2">
            {reviewPending ? "نراجع الإيصال بأنفسنا، ويصلكم بريد فور التفعيل." : "يتجمد المتجر الآن حتى يتم الدفع، وكل بياناته محفوظة."}
          </p>
        )}
      </div>
      {!reviewPending ? (
        <Link
          href="/dashboard/billing"
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-nova to-nova-deep px-5 text-[13px] font-black text-white shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova/60 focus-visible:ring-offset-2 sm:w-auto"
        >
          تفعيل المتجر
          <ArrowLeft className="size-4" aria-hidden="true" />
        </Link>
      ) : null}
    </div>
  );
}

function Unit({ n, u }: { n: number; u: string }) {
  return (
    <span className="inline-flex items-baseline gap-0.5">
      <span className="inline-block min-w-[2ch] text-center text-[20px] leading-none">{String(n).padStart(2, "0")}</span>
      <span className="text-[11px] font-bold text-ink-3">{u}</span>
    </span>
  );
}

/** لافتة القفل: المتجر مجمّد أو متوقف، واللوحة مقفلة إلا الاشتراك. */
export function LockBanner({ lock }: { lock: "frozen" | "paused" }) {
  const Icon = lock === "paused" ? PauseCircle : Lock;
  return (
    <div role="status" className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border border-bad/35 bg-bad/[0.07] p-4">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-bad text-white" aria-hidden="true">
        <Icon className="size-5" />
      </span>
      <div className="min-w-0 flex-1 basis-56">
        <p className="text-[14px] font-black text-ink">{lock === "paused" ? "متجركم متوقف لانتهاء الاشتراك" : "متجركم مجمّد لانتهاء التجربة"}</p>
        <p className="mt-0.5 text-[12px] leading-5 text-ink-2">اللوحة مقفلة إلا صفحة الاشتراك. كل البيانات محفوظة، وبمجرد قبول الدفع يعود كل شيء كما كان.</p>
      </div>
      <Link href="/dashboard/billing" className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-nova to-nova-deep px-5 text-[13px] font-black text-white shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova/60 focus-visible:ring-offset-2 sm:w-auto">
        صفحة الاشتراك
        <ArrowLeft className="size-4" aria-hidden="true" />
      </Link>
    </div>
  );
}
