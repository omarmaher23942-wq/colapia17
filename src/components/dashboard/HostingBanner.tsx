// HostingBanner — شريط اشتراك الاستضافة أعلى صفحات اللوحة (lib/hosting.ts): قبل الانتهاء بشهر، وفي السماح، وعند الإيقاف.
// زر واحد إلى صفحة الدفع. لا يظهر في صفحة الدفع نفسها.
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
          title: `باقٍ على انتهاء اشتراك متجرك ${arCount(state.daysLeft, NOUN.day)}`,
          text: `في ${day.format(state.expiresAt)}. جدّد الآن وتُضاف السنة الجديدة بعد هذا التاريخ.`,
          cta: "جدّد الاشتراك",
        }
      : state.phase === "grace"
        ? {
            tone: "bad" as const,
            icon: AlertTriangle,
            title: "انتهت سنة الاستضافة",
            text: `متجرك يعمل حتى ${day.format(state.pauseAt)} (باقٍ ${arCount(state.daysLeft, NOUN.day)})، ثم يتوقف عن الظهور للزوار حتى تجدد. لا يُحذف شيء.`,
            cta: "جدّد الآن",
          }
        : {
            tone: "bad" as const,
            icon: PauseCircle,
            title: "متجرك متوقف مؤقتاً عن الظهور للزوار",
            text: "لانتهاء الاستضافة. كل بياناتك محفوظة، وبمجرد التجديد يعود فوراً.",
            cta: "جدّد وأعد متجرك",
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
      <Link href="/dashboard/billing" className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-nova to-nova-deep px-5 text-[13px] font-black text-white shadow-md sm:w-auto">
        {view.cta}
        <ArrowLeft className="size-4" aria-hidden="true" />
      </Link>
    </div>
  );
}
