"use client";

// مركز جمهور المالك: من سجّل ووصل لأين، واختيار شريحة أو أشخاص، وكتابة رسالة بمعاينة حية وإرسال تجريبي،
// ثم إرسال على دفعات بشريط تقدم حقيقي. من أوقف الرسائل لا يُختار ولا تصله.
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, Send, FlaskConical, Mail, Users, Check, X, Loader2, BellOff, Sparkles, History } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { sendCampaignBatchAction, sendTestEmailAction, startCampaignAction } from "@/server/actions/outreach";
import type { AudienceRow, Segment } from "@/server/outreach";

type Campaign = { id: string; subject: string; segment: string; recipients: number; sent: number; failed: number; createdAt: string };

const SEG_TONE: Record<string, string> = {
  owned: "bg-emerald-400/15 text-emerald-300",
  paid: "bg-sky-400/15 text-sky-300",
  trial: "bg-amber-400/15 text-amber-300",
  lapsed: "bg-rose-400/15 text-rose-300",
  signed_up: "bg-white/10 text-[#c3cdf0]",
};

const PRESETS: { label: string; subject: string; headline: string; body: string; buttonTitle: string; buttonUrl: string }[] = [
  {
    label: "أكمل متجرك",
    subject: "{name}، متجرك على بُعد دقائق",
    headline: "خلّينا نكمّل متجرك",
    body: "أهلاً {name}،\n\nلاحظنا إنك بدأت تسجيلك في Colapia ولسه متجرك ما اكتملش. الاستمارة كلها 5 خطوات، وبعدها الذكاء الاصطناعي يصمم متجرك ويكتبه بالكامل.\n\nجرّبه 24 ساعة مجاناً، ولو عجبك فالباقة تشمل متجرك وسنة استضافة كاملة علينا، بلا عمولة على مبيعاتك.",
    buttonTitle: "أكمل متجري",
    buttonUrl: "https://colapia.com/dashboard",
  },
  {
    label: "تذكير بالتفعيل",
    subject: "{store} جاهز، فعّله قبل ما تنتهي التجربة",
    headline: "متجرك مستنيك",
    body: "أهلاً {name}،\n\nمتجر «{store}» شغال الآن. فعّله بالباقة (تشمل سنة استضافة كاملة علينا)، ويفتح لزباينك فوراً، من غير أي عمولة على مبيعاتك.",
    buttonTitle: "فعّل متجري",
    buttonUrl: "https://colapia.com/dashboard/billing",
  },
  {
    label: "خبر جديد",
    subject: "جديد في Colapia",
    headline: "ميزة جديدة لمتجرك",
    body: "أهلاً {name}،\n\nاكتب هنا الخبر بإيجاز: ماذا تغيّر، ولماذا يهم صاحب المتجر.",
    buttonTitle: "",
    buttonUrl: "",
  },
];

const EMPTY = { subject: "", headline: "", body: "", buttonTitle: "", buttonUrl: "" };
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("ar-EG", { day: "numeric", month: "short", year: "numeric" }) : "—");

export function AudienceCenter({ people, segments, campaigns }: { people: AudienceRow[]; segments: Record<Segment, string>; campaigns: Campaign[] }) {
  const router = useRouter();
  const [segment, setSegment] = useState<Segment>("all");
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [draft, setDraft] = useState(EMPTY);
  const [confirming, setConfirming] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number; sent: number; failed: number } | null>(null);
  const [testing, startTest] = useTransition();

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: 0 };
    for (const p of people) {
      if (p.optedOut) continue;
      c.all = (c.all ?? 0) + 1;
      c[p.segment] = (c[p.segment] ?? 0) + 1;
    }
    return c;
  }, [people]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return people.filter(
      (p) =>
        (segment === "all" || p.segment === segment) &&
        (!needle || p.name.toLowerCase().includes(needle) || p.email.includes(needle) || (p.storeName ?? "").toLowerCase().includes(needle) || (p.subdomain ?? "").includes(needle))
    );
  }, [people, segment, q]);

  const custom = picked.size > 0;
  const target = custom ? picked.size : counts[segment] ?? 0;
  const targetLabel = custom ? `${picked.size} محدد${picked.size > 1 ? "ين" : ""}` : `${segments[segment]} (${target})`;
  const ready = draft.subject.trim().length >= 3 && draft.body.trim().length >= 10;
  const sending = progress !== null && progress.done < progress.total;

  const toggle = (id: string) =>
    setPicked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const send = async () => {
    setConfirming(false);
    const start = await startCampaignAction({ draft, segment: custom ? "custom" : segment, ids: custom ? [...picked] : undefined });
    if (!start.ok) return toast.error(start.error);
    const { campaignId, recipients } = start.data;
    let sent = 0;
    let failed = 0;
    setProgress({ done: 0, total: recipients.length, sent, failed });
    for (let i = 0; i < recipients.length; i += 20) {
      const chunk = recipients.slice(i, i + 20);
      const r = await sendCampaignBatchAction(campaignId, chunk).catch(() => ({ ok: false as const, error: "انقطع الاتصال" }));
      if (r.ok) {
        sent += r.data.sent;
        failed += r.data.failed;
      } else failed += chunk.length;
      setProgress({ done: Math.min(i + 20, recipients.length), total: recipients.length, sent, failed });
    }
    toast.success(`أُرسلت ${sent.toLocaleString("ar-EG")} رسالة${failed ? `، وتعذّرت ${failed.toLocaleString("ar-EG")}` : ""}`);
    setPicked(new Set());
    router.refresh();
  };

  const input = "w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-[13px] text-white outline-none placeholder:text-[#8d97c4]/60 focus:border-[#8fa8ff]";

  return (
    <div className="space-y-6" dir="rtl">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-white/10 pb-5">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black text-white">
            <Users className="size-6 text-[#8fa8ff]" /> الجمهور والبريد
          </h1>
          <p className="mt-1 text-xs text-[#c3cdf0]/70">كل من سجّل في Colapia، وأين وصل. راسل شخصاً أو شريحة أو قائمة تختارها.</p>
        </div>
        <span className="rounded-xl bg-white/5 px-3 py-2 text-[12px] font-bold text-[#c3cdf0]">
          {people.length.toLocaleString("ar-EG")} شخص · {(people.length - (counts.all ?? 0)).toLocaleString("ar-EG")} أوقفوا الرسائل
        </span>
      </header>

      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="الشرائح">
        {(Object.keys(segments) as Segment[]).map((s) => (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={segment === s}
            onClick={() => {
              setSegment(s);
              setPicked(new Set());
            }}
            className={cn(
              "shrink-0 rounded-xl border px-3.5 py-2 text-[12px] font-bold transition",
              segment === s ? "border-[#8fa8ff]/50 bg-[#6f86ff]/20 text-white" : "border-white/10 text-[#c3cdf0]/75 hover:bg-white/5"
            )}
          >
            {segments[s]} <span className="ms-1 font-mono text-[11px] opacity-70">{(counts[s] ?? 0).toLocaleString("ar-EG")}</span>
          </button>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_440px]">
        {/* القائمة */}
        <section className="min-w-0 rounded-2xl border border-white/10 bg-[#0b0f2a]">
          <div className="flex flex-wrap items-center gap-2 border-b border-white/10 p-3">
            <label className="relative min-w-[200px] flex-1">
              <Search className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-[#8d97c4]" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث بالاسم أو البريد أو المتجر" className={cn(input, "pe-9")} />
            </label>
            <button
              type="button"
              onClick={() => setPicked(new Set(visible.filter((p) => !p.optedOut).map((p) => p.id)))}
              className="rounded-xl border border-white/10 px-3 py-2.5 text-[12px] font-bold text-[#c3cdf0] hover:bg-white/5"
            >
              حدّد الظاهرين
            </button>
            {custom ? (
              <button type="button" onClick={() => setPicked(new Set())} className="rounded-xl px-3 py-2.5 text-[12px] font-bold text-rose-300 hover:bg-rose-500/10">
                إلغاء التحديد ({picked.size})
              </button>
            ) : null}
          </div>
          {visible.length ? (
            <ul className="max-h-[640px] divide-y divide-white/5 overflow-y-auto">
              {visible.slice(0, 500).map((p) => (
                <li key={p.id} className={cn("flex items-center gap-3 px-3 py-3", p.optedOut && "opacity-50")}>
                  <input
                    type="checkbox"
                    checked={picked.has(p.id)}
                    disabled={p.optedOut}
                    onChange={() => toggle(p.id)}
                    aria-label={`تحديد ${p.name}`}
                    className="size-4 accent-[#6f86ff]"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-[13px] font-bold text-white">
                      {p.name}
                      <span className={cn("rounded-full px-2 py-0.5 text-[10.5px] font-bold", SEG_TONE[p.segment])}>{segments[p.segment]}</span>
                      {p.optedOut ? (
                        <span className="inline-flex items-center gap-1 text-[10.5px] text-[#8d97c4]">
                          <BellOff className="size-3" /> أوقف الرسائل
                        </span>
                      ) : null}
                    </p>
                    <p className="truncate text-[11.5px] text-[#8d97c4]" dir="ltr" style={{ textAlign: "right" }}>
                      {p.email}
                    </p>
                    <p className="text-[11px] text-[#8d97c4]/80">
                      {p.storeName ? `${p.storeName} · ` : ""}انضم {fmt(p.joinedAt)} · آخر دخول {fmt(p.lastLoginAt)}
                    </p>
                  </div>
                  {!p.optedOut ? (
                    <button
                      type="button"
                      onClick={() => setPicked(new Set([p.id]))}
                      className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1.5 text-[11px] font-bold text-[#c3cdf0] hover:bg-white/5"
                    >
                      <Mail className="size-3.5" /> راسله
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-8 text-center text-[13px] text-[#8d97c4]">لا أحد في هذا الاختيار.</p>
          )}
          {visible.length > 500 ? <p className="border-t border-white/10 p-3 text-center text-[11px] text-[#8d97c4]">تظهر أول 500؛ استخدم البحث للوصول لأي شخص (الإرسال للشريحة يشمل الجميع).</p> : null}
        </section>

        {/* كتابة الرسالة */}
        <section className="space-y-4 rounded-2xl border border-white/10 bg-[#0b0f2a] p-4 xl:sticky xl:top-6 xl:self-start">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-[15px] font-black text-white">رسالة جديدة</h2>
            <span className="rounded-lg bg-[#6f86ff]/15 px-2.5 py-1 text-[11.5px] font-bold text-[#c9d4ff]">إلى: {targetLabel}</span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => setDraft({ subject: p.subject, headline: p.headline, body: p.body, buttonTitle: p.buttonTitle, buttonUrl: p.buttonUrl })}
                className="inline-flex items-center gap-1 rounded-lg bg-white/5 px-2.5 py-1.5 text-[11px] font-bold text-[#c3cdf0] hover:bg-white/10"
              >
                <Sparkles className="size-3" /> {p.label}
              </button>
            ))}
          </div>

          <input value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} placeholder="عنوان الرسالة (يظهر في صندوق البريد)" maxLength={150} className={input} />
          <input value={draft.headline} onChange={(e) => setDraft({ ...draft, headline: e.target.value })} placeholder="عنوان داخل الرسالة (اختياري)" maxLength={150} className={input} />
          <textarea
            value={draft.body}
            onChange={(e) => setDraft({ ...draft, body: e.target.value })}
            placeholder="نص الرسالة. اترك سطراً فارغاً بين الفقرات."
            rows={8}
            maxLength={5000}
            className={cn(input, "resize-y leading-7")}
          />
          <p className="text-[11px] text-[#8d97c4]">
            اكتب <code className="rounded bg-white/10 px-1">{"{name}"}</code> لاسم الشخص الأول و<code className="rounded bg-white/10 px-1">{"{store}"}</code> لاسم متجره.
          </p>
          <div className="grid gap-2 sm:grid-cols-[140px_1fr]">
            <input value={draft.buttonTitle} onChange={(e) => setDraft({ ...draft, buttonTitle: e.target.value })} placeholder="نص الزر (اختياري)" maxLength={40} className={input} />
            <input value={draft.buttonUrl} onChange={(e) => setDraft({ ...draft, buttonUrl: e.target.value })} placeholder="https://..." dir="ltr" className={input} />
          </div>

          {/* معاينة */}
          <div className="rounded-xl bg-white p-4 text-[#111827]">
            <p className="text-[11px] text-gray-400">معاينة (بأول اسم في الاختيار)</p>
            <Preview draft={draft} sample={people.find((p) => (custom ? picked.has(p.id) : segment === "all" || p.segment === segment)) ?? null} />
          </div>

          {progress ? (
            <div aria-live="polite" className="space-y-1.5">
              <div className="flex justify-between text-[12px] font-bold text-white">
                <span className="inline-flex items-center gap-1.5">
                  {sending ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5 text-emerald-400" />}
                  {sending ? "يُرسل..." : "اكتمل الإرسال"}
                </span>
                <span className="font-mono">
                  {progress.done}/{progress.total}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-gradient-to-l from-[#6f86ff] to-emerald-400 transition-all" style={{ width: `${(progress.done / Math.max(1, progress.total)) * 100}%` }} />
              </div>
              <p className="text-[11px] text-[#8d97c4]">
                وصلت {progress.sent} · تعذّرت {progress.failed}
              </p>
            </div>
          ) : null}

          {confirming ? (
            <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-3">
              <p className="text-[12.5px] font-bold text-amber-100">ترسل الآن إلى {targetLabel}؟ لا يمكن التراجع بعد الإرسال.</p>
              <div className="mt-2 flex gap-2">
                <button type="button" onClick={send} className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-3 py-2 text-[12px] font-black text-[#07091a]">
                  <Send className="size-3.5" /> نعم، أرسل
                </button>
                <button type="button" onClick={() => setConfirming(false)} className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-[12px] font-bold text-[#c3cdf0] hover:bg-white/5">
                  <X className="size-3.5" /> رجوع
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={!ready || testing || sending}
                onClick={() =>
                  startTest(async () => {
                    const r = await sendTestEmailAction(draft);
                    if (r.ok) toast.success(`أُرسلت نسخة تجربة إلى ${r.data.to}`);
                    else toast.error(r.error);
                  })
                }
                className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl border border-white/10 text-[12.5px] font-bold text-[#c3cdf0] hover:bg-white/5 disabled:opacity-50"
              >
                {testing ? <Loader2 className="size-4 animate-spin" /> : <FlaskConical className="size-4" />} أرسل تجربة لي
              </button>
              <button
                type="button"
                disabled={!ready || !target || sending}
                onClick={() => setConfirming(true)}
                className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl bg-[#6f86ff] text-[12.5px] font-black text-white disabled:opacity-50"
              >
                <Send className="size-4" /> أرسل ({target.toLocaleString("ar-EG")})
              </button>
            </div>
          )}
        </section>
      </div>

      <section className="rounded-2xl border border-white/10 bg-[#0b0f2a] p-4">
        <h2 className="mb-3 flex items-center gap-2 text-[14px] font-black text-white">
          <History className="size-4 text-[#8fa8ff]" /> الرسائل المرسلة
        </h2>
        {campaigns.length ? (
          <ul className="divide-y divide-white/5">
            {campaigns.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-[12.5px]">
                <span className="min-w-0 flex-1 truncate font-bold text-white">{c.subject}</span>
                <span className="text-[#8d97c4]">{c.segment === "custom" ? "قائمة مختارة" : segments[c.segment as Segment] ?? c.segment}</span>
                <span className="font-mono text-emerald-300">{c.sent}</span>
                {c.failed ? <span className="font-mono text-rose-300">{c.failed}✕</span> : null}
                <span className="text-[#8d97c4]">{fmt(c.createdAt)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[12.5px] text-[#8d97c4]">لم تُرسل رسائل بعد.</p>
        )}
      </section>
    </div>
  );
}

function Preview({ draft, sample }: { draft: typeof EMPTY; sample: AudienceRow | null }) {
  const name = sample?.name.trim().split(/\s+/)[0] ?? "أحمد";
  const store = sample?.storeName ?? "متجرك";
  const p = (t: string) => t.replaceAll("{name}", name).replaceAll("{store}", store);
  if (!draft.subject && !draft.body) return <p className="mt-2 text-[12px] text-gray-400">اكتب الرسالة لتظهر هنا.</p>;
  return (
    <div className="mt-2 space-y-2">
      <p className="text-[12px] font-bold text-gray-500">{p(draft.subject)}</p>
      {draft.headline ? <p className="text-[16px] font-black">{p(draft.headline)}</p> : null}
      {p(draft.body)
        .split(/\n\s*\n/)
        .filter((x) => x.trim())
        .map((para, i) => (
          <p key={i} className="whitespace-pre-line text-[13px] leading-7">
            {para}
          </p>
        ))}
      {draft.buttonTitle && draft.buttonUrl ? <span className="inline-block rounded-lg bg-[#0f766e] px-4 py-2 text-[12.5px] font-bold text-white">{p(draft.buttonTitle)}</span> : null}
    </div>
  );
}
