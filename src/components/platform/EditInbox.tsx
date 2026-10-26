"use client";

// EditInbox.tsx — بطاقة طلب تعديل في صندوق المالك: العميل والمشروع ورابط المستودع بارزاً وقابلاً للنسخ، نص الطلب وملفاته،
// الحالة، وأزرار: بدء التنفيذ، تم التنفيذ، اعتذار بسبب، وتعليم الدفع. لا برومبت ولا شات: المالك يعدّل المستودع بنفسه.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Loader2, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { markEditPaidAction, setEditStatusAction } from "@/server/actions/edit-requests";
import { CopyButton } from "@/components/platform/requests/ProjectLinks";
import { cn } from "@/lib/utils";

export type EditCardData = {
  id: string;
  code: string;
  title: string;
  details: string;
  status: string;
  free: boolean;
  feeEgp: number;
  clientEmail: string;
  storeName: string;
  requestId: string;
  repoUrl: string | null;
  storeUrl: string | null;
  files: { url: string; name: string }[];
  teamNote: string | null;
  createdAt: string;
  doneAt: string | null;
};

export const EDIT_STATUS: Record<string, { label: string; tone: string }> = {
  new: { label: "جديد", tone: "bg-[#6f86ff]/20 text-[#c9d3ff]" },
  awaiting_payment: { label: "بانتظار الدفع", tone: "bg-amber-400/20 text-amber-200" },
  in_progress: { label: "قيد التنفيذ", tone: "bg-sky-400/20 text-sky-200" },
  done: { label: "تم", tone: "bg-emerald-400/20 text-emerald-200" },
  declined: { label: "اعتذار", tone: "bg-rose-400/20 text-rose-200" },
};

const btn = "inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-[13px] font-black disabled:cursor-not-allowed disabled:opacity-50";

export function EditCard({ e, full }: { e: EditCardData; full?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [note, setNote] = useState(e.teamNote ?? "");
  const st = EDIT_STATUS[e.status] ?? { label: e.status, tone: "bg-white/10 text-white" };
  const open = e.status === "new" || e.status === "in_progress";

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, ok: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return void toast.error(r.error ?? "تعذر الحفظ");
      toast.success(ok);
      router.refresh();
    });

  return (
    <article className="space-y-4 rounded-3xl border border-white/10 bg-[#0b0f2a] p-4 sm:p-5">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-base font-black text-white">{e.title}</h2>
          <p className="mt-0.5 text-[12.5px] text-[#8d97c4]">
            <a href={`/admin/requests/${e.requestId}`} className="font-bold underline">{e.storeName || "مشروع"}</a> · <span dir="ltr">{e.clientEmail}</span> · <span className="font-mono">{e.code}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-black", e.free ? "bg-emerald-400/15 text-emerald-200" : "bg-amber-400/15 text-amber-200")}>{e.free ? "مجاني" : `برسوم ${e.feeEgp.toLocaleString("en-US")} ج`}</span>
          <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-black", st.tone)}>{st.label}</span>
        </div>
      </header>

      {/* رابط المستودع: أهم ما يحتاجه المالك ليبدأ العمل */}
      <div className="rounded-2xl border border-[#6f86ff]/40 bg-[#6f86ff]/10 p-3">
        <p className="text-[12px] font-black text-[#c9d3ff]">مستودع العميل</p>
        {e.repoUrl ? (
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <a href={e.repoUrl} target="_blank" rel="noopener noreferrer" dir="ltr" className="min-w-0 flex-1 break-all text-start text-[13.5px] font-bold text-white underline">{e.repoUrl}</a>
            <CopyButton value={e.repoUrl} label="نسخ" />
            <a href={e.repoUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-white/15 px-3 text-[12.5px] font-black text-white">
              <ExternalLink className="size-4" aria-hidden="true" /> فتح
            </a>
          </div>
        ) : (
          <p className="mt-1 text-[13px] text-amber-200">لم يُسجَّل رابط المستودع بعد. أضيفوه من <a href={`/admin/requests/${e.requestId}`} className="underline">صفحة المشروع</a>.</p>
        )}
        {e.storeUrl ? <p className="mt-2 text-[12.5px] text-[#a9b3dc]">المتجر: <a href={e.storeUrl} target="_blank" rel="noopener noreferrer" dir="ltr" className="underline">{e.storeUrl}</a></p> : null}
      </div>

      <p className={cn("whitespace-pre-wrap text-[14px] leading-7 text-[#dfe5ff]", !full && "line-clamp-4")}>{e.details}</p>
      {e.files.length ? (
        <ul className="flex flex-wrap gap-2">
          {e.files.map((f) => (
            <li key={f.url}>
              <a href={f.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-white/15 px-3 text-[12.5px] font-bold text-white">
                <Paperclip className="size-4" aria-hidden="true" /> {f.name || "ملف"}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
      {e.teamNote && !open ? <p className="rounded-xl bg-white/[0.04] p-3 text-[13px] leading-7 text-[#c3cdf0]">ملاحظتكم للعميل: {e.teamNote}</p> : null}

      {e.status === "awaiting_payment" ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="min-w-0 flex-1 text-[13px] leading-7 text-amber-100">بانتظار تأكيد تحويل الرسوم من <a href="/admin/payments" className="underline">صفحة التحويلات</a>، أو علِّموه مدفوعاً إن تأكدتم منه.</p>
          <button type="button" disabled={pending} onClick={() => run(() => markEditPaidAction(e.id), "عُلِّم مدفوعاً وبدأ التعديل")} className={cn(btn, "bg-emerald-400 text-[#07091a]")}>
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null} تعليم مدفوع
          </button>
        </div>
      ) : null}

      {open || e.status === "awaiting_payment" ? (
        <div className="space-y-3 border-t border-white/10 pt-3">
          <label className="block text-[12.5px] font-black text-[#c3cdf0]">
            رسالة للعميل (تُرسل مع الإنجاز، وسبب الاعتذار إلزامي)
            <textarea value={note} onChange={(ev) => setNote(ev.target.value)} rows={2} maxLength={2000} className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] p-3 text-[14px] leading-7 text-white outline-none focus:border-[#6f86ff]" />
          </label>
          <div className="flex flex-wrap gap-2">
            {e.status === "new" ? (
              <button type="button" disabled={pending} onClick={() => run(() => setEditStatusAction({ id: e.id, status: "in_progress" }), "بدأ التنفيذ")} className={cn(btn, "border border-white/15 text-white")}>
                بدأ التنفيذ
              </button>
            ) : null}
            {open ? (
              <button type="button" disabled={pending} onClick={() => run(() => setEditStatusAction({ id: e.id, status: "done", note }), "عُلِّم منفَّذاً وأُبلغ العميل")} className={cn(btn, "bg-emerald-400 text-[#07091a]")}>
                {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null} تم التنفيذ
              </button>
            ) : null}
            <button type="button" disabled={pending} onClick={() => run(() => setEditStatusAction({ id: e.id, status: "declined", note }), "أُرسل الاعتذار للعميل")} className={cn(btn, "border border-rose-400/40 text-rose-200")}>
              اعتذار
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );
}
