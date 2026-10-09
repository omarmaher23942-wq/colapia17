"use client";

// OwnDeadlineBanner — شريط في أعلى كل صفحات اللوحة لمتجر مدفوع لم يُنقل بعد (lib/ownership-window.ts):
// العدّ التنازلي لمهلة النقل وزر واحد إلى «امتلك متجرك». يتحدث كل دقيقة، وكل ثانية في الساعة الأخيرة.
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, KeyRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { arCount, type ArNoun } from "@/lib/format";

const HOUR: ArNoun = { one: "ساعة", two: "ساعتان", few: "ساعات", many: "ساعة", other: "ساعة" };
const MINUTE: ArNoun = { one: "دقيقة", two: "دقيقتان", few: "دقائق", many: "دقيقة", other: "دقيقة" };
const DAY: ArNoun = { one: "يوم", two: "يومان", few: "أيام", many: "يوماً", other: "يوم" };

/** «3 أيام و 5 ساعات»، «ساعتان و 10 دقائق». (مسافة بعد الواو: بعض الخطوط تشوّه «و» الملاصقة لرقم.) */
function left(ms: number): string {
  const m = Math.max(0, Math.floor(ms / 60_000));
  const h = Math.floor(m / 60);
  const mm = m % 60;
  if (h >= 48) {
    const d = Math.floor(h / 24);
    const hh = h % 24;
    return hh ? `${arCount(d, DAY)} و ${arCount(hh, HOUR)}` : arCount(d, DAY);
  }
  if (h >= 1) return mm ? `${arCount(h, HOUR)} و ${arCount(mm, MINUTE)}` : arCount(h, HOUR);
  return arCount(Math.max(1, mm), MINUTE);
}

export function OwnDeadlineBanner({ deadline, serverNow }: { deadline: string; serverNow: number }) {
  const end = new Date(deadline).getTime();
  const [now, setNow] = useState(serverNow);
  const ms = end - now;
  const urgent = ms < 12 * 36e5;
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), ms < 36e5 ? 1000 : 60_000);
    return () => clearInterval(id);
  }, [ms < 36e5]); // eslint-disable-line react-hooks/exhaustive-deps

  const when = new Intl.DateTimeFormat("ar-EG-u-nu-latn", { weekday: "long", hour: "numeric", minute: "2-digit", timeZone: "Africa/Cairo" }).format(end);
  return (
    <div
      role="status"
      className={cn(
        "mb-5 flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border p-4",
        urgent ? "border-bad/35 bg-bad/[0.07]" : "border-nova/35 bg-gradient-to-l from-nova/[0.14] to-aurora/[0.06]"
      )}
    >
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl text-white", urgent ? "bg-bad" : "bg-nova")} aria-hidden="true">
        <KeyRound className="size-5" />
      </span>
      <div className="min-w-0 flex-1 basis-56">
        <p className="text-[14px] font-black text-ink">
          متجرك مدفوع: انقله لحساباتك خلال <span className={cn("tabular-nums", urgent ? "text-bad" : "text-nova-2")}>{left(ms)}</span>
        </p>
        <p className="mt-0.5 text-[12px] leading-5 text-ink-2">
          المهلة تنتهي {when}. بعدها يتوقف المتجر عن استقبال الطلبات حتى تكمل النقل. الخطوات مشروحة وتأخذ نحو نصف ساعة.
        </p>
      </div>
      <Link href="/dashboard/own" className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-nova to-nova-deep px-5 text-[13px] font-black text-white shadow-md sm:w-auto">
        امتلك متجرك الآن
        <ArrowLeft className="size-4" aria-hidden="true" />
      </Link>
    </div>
  );
}
