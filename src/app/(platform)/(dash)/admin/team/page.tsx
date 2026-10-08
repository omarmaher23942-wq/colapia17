import { db } from "@/db/client";
import { platformUsers } from "@/db/schema";
import { getPlatformSession } from "@/server/auth";
import { addMemberAction, toggleMemberAction } from "@/server/actions/platform-team";
import { Users, ShieldCheck, UserPlus, Mail, Key, ShieldAlert } from "lucide-react";

export const dynamic = "force-dynamic";

const SW = 1.75;

export default async function TeamPage() {
  const session = await getPlatformSession();
  const isOwner = session?.role === "owner";
  const users = await db.select().from(platformUsers);

  return (
    <div className="space-y-8 bg-[#07091a] text-[#eaf0ff]" dir="rtl">
      <div className="border-b border-white/10 pb-5">
        <h1 className="text-2xl font-black text-white flex items-center gap-2">
          <Users className="size-6 text-[#8fa8ff]" />
          فريق عمل المنصة
        </h1>
        <p className="mt-1 text-xs text-slate-400">إدارة المسؤولين والمراجعين وصلاحيات الدخول لمركز القيادة.</p>
      </div>

      {isOwner && (
        <div className="rounded-3xl border border-white/10 bg-[#0b0f2a] p-6 shadow-2xl">
          <h2 className="mb-5 text-sm font-black text-white flex items-center gap-2">
            <UserPlus className="size-4 text-[#8fa8ff]" /> إضافة عضو جديد
          </h2>
          <form action={addMemberAction} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 items-end">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 mb-1.5">الاسم</label>
              <input name="name" placeholder="الاسم بالكامل" className="w-full rounded-xl border border-white/10 bg-[#07091a] px-3.5 py-2.5 text-xs text-white outline-none focus:border-[#8fa8ff]" required />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 mb-1.5">البريد الإلكتروني</label>
              <div className="relative">
                <Mail className="absolute end-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-500" />
                <input name="email" type="email" placeholder="email@example.com" dir="ltr" className="w-full rounded-xl border border-white/10 bg-[#07091a] px-3.5 pe-9 py-2.5 text-xs text-white outline-none focus:border-[#8fa8ff]" required />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 mb-1.5">كلمة المرور المؤقتة</label>
              <div className="relative">
                <Key className="absolute end-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-500" />
                <input name="password" type="password" placeholder="********" className="w-full rounded-xl border border-white/10 bg-[#07091a] px-3.5 pe-9 py-2.5 text-xs text-white outline-none focus:border-[#8fa8ff]" required />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 mb-1.5">الصلاحية</label>
              <select name="role" className="w-full rounded-xl border border-white/10 bg-[#07091a] px-3.5 py-2.5 text-xs text-white outline-none focus:border-[#8fa8ff]">
                <option value="admin">مسؤول (Admin)</option>
                <option value="reviewer">مراجع (Reviewer)</option>
              </select>
            </div>
            <button type="submit" className="h-10 rounded-xl bg-gradient-to-l from-[#6f86ff] to-[#8fa8ff] px-4 text-xs font-black text-[#07091a] shadow-md hover:brightness-110 transition-all">
              إضافة العضو
            </button>
          </form>
        </div>
      )}

      <div className="overflow-x-auto rounded-3xl border border-white/10 bg-[#0e1424]">
        <table className="w-full text-xs text-start">
          <thead className="border-b border-white/10 bg-white/[0.02] text-slate-400 font-bold">
            <tr>
              <th className="p-4 text-start">الاسم والبريد</th>
              <th className="p-4 text-start">الصلاحية</th>
              <th className="p-4 text-start">الحالة</th>
              <th className="p-4 text-start">آخر دخول</th>
              {isOwner && <th className="p-4 text-start">إجراء</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                <td className="p-4">
                  <p className="font-bold text-white text-sm">{u.name}</p>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5" dir="ltr">{u.email}</p>
                </td>
                <td className="p-4">
                  <span className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] font-black ${u.role === "owner" ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" : u.role === "admin" ? "bg-teal-500/20 text-teal-300 border border-teal-500/30" : "bg-white/10 text-slate-300"}`}>
                    {u.role === "owner" ? <ShieldCheck className="size-3" /> : u.role === "admin" ? <ShieldCheck className="size-3" /> : <ShieldAlert className="size-3" />}
                    {u.role.toUpperCase()}
                  </span>
                </td>
                <td className="p-4">
                  <span className={`font-bold ${u.isActive ? "text-emerald-400" : "text-rose-400"}`}>
                    {u.isActive ? "نشط" : "معطّل"}
                  </span>
                </td>
                <td className="p-4 text-slate-400 font-mono">
                  {u.lastLoginAt?.toLocaleString("ar-EG", { timeZone: "Africa/Cairo" }) ?? "لم يسجل بعد"}
                </td>
                {isOwner && u.role !== "owner" && (
                  <td className="p-4">
                    <form action={toggleMemberAction.bind(null, u.id, !u.isActive)}>
                      <button className={`rounded-lg px-3 py-1.5 text-[10px] font-bold transition-colors ${u.isActive ? "bg-rose-500/10 text-rose-400 hover:bg-rose-500/20" : "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"}`}>
                        {u.isActive ? "تعطيل الحساب" : "تفعيل الحساب"}
                      </button>
                    </form>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}