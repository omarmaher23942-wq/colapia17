// /admin/changes — طلبات تعديل التجار («اطلب تعديل» من لوحاتهم): المفتوحة أولاً، بالإسناد والحالة والرد، وبرومبت جاهز.
import { asc, desc, eq, inArray, or } from "drizzle-orm";
import { MessageSquarePlus } from "lucide-react";
import { db } from "@/db/client";
import { platformUsers, storeChangeRequests, stores } from "@/db/schema";
import { requirePlatformPage } from "@/server/platform-guard";
import { can, isPlatformRole } from "@/agency/roles";
import { AREA_INFO, type ChangeArea } from "@/lib/change-requests";
import { renderPrompt } from "@/agency/prompt";
import { ChangeRow } from "@/components/platform/ChangeRow";

export const dynamic = "force-dynamic";

export default async function ChangesPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const me = await requirePlatformPage();
  const sp = await searchParams;
  const done = sp.view === "done";
  const seesAll = can(me.role, "requests.view_all");
  const rows = await db
    .select({ r: storeChangeRequests, store: { id: stores.id, name: stores.name, subdomain: stores.subdomain } })
    .from(storeChangeRequests)
    .innerJoin(stores, eq(stores.id, storeChangeRequests.storeId))
    .where(done ? inArray(storeChangeRequests.status, ["done", "declined"]) : or(eq(storeChangeRequests.status, "open"), eq(storeChangeRequests.status, "in_progress")))
    .orderBy(done ? desc(storeChangeRequests.updatedAt) : asc(storeChangeRequests.createdAt))
    .limit(200)
    .catch(() => []);
  const visible = seesAll ? rows : rows.filter((x) => x.r.assignedTo === me.id);
  const team = (await db.select({ id: platformUsers.id, name: platformUsers.name, role: platformUsers.role, active: platformUsers.isActive }).from(platformUsers)).filter((t) => t.active && isPlatformRole(t.role) && can(t.role, "requests.work"));
  return (
    <div className="mx-auto max-w-5xl space-y-5 text-[#eaf0ff]" dir="rtl">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black">
            <MessageSquarePlus className="size-6 text-[#8fa8ff]" aria-hidden="true" /> طلبات التعديل
          </h1>
          <p className="mt-1 text-[13px] text-[#8d97c4]">ما يطلبه التجار من لوحاتهم (حصة شهرية). الرد يظهر للتاجر، وبريد له عند التنفيذ أو الاعتذار.</p>
        </div>
        <nav className="flex gap-2">
          <a href="/admin/changes" className={`rounded-xl px-3.5 py-2 text-xs font-black ${!done ? "bg-[#6f86ff] text-[#07091a]" : "bg-white/5"}`}>مفتوحة</a>
          <a href="/admin/changes?view=done" className={`rounded-xl px-3.5 py-2 text-xs font-black ${done ? "bg-[#6f86ff] text-[#07091a]" : "bg-white/5"}`}>منتهية</a>
        </nav>
      </header>
      {visible.length === 0 ? <p className="rounded-3xl border border-white/10 bg-[#0b0f2a] p-6 text-center text-[13px] text-[#8d97c4]">لا طلبات.</p> : null}
      <ul className="space-y-3">
        {visible.map(({ r, store }) => (
          <ChangeRow
            key={r.id}
            id={r.id}
            store={store}
            area={AREA_INFO[r.area as ChangeArea]?.label ?? r.area}
            body={r.body}
            status={r.status}
            teamNote={r.teamNote}
            assignedTo={r.assignedTo}
            at={r.createdAt.toISOString()}
            team={team.map((t) => ({ id: t.id, name: t.name }))}
            canAssign={can(me.role, "requests.assign")}
            canWork={can(me.role, "requests.assign") || (r.assignedTo === me.id && can(me.role, "requests.work"))}
            prompt={renderPrompt({ slug: store.subdomain, code: `CHG-${r.id.slice(0, 6)}`, storeName: store.name, brief: "", provisioned: true, branch: `build/${store.subdomain}-c${r.id.slice(0, 6)}`, teamNotes: r.teamNote ? [r.teamNote] : [], reviewerNote: null, changeRequest: r.body })}
          />
        ))}
      </ul>
    </div>
  );
}
