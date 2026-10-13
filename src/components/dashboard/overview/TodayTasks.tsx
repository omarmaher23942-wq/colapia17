"use client";

// TodayTasks — «مهام اليوم» أعلى النظرة العامة (الجولة 3.1): بنود الانتباه الحية من نبض اللوحة + المتأخر في الشحن
// والتسليم + طلبات التقييم الجاهزة برسالة واتساب لكل عميل، وسطر بما أُنجز اليوم. أول مهمة عاجلة تظهر بارزة.
// حين لا يوجد ما ينتظر: «لا مهام عاجلة» واقتراح نمو واحد صادق (إن وُجد).
import { useState, useTransition } from "react";
import Link from "next/link";
import { CheckCircle2, ChevronLeft, Star } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { arCount, NOUN } from "@/lib/format";
import { doneLine, todayTasks, type TodayExtras } from "@/lib/today-tasks";
import { markOrderContactedAction } from "@/server/actions/orders";
import { BrandIcon } from "@/components/storefront/brand-icons";
import { useDashboardPulse } from "../DashboardPulse";
import { ATTENTION_TONE } from "../attention-items";

export type ReviewAsk = { id: string; code: string; name: string; href: string | null };

export function TodayTasks({ extras, asks: initialAsks, asksTotal, canMessage }: { extras: TodayExtras; asks: ReviewAsk[]; asksTotal: number; canMessage: boolean }) {
  const { counts, ready } = useDashboardPulse();
  const [asks, setAsks] = useState(initialAsks);
  const [sent, setSent] = useState(0);
  const [, start] = useTransition();
  if (!ready) return null;

  const tasks = todayTasks(counts, extras);
  const urgent = tasks.filter((t) => t.urgent);
  const lead = urgent[0];
  const rest = tasks.filter((t) => t !== lead);
  const done = doneLine({ ...extras.done, asked: extras.done.asked + sent });
  const shownAsks = canMessage ? asks.filter((a) => a.href) : [];
  const remainingAsks = Math.max(0, asksTotal - (initialAsks.length - asks.length));

  const markSent = (id: string) =>
    start(async () => {
      const r = await markOrderContactedAction(id);
      if (!r.ok) return void toast.error(r.error);
      setAsks((all) => all.filter((a) => a.id !== id));
      setSent((n) => n + 1);
    });

  return (
    <section aria-labelledby="today-title" className="space-y-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id="today-title" className="text-[15px] font-black text-ink">مهام اليوم</h2>
        {done ? (
          <p className="flex items-center gap-1.5 text-[12px] font-bold text-ok">
            <CheckCircle2 className="size-3.5" aria-hidden="true" /> {done}
          </p>
        ) : null}
      </div>

      {lead ? (
        <Link
          href={lead.href}
          className="dash-card group flex items-center gap-3 border-nova/25 p-4 transition hover:border-nova/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova"
        >
          <span className={cn("grid size-11 shrink-0 place-items-center rounded-2xl", ATTENTION_TONE[lead.tone])}>
            <lead.icon className="size-5" strokeWidth={2} aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-bold text-ink-3">ابدأ بهذه</span>
            <span className="block text-[14px] font-black leading-6 text-ink">
              {lead.title} <span className="text-nova-2">· {lead.chip}</span>
            </span>
            <span className="mt-0.5 block text-[12px] leading-5 text-ink-3">{lead.desc}</span>
          </span>
          <ChevronLeft className="size-5 shrink-0 text-ink-3 transition group-hover:-translate-x-0.5 group-hover:text-ink" aria-hidden="true" />
        </Link>
      ) : (
        <p className="dash-card flex items-center gap-2.5 p-4 text-[13px] font-bold text-ink-2">
          <CheckCircle2 className="size-5 text-ok" aria-hidden="true" /> لا مهام عاجلة الآن. كل طلب وإيصال وتقييم تم التعامل معه.
        </p>
      )}

      {rest.length ? (
        <ul className="grid grid-cols-2 gap-2 sm:gap-2.5 xl:grid-cols-3">
          {rest.map((it) => (
            <li key={it.key}>
              <Link
                href={it.href}
                title={it.desc}
                className="dash-card group flex h-full min-h-16 flex-col items-start gap-2 p-3 transition hover:border-nova/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova sm:flex-row sm:items-center sm:gap-3 sm:p-3.5"
              >
                <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl sm:size-10", ATTENTION_TONE[it.tone])}>
                  <it.icon className="size-[18px]" strokeWidth={2} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[12.5px] font-black leading-5 text-ink sm:truncate">{it.title}</span>
                  <span className="mt-0.5 block text-[12px] font-bold text-ink-2">{it.chip}</span>
                </span>
                <ChevronLeft className="hidden size-4 shrink-0 text-ink-3 transition group-hover:-translate-x-0.5 group-hover:text-ink sm:block" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      {shownAsks.length ? (
        <div className="dash-card space-y-2 p-4">
          <p className="flex items-center gap-2 text-[13px] font-black text-ink">
            <Star className="size-4 text-warn" aria-hidden="true" /> اطلب تقييماً ممن استلموا
            <span className="rounded-full bg-warn/12 px-2 py-0.5 text-[11px] text-warn">{arCount(remainingAsks, NOUN.customer)}</span>
          </p>
          <p className="text-[12px] leading-5 text-ink-3">التقييمات الحقيقية ترفع ثقة الزائر الجديد. الرسالة جاهزة برابط التقييم الخاص بطلب كل عميل.</p>
          <ul className="divide-y divide-edge/10">
            {shownAsks.map((a) => (
              <li key={a.id} className="flex items-center gap-3 py-2">
                <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-ink">
                  {a.name} <span className="font-mono text-[11.5px] font-normal text-ink-3" dir="ltr">{a.code}</span>
                </span>
                <a
                  href={a.href!}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setTimeout(() => markSent(a.id), 400)}
                  className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-xl bg-[#25D366] px-3 text-[12px] font-black text-white"
                >
                  <BrandIcon brand="whatsapp" className="size-4" /> إرسال الطلب
                </a>
                <button type="button" onClick={() => markSent(a.id)} className="shrink-0 text-[11.5px] font-bold text-ink-3 hover:text-ink">
                  تخطٍّ
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
