// EmailLog — جدول سجل البريد للمالك (D13، A7): كل رسالة بموضوعها ومستلمها ونتيجتها ورد Resend عند الفشل.
import { CheckCircle2, Mail, XCircle } from "lucide-react";
import type { EmailLogRow } from "@/server/repos/email-log";

const fmt = (d: Date) => d.toLocaleString("ar-EG-u-nu-latn", { timeZone: "Africa/Cairo", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

export function EmailLog({ rows, title = "سجل البريد", empty = "لا رسائل بريد مسجّلة بعد." }: { rows: EmailLogRow[]; title?: string; empty?: string }) {
  const failed = rows.filter((r) => !r.ok).length;
  return (
    <section aria-labelledby="email-log-h" className="rounded-3xl border border-white/10 bg-[#0b0f2a] p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-2">
        <h2 id="email-log-h" className="flex items-center gap-2 text-sm font-black text-white">
          <Mail className="size-4 text-[#8fa8ff]" aria-hidden="true" /> {title}
        </h2>
        {rows.length ? (
          <p className="text-[12px] font-bold text-[#a9b3dc]">
            {rows.length - failed} أُرسلت · <span className={failed ? "text-rose-300" : ""}>{failed} فشلت</span>
          </p>
        ) : null}
      </div>
      {rows.length === 0 ? (
        <p className="py-3 text-center text-[12.5px] text-[#a9b3dc]">{empty}</p>
      ) : (
        <ul className="max-h-96 space-y-2 overflow-y-auto pe-1">
          {rows.map((r) => (
            <li key={r.id} className="flex items-start gap-2.5 rounded-xl bg-white/[0.03] p-2.5 text-[12px]">
              {r.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-400" aria-label="أُرسلت" /> : <XCircle className="mt-0.5 size-4 shrink-0 text-rose-400" aria-label="فشلت" />}
              <div className="min-w-0 flex-1">
                <p className="break-words font-bold text-slate-100">{r.subject}</p>
                <p dir="ltr" className="break-all text-start font-mono text-[11px] text-slate-400">
                  {r.to.join(", ") || "—"}
                  {r.from ? ` ← ${r.from}` : ""}
                </p>
                {!r.ok && r.error ? (
                  <p className="mt-1 break-words text-rose-300">
                    {r.status ? <span dir="ltr" className="font-mono">[{r.status}] </span> : null}
                    {r.error}
                  </p>
                ) : null}
              </div>
              <time className="shrink-0 text-[11px] text-slate-500" dateTime={r.at.toISOString()}>
                {fmt(r.at)}
              </time>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
