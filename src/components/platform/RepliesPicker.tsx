"use client";
// الردود المحفوظة: اختيار رد وإدراجه في خانة الكتابة بعد ملء {الاسم} و{المتجر}، وإدارتها (إضافة/تعديل/حذف) من نفس المكان.
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { fillReply, MAX_TEXT, MAX_TITLE, REPLY_VARS, type SavedReply } from "@/agency/saved-replies";
import { saveReplyAction } from "@/server/actions/platform-conv-tools";

export function RepliesPicker({ initial, vars, onPick }: { initial: SavedReply[]; vars: { name?: string | null; store?: string | null }; onPick: (text: string) => void }) {
  const [items, setItems] = useState(initial);
  const [manage, setManage] = useState(false);
  const [draft, setDraft] = useState<{ id?: string; title: string; text: string }>({ title: "", text: "" });
  const [pending, start] = useTransition();

  const save = () =>
    start(async () => {
      const r = await saveReplyAction(draft);
      if (r?.error) return void toast.error(r.error);
      if (r && "items" in r && r.items) setItems(r.items);
      setDraft({ title: "", text: "" });
      toast.success("حُفظ الرد");
    });
  const remove = (id: string) =>
    start(async () => {
      const r = await saveReplyAction({ id, remove: true });
      if (r && "items" in r && r.items) setItems(r.items);
    });

  return (
    <div className="mb-3">
      <div className="flex gap-2 overflow-x-auto pb-1" role="list" aria-label="الردود المحفوظة">
        {items.map((r) => (
          <button key={r.id} role="listitem" type="button" title={r.text} onClick={() => onPick(fillReply(r.text, vars))} className="shrink-0 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] font-bold text-[#c3cdf0] transition-colors hover:bg-white/10 hover:text-white">
            {r.title}
          </button>
        ))}
        <button type="button" onClick={() => setManage((v) => !v)} aria-expanded={manage} className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-dashed border-white/20 px-3 py-1.5 text-[11px] font-bold text-[#8fa8ff] hover:bg-white/5">
          <Plus className="size-3" aria-hidden="true" /> {items.length ? "إدارة الردود" : "أضيفوا أول رد محفوظ"}
        </button>
      </div>
      {manage ? (
        <div className="mt-2 space-y-2 rounded-xl border border-white/10 bg-white/[.02] p-3">
          <ul className="space-y-1">
            {items.map((r) => (
              <li key={r.id} className="flex items-center gap-2 text-xs text-[#eaf0ff]">
                <button type="button" className="min-w-0 flex-1 truncate text-start font-bold hover:text-[#8fa8ff]" onClick={() => setDraft({ id: r.id, title: r.title, text: r.text })}>{r.title}</button>
                <button type="button" aria-label={`حذف ${r.title}`} disabled={pending} onClick={() => remove(r.id)} className="rounded p-1 text-rose-300 hover:bg-rose-500/10"><Trash2 className="size-3.5" aria-hidden="true" /></button>
              </li>
            ))}
          </ul>
          <input value={draft.title} maxLength={MAX_TITLE} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="عنوان قصير" aria-label="عنوان الرد" className="w-full rounded-lg border border-white/10 bg-[#07091a] px-3 py-2 text-xs text-[#eaf0ff]" />
          <textarea value={draft.text} maxLength={MAX_TEXT} rows={3} onChange={(e) => setDraft({ ...draft, text: e.target.value })} placeholder={`نص الرد. المتغيرات: ${REPLY_VARS.join(" ")}`} aria-label="نص الرد" className="w-full rounded-lg border border-white/10 bg-[#07091a] px-3 py-2 text-xs text-[#eaf0ff]" />
          <button type="button" disabled={pending || !draft.title.trim() || !draft.text.trim()} onClick={save} className="rounded-lg bg-[#6f86ff] px-3 py-1.5 text-xs font-black text-[#07091a] disabled:opacity-40">{draft.id ? "حفظ التعديل" : "إضافة الرد"}</button>
        </div>
      ) : null}
    </div>
  );
}
