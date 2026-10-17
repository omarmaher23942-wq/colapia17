// UsageMeters — عدّادات الاستخدام الشهري بهدوء: ما استُخدم وما بقي ومتى يتجدد، بلا ضغط ولا تخويف.
import { cn } from "@/lib/utils";
import { fmtNum } from "@/lib/format";
import { fmtBytes, nextResetLabel, type Meter } from "@/lib/usage-limits";
import type { UsageSummary } from "@/server/usage";

const TONE = { ok: "bg-nova", warn: "bg-warn", bad: "bg-bad" } as const;

function MeterCard({ title, hint, m, format }: { title: string; hint: string; m: Meter; format?: (n: number) => string }) {
  const f = format ?? fmtNum;
  return (
    <section className="dash-card p-4" aria-label={title}>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-[14px] font-black text-ink">{title}</h2>
        <p className="text-[12.5px] tabular-nums text-ink-2">
          <b className="text-ink">{f(m.used)}</b> من {f(m.limit)}
        </p>
      </div>
      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-edge/[0.08]" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={m.pct} aria-label={`${title}: ${m.pct}%`}>
        <div className={cn("h-full rounded-full transition-[width]", TONE[m.tone])} style={{ width: `${Math.max(m.pct, m.used > 0 ? 2 : 0)}%` }} />
      </div>
      <p className="mt-2 text-[12px] leading-5 text-ink-3">
        {m.tone === "bad" ? `اكتمل الحد. يتجدد في ${nextResetLabel()}.` : `المتبقي ${f(m.remaining)}. ${hint}`}
      </p>
    </section>
  );
}

export function UsageMeters({ u }: { u: UsageSummary }) {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <header className="border-b border-edge/10 pb-4">
        <h1 className="text-2xl font-black text-ink">الاستخدام</h1>
        <p className="mt-1 text-[13px] leading-6 text-ink-2">
          لكل متجر حد شهري يحمي الخدمة من الاستخدام المفرط ويكفي التشغيل المعتاد. تتجدد العدّادات في {nextResetLabel()}.
          {u.isTrial ? " حدود فترة التجربة أقل من حدود الاشتراك، وترتفع بمجرد تفعيل المتجر." : ""}
        </p>
      </header>
      <MeterCard title="العمليات الذكية" hint="تشمل استيراد المنتجات وكتابة الأوصاف وتعديل الشكل واستوديو المحتوى." m={u.ai} />
      {u.aiByKind.length ? (
        <ul className="dash-card divide-y divide-edge/[0.07] text-[13px]" aria-label="تفصيل العمليات الذكية">
          {u.aiByKind.map((k) => (
            <li key={k.kind} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <span className="text-ink-2">{k.name}</span>
              <b className="tabular-nums text-ink">{fmtNum(k.used)}</b>
            </li>
          ))}
        </ul>
      ) : null}
      <MeterCard title="رفع الصور" hint="عدد الصور المرفوعة هذا الشهر." m={u.images} />
      <MeterCard title="مساحة الصور" hint="الصور تُضغط تلقائياً قبل الرفع فتتسع لعدد كبير." m={u.imageBytes} format={fmtBytes} />
      <MeterCard title="رفع الفيديو" hint={`الحد الأقصى لحجم الفيديو الواحد ${fmtBytes(u.videoMaxBytes)}.`} m={u.videos} />
      <p className="text-[12px] leading-6 text-ink-3">إن احتجتم حداً أعلى لموسم إطلاق أو حملة كبيرة، اطلبوه من «طلب تعديل من الفريق» وسنراجعه معكم.</p>
    </div>
  );
}
