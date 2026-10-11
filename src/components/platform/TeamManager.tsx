"use client";

// TeamManager.tsx — إضافة عضو بالبريد والدور (يدخل بحساب Google بنفس البريد)، وتغيير الدور، والإيقاف. للمالك فقط؛
// الخادم يفرض ذلك في كل إجراء (platform-team.ts).
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { ASSIGNABLE_ROLES, ROLE_INFO, type PlatformRole } from "@/agency/roles";
import { addMemberAction, changeMemberRoleAction, toggleMemberAction } from "@/server/actions/platform-team";
import { cn } from "@/lib/utils";

const input = "h-11 w-full rounded-xl border border-white/10 bg-[#07091a] px-3 text-[14px] text-white outline-none focus:border-[#8fa8ff]";

export function AddMember() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<PlatformRole>("builder");
  const [pending, start] = useTransition();
  const submit = () =>
    start(async () => {
      const r = await addMemberAction({ name, email, role });
      if (!r.ok) return void toast.error(r.error);
      toast.success(r.emailed ? "أُضيف العضو ووصله بريد الدعوة" : "أُضيف العضو (تعذر إرسال البريد: أبلغه أن يدخل بحساب Google على /admin/login)");
      setName("");
      setEmail("");
      router.refresh();
    });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1.3fr_1fr_auto]"
    >
      <label className="block text-[12px] font-bold text-slate-400">
        الاسم
        <input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={80} className={cn(input, "mt-1.5")} />
      </label>
      <label className="block text-[12px] font-bold text-slate-400">
        بريد Google
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required dir="ltr" maxLength={120} placeholder="name@gmail.com" className={cn(input, "mt-1.5")} />
      </label>
      <label className="block text-[12px] font-bold text-slate-400">
        الدور
        <select value={role} onChange={(e) => setRole(e.target.value as PlatformRole)} className={cn(input, "mt-1.5")}>
          {ASSIGNABLE_ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_INFO[r].label}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" disabled={pending} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#8fa8ff] px-4 text-[13px] font-black text-[#07091a] disabled:opacity-60">
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <UserPlus className="size-4" aria-hidden="true" />}
        أضف
      </button>
      <p className="text-[12px] leading-6 text-slate-400 sm:col-span-2 lg:col-span-4">{ROLE_INFO[role].hint} يصله بريد بالدعوة، ويدخل بحساب Google المسجّل بهذا البريد نفسه. لا كلمات مرور.</p>
    </form>
  );
}

export function MemberControls({ id, role, active }: { id: string; role: PlatformRole; active: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, ok: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return void toast.error(r.error ?? "تعذر الحفظ");
      toast.success(ok);
      router.refresh();
    });
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        aria-label="الدور"
        value={role}
        disabled={pending || !active}
        onChange={(e) => run(() => changeMemberRoleAction({ id, role: e.target.value }), "تغيّر الدور (ستُطلب منه إعادة الدخول)")}
        className="h-10 rounded-lg border border-white/10 bg-[#07091a] px-2 text-[12px] font-bold text-white"
      >
        {ASSIGNABLE_ROLES.map((r) => (
          <option key={r} value={r}>
            {ROLE_INFO[r].label}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={pending}
        onClick={() => run(() => toggleMemberAction({ id, active: !active }), active ? "أُوقف العضو وأُعيدت طلباته للطابور" : "أُعيد تفعيل العضو")}
        className={cn("h-10 rounded-lg px-3 text-[12px] font-bold", active ? "bg-rose-500/10 text-rose-300 hover:bg-rose-500/20" : "bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20")}
      >
        {active ? "أوقف" : "فعّل"}
      </button>
    </div>
  );
}
