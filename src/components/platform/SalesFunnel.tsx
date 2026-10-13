// SalesFunnel — قمع المبيعات في مركز القيادة (الجولة 4.1): المحادثات ← الاستمارات ← التسليم ← الدفع بنسبة كل خطوة،
// وقمع رسائل التواصل، ومقاعد «الدائرة الذهبية»، وتحويل التجربة لمن سُلّموا في الفترة، وأضعف خطوة مع نصيحة.
import Link from "next/link";
import { Crown, TrendingDown } from "lucide-react";
import { formatEgp } from "@/lib/money";
import { FUNNEL_RANGES, STEP_ADVICE, funnelSteps, outreachSteps, weakestStep, type FunnelCounts, type FunnelRange, type FunnelStep } from "@/lib/sales-funnel";

const n = (v: number) => v.toLocaleString("en-US");

export function SalesFunnel({ counts, range, golden }: { counts: FunnelCounts; range: FunnelRange; golden: { code: string; used: number; seats: number } }) {
  const main = funnelSteps(counts);
  const out = outreachSteps(counts.outreach);
  const weak = weakestStep(main) ?? (counts.outreach.sent ? weakestStep(out) : null);
  const trialRate = counts.delivered > 0 ? Math.round((counts.deliveredCohortPaid / counts.delivered) * 100) : null;
  const seatsLeft = Math.max(0, golden.seats - golden.used);

  return (
    <section className="space-y-4 rounded-3xl border border-white/10 bg-[#0e1424] p-5 sm:p-6" aria-labelledby="funnel-title">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="funnel-title" className="text-base font-black text-white">قمع المبيعات</h2>
          <p className="text-xs text-[#8d97c4]">من أول محادثة إلى الدفع، ونسبة كل خطوة من التي قبلها.</p>
        </div>
        <nav aria-label="الفترة" className="inline-flex rounded-xl border border-white/10 p-1">
          {FUNNEL_RANGES.map((d) => (
            <Link key={d} href={`/admin?range=${d}`} aria-current={d === range ? "page" : undefined} className={`rounded-lg px-3 py-1.5 text-xs font-bold ${d === range ? "bg-[#6f86ff] text-[#07091a]" : "text-[#8d97c4] hover:text-white"}`}>
              {d} يوماً
            </Link>
          ))}
        </nav>
      </header>

      <Steps steps={main} />

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="إيراد الباقات" value={formatEgp(counts.revenue)} note={counts.renewals ? `${n(counts.renewals)} تجديد أيضاً` : "بلا تجديدات في الفترة"} />
        <Stat label="تحويل التجربة" value={trialRate === null ? "—" : `${trialRate}%`} note={counts.delivered ? `${n(counts.deliveredCohortPaid)} من ${n(counts.delivered)} سُلّموا في الفترة دفعوا` : "لا تسليمات في الفترة"} />
        <Link href="/admin/pricing" className="rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] p-4 transition hover:bg-amber-400/10">
          <p className="flex items-center gap-1.5 text-xs font-bold text-amber-200">
            <Crown className="size-3.5" aria-hidden="true" /> الدائرة الذهبية ({golden.code})
          </p>
          <p className="mt-1 font-mono text-2xl font-black text-white">
            {n(golden.used)}/{n(golden.seats)}
          </p>
          <p className="text-xs text-[#8d97c4]">{seatsLeft ? `باقٍ ${n(seatsLeft)} مقاعد` : "اكتملت المقاعد"}</p>
        </Link>
      </div>

      {counts.outreach.sent > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-black text-[#c5cdf0]">رسائل التواصل مع البراندات</p>
          <Steps steps={out} small />
        </div>
      ) : null}

      {weak && STEP_ADVICE[weak.key] ? (
        <p className="flex items-start gap-2 rounded-2xl border border-rose-400/20 bg-rose-500/[0.06] p-3 text-xs leading-6 text-rose-100">
          <TrendingDown className="mt-1 size-4 shrink-0 text-rose-300" aria-hidden="true" />
          <span>
            <b>أضعف خطوة: {weak.label} ({weak.rate}%).</b> {STEP_ADVICE[weak.key]}
          </span>
        </p>
      ) : null}
    </section>
  );
}

function Steps({ steps, small }: { steps: FunnelStep[]; small?: boolean }) {
  const max = Math.max(1, ...steps.map((s) => s.value));
  return (
    <ol className={`grid gap-2 ${small ? "grid-cols-3" : "grid-cols-2 lg:grid-cols-4"}`}>
      {steps.map((s) => (
        <li key={s.key} className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
          <p className="text-[11px] font-bold text-[#8d97c4]">{s.label}</p>
          <p className={`font-mono font-black text-white ${small ? "text-lg" : "text-2xl"}`}>{n(s.value)}</p>
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/[0.06]">
            <div className="h-full rounded-full bg-[#6f86ff]" style={{ width: `${Math.round((s.value / max) * 100)}%` }} />
          </div>
          <p className="mt-1 text-[11px] text-[#8d97c4]">{s.rate === null ? s.hint : `${s.rate}% ${s.hint}`}</p>
        </li>
      ))}
    </ol>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
      <p className="text-xs font-bold text-[#8d97c4]">{label}</p>
      <p className="mt-1 font-mono text-2xl font-black text-white">{value}</p>
      <p className="text-xs text-[#8d97c4]">{note}</p>
    </div>
  );
}
