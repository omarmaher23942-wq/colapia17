"use client";
import { useState, useTransition } from "react";
import { setLeadStatusAction } from "@/server/actions/leads";
import { LEAD_STATUSES, LEAD_STATUS_LABEL, type LeadStatus } from "@/agent/lead-capture";

export function LeadStatusForm({ id, status, note }: { id: string; status: LeadStatus; note: string }) {
  const [s, setS] = useState<LeadStatus>(status);
  const [n, setN] = useState(note);
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  const save = (next: LeadStatus, text: string) =>
    start(async () => {
      const r = await setLeadStatusAction(id, next, text);
      setMsg(r.error ?? "تم الحفظ");
    });
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={s}
        disabled={pending}
        aria-label="حالة العميل"
        onChange={(e) => {
          const v = e.target.value as LeadStatus;
          setS(v);
          save(v, n);
        }}
        className="rounded-lg border border-white/10 bg-[#0e1424] px-2 py-1.5 text-xs font-bold text-white"
      >
        {LEAD_STATUSES.map((k) => (
          <option key={k} value={k}>{LEAD_STATUS_LABEL[k]}</option>
        ))}
      </select>
      <input
        value={n}
        onChange={(e) => setN(e.target.value)}
        onBlur={() => n !== note && save(s, n)}
        maxLength={500}
        placeholder="ملاحظة الفريق"
        aria-label="ملاحظة الفريق"
        className="min-w-0 flex-1 rounded-lg border border-white/10 bg-[#0e1424] px-2 py-1.5 text-xs text-white placeholder:text-[#8d97c4]"
      />
      {msg ? <span className="text-[11px] text-[#8d97c4]" role="status">{msg}</span> : null}
    </div>
  );
}
