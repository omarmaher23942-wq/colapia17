"use client";

// RequestActions.tsx — نقل مرحلة الطلب (مع ملاحظة للعميل وإبلاغه بالبريد اختيارياً)، والملاحظات، وعلامة السبام،
// ونسخ الـ brief. الأخطاء تُعرض كما يعيدها الخادم ({ok:false, error}) لا رسائل مُخفاة.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ClipboardCopy, Flag, Loader2, Send, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { REQUEST_STAGES, type RequestStage } from "@/intake/constants";
import { STAGE_INFO } from "@/intake/stages";
import { addRequestNoteAction, moveRequestStageAction, setRequestSpamAction } from "@/server/actions/platform-requests";
import { cn } from "@/lib/utils";

const box = "w-full rounded-xl border border-white/10 bg-white/[0.04] p-3 text-[14px] leading-7 text-[#eaf0ff] outline-none placeholder:text-[#8d97c4]/70 focus:border-[#6f86ff]";

export function StageMover({ id, stage, canWrite, hasEmail }: { id: string; stage: RequestStage | null; canWrite: boolean; hasEmail: boolean }) {
  const router = useRouter();
  const [to, setTo] = useState<RequestStage | null>(null);
  const [clientNote, setClientNote] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [notify, setNotify] = useState(hasEmail);
  const [pending, start] = useTransition();

  const move = () =>
    to &&
    start(async () => {
      const r = await moveRequestStageAction({ id, stage: to, clientNote, internalNote, notifyClient: notify && hasEmail });
      if (!r.ok) return void toast.error(r.error);
      toast.success(r.notified ? `نُقل إلى «${STAGE_INFO[to].label}» وأُبلغ العميل بالبريد` : `نُقل إلى «${STAGE_INFO[to].label}»`);
      setTo(null);
      setClientNote("");
      setInternalNote("");
      router.refresh();
    });

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5" role="radiogroup" aria-label="المرحلة">
        {REQUEST_STAGES.map((s, i) => {
          const current = s === stage;
          const picked = s === to;
          return (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={picked}
              disabled={!canWrite || current || pending}
              onClick={() => setTo(s)}
              className={cn(
                "min-h-11 rounded-xl border px-2 text-[12.5px] font-black transition disabled:cursor-not-allowed",
                current ? "border-[#6f86ff] bg-[#6f86ff]/20 text-white" : picked ? "border-emerald-400/60 bg-emerald-400/15 text-emerald-200" : "border-white/10 text-[#c3cdf0] hover:border-white/25",
              )}
            >
              {i + 1}. {STAGE_INFO[s].label}
              {current ? <span className="block text-[10.5px] font-bold text-[#8fa8ff]">الحالية</span> : null}
            </button>
          );
        })}
      </div>
      {to ? (
        <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.02] p-3">
          <label className="block text-[13px] font-black text-[#eaf0ff]">
            ملاحظة يراها العميل في صفحة المتابعة (اختيارية)
            <textarea value={clientNote} onChange={(e) => setClientNote(e.target.value)} maxLength={600} rows={2} className={cn(box, "mt-1.5")} placeholder="مثلاً: اخترنا لك ألوان بيج وذهبي، وبنجهز الصفحة الرئيسية." />
          </label>
          <label className="block text-[13px] font-black text-[#eaf0ff]">
            ملاحظة داخلية للفريق (لا يراها العميل)
            <textarea value={internalNote} onChange={(e) => setInternalNote(e.target.value)} maxLength={2000} rows={2} className={cn(box, "mt-1.5")} />
          </label>
          <label className={cn("flex items-center gap-2 text-[13px] font-bold", hasEmail ? "text-[#c3cdf0]" : "text-[#8d97c4]/60")}>
            <input type="checkbox" checked={notify && hasEmail} disabled={!hasEmail} onChange={(e) => setNotify(e.target.checked)} className="size-4 accent-[#6f86ff]" />
            {hasEmail ? "أبلغ العميل بالبريد" : "لا بريد للعميل (بلّغه على واتساب)"}
          </label>
          <div className="flex gap-2">
            <button type="button" onClick={move} disabled={pending} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#6f86ff] px-4 text-[13.5px] font-black text-[#07091a] disabled:opacity-60">
              {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Check className="size-4" aria-hidden="true" />}
              انقل إلى «{STAGE_INFO[to].label}»
            </button>
            <button type="button" onClick={() => setTo(null)} className="min-h-11 rounded-xl px-3 text-[13px] font-bold text-[#8d97c4] hover:text-white">
              إلغاء
            </button>
          </div>
        </div>
      ) : !canWrite ? (
        <p className="text-[12.5px] text-[#8d97c4]">صلاحيتك للعرض فقط.</p>
      ) : null}
    </div>
  );
}

export function NoteForm({ id, canWrite }: { id: string; canWrite: boolean }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [forClient, setForClient] = useState(false);
  const [pending, start] = useTransition();
  if (!canWrite) return null;
  const save = () =>
    start(async () => {
      const r = await addRequestNoteAction(forClient ? { id, clientNote: text } : { id, internalNote: text });
      if (!r.ok) return void toast.error(r.error);
      toast.success(forClient ? "الملاحظة ظاهرة للعميل الآن" : "أُضيفت الملاحظة");
      setText("");
      router.refresh();
    });
  return (
    <div className="space-y-2">
      <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={forClient ? 600 : 2000} rows={3} className={box} placeholder={forClient ? "تظهر للعميل تحت المرحلة الحالية" : "ملاحظة داخلية للفريق"} />
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={save} disabled={pending || !text.trim()} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/15 px-4 text-[13px] font-black text-white disabled:opacity-50">
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Send className="size-4" aria-hidden="true" />}
          أضف الملاحظة
        </button>
        <label className="flex items-center gap-2 text-[12.5px] font-bold text-[#c3cdf0]">
          <input type="checkbox" checked={forClient} onChange={(e) => setForClient(e.target.checked)} className="size-4 accent-[#6f86ff]" />
          يراها العميل
        </label>
      </div>
    </div>
  );
}

export function SpamToggle({ id, spam, canWrite }: { id: string; spam: boolean; canWrite: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (!canWrite) return null;
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          if (!spam && !window.confirm("تعليم الطلب كسبام يخرجه من الطابور. متأكد؟")) return;
          const r = await setRequestSpamAction({ id, spam: !spam });
          if (!r.ok) return void toast.error(r.error);
          router.refresh();
        })
      }
      className={cn("inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 text-[12.5px] font-black disabled:opacity-60", spam ? "border-white/15 text-white" : "border-rose-400/30 text-rose-300 hover:bg-rose-500/10")}
    >
      {spam ? <Undo2 className="size-4" aria-hidden="true" /> : <Flag className="size-4" aria-hidden="true" />}
      {spam ? "ليس سبام: أرجعه للطابور" : "سبام"}
    </button>
  );
}

export function CopyBrief({ markdown }: { markdown: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(markdown);
          setDone(true);
          toast.success("الـ brief اتنسخ (BRIEF.md)");
          setTimeout(() => setDone(false), 2500);
        } catch {
          toast.error("المتصفح منع النسخ.");
        }
      }}
      className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-white/[0.06] px-3 text-[12.5px] font-black text-white hover:bg-white/10"
    >
      {done ? <Check className="size-4 text-emerald-400" aria-hidden="true" /> : <ClipboardCopy className="size-4" aria-hidden="true" />}
      انسخ BRIEF.md
    </button>
  );
}
