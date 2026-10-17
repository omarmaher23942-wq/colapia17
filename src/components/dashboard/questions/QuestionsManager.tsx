"use client";

// QuestionsManager — أسئلة الزوار عن المنتجات: إجابة مباشرة تظهر في صفحة المنتج، وإخفاء، وحذف، وإشعار السائل على واتساب إن ترك رقمه.
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EyeOff, MessageCircle, RotateCcw, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { fmtNum } from "@/lib/format";
import { waLink } from "@/lib/whatsapp";
import { timeAgo } from "../orders/parts";
import { answerQuestionAction, setQuestionStateAction } from "@/server/actions/questions";
import type { QuestionRow, QuestionTab } from "@/server/repos/questions-list";
import { requestPulse } from "../DashboardPulse";

const TABS: { key: QuestionTab; label: string }[] = [
  { key: "pending", label: "بانتظار الإجابة" },
  { key: "answered", label: "المجاب عنها" },
  { key: "hidden", label: "المخفية" },
];

export function QuestionsManager({ tab, rows, counts, storeName, storeUrl }: { tab: QuestionTab; rows: QuestionRow[]; counts: Record<QuestionTab, number>; storeName: string; storeUrl: string }) {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <header className="border-b border-edge/10 pb-4">
        <h1 className="text-2xl font-black text-ink">أسئلة المنتجات</h1>
        <p className="mt-1 text-[13px] leading-6 text-ink-2">الإجابة تظهر تحت المنتج للجميع، فتحسم تردد زائر آخر لديه السؤال نفسه. السؤال بلا إجابة لا يظهر في المتجر.</p>
      </header>
      <nav aria-label="حالة السؤال" className="flex gap-1.5 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={t.key === "pending" ? "/dashboard/questions" : `/dashboard/questions?tab=${t.key}`}
            aria-current={t.key === tab ? "page" : undefined}
            className={cn("inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl border px-3 text-[12.5px] font-bold transition-colors", t.key === tab ? "border-nova bg-nova text-white" : "border-edge/10 text-ink-2 hover:bg-edge/[0.05]")}
          >
            {t.label}
            <span className="rounded-full bg-black/15 px-1.5 text-[11px] tabular-nums">{fmtNum(counts[t.key])}</span>
          </Link>
        ))}
      </nav>
      {rows.length ? (
        <ul className="space-y-3">
          {rows.map((q) => (
            <Row key={q.id} q={q} tab={tab} storeName={storeName} storeUrl={storeUrl} />
          ))}
        </ul>
      ) : (
        <p className="dash-card px-5 py-10 text-center text-[13px] leading-6 text-ink-2">{tab === "pending" ? "لا أسئلة تنتظر إجابتكم." : tab === "answered" ? "لم تُجب عن أسئلة بعد." : "لا أسئلة مخفية."}</p>
      )}
    </div>
  );
}

function Row({ q, tab, storeName, storeUrl }: { q: QuestionRow; tab: QuestionTab; storeName: string; storeUrl: string }) {
  const router = useRouter();
  const [text, setText] = useState(q.answer ?? "");
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const done = () => {
    requestPulse();
    router.refresh();
  };
  const answer = () =>
    start(async () => {
      const r = await answerQuestionAction(q.id, text).catch(() => ({ ok: false as const, error: "انقطع الاتصال" }));
      if (!r.ok) return void toast.error(r.error);
      toast.success("نُشرت الإجابة في صفحة المنتج");
      setEditing(false);
      done();
    });
  const state = (s: "hidden" | "pending" | "delete") =>
    start(async () => {
      const r = await setQuestionStateAction(q.id, s).catch(() => ({ ok: false as const, error: "انقطع الاتصال" }));
      if (!r.ok) return void toast.error(r.error);
      done();
    });
  const notify = waLink(q.askerPhone, `مرحباً${q.askerName ? ` ${q.askerName.split(/\s+/)[0]}` : ""}، أجبنا عن سؤالكم حول «${q.productName}» في ${storeName}:\n${text || q.answer}\n${storeUrl}`);

  return (
    <li className="dash-card space-y-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="min-w-0 text-[12px] text-ink-3">
          على <Link href={`/dashboard/products/${q.productId}`} className="font-bold text-ink-2 hover:underline">{q.productName}</Link>
          {q.askerName ? <> · {q.askerName}</> : null} · {timeAgo(q.createdAt)}
        </p>
      </div>
      <p className="text-[14px] font-bold leading-7 text-ink">{q.question}</p>
      {tab === "answered" && !editing ? (
        <p className="rounded-xl bg-ok/[0.08] p-3 text-[13px] leading-6 text-ink">{q.answer}</p>
      ) : tab !== "hidden" ? (
        <div className="space-y-2">
          <textarea
            aria-label="الإجابة"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            maxLength={1000}
            placeholder="اكتبوا إجابة واضحة ومحددة"
            className="w-full rounded-xl border border-edge/10 bg-transparent p-3 text-[13px] leading-6 text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova"
          />
          <button type="button" disabled={pending || text.trim().length < 2} onClick={answer} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-gradient-to-b from-nova to-nova-deep px-4 text-[13px] font-black text-white disabled:opacity-50">
            <Send className="size-4" aria-hidden="true" />
            نشر الإجابة
          </button>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2 border-t border-edge/10 pt-3">
        {tab === "answered" && !editing ? (
          <button type="button" onClick={() => setEditing(true)} className="min-h-10 rounded-lg border border-edge/10 px-3 text-[12px] font-bold text-ink-2 hover:bg-edge/[0.06]">
            تعديل الإجابة
          </button>
        ) : null}
        {tab === "answered" && notify ? (
          <a href={notify} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-edge/10 px-3 text-[12px] font-bold text-ink-2 hover:bg-edge/[0.06]">
            <MessageCircle className="size-4" aria-hidden="true" />
            إبلاغ السائل
          </a>
        ) : null}
        {tab === "hidden" ? (
          <button type="button" disabled={pending} onClick={() => state("pending")} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-edge/10 px-3 text-[12px] font-bold text-ink-2 hover:bg-edge/[0.06]">
            <RotateCcw className="size-4" aria-hidden="true" />
            إعادة للانتظار
          </button>
        ) : (
          <button type="button" disabled={pending} onClick={() => state("hidden")} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-edge/10 px-3 text-[12px] font-bold text-ink-2 hover:bg-edge/[0.06]">
            <EyeOff className="size-4" aria-hidden="true" />
            إخفاء
          </button>
        )}
        <button type="button" disabled={pending} onClick={() => state("delete")} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-[12px] font-bold text-bad hover:bg-bad/10">
          <Trash2 className="size-4" aria-hidden="true" />
          حذف
        </button>
      </div>
    </li>
  );
}
