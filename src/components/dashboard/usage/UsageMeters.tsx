// UsageMeters — عدّادات حدود الباقة بهدوء (V3، D2): ما استُخدم وما بقي، ومتى يتجدد الشهري، وتلميح ترقية قبل الوصول للحد.
import Link from "next/link";
import { Check, Globe2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtNum } from "@/lib/format";
import { fmtStorage } from "@/lib/platform-pricing";
import { nextResetLabel, type Meter } from "@/lib/usage-limits";
import type { UsageSummary } from "@/server/usage";

const TONE = { ok: "bg-nova", warn: "bg-warn", bad: "bg-bad" } as const;

function MeterCard({ title, hint, m, format, monthly, upgrade }: { title: string; hint: string; m: Meter; format?: (n: number) => string; monthly?: boolean; upgrade?: string | null }) {
  const f = format ?? fmtNum;
  return (
    <section className="dash-card p-4" aria-label={title}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
        <h3 className="text-[14px] font-black text-ink">{title}</h3>
        <p className="text-[12.5px] tabular-nums text-ink-2">
          <b className="text-ink">{f(m.used)}</b> من {f(m.limit)}
        </p>
      </div>
      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-edge/[0.08]" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={m.pct} aria-label={`${title}: ${m.pct}%`}>
        <div className={cn("h-full rounded-full transition-[width]", TONE[m.tone])} style={{ width: `${Math.max(m.pct, m.used > 0 ? 2 : 0)}%` }} />
      </div>
      <p className="mt-2 text-[12px] leading-5 text-ink-3">
        {m.tone === "bad" ? (monthly ? `اكتمل حد هذا الشهر، ويتجدد في ${nextResetLabel()}.` : "اكتمل حد الباقة.") : `المتبقي ${f(m.remaining)}. ${hint}`}
        {upgrade && m.tone !== "ok" ? (
          <>
            {" "}
            <Link href="/dashboard/billing#plans" className="font-bold text-nova-2 underline-offset-4 hover:underline focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova/50">
              باقة «{upgrade}» تتيح أكثر
            </Link>
          </>
        ) : null}
      </p>
    </section>
  );
}

/** شبكة العدّادات وحدها (صفحتا الاشتراك والاستخدام). */
export function UsageGrid({ u }: { u: UsageSummary }) {
  const up = u.nextPlan?.name ?? null;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <MeterCard title="المنتجات" hint="كل منتج منشور أو مخفي في المتجر." m={u.products} upgrade={up} />
      <MeterCard title="مساحة الصور والفيديو" hint={u.storageMeasured ? "الصور تُضغط تلقائياً قبل الرفع فتتسع لعدد كبير." : "تقدير من حجم ما رُفع."} m={u.storage} format={fmtStorage} upgrade={up} />
      <MeterCard title="الفيديوهات" hint={`حتى ${fmtStorage(u.limits.videoMaxBytes)} للفيديو الواحد.`} m={u.videos} upgrade={up} />
      <MeterCard title="العمليات التلقائية هذا الشهر" hint="استيراد المنتجات وقراءة الصور والتعديل بالوصف واستوديو المحتوى." m={u.ai} monthly upgrade={up} />
      <MeterCard title="البحث بالصورة لزواركم هذا الشهر" hint="يتوقف البحث بالصورة وحده عند الحد ويعمل باقي المتجر." m={u.visualSearch} monthly upgrade={up} />
      <MeterCard title="أعضاء الفريق" hint="غير صاحب المتجر." m={u.team} upgrade={up} />
      <section className="dash-card flex items-center gap-3 p-4 sm:col-span-2" aria-label="النطاق الخاص">
        <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", u.customDomain ? "bg-ok/15 text-ok" : "bg-edge/[0.06] text-ink-3")} aria-hidden="true">
          <Globe2 className="size-4" />
        </span>
        <p className="min-w-0 flex-1 text-[13px] text-ink-2">
          <b className="text-ink">النطاق الخاص: </b>
          {u.customDomain ? "متاح في باقتكم، ويُربط من «النطاق الخاص» في القائمة." : `غير متاح في باقة «${u.planName}».`}
        </p>
        {u.customDomain ? <Check className="size-4 shrink-0 text-ok" aria-hidden="true" /> : <X className="size-4 shrink-0 text-ink-3" aria-hidden="true" />}
      </section>
    </div>
  );
}

export function UsageMeters({ u }: { u: UsageSummary }) {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <header className="border-b border-edge/10 pb-4">
        <h1 className="text-2xl font-black text-ink">الاستخدام</h1>
        <p className="mt-1 text-[13px] leading-6 text-ink-2">
          {u.isTrial ? `فترة التجربة بحدود باقة «${u.planName}».` : `حدود باقة «${u.planName}».`} الحدود الشهرية تتجدد في {nextResetLabel()}، والطلبات والزوار بلا حد.
        </p>
      </header>
      <UsageGrid u={u} />
      {u.aiByKind.length ? (
        <ul className="dash-card divide-y divide-edge/[0.07] text-[13px]" aria-label="تفصيل العمليات التلقائية هذا الشهر">
          {u.aiByKind.map((k) => (
            <li key={k.kind} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <span className="text-ink-2">{k.name}</span>
              <b className="tabular-nums text-ink">{fmtNum(k.used)}</b>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="text-[12px] leading-6 text-ink-3">
        لتغيير الباقة أو تجديدها:{" "}
        <Link href="/dashboard/billing" className="font-bold text-nova-2 underline-offset-4 hover:underline">
          صفحة الاشتراك
        </Link>
        .
      </p>
    </div>
  );
}
