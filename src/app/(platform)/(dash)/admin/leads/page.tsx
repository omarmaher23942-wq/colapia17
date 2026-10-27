import Link from "next/link";
import { desc, sql } from "drizzle-orm";
import { Download, MessageCircle, Users } from "lucide-react";
import { db } from "@/db/client";
import { conversations } from "@/db/schema";
import { requirePlatformPage } from "@/server/platform-guard";
import { LEAD_STATUSES, LEAD_STATUS_LABEL, leadRecordOf, whatsappLink, type LeadStatus } from "@/agent/lead-capture";
import { LeadStatusForm } from "@/components/platform/LeadStatusForm";

export const dynamic = "force-dynamic";

const TONE: Record<LeadStatus, string> = {
  new: "bg-[#6f86ff]/20 text-[#bcc8ff]",
  contacted: "bg-amber-400/15 text-amber-200",
  won: "bg-emerald-400/15 text-emerald-200",
  lost: "bg-rose-400/15 text-rose-200",
};

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  await requirePlatformPage({ cap: "leads" });
  const { s } = await searchParams;
  const rows = await db
    .select({ id: conversations.id, memory: conversations.memory, channel: conversations.channel, createdAt: conversations.createdAt })
    .from(conversations)
    .where(sql`${conversations.memory} ? 'v6Lead'`)
    .orderBy(desc(conversations.updatedAt))
    .limit(500);
  const leads = rows.flatMap((r) => {
    const rec = leadRecordOf(r.memory);
    return rec ? [{ id: r.id, channel: r.channel, rec }] : [];
  });
  const counts = Object.fromEntries(LEAD_STATUSES.map((k) => [k, leads.filter((l) => l.rec.status === k).length])) as Record<LeadStatus, number>;
  const shown = leads.filter((l) => !s || l.rec.status === s).sort((a, b) => b.rec.at.localeCompare(a.rec.at));

  return (
    <div className="space-y-6" dir="rtl">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-5">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black text-white"><Users className="size-6 text-[#8fa8ff]" aria-hidden="true" /> العملاء المحتملون</h1>
          <p className="mt-1 text-xs text-[#8d97c4]">كل من ترك اسمه ورقمه للوكيل. تواصلوا معهم بسرعة: أول ساعة هي الأهم.</p>
        </div>
        <Link href="/admin/leads/export" className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-white hover:bg-white/10">
          <Download className="size-4" aria-hidden="true" /> تصدير CSV
        </Link>
      </header>

      <nav aria-label="الحالة" className="flex flex-wrap gap-2">
        <Link href="/admin/leads" aria-current={!s ? "page" : undefined} className={`rounded-xl px-3 py-1.5 text-xs font-bold ${!s ? "bg-[#6f86ff] text-[#07091a]" : "border border-white/10 text-[#8d97c4]"}`}>الكل ({leads.length})</Link>
        {LEAD_STATUSES.map((k) => (
          <Link key={k} href={`/admin/leads?s=${k}`} aria-current={s === k ? "page" : undefined} className={`rounded-xl px-3 py-1.5 text-xs font-bold ${s === k ? "bg-[#6f86ff] text-[#07091a]" : "border border-white/10 text-[#8d97c4]"}`}>
            {LEAD_STATUS_LABEL[k]} ({counts[k]})
          </Link>
        ))}
      </nav>

      {shown.length === 0 ? (
        <p className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center text-sm text-[#8d97c4]">لا عملاء محتملون هنا بعد. يظهر هنا كل عميل يترك بياناته للوكيل.</p>
      ) : (
        <ul className="grid gap-3">
          {shown.map(({ id, channel, rec }) => (
            <li key={id} className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-base font-black text-white">{rec.name}</p>
                  <p className="mt-0.5 text-xs text-[#8d97c4]" dir="ltr">
                    {rec.whatsapp}{rec.email ? ` · ${rec.email}` : ""}{rec.igUsername ? ` · @${rec.igUsername}` : ""}
                  </p>
                </div>
                <span className={`rounded-lg px-2.5 py-1 text-[11px] font-black ${TONE[rec.status]}`}>{LEAD_STATUS_LABEL[rec.status]}</span>
              </div>
              {rec.service ? <p className="text-sm text-[#cbd5ff]"><b>الخدمة:</b> {rec.service}</p> : null}
              {rec.summary ? <p className="text-xs leading-6 text-[#8d97c4]">{rec.summary}</p> : null}
              <div className="flex flex-wrap items-center gap-2">
                <a href={whatsappLink(rec.whatsapp)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3 py-1.5 text-xs font-black text-[#04120a]">
                  <MessageCircle className="size-4" aria-hidden="true" /> واتساب
                </a>
                <Link href={`/admin/conversations?id=${id}`} className="rounded-xl border border-white/10 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/10">المحادثة ({channel === "instagram" ? "إنستجرام" : "ماسنجر"})</Link>
                <time className="text-[11px] text-[#8d97c4]" dateTime={rec.at}>{new Date(rec.at).toLocaleString("ar-EG")}</time>
              </div>
              <LeadStatusForm id={id} status={rec.status} note={rec.note ?? ""} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
