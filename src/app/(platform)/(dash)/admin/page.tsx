import { redirect } from "next/navigation";
import Link from "next/link";
import { sql } from "drizzle-orm";
import { Flame, MessagesSquare, Crown, UserPlus } from "lucide-react";
import { db } from "@/db/client";
import { conversations } from "@/db/schema";
import { can } from "@/agency/roles";
import { AutoRefresh } from "@/components/platform/AutoRefresh";
import { PlatformHealthScore } from "@/components/platform/PlatformHealthScore";
import { HotLeadsWidget } from "@/components/platform/HotLeadsWidget";
import { requirePlatformPage } from "@/server/platform-guard";
import { goldenStatus } from "@/server/pricing";

export const dynamic = "force-dynamic";

export default async function AdminCommandCenter() {
  const me = await requirePlatformPage();
  if (!can(me.role, "stores.manage")) redirect(can(me.role, "conversations") ? "/admin/conversations" : "/admin/leads");
  const golden = await goldenStatus().catch(() => null);
  const [c] = await db
    .select({
      total: sql<number>`count(*)`.mapWith(Number),
      week: sql<number>`count(*) filter (where created_at > now() - interval '7 days')`.mapWith(Number),
      leads: sql<number>`count(*) filter (where memory ? 'v6Lead')`.mapWith(Number),
      newLeads: sql<number>`count(*) filter (where memory ? 'v6Lead' and coalesce(memory->'v6Lead'->>'status','new') = 'new')`.mapWith(Number),
      unread: sql<number>`coalesce(sum(unread_for_admin),0)`.mapWith(Number),
    })
    .from(conversations)
    .catch(() => [{ total: 0, week: 0, leads: 0, newLeads: 0, unread: 0 }]);
  const seatsLeft = golden ? Math.max(0, golden.seats - golden.seatsUsed) : 0;

  return (
    <div className="space-y-8" dir="rtl">
      <AutoRefresh everyMs={15_000} />
      <header className="border-b border-white/10 pb-6">
        <h1 className="text-2xl font-black text-white sm:text-3xl">مركز القيادة</h1>
        <p className="mt-1 text-xs text-[#8d97c4]">المحادثات والعملاء المحتملون ومقاعد الدائرة الذهبية.</p>
      </header>

      {c && c.newLeads > 0 ? (
        <Link href="/admin/leads?s=new" className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-[#8fa8ff]/30 bg-[#6f86ff]/10 p-4 transition hover:bg-[#6f86ff]/15">
          <span className="text-sm font-black text-white">{c.newLeads} عميل محتمل جديد بانتظار تواصلكم</span>
          <span className="text-xs font-bold text-[#8fa8ff]">افتح الليدز ←</span>
        </Link>
      ) : null}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi href="/admin/leads" label="عملاء محتملون" value={c?.leads ?? 0} note={`${c?.newLeads ?? 0} جديد`} Icon={UserPlus} />
        <Kpi href="/admin/conversations" label="المحادثات" value={c?.total ?? 0} note={`${c?.week ?? 0} هذا الأسبوع · ${c?.unread ?? 0} غير مقروءة`} Icon={MessagesSquare} />
        <Kpi href="/admin/pricing" label="مقاعد الدائرة الذهبية" value={golden ? `${golden.seatsUsed}/${golden.seats}` : "—"} note={golden ? `باقٍ ${seatsLeft}` : "راجع الأسعار"} Icon={Crown} />
        <Kpi href="/admin/conversations" label="محادثات ساخنة" value="" note="الأعلى اهتماماً في الأسفل" Icon={Flame} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <PlatformHealthScore />
        <HotLeadsWidget />
      </div>
    </div>
  );
}

function Kpi({ href, label, value, note, Icon }: { href: string; label: string; value: string | number; note: string; Icon: typeof Flame }) {
  return (
    <Link href={href} className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 transition hover:bg-white/[0.04]">
      <div className="flex items-center justify-between text-[#8d97c4]">
        <span className="text-xs font-bold">{label}</span>
        <Icon className="size-4 text-[#8fa8ff]" strokeWidth={1.75} aria-hidden="true" />
      </div>
      <p className="mt-2 font-mono text-3xl font-black tabular-nums text-white">{value}</p>
      <p className="mt-1 text-xs font-bold text-[#8d97c4]">{note}</p>
    </Link>
  );
}
