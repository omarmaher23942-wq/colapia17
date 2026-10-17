"use client";

// GoalCard — «هدف الشهر»: هدف المبيعات ووتيرته الفعلية، والإنفاق الإعلاني وصافي الربح والعائد، وتوصيات الأسبوع من بيانات المتجر.
// كل رقم من بيانات المتجر؛ إن لم يُدخل التاجر هدفاً أو إنفاقاً تظهر دعوة لإدخاله بدل رقم مخترع.
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Lightbulb, Pencil, Target } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatEgp } from "@/lib/money";
import { fmtDec, fmtNum } from "@/lib/format";
import { toNumber } from "../product/model";
import { PACE_TEXT } from "@/lib/sales-goal";
import { saveAdSpendAction, saveSalesGoalAction } from "@/server/actions/growth";
import type { GrowthData } from "@/server/repos/growth";

const TONE = { reached: "bg-ok", ahead: "bg-ok", on_track: "bg-nova", behind: "bg-warn", none: "bg-nova" } as const;
const input = "min-h-11 w-full rounded-xl border border-edge/10 bg-transparent px-3 text-[13px] tabular-nums text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova";

export function GoalCard({ g }: { g: GrowthData }) {
  const router = useRouter();
  const [editGoal, setEditGoal] = useState(false);
  const [goal, setGoal] = useState(g.goalEgp ? String(g.goalEgp) : "");
  const [spend, setSpend] = useState(g.adSpendEgp ? String(g.adSpendEgp) : "");
  const [pending, start] = useTransition();
  const p = g.pace;

  const saveGoal = () =>
    start(async () => {
      const n = goal.trim() ? toNumber(goal) : null;
      if (n !== null && (!Number.isFinite(n) || n < 0)) return void toast.error("أدخلوا هدفاً صحيحاً بالجنيه");
      const r = await saveSalesGoalAction(n).catch(() => ({ ok: false as const, error: "انقطع الاتصال" }));
      if (!r.ok) return void toast.error(r.error);
      toast.success(n ? "حُفظ هدف الشهر" : "أُزيل الهدف");
      setEditGoal(false);
      router.refresh();
    });
  const saveSpend = () =>
    start(async () => {
      const n = spend.trim() ? toNumber(spend) : 0;
      if (n === null || !Number.isFinite(n) || n < 0) return void toast.error("أدخلوا مبلغاً صحيحاً بالجنيه");
      const r = await saveAdSpendAction(n).catch(() => ({ ok: false as const, error: "انقطع الاتصال" }));
      if (!r.ok) return void toast.error(r.error);
      toast.success("حُفظ إنفاق الإعلانات");
      router.refresh();
    });

  return (
    <section className="grid gap-4 lg:grid-cols-5" aria-label="هدف الشهر والأرباح">
      <div className="dash-card space-y-3 p-4 lg:col-span-3">
        <header className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-[14px] font-black text-ink">
            <Target className="size-4 text-nova-2" aria-hidden="true" />
            هدف هذا الشهر
          </h2>
          {g.goalEgp && !editGoal ? (
            <button type="button" onClick={() => setEditGoal(true)} className="inline-flex min-h-10 items-center gap-1.5 text-[12px] font-bold text-ink-2 hover:text-ink">
              <Pencil className="size-3.5" aria-hidden="true" />
              تعديل
            </button>
          ) : null}
        </header>
        {g.goalEgp && !editGoal ? (
          <>
            <p className="flex flex-wrap items-baseline gap-x-2 text-ink">
              <b className="text-[24px] font-black tabular-nums">{formatEgp(g.soldPiasters)}</b>
              <span className="text-[12.5px] text-ink-2">من {formatEgp(g.goalEgp * 100)} ({fmtNum(p.pct)}%)</span>
            </p>
            <div className="relative h-3 overflow-hidden rounded-full bg-edge/[0.08]" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, p.pct)} aria-label={`تحقق ${p.pct}% من هدف الشهر`}>
              <div className={cn("h-full rounded-full transition-[width]", TONE[p.status])} style={{ width: `${Math.min(100, p.pct)}%` }} />
              <span className="absolute inset-y-0 w-0.5 bg-ink/50" style={{ insetInlineStart: `${Math.min(100, p.expectedPct)}%` }} aria-hidden="true" />
            </div>
            <p className="text-[12.5px] leading-6 text-ink-2">
              {p.status !== "none" ? PACE_TEXT[p.status] : ""}{" "}
              {p.status !== "reached" && p.daysLeft > 0 ? `المتوقع بنهاية الشهر ${formatEgp(p.projectedPiasters)}. المطلوب يومياً للوصول للهدف ${formatEgp(p.perDayNeededPiasters)} (باقٍ ${fmtNum(p.daysLeft)} يوماً).` : ""}
            </p>
          </>
        ) : (
          <div className="space-y-2">
            <p className="text-[12.5px] leading-6 text-ink-2">{g.goalEgp ? "عدّلوا الهدف الشهري" : "حدّدوا هدفاً لمبيعات هذا الشهر لنعرض لكم وتيرتكم الفعلية وما يلزم يومياً للوصول إليه."}</p>
            <div className="flex gap-2">
              <input aria-label="هدف المبيعات الشهري بالجنيه" inputMode="numeric" value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="مثال: 50000" className={input} />
              <button type="button" disabled={pending} onClick={saveGoal} className="min-h-11 shrink-0 rounded-xl bg-gradient-to-b from-nova to-nova-deep px-5 text-[13px] font-black text-white disabled:opacity-50">
                حفظ
              </button>
              {editGoal ? (
                <button type="button" onClick={() => setEditGoal(false)} className="min-h-11 shrink-0 rounded-xl border border-edge/10 px-4 text-[13px] font-bold text-ink-2">
                  إلغاء
                </button>
              ) : null}
            </div>
          </div>
        )}
      </div>

      <div className="dash-card space-y-3 p-4 lg:col-span-2">
        <h2 className="text-[14px] font-black text-ink">الربح بعد الإعلانات</h2>
        <div className="flex gap-2">
          <label className="block flex-1 text-[11.5px] font-bold text-ink-3">
            إنفاق الإعلانات هذا الشهر (ج)
            <input inputMode="numeric" value={spend} onChange={(e) => setSpend(e.target.value)} placeholder="0" className={cn(input, "mt-1")} />
          </label>
          <button type="button" disabled={pending} onClick={saveSpend} className="mt-[1.1rem] min-h-11 shrink-0 self-end rounded-xl border border-edge/10 px-4 text-[13px] font-bold text-ink hover:bg-edge/[0.06] disabled:opacity-50">
            حفظ
          </button>
        </div>
        <dl className="grid grid-cols-2 gap-3 text-[12px]">
          <div>
            <dt className="text-ink-3">صافي الربح التقديري</dt>
            <dd className="mt-0.5 text-[17px] font-black tabular-nums text-ink">{g.netProfitPiasters === null ? "—" : formatEgp(g.netProfitPiasters)}</dd>
          </div>
          <div>
            <dt className="text-ink-3">العائد على الإعلان</dt>
            <dd className="mt-0.5 text-[17px] font-black tabular-nums text-ink">{g.roas === null ? "—" : `${fmtDec(g.roas)}×`}</dd>
          </div>
        </dl>
        <p className="text-[11.5px] leading-5 text-ink-3">
          {g.profitPiasters === null
            ? "أضيفوا سعر التكلفة لمنتجاتكم ليظهر صافي الربح."
            : `الربح من المنتجات التي لها سعر تكلفة (${fmtNum(Math.round(g.profitCoverage * 100))}% من المبيعات) بعد الخصومات ثم ناقص إنفاق الإعلانات.`}{" "}
          {g.roas === null ? "أدخلوا إنفاق الإعلانات ليظهر عائده." : "العائد = مبيعات الشهر ÷ إنفاق الإعلانات."}
        </p>
      </div>

      {g.recommendations.length ? (
        <div className="dash-card p-4 lg:col-span-5">
          <h2 className="flex items-center gap-2 text-[14px] font-black text-ink">
            <Lightbulb className="size-4 text-warn" aria-hidden="true" />
            توصيات الأسبوع من بياناتكم
          </h2>
          <ul className="mt-3 grid gap-3 md:grid-cols-3">
            {g.recommendations.map((r) => (
              <li key={r.key} className="rounded-xl bg-edge/[0.04] p-3">
                <p className="text-[13px] font-black text-ink">{r.title}</p>
                <p className="mt-1 text-[12px] leading-6 text-ink-2">{r.text}</p>
                <Link href={r.href} className="mt-1.5 inline-flex min-h-9 items-center gap-1 text-[12px] font-bold text-nova-2 hover:text-ink">
                  افتحوا
                  <ArrowLeft className="size-3.5" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
