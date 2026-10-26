"use client";

// ProductionPanel.tsx — لوحة الإنتاج داخل صفحة الطلب: الحالة، الإسناد، الأزرار المسموحة لهذا العضو فقط (نفس قواعد الخادم من
// src/agency/production.ts)، «بانتظار العميل»، قائمة الفحص، والتسليم. التسليم يعيد رسالة جاهزة للنسخ (فيها دعوة الجلسة).
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ClipboardCopy, Clock3, Download, Loader2, PauseCircle, PlayCircle, Rocket, RotateCcw, Send, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { PRODUCTION_INFO, PRODUCTION_STATES, QA_ITEMS, canMove, canTickQa, type ProductionState, type QaState } from "@/agency/production";
import { can, ROLE_INFO, type PlatformRole } from "@/agency/roles";
import { assignRequestAction, deliverRequestAction, moveProductionAction, setWaitingAction, tickQaAction } from "@/server/actions/agency-production";
import { cn } from "@/lib/utils";

export type Member = { id: string; name: string; role: PlatformRole };

type Props = {
  id: string;
  me: { id: string; role: PlatformRole };
  production: ProductionState;
  builderId: string | null;
  reviewerId: string | null;
  qa: QaState;
  waitingReason: string | null;
  members: Member[];
  round: number;
  overdue: number;
};

const btn = "inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-[13px] font-black disabled:cursor-not-allowed disabled:opacity-50";
const box = "w-full rounded-xl border border-white/10 bg-white/[0.04] p-3 text-[14px] leading-7 text-[#eaf0ff] outline-none placeholder:text-[#8d97c4]/70 focus:border-[#6f86ff]";
const select = "h-11 w-full rounded-xl border border-white/10 bg-[#07091a] px-3 text-[13px] font-bold text-white outline-none focus:border-[#6f86ff]";

export function ProductionPanel(p: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [note, setNote] = useState("");
  const [builder, setBuilder] = useState(p.builderId ?? "");
  const [reviewer, setReviewer] = useState(p.reviewerId ?? "");
  const [waiting, setWaiting] = useState(p.waitingReason ?? "");
  const [delivered, setDelivered] = useState<{ message: string; downloadUrl: string } | null>(null);
  const [copied, setCopied] = useState(false);
  // علامات الفحص تظهر فوراً عند الضغط (تفاؤلياً)، وتُعاد إن رفضها الخادم.
  const [qaLocal, setQaLocal] = useState<QaState>(p.qa);
  const [qaSeen, setQaSeen] = useState(p.qa);
  if (qaSeen !== p.qa) {
    setQaSeen(p.qa);
    setQaLocal(p.qa);
  }

  const row = { production: p.production, builderId: p.builderId, reviewerId: p.reviewerId, qa: qaLocal };
  const manager = can(p.me.role, "requests.assign");
  const mine = p.builderId === p.me.id;
  const names = useMemo(() => new Map(p.members.map((m) => [m.id, m.name])), [p.members]);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, success: string, after?: () => void) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return void toast.error(r.error ?? "تعذر الحفظ");
      toast.success(success);
      after?.();
      router.refresh();
    });

  const move = (to: ProductionState, label: string) => run(() => moveProductionAction({ id: p.id, to, note: note || undefined }), label, () => setNote(""));

  const actions: { to: ProductionState; label: string; icon: typeof PlayCircle; tone: string; needsNote?: boolean }[] = [];
  if (p.production === "assigned" || (p.production === "new" && p.builderId)) actions.push({ to: "building", label: "ابدأ التجهيز", icon: PlayCircle, tone: "bg-[#6f86ff] text-[#07091a]" });
  if (p.production === "building") actions.push({ to: "review", label: "أرسل للمراجعة", icon: Send, tone: "bg-[#6f86ff] text-[#07091a]" });
  if (p.production === "review") {
    actions.push({ to: "ready", label: "اعتمد: جاهز للتسليم", icon: ShieldCheck, tone: "bg-emerald-400 text-[#07091a]" });
    actions.push({ to: "building", label: "أعده للمنفّذ", icon: RotateCcw, tone: "border border-amber-400/40 text-amber-200", needsNote: true });
  }
  if (p.production === "ready") actions.push({ to: "building", label: "أعده للتجهيز", icon: RotateCcw, tone: "border border-amber-400/40 text-amber-200", needsNote: true });

  const builders = p.members.filter((m) => can(m.role, "requests.work"));
  const reviewers = p.members.filter((m) => can(m.role, "requests.approve"));
  const doneCount = (by: "builder" | "reviewer") => QA_ITEMS.filter((i) => i.by === by && qaLocal[i.key]).length;
  const total = (by: "builder" | "reviewer") => QA_ITEMS.filter((i) => i.by === by).length;
  const tick = (key: string, done: boolean) => {
    const prev = qaLocal;
    setQaLocal((q) => {
      const next = { ...q };
      if (done) next[key] = { by: p.me.id, at: new Date().toISOString() };
      else delete next[key];
      return next;
    });
    start(async () => {
      const r = await tickQaAction({ id: p.id, key, done });
      if (!r.ok) {
        setQaLocal(prev);
        return void toast.error(r.error);
      }
      router.refresh();
    });
  };

  const deliver = () =>
    start(async () => {
      if (!window.confirm("تسليم المشروع للعميل الآن؟ تبدأ نافذة التعديل المجاني من هذه اللحظة.")) return;
      const r = await deliverRequestAction({ id: p.id });
      if (!r.ok) return void toast.error(r.error);
      toast.success("سُلِّم المشروع");
      setDelivered({ message: r.message, downloadUrl: r.downloadUrl });
      router.refresh();
    });

  return (
    <div className="space-y-5">
      {/* الحالة */}
      <ol className="grid grid-cols-3 gap-1.5 sm:grid-cols-6" aria-label="حالة الإنتاج">
        {PRODUCTION_STATES.map((s, i) => {
          const idx = PRODUCTION_STATES.indexOf(p.production);
          return (
            <li key={s} aria-current={s === p.production ? "step" : undefined} className={cn("rounded-xl border px-2 py-2 text-center text-[11.5px] font-black", s === p.production ? "border-[#6f86ff] bg-[#6f86ff]/20 text-white" : i < idx ? "border-emerald-400/30 text-emerald-300" : "border-white/10 text-[#8d97c4]")}>
              {PRODUCTION_INFO[s].label}
            </li>
          );
        })}
      </ol>
      <p className="text-[12.5px] text-[#8d97c4]">
        {PRODUCTION_INFO[p.production].hint} الجولة {p.round}
        {p.overdue > 0 ? <span className="ms-2 font-black text-rose-300">متأخر داخلياً {p.overdue} س عن مهلة هذه الحالة</span> : null}
      </p>

      {/* الإسناد */}
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <label className="block text-[12.5px] font-black text-[#c3cdf0]">
          المنفّذ
          {manager ? (
            <select value={builder} onChange={(e) => setBuilder(e.target.value)} className={cn(select, "mt-1.5")} disabled={pending || p.production === "delivered"}>
              <option value="">— بلا —</option>
              {builders.map((m) => (
                <option key={m.id} value={m.id} disabled={m.id === reviewer}>
                  {m.name} ({ROLE_INFO[m.role].label})
                </option>
              ))}
            </select>
          ) : (
            <span className="mt-1.5 block text-[14px] text-white">{p.builderId ? (names.get(p.builderId) ?? "عضو") : "—"}</span>
          )}
        </label>
        <label className="block text-[12.5px] font-black text-[#c3cdf0]">
          المراجع
          {manager ? (
            <select value={reviewer} onChange={(e) => setReviewer(e.target.value)} className={cn(select, "mt-1.5")} disabled={pending || p.production === "delivered"}>
              <option value="">— أي مراجع —</option>
              {reviewers.map((m) => (
                <option key={m.id} value={m.id} disabled={m.id === builder}>
                  {m.name} ({ROLE_INFO[m.role].label})
                </option>
              ))}
            </select>
          ) : (
            <span className="mt-1.5 block text-[14px] text-white">{p.reviewerId ? (names.get(p.reviewerId) ?? "عضو") : "أي مراجع"}</span>
          )}
        </label>
        {manager ? (
          <button type="button" disabled={pending || ((builder || null) === p.builderId && (reviewer || null) === p.reviewerId)} onClick={() => run(() => assignRequestAction({ id: p.id, builderId: builder || null, reviewerId: reviewer || null }), "حُفظ الإسناد وأُبلغ الأعضاء")} className={cn(btn, "border border-white/15 text-white")}>
            حفظ الإسناد
          </button>
        ) : null}
      </div>

      {/* الانتقالات */}
      {actions.length ? (
        <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.02] p-3">
          <label className="block text-[12.5px] font-black text-[#c3cdf0]">
            ملاحظة داخلية مع الانتقال {actions.some((a) => a.needsNote) ? "(إلزامية عند الإعادة: ما الذي يجب إصلاحه)" : "(اختيارية)"}
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={3000} className={cn(box, "mt-1.5")} />
          </label>
          <div className="flex flex-wrap gap-2">
            {actions.map((a) => {
              const why = canMove(row, a.to, p.me, a.needsNote ? note : "x");
              return (
                <button key={a.label} type="button" disabled={pending || !why.ok} title={why.ok ? undefined : why.error} onClick={() => move(a.to, `${a.label}: تم`)} className={cn(btn, a.tone)}>
                  {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <a.icon className="size-4" aria-hidden="true" />}
                  {a.label}
                </button>
              );
            })}
          </div>
          {actions.map((a) => {
            const why = canMove(row, a.to, p.me, a.needsNote ? note : "x");
            return !why.ok ? (
              <p key={`why-${a.label}`} className="text-[12px] text-[#8d97c4]">«{a.label}»: {why.error}</p>
            ) : null;
          })}
        </div>
      ) : p.production === "new" && !p.builderId ? (
        <p className="text-[12.5px] text-[#8d97c4]">{manager ? "اختر منفّذاً واحفظ الإسناد ليبدأ." : "بانتظار أن يسنده مدير لمنفّذ."}</p>
      ) : null}

      {/* التسليم */}
      {p.production === "ready" && can(p.me.role, "requests.deliver") ? (
        <div className="space-y-2 rounded-2xl border border-emerald-400/30 bg-emerald-400/[0.06] p-3">
          <p className="text-[13px] font-bold leading-6 text-emerald-100">اعتمده المراجع وقائمة الفحص كاملة. التسليم يسجّل تاريخه ويفتح نافذة التعديل المجاني للعميل، ويعطيك رسالة التسليم جاهزة للنسخ ورابط تنزيل المشروع.</p>
          <button type="button" disabled={pending} onClick={deliver} className={cn(btn, "bg-emerald-400 text-[#07091a]")}>
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Rocket className="size-4" aria-hidden="true" />}
            سلّم للعميل
          </button>
        </div>
      ) : null}
      {delivered ? (
        <div className="space-y-2 rounded-2xl border border-white/10 bg-[#050716] p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-[13px] font-black text-white">رسالة التسليم (انسخها وأرسلها للعميل)</h3>
            <div className="flex gap-2">
              <a href={delivered.downloadUrl} className={cn(btn, "border border-white/15 text-white")}>
                <Download className="size-4" aria-hidden="true" /> تنزيل المشروع
              </a>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(delivered.message);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2500);
                  } catch {
                    toast.error("المتصفح منع النسخ.");
                  }
                }}
                className={cn(btn, "bg-white/[0.06] text-white hover:bg-white/10")}
              >
                {copied ? <Check className="size-4 text-emerald-400" aria-hidden="true" /> : <ClipboardCopy className="size-4" aria-hidden="true" />}
                انسخ الرسالة
              </button>
            </div>
          </div>
          <pre dir="rtl" className="whitespace-pre-wrap text-[12.5px] leading-7 text-[#c3cdf0]">{delivered.message}</pre>
        </div>
      ) : null}

      {/* بانتظار العميل */}
      {p.production !== "delivered" && (manager || mine || can(p.me.role, "requests.client_stage")) ? (
        <div className="flex flex-wrap items-end gap-2">
          <label className="block min-w-[220px] flex-1 text-[12.5px] font-black text-[#c3cdf0]">
            بانتظار العميل (معلومة ناقصة)
            <input value={waiting} onChange={(e) => setWaiting(e.target.value)} maxLength={300} placeholder="مثلاً: صورة الشعار بجودة أعلى" className={cn(box, "mt-1.5 h-11 py-0")} />
          </label>
          <button type="button" disabled={pending || (waiting.trim() || null) === p.waitingReason} onClick={() => run(() => setWaitingAction({ id: p.id, reason: waiting.trim() || null }), waiting.trim() ? "عُلِّم بانتظار العميل" : "انتهى الانتظار")} className={cn(btn, "border border-white/15 text-white")}>
            {waiting.trim() ? <PauseCircle className="size-4" aria-hidden="true" /> : <Clock3 className="size-4" aria-hidden="true" />}
            {waiting.trim() ? "علّمه منتظراً" : "أنهِ الانتظار"}
          </button>
        </div>
      ) : null}

      {/* قائمة الفحص */}
      <div className="grid gap-4 lg:grid-cols-2">
        {(["builder", "reviewer"] as const).map((by) => (
          <fieldset key={by} className="space-y-2 rounded-2xl border border-white/10 p-3">
            <legend className="px-1 text-[12.5px] font-black text-white">
              {by === "builder" ? "قبل الإرسال للمراجعة (المنفّذ)" : "قبل الاعتماد (المراجع)"} · {doneCount(by)}/{total(by)}
            </legend>
            {QA_ITEMS.filter((i) => i.by === by).map((item) => {
              const checked = Boolean(qaLocal[item.key]);
              const editable = canTickQa(row, item, p.me);
              return (
                <label key={item.key} className={cn("flex items-start gap-2.5 rounded-xl p-2 text-[13px] leading-6", editable ? "cursor-pointer hover:bg-white/[0.03]" : "opacity-70")}>
                  <input type="checkbox" checked={checked} disabled={!editable} onChange={(e) => tick(item.key, e.target.checked)} className="mt-1 size-4 shrink-0 accent-emerald-400" />
                  <span className={checked ? "text-emerald-100" : "text-[#c3cdf0]"}>
                    {item.label}
                    {checked ? <span className="block text-[11px] text-[#8d97c4]">{names.get(qaLocal[item.key]!.by) ?? "عضو"}</span> : null}
                  </span>
                </label>
              );
            })}
          </fieldset>
        ))}
      </div>
    </div>
  );
}
