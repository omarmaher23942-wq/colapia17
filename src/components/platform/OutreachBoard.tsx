"use client";

// لوحة التواصل مع البراندات: «الآن» (الرسالة المستحقة جاهزة للنسخ وفتح المحادثة)، وإضافة الحسابات، والقائمة بمراحلها،
// وجدول الإرسال اليومي. الإرسال من حساب Colapia بيد المالك: إنستجرام لا يسمح ببدء محادثة من البرامج، والأدوات غير
// الرسمية تعرّض الحساب للحظر (وهو نفسه حساب الوكيل)، والتباعد اليومي يحمي الحساب.
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { CalendarClock, Check, Copy, ExternalLink, Loader2, MessageSquare, Plus, RefreshCw, Search, Send, Settings2, SkipForward, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { LEAD_STATUSES, LEAD_STATUS_INFO, PENDING_STATUSES, type LeadStatus, type OutreachSettings } from "@/lib/ig-outreach";
import {
  addLeadsAction,
  deleteLeadAction,
  regenerateMessageAction,
  saveOutreachSettingsAction,
  setLeadStatusAction,
  updateLeadAction,
} from "@/server/actions/ig-outreach";

export type LeadView = {
  id: string;
  handle: string;
  brandName: string | null;
  category: string | null;
  note: string | null;
  status: LeadStatus;
  message: string | null;
  messageSource: string | null;
  scheduledFor: string | null;
  sentAt: string | null;
  conversationId: string | null;
  createdAt: string;
};

const TONE: Record<string, string> = {
  muted: "bg-white/8 text-[#c3cdf0]",
  info: "bg-sky-400/15 text-sky-300",
  warn: "bg-amber-400/15 text-amber-300",
  ok: "bg-emerald-400/15 text-emerald-300",
  bad: "bg-rose-400/15 text-rose-300",
};
/** أقل فاصل بين رسالتين يرسلهما المالك مبكراً عن موعدهما. */
const MIN_GAP_MIN = 20;

const timeFmt = (iso: string) =>
  new Date(iso).toLocaleString("ar-EG", { timeZone: "Africa/Cairo", weekday: "short", hour: "numeric", minute: "2-digit", day: "numeric", month: "short" });
const clock = (iso: string) => new Date(iso).toLocaleTimeString("ar-EG", { timeZone: "Africa/Cairo", hour: "numeric", minute: "2-digit" });
const cairoDay = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Africa/Cairo" });
const igProfile = (h: string) => `https://www.instagram.com/${h}/`;
const igDm = (h: string) => `https://ig.me/m/${h}`;

function untilLabel(iso: string, now: number) {
  const min = Math.max(1, Math.round((new Date(iso).getTime() - now) / 60_000));
  if (min < 90) return `بعد ${min} دقيقة`;
  const h = Math.round(min / 60);
  return h < 36 ? `بعد ${h} ساعة` : `بعد ${Math.round(h / 24)} يوم`;
}

export function OutreachBoard({ leads, settings, canEditSettings }: { leads: LeadView[]; settings: OutreachSettings; canEditSettings: boolean }) {
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());
  const [pending, start] = useTransition();
  const [filter, setFilter] = useState<LeadStatus | "all">("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  // تحديث كل دقيقة: الرسالة المستحقة والعدّاد ورسائل اكتملت صياغتها.
  useEffect(() => {
    const t = setInterval(() => {
      setNow(Date.now());
      router.refresh();
    }, 60_000);
    return () => clearInterval(t);
  }, [router]);

  const today = cairoDay(new Date(now));
  const pendingLeads = useMemo(
    () => leads.filter((l) => PENDING_STATUSES.includes(l.status) && l.scheduledFor).sort((a, b) => a.scheduledFor!.localeCompare(b.scheduledFor!)),
    [leads]
  );
  const due = pendingLeads.filter((l) => new Date(l.scheduledFor!).getTime() <= now);
  const next = pendingLeads.find((l) => new Date(l.scheduledFor!).getTime() > now) ?? null;
  const sentToday = leads.filter((l) => l.sentAt && cairoDay(new Date(l.sentAt)) === today).length;
  const lastSent = leads.reduce<number>((m, l) => (l.sentAt ? Math.max(m, new Date(l.sentAt).getTime()) : m), 0);
  const counts = useMemo(() => {
    const c = Object.fromEntries(LEAD_STATUSES.map((s) => [s, 0])) as Record<LeadStatus, number>;
    for (const l of leads) c[l.status] = (c[l.status] ?? 0) + 1;
    return c;
  }, [leads]);

  const current = due[0] ?? null;
  const shown = useMemo(() => {
    const term = q.trim().toLowerCase().replace(/^@/, "");
    return leads.filter((l) => (filter === "all" || l.status === filter) && (!term || l.handle.includes(term) || (l.brandName ?? "").toLowerCase().includes(term) || (l.note ?? "").includes(term)));
  }, [leads, filter, q]);

  const act = (fn: () => Promise<{ ok: boolean; error?: string }>, done?: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) toast.error(r.error ?? "تعذر الحفظ");
      else {
        if (done) toast.success(done);
        router.refresh();
      }
    });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-white/10 pb-5">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black text-white">
            <Send className="size-6 text-[#8fa8ff]" /> التواصل مع البراندات
          </h1>
          <p className="mt-1 max-w-2xl text-xs leading-6 text-[#c3cdf0]/70">
            أضف حسابات البراندات التي اخترتها، وكل حساب تجهز له رسالة افتتاحية مخصصة وموعد في جدول يومي متباعد. الإرسال من حساب Colapia بيدك (ننسخ الرسالة ونفتح
            المحادثة)، لأن إنستجرام لا يسمح ببدء المحادثات من البرامج والأدوات غير الرسمية تعرّض الحساب للحظر. أول ما يرد البراند يتسلّمه المساعد ويكمل معه.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-[12px]">
          <Stat label="أُرسل اليوم" value={`${sentToday} / ${settings.dailyCap}`} />
          <Stat label="في الطابور" value={String(counts.queued + counts.ready)} />
          <Stat label="ردّوا" value={String(counts.replied + counts.owner)} />
          <Stat label="أرسلوا الفورم" value={String(counts.form)} />
          <Stat label="دفعوا" value={String(counts.won)} />
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[1fr_400px]">
        <section className="min-w-0 rounded-2xl border border-white/10 bg-[#0b0f2a] p-4 sm:p-5">
          {current ? (
            <NowCard
              key={current.id}
              lead={current}
              waiting={due.length - 1}
              tooSoonUntil={lastSent && now - lastSent < MIN_GAP_MIN * 60_000 && new Date(current.scheduledFor!).getTime() > lastSent ? lastSent + MIN_GAP_MIN * 60_000 : 0}
              now={now}
              busy={pending}
              act={act}
            />
          ) : next ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <CalendarClock className="size-8 text-[#8fa8ff]" />
              <p className="text-[15px] font-black text-white">لا رسالة مستحقة الآن</p>
              <p className="text-[12.5px] text-[#c3cdf0]/80">
                التالية لـ <span className="font-mono text-white">@{next.handle}</span> الساعة {clock(next.scheduledFor!)}
                {` (${untilLabel(next.scheduledFor!, now)})`}.
                {sentToday >= settings.dailyCap ? " وصلت حد اليوم، والباقي موزّع على الأيام التالية." : ""}
              </p>
            </div>
          ) : (
            <div className="py-8 text-center text-[13px] text-[#c3cdf0]/80">الطابور فارغ. أضف حسابات البراندات التي اخترتها من الخانة المجاورة.</div>
          )}
        </section>

        <aside className="space-y-4">
          <AddLeads busy={pending} start={start} onDone={() => router.refresh()} />
          {canEditSettings ? <ScheduleSettings settings={settings} busy={pending} act={act} /> : null}
        </aside>
      </div>

      <section className="min-w-0 rounded-2xl border border-white/10 bg-[#0b0f2a]">
        <div className="flex flex-wrap items-center gap-2 border-b border-white/10 p-3">
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            <Chip on={filter === "all"} onClick={() => setFilter("all")} label={`الكل ${leads.length}`} />
            {LEAD_STATUSES.map((s) => (counts[s] ? <Chip key={s} on={filter === s} onClick={() => setFilter(s)} label={`${LEAD_STATUS_INFO[s].label} ${counts[s]}`} /> : null))}
          </div>
          <div className="relative min-w-[180px] flex-1">
            <Search className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-[#8d97c4]" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث بالحساب أو الاسم أو الملاحظة" className="w-full rounded-xl border border-white/10 bg-white/5 py-2 pe-9 ps-3 text-[12.5px] text-white placeholder:text-[#8d97c4] focus:border-[#6f86ff] focus:outline-none" />
          </div>
        </div>
        {shown.length ? (
          <ul className="max-h-[720px] divide-y divide-white/5 overflow-y-auto">
            {shown.map((l) => (
              <LeadRow key={l.id} lead={l} open={open === l.id} toggle={() => setOpen(open === l.id ? null : l.id)} busy={pending} act={act} />
            ))}
          </ul>
        ) : (
          <p className="p-6 text-center text-[12.5px] text-[#8d97c4]">لا حسابات هنا.</p>
        )}
      </section>
    </div>
  );
}

type Act = (fn: () => Promise<{ ok: boolean; error?: string }>, done?: string) => void;

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
      <div className="text-[10.5px] text-[#8d97c4]">{label}</div>
      <div className="font-mono text-[15px] font-black text-white">{value}</div>
    </div>
  );
}

function Chip({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} className={cn("shrink-0 rounded-full px-3 py-1.5 text-[11.5px] font-bold", on ? "bg-[#6f86ff] text-[#07091a]" : "bg-white/5 text-[#c3cdf0] hover:bg-white/10")}>
      {label}
    </button>
  );
}

function StatusPill({ status }: { status: LeadStatus }) {
  const i = LEAD_STATUS_INFO[status];
  return <span className={cn("rounded-full px-2 py-0.5 text-[10.5px] font-bold", TONE[i.tone])}>{i.label}</span>;
}

function NowCard({ lead, waiting, tooSoonUntil, now, busy, act }: { lead: LeadView; waiting: number; tooSoonUntil: number; now: number; busy: boolean; act: Act }) {
  const [text, setText] = useState(lead.message ?? "");
  const [copied, setCopied] = useState(false);
  const dirty = text.trim() !== (lead.message ?? "").trim();
  const waitMin = tooSoonUntil ? Math.ceil((tooSoonUntil - now) / 60_000) : 0;

  async function copyAndOpen() {
    if (dirty) act(() => updateLeadAction({ id: lead.id, message: text }));
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("نُسخت الرسالة. الصقها في المحادثة ثم اضغط «أرسلتها».");
    } catch {
      toast.error("تعذر النسخ تلقائياً، انسخ النص يدوياً.");
    }
    window.open(igDm(lead.handle), "_blank", "noopener");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#6f86ff] to-[#b06fff] text-lg font-black text-white">{lead.handle[0]?.toUpperCase()}</span>
          <div className="min-w-0">
            <a href={igProfile(lead.handle)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 font-mono text-[15px] font-black text-white hover:underline">
              @{lead.handle} <ExternalLink className="size-3.5 opacity-60" />
            </a>
            <p className="truncate text-[11.5px] text-[#8d97c4]">{[lead.brandName, lead.category, lead.note].filter(Boolean).join(" · ") || "بلا ملاحظات"}</p>
          </div>
        </div>
        <span className="rounded-full bg-amber-400/15 px-3 py-1 text-[11px] font-bold text-amber-300">
          مستحقة منذ {clock(lead.scheduledFor!)}
          {waiting > 0 ? ` · و${waiting} بعدها` : ""}
        </span>
      </div>

      {lead.message ? (
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          dir="rtl"
          className="w-full resize-y rounded-xl border border-white/10 bg-white/5 p-3 text-[14px] leading-7 text-white focus:border-[#6f86ff] focus:outline-none"
        />
      ) : (
        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-4 text-[12.5px] text-[#c3cdf0]">
          <Loader2 className="size-4 animate-spin" /> جارٍ تجهيز الرسالة المخصصة… (أو اضغط «صياغة أخرى»)
        </div>
      )}
      <p className="text-[11px] text-[#8d97c4]">
        {lead.messageSource === "template" ? "رسالة احتياطية (تعذرت الصياغة المخصصة). " : lead.messageSource === "edited" ? "عدّلتها بنفسك. " : ""}
        {text.length} حرفاً. راجعها قبل الإرسال.
      </p>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || !text.trim() || waitMin > 0}
          onClick={copyAndOpen}
          className="inline-flex items-center gap-2 rounded-xl bg-[#6f86ff] px-4 py-2.5 text-[13px] font-black text-white hover:bg-[#5b73f5] disabled:opacity-50"
        >
          <Copy className="size-4" /> {waitMin > 0 ? `انتظر ${waitMin} د (تباعد الرسائل)` : "انسخ وافتح المحادثة"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => act(() => setLeadStatusAction({ id: lead.id, status: "sent" }), "سُجّلت كمُرسلة")}
          className={cn("inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-black", copied ? "bg-emerald-500 text-white" : "border border-white/10 text-[#c3cdf0] hover:bg-white/5")}
        >
          <Check className="size-4" /> أرسلتها
        </button>
        <button type="button" disabled={busy} onClick={() => act(async () => { const r = await regenerateMessageAction(lead.id); if (r.ok) setText(r.message); return r; })} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2.5 text-[12px] font-bold text-[#c3cdf0] hover:bg-white/5">
          <RefreshCw className="size-4" /> صياغة أخرى
        </button>
        {dirty ? (
          <button type="button" disabled={busy} onClick={() => act(() => updateLeadAction({ id: lead.id, message: text }), "حُفظت")} className="rounded-xl border border-white/10 px-3 py-2.5 text-[12px] font-bold text-[#c3cdf0] hover:bg-white/5">
            احفظ التعديل
          </button>
        ) : null}
        <button type="button" disabled={busy} onClick={() => act(() => setLeadStatusAction({ id: lead.id, status: "skipped" }), "تخطّيته")} className="inline-flex items-center gap-2 rounded-xl px-3 py-2.5 text-[12px] font-bold text-[#8d97c4] hover:bg-white/5">
          <SkipForward className="size-4" /> تخطَّ
        </button>
      </div>
    </div>
  );
}

function AddLeads({ busy, start, onDone }: { busy: boolean; start: (fn: () => Promise<void>) => void; onDone: () => void }) {
  const [text, setText] = useState("");
  const [category, setCategory] = useState("");
  const lines = text.split(/\r?\n/).filter((l) => l.trim()).length;
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0b0f2a] p-4">
      <p className="flex items-center gap-2 text-[13px] font-black text-white">
        <Plus className="size-4 text-[#8fa8ff]" /> أضف حسابات
      </p>
      <p className="mt-1 text-[11px] leading-5 text-[#8d97c4]">حساب في كل سطر: رابط إنستجرام أو @اسم، وبعده «|» وملاحظتك (تُستخدم في تخصيص الرسالة). مثال: instagram.com/brand | فساتين سواريه وتصويرها حلو</p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        dir="ltr"
        placeholder={"https://instagram.com/brand1 | عبايات كاجوال\n@brand2 | تيشيرتات أوفر سايز"}
        className="mt-3 w-full resize-y rounded-xl border border-white/10 bg-white/5 p-3 font-mono text-[12px] leading-6 text-white placeholder:text-[#5d6696] focus:border-[#6f86ff] focus:outline-none"
      />
      <input
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        placeholder="النوع (اختياري): فساتين، عبايات، رجالي…"
        className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[12.5px] text-white placeholder:text-[#8d97c4] focus:border-[#6f86ff] focus:outline-none"
      />
      <button
        type="button"
        disabled={busy || !lines}
        onClick={() =>
          start(async () => {
            const r = await addLeadsAction({ text, category: category || undefined });
            if (!r.ok) return void toast.error(r.error);
            toast.success(`أضفت ${r.added} حساباً وجدولتهم${r.skipped.length ? `، و${r.skipped.length} موجودة من قبل` : ""}${r.invalid.length ? `، و${r.invalid.length} سطراً لم أفهمه` : ""}`);
            setText("");
            onDone();
          })
        }
        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#6f86ff] px-4 py-2.5 text-[13px] font-black text-white hover:bg-[#5b73f5] disabled:opacity-50"
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} تأكيد وجدولة {lines ? `(${lines})` : ""}
      </button>
    </div>
  );
}

function ScheduleSettings({ settings, busy, act }: { settings: OutreachSettings; busy: boolean; act: Act }) {
  const [s, setS] = useState(settings);
  const changed = s.dailyCap !== settings.dailyCap || s.startHour !== settings.startHour || s.endHour !== settings.endHour;
  const num = (v: string) => Number(v.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))));
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0b0f2a] p-4">
      <p className="flex items-center gap-2 text-[13px] font-black text-white">
        <Settings2 className="size-4 text-[#8fa8ff]" /> جدول الإرسال
      </p>
      <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] text-[#8d97c4]">
        <label className="space-y-1">
          <span>رسائل يومياً</span>
          <input type="number" min={1} max={30} value={s.dailyCap} onChange={(e) => setS({ ...s, dailyCap: num(e.target.value) })} className="w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 font-mono text-[13px] text-white" />
        </label>
        <label className="space-y-1">
          <span>من الساعة</span>
          <input type="number" min={0} max={22} value={s.startHour} onChange={(e) => setS({ ...s, startHour: num(e.target.value) })} className="w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 font-mono text-[13px] text-white" />
        </label>
        <label className="space-y-1">
          <span>إلى الساعة</span>
          <input type="number" min={1} max={24} value={s.endHour} onChange={(e) => setS({ ...s, endHour: num(e.target.value) })} className="w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 font-mono text-[13px] text-white" />
        </label>
      </div>
      <p className="mt-2 text-[11px] leading-5 text-[#8d97c4]">بتوقيت القاهرة. الموصى به 15–20 رسالة يومياً موزعة على اليوم؛ الرسائل المتتالية الكثيرة تعرّض الحساب لإيقاف مؤقت.</p>
      {changed ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => act(() => saveOutreachSettingsAction(s), "حُفظ الجدول وأُعيد توزيع الطابور")}
          className="mt-3 w-full rounded-xl bg-white/10 px-3 py-2 text-[12.5px] font-bold text-white hover:bg-white/15"
        >
          احفظ وأعد التوزيع
        </button>
      ) : null}
    </div>
  );
}

function LeadRow({ lead, open, toggle, busy, act }: { lead: LeadView; open: boolean; toggle: () => void; busy: boolean; act: Act }) {
  const [msg, setMsg] = useState(lead.message ?? "");
  const [note, setNote] = useState(lead.note ?? "");
  const [brand, setBrand] = useState(lead.brandName ?? "");
  const when = lead.sentAt ? `أُرسلت ${timeFmt(lead.sentAt)}` : lead.scheduledFor && PENDING_STATUSES.includes(lead.status) ? `موعدها ${timeFmt(lead.scheduledFor)}` : "";
  return (
    <li className="p-3">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={toggle} className="min-w-0 flex-1 text-start">
          <span className="font-mono text-[13px] font-bold text-white">@{lead.handle}</span>
          {lead.brandName ? <span className="ms-2 text-[12px] text-[#c3cdf0]">{lead.brandName}</span> : null}
          <span className="ms-2 text-[11px] text-[#8d97c4]">{when}</span>
        </button>
        <StatusPill status={lead.status} />
        {lead.conversationId ? (
          <Link href={`/admin/conversations?id=${lead.conversationId}`} className="inline-flex items-center gap-1 rounded-lg bg-white/5 px-2 py-1 text-[11px] font-bold text-[#8fa8ff] hover:bg-white/10">
            <MessageSquare className="size-3.5" /> المحادثة
          </Link>
        ) : null}
        <select
          value={lead.status}
          disabled={busy}
          onChange={(e) => act(() => setLeadStatusAction({ id: lead.id, status: e.target.value as LeadStatus }))}
          className="rounded-lg border border-white/10 bg-[#11163a] px-2 py-1 text-[11.5px] text-[#c3cdf0]"
          aria-label="غيّر الحالة"
        >
          {LEAD_STATUSES.map((s) => (
            <option key={s} value={s}>
              {LEAD_STATUS_INFO[s].label}
            </option>
          ))}
        </select>
      </div>
      {open ? (
        <div className="mt-3 grid gap-2 rounded-xl bg-white/[0.03] p-3 sm:grid-cols-2">
          <input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="اسم البراند" className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[12.5px] text-white" />
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="ملاحظتك" className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[12.5px] text-white" />
          <textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={4} placeholder="الرسالة الافتتاحية" className="rounded-lg border border-white/10 bg-white/5 p-3 text-[13px] leading-6 text-white sm:col-span-2" />
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => act(() => updateLeadAction({ id: lead.id, brandName: brand || null, note: note || null, ...(msg.trim() && msg.trim() !== (lead.message ?? "").trim() ? { message: msg } : {}) }), "حُفظ")}
              className="rounded-lg bg-[#6f86ff] px-3 py-1.5 text-[12px] font-bold text-white"
            >
              احفظ
            </button>
            <button type="button" disabled={busy} onClick={() => act(async () => { const r = await regenerateMessageAction(lead.id); if (r.ok) setMsg(r.message); return r; })} className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-1.5 text-[12px] font-bold text-[#c3cdf0]">
              <RefreshCw className="size-3.5" /> صياغة أخرى
            </button>
            <a href={igProfile(lead.handle)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-1.5 text-[12px] font-bold text-[#c3cdf0]">
              <ExternalLink className="size-3.5" /> الحساب
            </a>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (confirm(`حذف @${lead.handle} من القائمة؟`)) act(() => deleteLeadAction(lead.id), "حُذف");
              }}
              className="ms-auto inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-[12px] font-bold text-rose-300 hover:bg-rose-500/10"
            >
              <Trash2 className="size-3.5" /> حذف
            </button>
          </div>
        </div>
      ) : null}
    </li>
  );
}
