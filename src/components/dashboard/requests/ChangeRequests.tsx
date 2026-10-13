"use client";

// ChangeRequests.tsx — طلب تعديل من فريق Colapia (حصة شهرية)، وقائمة الطلبات بحالاتها وردود الفريق.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MessageSquarePlus, Send } from "lucide-react";
import { toast } from "sonner";
import { AREA_INFO, CHANGE_AREAS, STATUS_INFO, type ChangeArea, type ChangeStatus } from "@/lib/change-requests";
import { submitChangeRequestAction } from "@/server/actions/change-requests";
import { cn } from "@/lib/utils";

type Row = { id: string; area: ChangeArea; body: string; status: ChangeStatus; teamNote: string | null; at: string; doneAt: string | null };
const TONE: Record<ChangeStatus, string> = { open: "text-nova-2", in_progress: "text-warn", done: "text-ok", declined: "text-ink-3" };
const when = (iso: string) => new Date(iso).toLocaleString("ar-EG-u-nu-latn", { timeZone: "Africa/Cairo", dateStyle: "medium", timeStyle: "short" });

export function ChangeRequests({ allowed, quota, rows, initialArea }: { allowed: boolean; quota: { perMonth: number; used: number; remaining: number }; rows: Row[]; initialArea: ChangeArea }) {
  const router = useRouter();
  const [area, setArea] = useState<ChangeArea>(initialArea);
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="space-y-5">
      <header>
        <h1 className="flex items-center gap-2 text-xl font-black text-ink">
          <MessageSquarePlus className="size-5 text-nova-2" aria-hidden="true" /> طلب تعديل
        </h1>
        <p className="mt-1 text-[13.5px] leading-7 text-ink-2">
          ما تقدر تعمله من لوحتك (منتج، سعر، صورة، نص) اعمله فوراً بنفسك. وما يحتاج فريقنا (تصميم، صفحة جديدة، تنظيم كبير) اطلبه هنا: {quota.perMonth} طلبات كل شهر ضمن اشتراكك.
        </p>
      </header>

      {allowed ? (
        <section className="dash-card space-y-3 p-4 sm:p-5">
          <p className="text-[13px] font-bold text-ink-2">
            باقٍ لك هذا الشهر: <b className={quota.remaining ? "text-ok" : "text-bad"}>{quota.remaining}</b> من {quota.perMonth}
          </p>
          <div className="flex flex-wrap gap-2">
            {CHANGE_AREAS.map((a) => (
              <button key={a} type="button" onClick={() => setArea(a)} className={cn("min-h-10 rounded-xl border px-3 text-[12.5px] font-black", area === a ? "border-nova bg-nova/15 text-ink" : "border-edge/10 text-ink-2")}>
                {AREA_INFO[a].label}
              </button>
            ))}
          </div>
          <label className="block text-[13px] font-bold text-ink-2">
            اكتب التعديل بالتفصيل ({AREA_INFO[area].hint})
            <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} rows={5} className="mt-1.5 w-full rounded-xl border border-edge/10 bg-edge/[0.03] p-3 text-[16px] leading-7 text-ink outline-none focus:border-nova" />
          </label>
          <button
            type="button"
            disabled={pending || !quota.remaining || body.trim().length < 10}
            onClick={() =>
              start(async () => {
                const r = await submitChangeRequestAction({ area, body });
                if (!r.ok) return void toast.error(r.error);
                toast.success("وصل طلبك للفريق، وهنرد عليك هنا");
                setBody("");
                router.refresh();
              })
            }
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-nova px-5 text-[13.5px] font-black text-white disabled:opacity-50"
          >
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Send className="size-4" aria-hidden="true" />}
            إرسال الطلب
          </button>
        </section>
      ) : (
        <p className="dash-card p-4 text-[13.5px] text-ink-2">الطلبات متاحة بعد تسليم متجرك.</p>
      )}

      <section className="dash-card divide-y divide-edge/10">
        {rows.length === 0 ? <p className="p-5 text-[13.5px] text-ink-3">لا طلبات بعد.</p> : null}
        {rows.map((r) => (
          <article key={r.id} className="space-y-2 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-[12.5px]">
              <span className="font-black text-ink">{AREA_INFO[r.area]?.label ?? r.area}</span>
              <span className={cn("font-black", TONE[r.status])}>{STATUS_INFO[r.status]?.label ?? r.status}</span>
            </div>
            <p className="whitespace-pre-line text-[14px] leading-7 text-ink-2">{r.body}</p>
            {r.teamNote ? <p className="rounded-xl bg-nova/[0.08] p-3 text-[13.5px] leading-7 text-ink">رد الفريق: {r.teamNote}</p> : null}
            <p className="text-[11.5px] text-ink-3">{when(r.at)}{r.doneAt ? ` · تم ${when(r.doneAt)}` : ""}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
