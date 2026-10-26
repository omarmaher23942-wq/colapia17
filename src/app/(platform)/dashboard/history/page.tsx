// /dashboard/history — سجل طلبات التعديل للعميل بحالتها.
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { editRequests } from "@/db/schema";
import { requireClientPortal } from "@/server/client-guard";
import { desc } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const metadata = { title: "السجل" };

const STATUS: Record<string, string> = { new: "تم الاستلام", awaiting_payment: "بانتظار تأكيد الدفع", in_progress: "قيد التنفيذ", done: "تم التنفيذ", declined: "اعتذار" };

export default async function HistoryPage() {
  const session = await requireClientPortal();
  const rows = await db.select().from(editRequests).where(eq(editRequests.merchantId, session.merchantId)).orderBy(desc(editRequests.createdAt)).limit(100);
  const fmt = new Intl.DateTimeFormat("ar-EG-u-nu-latn", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Cairo" });
  return (
    <div className="space-y-3">
      <h1 className="text-xl font-black">سجل الطلبات</h1>
      {rows.length === 0 ? <p className="dash-card p-6 text-center text-[14px] text-ink-2">لا طلبات تعديل بعد.</p> : null}
      {rows.map((r) => (
        <article key={r.id} className="dash-card space-y-1 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[15px] font-black">{r.title}</h2>
            <span className="rounded-full bg-nova/10 px-2.5 py-1 text-[12px] font-black">{STATUS[r.status] ?? r.status}</span>
          </div>
          <p className="text-[12.5px] text-ink-3"><span className="font-mono">{r.code}</span> · {fmt.format(r.createdAt)} · {r.isFree ? "مجاني" : `رسوم ${Math.round(r.feePiasters / 100).toLocaleString("en-US")} ج`}</p>
          {r.teamNote ? <p className="text-[13.5px] leading-7 text-ink-2">{r.teamNote}</p> : null}
        </article>
      ))}
    </div>
  );
}
