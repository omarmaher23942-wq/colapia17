// /admin/team — فريق الوكالة: الأعضاء وأدوارهم وما بين أيديهم الآن، وسجل نشاط اللوحة. الإدارة للمالك وحده.
import { and, eq, ne, sql } from "drizzle-orm";
import { Users, UserPlus } from "lucide-react";
import { db } from "@/db/client";
import { platformUsers } from "@/db/schema";
import { storeRequests } from "@/db/schema/agency";
import { requirePlatformPage } from "@/server/platform-guard";
import { can, isPlatformRole, PLATFORM_ROLES, ROLE_INFO } from "@/agency/roles";
import { recentActivity } from "@/agency/activity";
import { AddMember, MemberControls } from "@/components/platform/TeamManager";
import { at } from "@/components/platform/requests/format";

export const dynamic = "force-dynamic";

const ACTION_LABEL: Record<string, string> = {
  "member.added": "أضاف عضواً",
  "member.role": "غيّر دور عضو",
  "member.enabled": "فعّل عضواً",
  "member.disabled": "أوقف عضواً",
  "request.assign": "أسند طلباً",
  "request.production": "نقل حالة طلب",
  "request.provision": "جهّز متجراً",
  "request.deliver": "سلّم متجراً",
};

export default async function TeamPage() {
  const me = await requirePlatformPage();
  const isOwner = can(me.role, "team.manage");
  const users = await db.select().from(platformUsers).orderBy(platformUsers.createdAt);
  const load = await db
    .select({
      id: platformUsers.id,
      building: sql<number>`count(*) filter (where ${storeRequests.builderId} = ${platformUsers.id})`.mapWith(Number),
      reviewing: sql<number>`count(*) filter (where ${storeRequests.reviewerId} = ${platformUsers.id})`.mapWith(Number),
    })
    .from(platformUsers)
    .leftJoin(storeRequests, and(eq(storeRequests.status, "submitted"), ne(storeRequests.production, "delivered"), sql`(${storeRequests.builderId} = ${platformUsers.id} or ${storeRequests.reviewerId} = ${platformUsers.id})`))
    .groupBy(platformUsers.id)
    .catch(() => []);
  const loadBy = new Map(load.map((l) => [l.id, l]));
  const activity = isOwner ? await recentActivity(40) : [];
  const names = new Map(users.map((u) => [u.id, u.name]));

  return (
    <div className="space-y-8 text-[#eaf0ff]" dir="rtl">
      <div className="border-b border-white/10 pb-5">
        <h1 className="flex items-center gap-2 text-2xl font-black text-white">
          <Users className="size-6 text-[#8fa8ff]" aria-hidden="true" /> فريق الوكالة
        </h1>
        <p className="mt-1 text-[13px] text-slate-400">كل عضو يدخل بحساب Google ببريده المسجّل هنا، ويرى ويعمل حسب دوره فقط (الخادم يفرض ذلك).</p>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {PLATFORM_ROLES.map((r) => (
          <div key={r} className="rounded-2xl border border-white/10 bg-[#0b0f2a] p-3">
            <p className="text-[13px] font-black text-white">{ROLE_INFO[r].label}</p>
            <p className="mt-1 text-[12px] leading-6 text-slate-400">{ROLE_INFO[r].hint}</p>
          </div>
        ))}
      </section>

      {isOwner ? (
        <section className="rounded-3xl border border-white/10 bg-[#0b0f2a] p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-black text-white">
            <UserPlus className="size-4 text-[#8fa8ff]" aria-hidden="true" /> أضف عضواً
          </h2>
          <AddMember />
        </section>
      ) : null}

      <section className="overflow-x-auto rounded-3xl border border-white/10 bg-[#0e1424]">
        <table className="w-full text-start text-[13px]">
          <thead className="border-b border-white/10 bg-white/[0.02] text-slate-400">
            <tr>
              <th className="p-4 text-start">العضو</th>
              <th className="p-4 text-start">الدور</th>
              <th className="p-4 text-start">بين يديه الآن</th>
              <th className="p-4 text-start">آخر دخول</th>
              {isOwner ? <th className="p-4 text-start">إدارة</th> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {users.map((u) => {
              const l = loadBy.get(u.id);
              const role = isPlatformRole(u.role) ? u.role : null;
              return (
                <tr key={u.id} className={u.isActive ? "" : "opacity-50"}>
                  <td className="p-4">
                    <p className="font-bold text-white">{u.name}</p>
                    <p className="mt-0.5 font-mono text-[11px] text-slate-400" dir="ltr">
                      {u.email}
                    </p>
                  </td>
                  <td className="p-4 font-bold">{role ? ROLE_INFO[role].label : u.role}{u.isActive ? "" : " · موقوف"}</td>
                  <td className="p-4 text-slate-300">{l && (l.building || l.reviewing) ? [l.building ? `يبني ${l.building}` : "", l.reviewing ? `يراجع ${l.reviewing}` : ""].filter(Boolean).join(" · ") : "—"}</td>
                  <td className="p-4 text-slate-400">{u.lastLoginAt ? at(u.lastLoginAt) : "لم يدخل بعد"}</td>
                  {isOwner ? <td className="p-4">{role && role !== "owner" && u.id !== me.id ? <MemberControls id={u.id} role={role} active={u.isActive} /> : <span className="text-slate-500">—</span>}</td> : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {isOwner ? (
        <section className="rounded-3xl border border-white/10 bg-[#0b0f2a] p-5">
          <h2 className="mb-3 text-sm font-black text-white">سجل نشاط الفريق</h2>
          {activity.length ? (
            <ol className="space-y-2.5">
              {activity.map((a) => (
                <li key={a.id} className="border-s-2 border-white/10 ps-3 text-[13px]">
                  <span className="text-slate-400">{at(a.createdAt)} · </span>
                  <b>{a.actorId ? (names.get(a.actorId) ?? "عضو") : "النظام"}</b> {ACTION_LABEL[a.action] ?? a.action}
                  {a.target?.startsWith("request:") ? (
                    <a href={`/admin/requests/${a.target.slice(8)}`} className="ms-1 text-[#8fa8ff] underline">
                      الطلب
                    </a>
                  ) : a.target?.startsWith("member:") ? (
                    <span className="ms-1 text-slate-300">{names.get(a.target.slice(7)) ?? ""}</span>
                  ) : null}
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-[13px] text-slate-400">لا نشاط بعد.</p>
          )}
        </section>
      ) : null}
    </div>
  );
}
