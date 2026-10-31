"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ClipboardCopy, FileJson, MessageCircle, Sparkles, Trash2 } from "lucide-react";
import { deleteBriefAction, setBriefStatusAction } from "@/server/actions/briefs";
import { BRIEF_STATUSES, BRIEF_STATUS_LABEL, type BriefStatus } from "@/briefs/realestate";

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const t = document.createElement("textarea");
    t.value = text;
    t.style.position = "fixed";
    t.style.opacity = "0";
    document.body.appendChild(t);
    t.select();
    const ok = document.execCommand("copy");
    t.remove();
    return ok;
  }
}

type Texts = { brief: string; prompt: string; json: string; whatsapp: string };

export function BriefActions({ id, status, note, texts, waUrl, canDelete, inTable }: { id: string; status: BriefStatus; note: string; texts: Texts; waUrl: string; canDelete: boolean; inTable: boolean }) {
  const router = useRouter();
  const [done, setDone] = useState<string | null>(null);
  const [s, setS] = useState(status);
  const [n, setN] = useState(note);
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  const btn = "inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-xs font-black text-white hover:bg-white/10";
  const doCopy = async (key: keyof Texts, label: string) => {
    setDone((await copy(texts[key])) ? label : "تعذر النسخ");
    setTimeout(() => setDone(null), 2200);
  };
  const save = (next: BriefStatus, text: string) =>
    start(async () => {
      const r = await setBriefStatusAction(id, next, text);
      setMsg(r.error ?? "تم الحفظ");
      if (!r.error) router.refresh();
    });
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => doCopy("brief", "نُسخ البريف")} className={`${btn} !bg-[#6f86ff] !text-[#07091a]`}>
          <ClipboardCopy className="size-4" aria-hidden="true" /> نسخ البريف
        </button>
        <button type="button" onClick={() => doCopy("prompt", "نُسخ برومبت البناء")} className={`${btn} !border-[#c8a24a]/40 !text-[#f1e3bd]`}>
          <Sparkles className="size-4" aria-hidden="true" /> نسخ برومبت البناء (ulghx)
        </button>
        <button type="button" onClick={() => doCopy("json", "نُسخ JSON")} className={btn}>
          <FileJson className="size-4" aria-hidden="true" /> نسخ JSON
        </button>
        <button type="button" onClick={() => doCopy("whatsapp", "نُسخت رسالة واتساب")} className={btn}>
          <ClipboardCopy className="size-4" aria-hidden="true" /> نسخ رسالة العميل
        </button>
        <a href={waUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3.5 py-2 text-xs font-black text-[#04120a]">
          <MessageCircle className="size-4" aria-hidden="true" /> واتساب العميل
        </a>
        <span role="status" aria-live="polite" className="inline-flex items-center gap-1 text-xs font-bold text-emerald-300">
          {done ? <><Check className="size-4" aria-hidden="true" /> {done}</> : null}
        </span>
      </div>
      {inTable ? (
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={s}
            disabled={pending}
            aria-label="حالة الاستمارة"
            onChange={(e) => {
              const v = e.target.value as BriefStatus;
              setS(v);
              save(v, n);
            }}
            className="rounded-lg border border-white/10 bg-[#0e1424] px-2 py-1.5 text-xs font-bold text-white"
          >
            {BRIEF_STATUSES.map((k) => (
              <option key={k} value={k}>{BRIEF_STATUS_LABEL[k]}</option>
            ))}
          </select>
          <input
            value={n}
            onChange={(e) => setN(e.target.value)}
            onBlur={() => n !== note && save(s, n)}
            maxLength={1000}
            placeholder="ملاحظة الفريق"
            aria-label="ملاحظة الفريق"
            className="min-w-0 flex-1 rounded-lg border border-white/10 bg-[#0e1424] px-2 py-1.5 text-xs text-white placeholder:text-[#8d97c4]"
          />
          {canDelete ? (
            <button
              type="button"
              onClick={() => {
                if (confirm("حذف الاستمارة نهائياً؟")) start(async () => { await deleteBriefAction(id); router.push("/admin/briefs"); });
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-rose-400/30 px-2.5 py-1.5 text-xs font-bold text-rose-300 hover:bg-rose-500/10"
            >
              <Trash2 className="size-3.5" aria-hidden="true" /> حذف
            </button>
          ) : null}
          {msg ? <span className="text-[11px] text-[#8d97c4]" role="status">{msg}</span> : null}
        </div>
      ) : (
        <p className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-xs leading-6 text-amber-100">هذه نسخة احتياطية لم تنتقل لجدول الاستمارات بعد. شغّلوا <b dir="ltr">npm run db:migrate</b> وستنتقل وحدها عند فتح هذه الصفحة.</p>
      )}
    </div>
  );
}
