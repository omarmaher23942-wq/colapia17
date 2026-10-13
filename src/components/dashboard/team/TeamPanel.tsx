"use client";

// TeamPanel.tsx — دعوة أعضاء الفريق وتعديل أدوارهم وصلاحياتهم وإزالتهم، وسجل النشاط. الخادم يفرض كل شيء
// (server/actions/store-team.ts + server/merchant-guard.ts)؛ هذه واجهة فقط.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { AREA_LABEL, LEVEL_LABEL, STORE_AREAS, STORE_ROLES, STORE_ROLE_INFO, STORE_ROLE_LABEL, permsFor, type AccessLevel, type StoreArea, type StoreRole } from "@/lib/store-perms";
import { inviteMemberAction, removeMemberAction, updateMemberAction } from "@/server/actions/store-team";
import { ConfirmDialog } from "@/components/dashboard/ui/DashDialog";
import { cn } from "@/lib/utils";

type Member = { id: string; email: string; name: string | null; role: string; perms: Record<string, string> | null; joined: boolean; lastLogin: string | null };
type Activity = { id: string; who: string; action: string; target: string | null; at: string };

const input = "h-11 w-full rounded-xl border border-edge/10 bg-edge/[0.03] px-3 text-[14px] text-ink outline-none focus:border-nova";
const GRANTABLE = STORE_AREAS.filter((a) => a !== "team" && a !== "billing");
const ACTIONS: Record<string, string> = { "member.invited": "دعا", "member.updated": "غيّر الصلاحيات", "member.removed": "أزال" };
const when = (iso: string) => new Intl.DateTimeFormat("ar-EG-u-nu-latn", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Africa/Cairo" }).format(new Date(iso));

function PermsMatrix({ value, onChange }: { value: Partial<Record<StoreArea, AccessLevel>>; onChange: (v: Partial<Record<StoreArea, AccessLevel>>) => void }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {GRANTABLE.map((a) => (
        <label key={a} className="flex items-center justify-between gap-2 rounded-xl border border-edge/10 px-3 py-2 text-[13px] text-ink-2">
          <span>{AREA_LABEL[a]}</span>
          <select value={value[a] ?? "none"} onChange={(e) => onChange({ ...value, [a]: e.target.value as AccessLevel })} className="h-9 rounded-lg border border-edge/10 bg-transparent px-2 text-[12.5px] font-bold text-ink">
            {(["none", "view", "manage"] as const).map((l) => (
              <option key={l} value={l}>
                {LEVEL_LABEL[l]}
              </option>
            ))}
          </select>
        </label>
      ))}
    </div>
  );
}

function RolePicker({ role, setRole }: { role: StoreRole; setRole: (r: StoreRole) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {STORE_ROLES.map((r) => (
        <button key={r} type="button" onClick={() => setRole(r)} className={cn("min-h-10 rounded-xl border px-3 text-[12.5px] font-black", role === r ? "border-nova bg-nova/15 text-ink" : "border-edge/10 text-ink-2")}>
          {STORE_ROLE_LABEL[r]}
        </button>
      ))}
    </div>
  );
}

export function TeamPanel({ storeName, members, activity }: { storeName: string; members: Member[]; activity: Activity[] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<StoreRole>("orders");
  const [custom, setCustom] = useState<Partial<Record<StoreArea, AccessLevel>>>({ orders: "manage" });
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState<string | null>(null);
  const [editRole, setEditRole] = useState<StoreRole>("orders");
  const [editPerms, setEditPerms] = useState<Partial<Record<StoreArea, AccessLevel>>>({});
  const [removing, setRemoving] = useState<Member | null>(null);

  const invite = () =>
    start(async () => {
      const r = await inviteMemberAction({ email, name: name || undefined, role, perms: role === "custom" ? custom : undefined });
      if (!r.ok) return void toast.error(r.error);
      toast.success(r.emailed ? "أُرسلت الدعوة على بريده" : "أُضيف للفريق (تعذر البريد: أبلغه أن يدخل colapia.com/login بهذا البريد)");
      setEmail("");
      setName("");
      router.refresh();
    });

  return (
    <div className="space-y-5">
      <header>
        <h1 className="flex items-center gap-2 text-xl font-black text-ink">
          <Users className="size-5 text-nova-2" aria-hidden="true" /> فريق متجر {storeName}
        </h1>
        <p className="mt-1 text-[13px] text-ink-3">كل عضو يدخل بحساب Google ببريده أو برمز يصله على البريد، ويرى ويعدّل ما يسمح به دوره فقط. الفريق والاشتراك لك وحدك.</p>
      </header>

      <section className="dash-card space-y-4 p-4 sm:p-5">
        <h2 className="flex items-center gap-2 text-[14px] font-black text-ink">
          <UserPlus className="size-4" aria-hidden="true" /> دعوة عضو
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-[12.5px] font-bold text-ink-3">
            البريد
            <input className={cn(input, "mt-1.5")} dir="ltr" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@gmail.com" />
          </label>
          <label className="block text-[12.5px] font-bold text-ink-3">
            الاسم (اختياري)
            <input className={cn(input, "mt-1.5")} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
          </label>
        </div>
        <RolePicker role={role} setRole={setRole} />
        <p className="text-[12.5px] text-ink-3">{role === "custom" ? "اختر لكل مجال: لا شيء، أو عرض فقط، أو إدارة." : STORE_ROLE_INFO[role].hint}</p>
        {role === "custom" ? <PermsMatrix value={custom} onChange={setCustom} /> : null}
        <button type="button" onClick={invite} disabled={pending || !email.trim()} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-nova px-5 text-[13.5px] font-black text-white disabled:opacity-50">
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <UserPlus className="size-4" aria-hidden="true" />}
          إرسال الدعوة
        </button>
      </section>

      <section className="dash-card divide-y divide-edge/10">
        {members.length === 0 ? <p className="p-5 text-[13.5px] text-ink-3">لا أعضاء بعد. أنت وحدك تدير المتجر.</p> : null}
        {members.map((m) => {
          const perms = permsFor(m.role, m.perms);
          const open = editing === m.id;
          return (
            <div key={m.id} className="space-y-3 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-black text-ink">{m.name || m.email}</p>
                  <p className="text-[12px] text-ink-3" dir="ltr">
                    {m.email}
                  </p>
                  <p className="mt-1 text-[12px] text-ink-3">
                    {STORE_ROLE_LABEL[m.role as StoreRole] ?? m.role} · {m.joined ? (m.lastLogin ? `آخر دخول ${when(m.lastLogin)}` : "دخل") : "لم يدخل بعد"}
                  </p>
                  <p className="mt-1 text-[11.5px] text-ink-3">
                    {GRANTABLE.filter((a) => perms[a] !== "none")
                      .map((a) => `${AREA_LABEL[a]}: ${LEVEL_LABEL[perms[a]]}`)
                      .join(" · ") || "بلا صلاحيات"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(open ? null : m.id);
                      setEditRole(m.role as StoreRole);
                      setEditPerms(permsFor(m.role, m.perms));
                    }}
                    className="min-h-10 rounded-xl border border-edge/10 px-3 text-[12.5px] font-black text-ink"
                  >
                    {open ? "إغلاق" : "عدّل"}
                  </button>
                  <button type="button" aria-label={`أزل ${m.email}`} onClick={() => setRemoving(m)} className="grid size-10 place-items-center rounded-xl text-bad hover:bg-bad/10">
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
              {open ? (
                <div className="space-y-3 rounded-2xl border border-edge/10 p-3">
                  <RolePicker role={editRole} setRole={setEditRole} />
                  {editRole === "custom" ? <PermsMatrix value={editPerms} onChange={setEditPerms} /> : <p className="text-[12.5px] text-ink-3">{STORE_ROLE_INFO[editRole].hint}</p>}
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        const r = await updateMemberAction({ id: m.id, role: editRole, perms: editRole === "custom" ? editPerms : undefined });
                        if (!r.ok) return void toast.error(r.error);
                        toast.success("حُفظت الصلاحيات (تسري فوراً)");
                        setEditing(null);
                        router.refresh();
                      })
                    }
                    className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-nova px-4 text-[13px] font-black text-white disabled:opacity-50"
                  >
                    حفظ
                  </button>
                </div>
              ) : null}
            </div>
          );
        })}
      </section>

      {activity.length ? (
        <section className="dash-card space-y-2 p-4 sm:p-5">
          <h2 className="text-[14px] font-black text-ink">سجل الفريق</h2>
          <ol className="space-y-1.5 text-[13px] text-ink-2">
            {activity.map((a) => (
              <li key={a.id}>
                <span className="text-ink-3">{when(a.at)} · </span>
                <b>{a.who}</b> {ACTIONS[a.action] ?? a.action} {a.target ? <span dir="ltr">{a.target}</span> : null}
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <ConfirmDialog
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        title="إزالة من الفريق"
        description={removing ? `يفقد ${removing.email} الوصول لمتجرك فوراً.` : ""}
        confirmLabel="أزله"
        tone="danger"
        onConfirm={async () => {
          if (!removing) return true;
          const r = await removeMemberAction({ id: removing.id });
          if (!r.ok) {
            toast.error(r.error);
            return false;
          }
          toast.success("أُزيل من الفريق");
          router.refresh();
          return true;
        }}
      />
    </div>
  );
}
