import Link from "next/link";
import { ClipboardList, FlaskConical, MessageCircle } from "lucide-react";
import { requirePlatformPage } from "@/server/platform-guard";
import { listBriefs } from "@/server/briefs";
import { BRIEF_STATUSES, BRIEF_STATUS_LABEL, type BriefStatus } from "@/briefs/realestate";
import { businessTypeLabel } from "@/briefs/render";
import { waMe } from "@/briefs/realestate";

export const dynamic = "force-dynamic";

const TONE: Record<BriefStatus, string> = {
  new: "bg-[#6f86ff]/20 text-[#bcc8ff]",
  contacted: "bg-amber-400/15 text-amber-200",
  building: "bg-violet-400/15 text-violet-200",
  delivered: "bg-emerald-400/15 text-emerald-200",
  archived: "bg-white/10 text-[#8d97c4]",
};

export default async function BriefsPage({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  await requirePlatformPage({ cap: "leads" });
  const { s } = await searchParams;
  const { briefs, tableReady, pendingFallback } = await listBriefs();
  const counts = Object.fromEntries(BRIEF_STATUSES.map((k) => [k, briefs.filter((b) => b.status === k).length])) as Record<BriefStatus, number>;
  const shown = briefs.filter((b) => (s ? b.status === s : b.status !== "archived"));
  return (
    <div className="space-y-6" dir="rtl">
      <header className="border-b border-white/10 pb-5">
        <h1 className="flex items-center gap-2 text-2xl font-black text-white"><ClipboardList className="size-6 text-[#8fa8ff]" aria-hidden="true" /> استمارات العملاء</h1>
        <p className="mt-1 text-xs text-[#8d97c4]">كل استمارة يملؤها عميل من <b dir="ltr">/realestate</b> تصل هنا فوراً مع بريد وإشعار. افتحوا الاستمارة لنسخ البريف أو برومبت البناء.</p>
        <p className="mt-2 text-xs text-[#8d97c4]">رابط الاستمارة العقارية للعملاء: <Link href="/realestate" target="_blank" className="font-bold text-[#8fa8ff]" dir="ltr">/realestate</Link> (افتحوه وأنتم داخل اللوحة لتجربته: تُوسم الاستمارة «تجريبية»).</p>
      </header>

      {!tableReady ? (
        <p className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm leading-7 text-amber-100">جدول الاستمارات غير موجود بعد. الاستمارات تُحفظ احتياطياً ولا تضيع، وتنتقل وحدها بعد تشغيل <b dir="ltr">npm run db:migrate</b>.</p>
      ) : pendingFallback > 0 ? (
        <p className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-3 text-xs text-amber-100">{pendingFallback} استمارة محفوظة احتياطياً وستنتقل للجدول عند تشغيل الـ migration.</p>
      ) : null}

      <nav aria-label="الحالة" className="flex flex-wrap gap-2">
        <Link href="/admin/briefs" aria-current={!s ? "page" : undefined} className={`rounded-xl px-3 py-1.5 text-xs font-bold ${!s ? "bg-[#6f86ff] text-[#07091a]" : "border border-white/10 text-[#8d97c4]"}`}>النشطة ({briefs.length - counts.archived})</Link>
        {BRIEF_STATUSES.map((k) => (
          <Link key={k} href={`/admin/briefs?s=${k}`} aria-current={s === k ? "page" : undefined} className={`rounded-xl px-3 py-1.5 text-xs font-bold ${s === k ? "bg-[#6f86ff] text-[#07091a]" : "border border-white/10 text-[#8d97c4]"}`}>
            {BRIEF_STATUS_LABEL[k]} ({counts[k]})
          </Link>
        ))}
      </nav>

      {shown.length === 0 ? (
        <p className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center text-sm text-[#8d97c4]">لا استمارات هنا بعد.</p>
      ) : (
        <ul className="grid gap-3">
          {shown.map((b) => (
            <li key={b.id} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 transition hover:bg-white/[0.04]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <Link href={`/admin/briefs/${b.id}`} className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-base font-black text-white">
                    {b.businessName}
                    {!b.seenAt ? <span className="rounded-md bg-[#6f86ff] px-1.5 py-0.5 text-[10px] font-black text-[#07091a]">جديدة</span> : null}
                    {b.isTest ? <span className="inline-flex items-center gap-1 rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-bold text-[#c3cdf0]"><FlaskConical className="size-3" aria-hidden="true" />تجريبية</span> : null}
                    {b.source === "fallback" ? <span className="rounded-md bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-200">احتياطية</span> : null}
                  </p>
                  <p className="mt-0.5 text-xs text-[#8d97c4]">{businessTypeLabel(b.data)} · {b.contactName} · <span dir="ltr">{b.whatsapp}</span> · <span dir="ltr">{b.ref}</span></p>
                  <time className="text-[11px] text-[#8d97c4]" dateTime={b.createdAt}>{new Date(b.createdAt).toLocaleString("ar-EG", { timeZone: "Africa/Cairo" })}</time>
                </Link>
                <div className="flex items-center gap-2">
                  <span className={`rounded-lg px-2.5 py-1 text-[11px] font-black ${TONE[b.status]}`}>{BRIEF_STATUS_LABEL[b.status]}</span>
                  <a href={waMe(b.whatsapp)} target="_blank" rel="noopener noreferrer" aria-label={`واتساب ${b.contactName}`} className="grid size-8 place-items-center rounded-lg bg-emerald-500 text-[#04120a]"><MessageCircle className="size-4" aria-hidden="true" /></a>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
