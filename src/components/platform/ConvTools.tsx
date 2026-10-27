"use client";
// أدوات الفريق داخل المحادثة: إسناد لنفسي، موعد متابعة، ملاحظات داخلية، وتصدير النص. لا شيء منها يصل العميل.
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Download, NotebookPen, UserCheck, CalendarClock } from "lucide-react";
import { addNoteAction, assignConversationAction, setFollowUpAction } from "@/server/actions/platform-conv-tools";

export type ConvToolsData = {
  id: string;
  assigneeName: string | null;
  mine: boolean;
  followUpAt: string | null;
  notes: { by: string; at: string; text: string }[];
};

const BTN = "inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[.04] px-3 py-1.5 text-xs font-bold text-[#c3cdf0] transition-colors hover:bg-white/10 hover:text-[#eaf0ff] disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8fa8ff]/60";
const toLocalInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

export function ConvTools({ data }: { data: ConvToolsData }) {
  const [pending, start] = useTransition();
  const [note, setNote] = useState("");
  const [when, setWhen] = useState(toLocalInput(data.followUpAt));
  const done = (r: { error?: string } | undefined, ok: string) => { if (r?.error) toast.error(r.error); else toast.success(ok); };

  return (
    <div className="space-y-3 border-b border-white/10 bg-[#0a0e26] px-4 py-3" dir="rtl">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={BTN} disabled={pending} onClick={() => start(async () => done(await assignConversationAction(data.id, !data.mine), data.mine ? "أُلغي الإسناد" : "أُسندت إليكم"))}>
          <UserCheck className="size-3.5" aria-hidden="true" />
          {data.mine ? "إلغاء الإسناد" : data.assigneeName ? `مُسندة إلى ${data.assigneeName} · إسناد لي` : "إسناد لي"}
        </button>
        <label className="flex items-center gap-1.5 text-xs font-bold text-[#c3cdf0]">
          <CalendarClock className="size-3.5" aria-hidden="true" />
          <span>متابعة في</span>
          <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="rounded-lg border border-white/10 bg-[#07091a] px-2 py-1 text-xs text-[#eaf0ff]" dir="ltr" />
        </label>
        <button type="button" className={BTN} disabled={pending || !when} onClick={() => start(async () => done(await setFollowUpAction(data.id, new Date(when).toISOString()), "حُفظ موعد المتابعة"))}>حفظ الموعد</button>
        {data.followUpAt ? (
          <button type="button" className={BTN} disabled={pending} onClick={() => start(async () => { setWhen(""); done(await setFollowUpAction(data.id, null), "أُلغي الموعد"); })}>إلغاء الموعد</button>
        ) : null}
        <a className={`${BTN} ms-auto`} href={`/admin/conversations/export?id=${data.id}`} download>
          <Download className="size-3.5" aria-hidden="true" /> تصدير النص
        </a>
      </div>
      <details className="rounded-xl border border-white/10 bg-white/[.02] p-3">
        <summary className="flex cursor-pointer items-center gap-1.5 text-xs font-bold text-[#c3cdf0]">
          <NotebookPen className="size-3.5" aria-hidden="true" /> ملاحظات داخلية ({data.notes.length})
        </summary>
        <ul className="mt-2 space-y-1.5">
          {data.notes.map((n, i) => (
            <li key={i} className="rounded-lg bg-white/[.04] px-3 py-2 text-xs leading-6 text-[#eaf0ff]">
              {n.text}
              <span className="mt-0.5 block text-[10px] text-slate-400">{n.by} · {new Date(n.at).toLocaleString("ar-EG-u-nu-latn", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</span>
            </li>
          ))}
        </ul>
        <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (!note.trim()) return; start(async () => { const r = await addNoteAction(data.id, note); done(r, "حُفظت الملاحظة"); if (!r?.error) setNote(""); }); }}>
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={600} placeholder="ملاحظة للفريق فقط، لا يراها العميل" aria-label="ملاحظة داخلية" className="min-w-0 flex-1 rounded-lg border border-white/10 bg-[#07091a] px-3 py-2 text-xs text-[#eaf0ff] placeholder:text-slate-500" />
          <button className={BTN} disabled={pending || !note.trim()}>إضافة</button>
        </form>
      </details>
    </div>
  );
}
