import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { requirePlatformPage } from "@/server/platform-guard";
import { can } from "@/agency/roles";
import { getBrief } from "@/server/briefs";
import { BRIEF_STATUS_LABEL, waMe } from "@/briefs/realestate";
import { clientWhatsappMessage, renderBriefMarkdown, renderBuildPrompt } from "@/briefs/render";
import { BriefActions } from "@/components/platform/BriefActions";

export const dynamic = "force-dynamic";

export default async function BriefDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const u = await requirePlatformPage({ cap: "leads" });
  const { id } = await params;
  const b = await getBrief(id, { markSeen: true });
  if (!b) notFound();
  const meta = { id: b.id, ref: b.ref, createdAt: b.createdAt, isTest: b.isTest };
  const brief = renderBriefMarkdown(b.data, meta);
  const texts = {
    brief,
    prompt: renderBuildPrompt(b.data, meta),
    json: JSON.stringify({ ref: b.ref, createdAt: b.createdAt, ...b.data }, null, 2),
    whatsapp: clientWhatsappMessage(b.data, b.ref),
  };
  const wa = `${waMe(b.whatsapp)}?text=${encodeURIComponent(texts.whatsapp)}`;
  return (
    <div className="space-y-6" dir="rtl">
      <Link href="/admin/briefs" className="inline-flex items-center gap-1 text-xs font-bold text-[#8fa8ff]"><ArrowRight className="size-4" aria-hidden="true" /> كل الاستمارات</Link>
      <header className="border-b border-white/10 pb-5">
        <h1 className="text-2xl font-black text-white">{b.businessName}</h1>
        <p className="mt-1 text-xs text-[#8d97c4]">{b.ref} · {BRIEF_STATUS_LABEL[b.status]}{b.isTest ? " · تجريبية" : ""} · {new Date(b.createdAt).toLocaleString("ar-EG", { timeZone: "Africa/Cairo" })}</p>
      </header>
      <BriefActions id={b.id} status={b.status} note={b.note ?? ""} texts={texts} waUrl={wa} canDelete={can(u.role, "team.manage")} inTable={b.source === "db"} />
      <section aria-label="إجابات العميل">
        <h2 className="mb-2 text-sm font-black text-white">إجابات العميل (البريف)</h2>
        <pre dir="rtl" className="max-h-[70vh] overflow-auto whitespace-pre-wrap rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-[13px] leading-7 text-[#dce3ff]">{brief}</pre>
      </section>
    </div>
  );
}
