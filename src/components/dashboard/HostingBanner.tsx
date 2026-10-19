// HostingBanner — شريط اشتراك الاستضافة أعلى صفحات اللوحة (lib/hosting.ts): قبل الانتهاء بشهر، وفي السماح.
// بعد السماح يتوقف المتجر وتُقفل اللوحة (LockBanner في billing/TrialBanner.tsx). زر واحد إلى صفحة الاشتراك.
import Link from "next/link";
import { AlertTriangle, ArrowLeft, PauseCircle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { arCount, NOUN } from "@/lib/format";
import type { HostingState } from "@/lib/hosting";

const day = new Intl.DateTimeFormat("ar-EG-u-nu-latn", { day: "numeric", month: "long", timeZone: "Africa/Cairo" });

export function HostingBanner({ state }: { state: Exclude<HostingState, { phase: "none" | "offline" }> }) {
  const view =
    state.phase === "renew_soon" || state.phase === "active"
      ? {
          tone: "warn" as const,
          icon: RefreshCw,
          title: `باقٍ على انتهاء اشتراك متجركم ${arCount(state.daysLeft, NOUN.day)}`,
          text: `في ${day.format(state.expiresAt)}. بالتجديد الآن تُضاف المدة الجديدة بعد هذا التاريخ فلا يضيع يوم.`,
          cta: "تجديد الاشتراك",
        }
      : state.phase === "grace"
        ? {
            tone: "bad" as const,
            icon: AlertTriangle,
            title: "انتهت مدة الاشتراك",
            text: `متجركم يعمل حتى ${day.format(state.pauseAt)} (باقٍ ${arCount(state.daysLeft, NOUN.day)})، ثم يتوقف عن الظهور للزوار وتُقفل اللوحة حتى التجديد. لا يُحذف شيء.`,
            cta: "التجديد الآن",
          }
        : {
            tone: "bad" as const,
            icon: PauseCircle,
            title: "متجركم متوقف مؤقتاً عن الظهور للزوار",
            text: "لانتهاء الاشتراك. كل البيانات محفوظة، وبمجرد التجديد يعود فوراً.",
            cta: "التجديد وإعادة المتجر",
          };
  const Icon = view.icon;
  return (
    <div
      role="status"
      className={cn(
        "mb-5 flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border p-4",
        view.tone === "bad" ? "border-bad/35 bg-bad/[0.07]" : "border-warn/35 bg-warn/[0.07]"
      )}
    >
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl text-white", view.tone === "bad" ? "bg-bad" : "bg-warn")} aria-hidden="true">
        <Icon className="size-5" />
      </span>
      <div className="min-w-0 flex-1 basis-56">
        <p className="text-[14px] font-black text-ink">{view.title}</p>
        <p className="mt-0.5 text-[12px] leading-5 text-ink-2">{view.text}</p>
      </div>
      <Link
        href="/dashboard/billing"
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-nova to-nova-deep px-5 text-[13px] font-black text-white shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova/60 focus-visible:ring-offset-2 sm:w-auto"
      >
        {view.cta}
        <ArrowLeft className="size-4" aria-hidden="true" />
      </Link>
    </div>
  );
}
