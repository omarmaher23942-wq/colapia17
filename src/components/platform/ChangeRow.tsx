"use client";

// ChangeRow.tsx — طلب تعديل واحد في لوحة الوكالة: الإسناد والحالة والرد للتاجر ونسخ البرومبت.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ClipboardCopy, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { STATUS_INFO, type ChangeStatus } from "@/lib/change-requests";
import { updateChangeRequestAction } from "@/server/actions/agency-changes";

type Props = {
  id: string;
  store: { id: string; name: string; subdomain: string };
  area: string;
  body: string;
  status: string;
  teamNote: string | null;
  assignedTo: string | null;
  at: string;
  team: { id: string; name: string }[];
  canAssign: boolean;
  canWork: boolean;
  prompt: string;
};

export function ChangeRow(p: Props) {
  const router = useRouter();
  const [note, setNote] = useState(p.teamNote ?? "");
  const [pending, start] = useTransition();
  const save = (patch: { status?: ChangeStatus; assignedTo?: string | null; teamNote?: string }, ok: string) =>
    start(async () => {
      const r = await updateChangeRequestAction({ id: p.id, ...patch });
      if (!r.ok) return void toast.error(r.error);
      toast.success(ok);
      router.refresh();
    });
  return (
    <li className="space-y-3 rounded-3xl border border-white/10 bg-[#0b0f2a] p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-black">
            {p.store.name} <span className="font-mono text-[12px] text-[#8d97c4]">{p.store.subdomain}</span>
          </p>
          <p className="text-[12px] text-[#8d97c4]">
            {p.area} · {new Date(p.at).toLocaleString("ar-EG-u-nu-latn", { timeZone: "Africa/Cairo", dateStyle: "medium", timeStyle: "short" })} · {STATUS_INFO[p.status as ChangeStatus]?.label ?? p.status}
          </p>
        </div>
        <a href={`/admin/stores/${p.store.id}`} className="inline-flex items-center gap-1 text-[12px] text-[#8fa8ff] underline">
          المتجر <ExternalLink className="size-3.5" aria-hidden="true" />
        </a>
      </div>
      <p className="whitespace-pre-line rounded-2xl bg-white/[0.04] p-3 text-[14px] leading-7">{p.body}</p>
      <div className="flex flex-wrap items-center gap-2">
        {p.canAssign ? (
          <select value={p.assignedTo ?? ""} disabled={pending} onChange={(e) => save({ assignedTo: e.target.value || null }, "حُفظ الإسناد")} className="h-10 rounded-xl border border-white/10 bg-[#07091a] px-2 text-[12.5px]" aria-label="المنفّذ">
            <option value="">— بلا منفّذ —</option>
            {p.team.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        ) : null}
        {p.canWork ? (
          <>
            <button type="button" disabled={pending} onClick={() => save({ status: "in_progress" }, "قيد التنفيذ")} className="min-h-10 rounded-xl border border-white/15 px-3 text-[12.5px] font-black">قيد التنفيذ</button>
            <button type="button" disabled={pending} onClick={() => save({ status: "done", teamNote: note }, "تم وأُبلغ التاجر")} className="min-h-10 rounded-xl bg-emerald-400 px-3 text-[12.5px] font-black text-[#07091a]">تم</button>
            <button type="button" disabled={pending} onClick={() => save({ status: "declined", teamNote: note }, "سُجّل الاعتذار وأُبلغ التاجر")} className="min-h-10 rounded-xl px-3 text-[12.5px] font-black text-rose-300">اعتذار</button>
          </>
        ) : null}
        <button
          type="button"
          onClick={() => navigator.clipboard.writeText(p.prompt).then(() => toast.success("نُسخ البرومبت"), () => toast.error("المتصفح منع النسخ"))}
          className="ms-auto inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-white/[0.06] px-3 text-[12.5px] font-black"
        >
          <ClipboardCopy className="size-4" aria-hidden="true" /> البرومبت
        </button>
      </div>
      {p.canWork ? (
        <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} rows={2} placeholder="رد للتاجر (يظهر له مع الحالة)" className="w-full rounded-xl border border-white/10 bg-white/[0.04] p-3 text-[14px] leading-7 outline-none focus:border-[#6f86ff]" />
      ) : null}
    </li>
  );
}
