"use client";
// RealEstateBriefForm — استمارة «موقعكم العقاري» (colapia.com/realestate): سبع خطوات قصيرة أغلبها لمسات لا كتابة.
// - التقدم يُحفظ على جهاز العميل تلقائياً (localStorage) ويُستأنف من الخطوة نفسها.
// - المعرّف يتولد مرة عند البدء، فإعادة الإرسال بعد انقطاع لا تكرر الاستمارة (الخادم idempotent).
// - الإرسال يعيد المحاولة وحده، وإن تعذر تماماً يبقى كل شيء محفوظاً ويظهر بديل الإرسال على واتساب.
// القواعد والخيارات كلها من src/briefs/realestate.ts (نفسها على الخادم).
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Building2,
  Check,
  CheckCircle2,
  CircleAlert,
  Clock,
  HardHat,
  Hotel,
  KeyRound,
  Landmark,
  Loader2,
  MessageCircle,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  UserRound,
  Wand2,
  type LucideIcon,
} from "lucide-react";
import { ColapiaLogo } from "@/components/brand/ColapiaLogo";
import {
  AREAS,
  AUDIENCES,
  BRAND_STATES,
  BUSINESS_TYPES,
  CHANNELS,
  DEAL_TYPES,
  DOMAIN_STATES,
  GOALS,
  LANGUAGES,
  MAX_GOALS,
  MEDIA_STATES,
  PALETTES,
  PROPERTY_TYPES,
  SERVICES,
  STEPS,
  STYLES,
  TEAM_SIZES,
  TIMELINES,
  featuresFor,
  firstIncompleteStep,
  isBusinessType,
  parseBrief,
  recommendFeatures,
  scaleQuestion,
  stepErrors,
  suggestedLanguage,
  type BriefDraft,
  type FieldErrors,
  type Option,
} from "@/briefs/realestate";
import { briefSummaryLines } from "@/briefs/render";

const DRAFT_KEY = "clp-brief:realestate:v1";
/** وعد التسليم كما قرره المالك (يظهر في شاشة النجاح). */
const DELIVERY_PROMISE = "خلال 48 ساعة";

const TYPE_ICONS: Record<string, LucideIcon> = {
  broker: UserRound,
  agency: Building2,
  developer: Landmark,
  rentals: KeyRound,
  shortstay: Hotel,
  construction: HardHat,
  other: Sparkles,
};

type Draft = { id: string; startedAt: number; step: number; data: BriefDraft; featuresTouched: boolean; langTouched: boolean; savedAt: number };
type Phase = "intro" | "form" | "done";

const uuid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) => (Number(c) ^ (Math.random() * 16) >> (Number(c) / 4)).toString(16));

const freshDraft = (): Draft => ({ id: uuid(), startedAt: Date.now(), step: 0, data: {}, featuresTouched: false, langTouched: false, savedAt: Date.now() });

function readDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as Draft;
    return d && typeof d.id === "string" && d.data && typeof d.data === "object" ? d : null;
  } catch {
    return null;
  }
}
const writeDraft = (d: Draft) => {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...d, savedAt: Date.now() }));
  } catch {
    /* وضع التصفح الخاص: نكمل بلا حفظ */
  }
};
const clearDraft = () => {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* لا شيء */
  }
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function RealEstateBriefForm({ agencyWhatsapp, instagramUrl }: { agencyWhatsapp: string | null; instagramUrl: string }) {
  const [phase, setPhase] = useState<Phase>("intro");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [resumable, setResumable] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [doneRef, setDoneRef] = useState<string | null>(null);
  const [doneName, setDoneName] = useState("");
  const [hp, setHp] = useState("");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const d = readDraft();
    if (d && Object.keys(d.data).length > 0) setResumable(d);
  }, []);

  // حفظ تلقائي (مؤجل قليلاً حتى لا يكتب مع كل حرف).
  useEffect(() => {
    if (!draft || phase !== "form") return;
    const t = setTimeout(() => writeDraft(draft), 250);
    return () => clearTimeout(t);
  }, [draft, phase]);

  const data = draft?.data ?? {};
  const step = draft?.step ?? 0;
  const stepId = STEPS[step]!.id;

  const set = useCallback(<K extends keyof BriefDraft>(key: K, value: BriefDraft[K]) => {
    setDraft((d) => {
      if (!d) return d;
      const next: Draft = { ...d, data: { ...d.data, [key]: value } };
      if (key === "features") next.featuresTouched = true;
      if (key === "languages") next.langTouched = true;
      // جمهور خارج مصر ← نقترح موقعاً بلغتين ما لم يختر العميل اللغة بنفسه.
      if (key === "audience" && !d.langTouched) next.data.languages = suggestedLanguage(value as string[]);
      return next;
    });
    setErrors((e) => (e[key as keyof FieldErrors] ? { ...e, [key]: undefined } : e));
  }, []);

  const goTo = useCallback((i: number, d?: Draft) => {
    setDraft((cur) => {
      const base = d ?? cur;
      if (!base) return base;
      const next = { ...base, step: i };
      // الوصول لخطوة المميزات: اختيار مبدئي ذكي ما لم يعدّله العميل.
      if (STEPS[i]?.id === "features" && !next.featuresTouched) next.data = { ...next.data, features: recommendFeatures(next.data) };
      return next;
    });
    setErrors({});
    requestAnimationFrame(() => {
      topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      headingRef.current?.focus({ preventScroll: true });
    });
  }, []);

  const start = (resume: boolean) => {
    const d = resume && resumable ? resumable : freshDraft();
    if (!resume) clearDraft();
    setDraft(d);
    setPhase("form");
    goTo(Math.min(d.step, STEPS.length - 1), d);
  };

  const showErrors = (e: FieldErrors) => {
    setErrors(e);
    requestAnimationFrame(() => {
      const first = document.querySelector<HTMLElement>("[data-field-error]");
      first?.scrollIntoView({ behavior: "smooth", block: "center" });
      const focusable = first?.querySelector<HTMLElement>("input, textarea, button");
      focusable?.focus({ preventScroll: true });
    });
  };

  const next = () => {
    const e = stepErrors(stepId, data);
    if (Object.keys(e).length) return showErrors(e);
    if (step < STEPS.length - 1) goTo(step + 1);
    else void submit();
  };

  const back = () => (step > 0 ? goTo(step - 1) : setPhase("intro"));

  async function submit() {
    if (!draft || submitting) return;
    const bad = firstIncompleteStep(draft.data);
    if (bad !== -1) {
      goTo(bad);
      requestAnimationFrame(() => showErrors(stepErrors(STEPS[bad]!.id, draft.data)));
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    writeDraft(draft);
    const body = JSON.stringify({
      id: draft.id,
      startedAt: draft.startedAt,
      data: draft.data,
      website: hp,
      referrer: document.referrer || undefined,
      source: new URLSearchParams(location.search).get("src") ?? new URLSearchParams(location.search).get("utm_source") ?? undefined,
    });
    let lastError = "تعذر الاتصال. تأكدوا من الإنترنت ثم أعيدوا المحاولة.";
    for (const wait of [0, 1500, 4000]) {
      if (wait) await sleep(wait);
      try {
        const res = await fetch("/api/briefs", { method: "POST", headers: { "Content-Type": "application/json" }, body, cache: "no-store" });
        const json = (await res.json().catch(() => ({}))) as { ok?: boolean; ref?: string; error?: string; step?: number; errors?: FieldErrors };
        if (res.ok && json.ok && json.ref) {
          clearDraft();
          setDoneRef(json.ref);
          setDoneName(String(draft.data.businessName ?? ""));
          setPhase("done");
          setSubmitting(false);
          window.scrollTo({ top: 0 });
          return;
        }
        if (res.status === 422 && typeof json.step === "number") {
          setSubmitting(false);
          goTo(json.step);
          requestAnimationFrame(() => showErrors(json.errors ?? {}));
          return;
        }
        lastError = json.error ?? lastError;
        if (res.status === 429 || res.status === 403 || res.status === 400) break;
      } catch {
        /* انقطاع: نعيد المحاولة */
      }
    }
    setSubmitting(false);
    setSubmitError(lastError);
  }

  const whatsappFallback = useMemo(() => {
    const p = parseBrief(data);
    const lines = p.ok ? [`استمارة موقع عقاري: ${p.data.businessName}`, ...briefSummaryLines(p.data)] : [`استمارة موقع عقاري: ${data.businessName ?? ""}`];
    const text = encodeURIComponent(lines.join("\n"));
    return agencyWhatsapp ? `https://wa.me/${agencyWhatsapp.replace(/^0/, "20")}?text=${text}` : instagramUrl;
  }, [data, agencyWhatsapp, instagramUrl]);

  return (
    <div className="relative min-h-dvh bg-[#07091a] text-[#eaf0ff]" dir="rtl">
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-0 bg-[radial-gradient(60%_40%_at_50%_0%,rgba(111,134,255,0.18),transparent_60%),radial-gradient(40%_30%_at_100%_40%,rgba(200,162,74,0.07),transparent_70%)]" />
      <div ref={topRef} className="relative mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-4 pb-32 pt-5 sm:px-6">
        <header className="flex items-center justify-between gap-3">
          <ColapiaLogo size={30} priority />
          {phase === "form" ? (
            <span className="text-xs font-bold text-[#8d97c4]" aria-live="polite">
              الخطوة {step + 1} من {STEPS.length}
            </span>
          ) : null}
        </header>

        {phase === "intro" ? <Intro resumable={resumable} onStart={start} /> : null}

        {phase === "form" && draft ? (
          <main className="mt-5 flex-1">
            <Progress step={step} />
            <section key={stepId} className="brief-step mt-6 space-y-7">
              <div>
                <p className="text-xs font-black tracking-wide text-[#8fa8ff]">{STEPS[step]!.title}</p>
                <h1 ref={headingRef} tabIndex={-1} className="mt-1 text-2xl font-black leading-tight text-white outline-none sm:text-3xl">
                  {STEPS[step]!.lead}
                </h1>
              </div>
              <StepBody stepId={stepId} data={data} set={set} errors={errors} />
              {/* حقل مخفي للبرامج الآلية: لا يراه الإنسان ولا قارئ الشاشة. */}
              <div aria-hidden="true" className="sr-only">
                <label>
                  الموقع
                  <input tabIndex={-1} autoComplete="off" value={hp} onChange={(e) => setHp(e.target.value)} name="website" />
                </label>
              </div>
            </section>

            {submitError ? (
              <div role="alert" className="mt-6 space-y-3 rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm">
                <p className="flex items-start gap-2 font-bold text-rose-100">
                  <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> {submitError}
                </p>
                <p className="text-xs leading-6 text-rose-100/80">إجاباتكم محفوظة على هذا الجهاز ولن تضيع.</p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => void submit()} className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-xs font-black text-[#07091a]">
                    <RotateCcw className="size-4" aria-hidden="true" /> إعادة الإرسال
                  </button>
                  <a href={whatsappFallback} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 px-4 py-2 text-xs font-bold text-white">
                    <MessageCircle className="size-4" aria-hidden="true" /> {agencyWhatsapp ? "أرسلوها لنا على واتساب" : "راسلونا على إنستجرام"}
                  </a>
                </div>
              </div>
            ) : null}
          </main>
        ) : null}

        {phase === "done" ? <Done reference={doneRef ?? ""} name={doneName} agencyWhatsapp={agencyWhatsapp} instagramUrl={instagramUrl} /> : null}
      </div>

      {phase === "form" ? (
        <nav aria-label="التنقل بين الخطوات" className="fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-[#07091a]/90 backdrop-blur-xl" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
          <div className="mx-auto flex w-full max-w-2xl items-center gap-3 px-4 py-3 sm:px-6">
            <button type="button" onClick={back} disabled={submitting} className="inline-flex h-12 items-center gap-1.5 rounded-2xl border border-white/15 px-4 text-sm font-bold text-[#c3cdf0] transition hover:bg-white/5 disabled:opacity-50">
              <ArrowRight className="size-4" aria-hidden="true" /> السابق
            </button>
            <button
              type="button"
              onClick={next}
              disabled={submitting}
              className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-l from-[#8fa8ff] to-[#6f86ff] text-sm font-black text-[#07091a] shadow-[0_10px_30px_-10px_rgba(111,134,255,0.8)] transition hover:brightness-110 disabled:opacity-70"
            >
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" /> جارٍ الإرسال…
                </>
              ) : step === STEPS.length - 1 ? (
                <>
                  إرسال الاستمارة <Check className="size-4" aria-hidden="true" />
                </>
              ) : (
                <>
                  التالي <ArrowLeft className="size-4" aria-hidden="true" />
                </>
              )}
            </button>
          </div>
        </nav>
      ) : null}

      <style>{`
        .brief-step { animation: brief-in .35s cubic-bezier(.2,.7,.2,1) both; }
        @keyframes brief-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
        @media (prefers-reduced-motion: reduce) { .brief-step { animation: none; } }
      `}</style>
    </div>
  );
}

// ─── الشاشات ──────────────────────────────────────────────────────────────

function Intro({ resumable, onStart }: { resumable: Draft | null; onStart: (resume: boolean) => void }) {
  const items: [LucideIcon, string][] = [
    [Clock, "7 خطوات قصيرة في نحو 3 دقائق، أغلبها لمسات لا كتابة."],
    [ShieldCheck, "لا نطلب الآن عقارات ولا صوراً ولا روابط: تضيفونها بسهولة عند أول فتح لموقعكم."],
    [Wand2, "تُحفظ إجاباتكم تلقائياً على جهازكم، وتكملون متى شئتم."],
  ];
  return (
    <main className="brief-step flex flex-1 flex-col justify-center py-10">
      <p className="inline-flex w-fit items-center gap-1.5 rounded-full border border-[#8fa8ff]/30 bg-[#6f86ff]/10 px-3 py-1 text-xs font-black text-[#bcc8ff]">
        <Building2 className="size-3.5" aria-hidden="true" /> استمارة موقعكم العقاري
      </p>
      <h1 className="mt-4 text-3xl font-black leading-[1.25] text-white sm:text-[2.6rem]">
        موقع عقاري احترافي
        <span className="block bg-gradient-to-l from-[#e8d29a] via-[#c8a24a] to-[#e8d29a] bg-clip-text text-transparent">مصمَّم لنشاطكم أنتم</span>
      </h1>
      <p className="mt-4 text-base leading-8 text-[#c3cdf0]">
        أجيبوا عن أسئلة قصيرة لنفهم نشاطكم وما تريدونه من موقعكم، ثم نبني لكم الموقع ولوحة تحكم ذكية وإعداداً أول سهلاً، ونسلّمها لكم جاهزة.
      </p>
      <ul className="mt-7 space-y-3">
        {items.map(([Icon, text]) => (
          <li key={text} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3.5 text-sm leading-7 text-[#dce3ff]">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#6f86ff]/15 text-[#8fa8ff]">
              <Icon className="size-4.5" aria-hidden="true" />
            </span>
            {text}
          </li>
        ))}
      </ul>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        {resumable ? (
          <>
            <button type="button" onClick={() => onStart(true)} className="inline-flex h-13 flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-l from-[#8fa8ff] to-[#6f86ff] px-6 py-3.5 text-base font-black text-[#07091a]">
              أكملوا من الخطوة {Math.min(resumable.step, STEPS.length - 1) + 1} <ArrowLeft className="size-4" aria-hidden="true" />
            </button>
            <button type="button" onClick={() => onStart(false)} className="inline-flex items-center justify-center gap-1.5 rounded-2xl border border-white/15 px-5 py-3.5 text-sm font-bold text-[#c3cdf0]">
              <RotateCcw className="size-4" aria-hidden="true" /> البدء من جديد
            </button>
          </>
        ) : (
          <button type="button" onClick={() => onStart(false)} className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-l from-[#8fa8ff] to-[#6f86ff] px-6 py-4 text-base font-black text-[#07091a] shadow-[0_14px_40px_-12px_rgba(111,134,255,0.9)]">
            ابدأوا الآن <ArrowLeft className="size-4" aria-hidden="true" />
          </button>
        )}
      </div>
    </main>
  );
}

function Done({ reference, name, agencyWhatsapp, instagramUrl }: { reference: string; name: string; agencyWhatsapp: string | null; instagramUrl: string }) {
  const steps = [
    "نراجع استمارتكم ونتواصل معكم على واتساب لتأكيد التفاصيل.",
    `نجهّز موقعكم ولوحة تحكمه ${DELIVERY_PROMISE} من التأكيد.`,
    "اجتماع قصير نسلّمكم فيه الموقع، ونربط فيه كل شيء ونطلقه معاً.",
  ];
  const msg = encodeURIComponent(`مرحباً، أرسلنا استمارة موقع «${name}» برقم ${reference}.`);
  return (
    <main className="brief-step flex flex-1 flex-col justify-center py-10 text-center">
      <span className="mx-auto grid size-20 place-items-center rounded-full bg-emerald-400/15 text-emerald-300 ring-8 ring-emerald-400/5">
        <CheckCircle2 className="size-10" aria-hidden="true" />
      </span>
      <h1 className="mt-6 text-3xl font-black text-white" tabIndex={-1}>
        وصلتنا استمارتكم، شكراً لكم
      </h1>
      <p className="mt-3 text-sm text-[#c3cdf0]">
        رقم الاستمارة: <b className="font-mono text-base tracking-wider text-white" dir="ltr">{reference}</b>
      </p>
      <ol className="mx-auto mt-8 w-full max-w-md space-y-3 text-start">
        {steps.map((s, i) => (
          <li key={s} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3.5 text-sm leading-7 text-[#dce3ff]">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#6f86ff] text-xs font-black text-[#07091a]">{i + 1}</span>
            {s}
          </li>
        ))}
      </ol>
      <p className="mx-auto mt-6 max-w-md text-xs leading-6 text-[#8d97c4]">
        عند أول فتح لموقعكم يقودكم «الإعداد الأول» خطوة بخطوة لإضافة الشعار والعقارات وروابط التواصل وطريقة استقبال طلبات عملائكم.
      </p>
      <a
        href={agencyWhatsapp ? `https://wa.me/${agencyWhatsapp.replace(/^0/, "20")}?text=${msg}` : instagramUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mx-auto mt-7 inline-flex items-center gap-2 rounded-2xl border border-white/15 px-5 py-3 text-sm font-bold text-white hover:bg-white/5"
      >
        <MessageCircle className="size-4" aria-hidden="true" /> {agencyWhatsapp ? "تواصلوا معنا على واتساب" : "تابعونا على إنستجرام"}
      </a>
    </main>
  );
}

function Progress({ step }: { step: number }) {
  const pct = Math.round(((step + 1) / STEPS.length) * 100);
  return (
    <div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="التقدم في الاستمارة">
        <div className="h-full rounded-full bg-gradient-to-l from-[#e8d29a] to-[#8fa8ff] transition-[width] duration-500" style={{ width: `${pct}%` }} />
      </div>
      <ol className="mt-3 hidden justify-between text-[11px] font-bold text-[#8d97c4] sm:flex">
        {STEPS.map((s, i) => (
          <li key={s.id} className={i <= step ? "text-[#c3cdf0]" : undefined} aria-current={i === step ? "step" : undefined}>
            {s.title}
          </li>
        ))}
      </ol>
    </div>
  );
}

// ─── محتوى كل خطوة ────────────────────────────────────────────────────────

type SetFn = <K extends keyof BriefDraft>(key: K, value: BriefDraft[K]) => void;

function StepBody({ stepId, data, set, errors }: { stepId: (typeof STEPS)[number]["id"]; data: BriefDraft; set: SetFn; errors: FieldErrors }) {
  switch (stepId) {
    case "business":
      return (
        <>
          <TextField id="businessName" label="اسم نشاطكم كما سيظهر في الموقع" placeholder="مثال: الريادة للتسويق العقاري" value={data.businessName ?? ""} onChange={(v) => set("businessName", v)} error={errors.businessName} maxLength={80} autoComplete="organization" />
          <Single
            id="businessType"
            label="ما الذي يصف نشاطكم؟"
            options={BUSINESS_TYPES}
            value={data.businessType}
            onChange={(v) => set("businessType", v)}
            error={errors.businessType}
            icons={TYPE_ICONS}
            columns={2}
          />
          {data.businessType === "other" ? (
            <TextField id="businessTypeOther" label="ما نشاطكم؟" placeholder="مثال: تقييم عقاري، تسويق أراضٍ زراعية…" value={data.businessTypeOther ?? ""} onChange={(v) => set("businessTypeOther", v)} error={errors.businessTypeOther} maxLength={80} />
          ) : null}
          <Single id="teamSize" label="كم شخصاً في فريقكم؟" options={TEAM_SIZES} value={data.teamSize} onChange={(v) => set("teamSize", v)} error={errors.teamSize} compact />
        </>
      );
    case "properties": {
      const scale = scaleQuestion(isBusinessType(data.businessType) ? data.businessType : undefined);
      return (
        <>
          <Multi id="propertyTypes" label="ما أنواع العقارات التي تتعاملون فيها؟" hint="اختاروا كل ما ينطبق" options={PROPERTY_TYPES} value={data.propertyTypes} onChange={(v) => set("propertyTypes", v)} error={errors.propertyTypes} />
          {data.businessType === "construction" ? (
            <Multi id="services" label="ما خدماتكم؟" options={SERVICES} value={data.services} onChange={(v) => set("services", v)} error={errors.services} />
          ) : (
            <Multi id="dealTypes" label="ما نوع المعاملات؟" options={DEAL_TYPES} value={data.dealTypes} onChange={(v) => set("dealTypes", v)} error={errors.dealTypes} />
          )}
          <Single id="scale" label={scale.title} options={scale.options} value={data.scale} onChange={(v) => set("scale", v)} error={errors.scale} compact />
        </>
      );
    }
    case "market":
      return (
        <>
          <Multi id="areas" label="أين تقع عقاراتكم أو أعمالكم؟" hint="اختاروا أو اكتبوا مناطق أخرى" options={AREAS} value={data.areas} onChange={(v) => set("areas", v)} error={errors.areas} />
          <TextField id="areasOther" label="مناطق أخرى (اختياري)" placeholder="مثال: المنصورة، دبي مارينا" value={data.areasOther ?? ""} onChange={(v) => set("areasOther", v)} maxLength={200} />
          <Multi id="audience" label="من عملاؤكم؟" options={AUDIENCES} value={data.audience} onChange={(v) => set("audience", v)} error={errors.audience} />
          <Single id="languages" label="لغة الموقع" options={LANGUAGES} value={data.languages} onChange={(v) => set("languages", v)} error={errors.languages} compact />
        </>
      );
    case "goals":
      return (
        <>
          <Multi id="goals" label="ما أهم ما تريدونه من الموقع؟" hint={`اختاروا حتى ${MAX_GOALS}`} options={GOALS} value={data.goals} onChange={(v) => set("goals", v)} error={errors.goals} max={MAX_GOALS} />
          <Multi id="channels" label="من أين يأتيكم العملاء اليوم؟ (اختياري)" options={CHANNELS} value={data.channels} onChange={(v) => set("channels", v)} />
          <TextArea
            id="problem"
            label="ما أكثر ما يرهقكم في العمل اليومي؟ (اختياري)"
            hint="نصمم لوحة التحكم لتحل هذا تحديداً"
            placeholder="مثال: أسئلة مكررة على واتساب، ضياع العملاء بين أفراد الفريق، صعوبة إرسال العقار المناسب لكل عميل…"
            value={data.problem ?? ""}
            onChange={(v) => set("problem", v)}
            maxLength={600}
          />
        </>
      );
    case "features":
      return <FeaturesStep data={data} set={set} />;
    case "look":
      return (
        <>
          <Single id="brand" label="هل لديكم هوية بصرية؟" hint="الشعار نفسه ترفعونه في الإعداد الأول" options={BRAND_STATES} value={data.brand} onChange={(v) => set("brand", v)} error={errors.brand} compact />
          <PalettePicker data={data} set={set} error={errors.palette ?? errors.primaryColor} />
          <Single id="style" label="ما الإحساس الذي تريدونه؟" options={STYLES} value={data.style} onChange={(v) => set("style", v)} error={errors.style} compact />
          <TextField id="inspiration" label="مواقع تعجبكم أو صفحتكم الحالية (اختياري)" placeholder="روابط مواقع أو صفحة إنستجرام" value={data.inspiration ?? ""} onChange={(v) => set("inspiration", v)} maxLength={400} dir="ltr" />
        </>
      );
    case "contact":
      return (
        <>
          <TextField id="contactName" label="اسمكم" value={data.contactName ?? ""} onChange={(v) => set("contactName", v)} error={errors.contactName} maxLength={60} autoComplete="name" />
          <TextField
            id="whatsapp"
            label="رقم واتساب للتواصل وتحديد موعد التسليم"
            hint="للتواصل معكم فقط، لا يظهر في الموقع"
            placeholder="01012345678"
            value={data.whatsapp ?? ""}
            onChange={(v) => set("whatsapp", v)}
            error={errors.whatsapp}
            maxLength={30}
            inputMode="tel"
            autoComplete="tel"
            dir="ltr"
          />
          <TextField id="email" label="البريد الإلكتروني (اختياري)" placeholder="name@example.com" value={data.email ?? ""} onChange={(v) => set("email", v)} error={errors.email} maxLength={120} inputMode="email" autoComplete="email" dir="ltr" />
          <Single id="domain" label="هل لديكم نطاق (دومين) للموقع؟" options={DOMAIN_STATES} value={data.domain} onChange={(v) => set("domain", v)} error={errors.domain} compact />
          {data.domain === "have" ? (
            <TextField id="domainName" label="النطاق" placeholder="example.com" value={data.domainName ?? ""} onChange={(v) => set("domainName", v)} error={errors.domainName} maxLength={120} dir="ltr" inputMode="url" />
          ) : null}
          <Single id="media" label="صور العقارات وفيديوهاتها لديكم" options={MEDIA_STATES} value={data.media} onChange={(v) => set("media", v)} error={errors.media} compact />
          <Single id="timeline" label="متى تريدون إطلاق الموقع؟" options={TIMELINES} value={data.timeline} onChange={(v) => set("timeline", v)} error={errors.timeline} compact />
          <TextArea id="notes" label="أي شيء آخر تريدون إضافته؟ (اختياري)" placeholder="فكرة، ميزة خاصة، موقع منافس…" value={data.notes ?? ""} onChange={(v) => set("notes", v)} maxLength={2000} />
        </>
      );
  }
}

function FeaturesStep({ data, set }: { data: BriefDraft; set: SetFn }) {
  const shown = featuresFor(isBusinessType(data.businessType) ? data.businessType : undefined);
  const picked = new Set(data.features ?? []);
  const recommended = new Set<string>(recommendFeatures(data));
  const toggle = (id: string) => {
    const next = new Set(picked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    set("features", shown.map((f) => f.id).filter((x) => next.has(x)));
  };
  const groups = [
    ["site", "في الموقع"],
    ["dashboard", "في لوحة التحكم"],
  ] as const;
  return (
    <div className="space-y-7">
      <p className="rounded-2xl border border-[#c8a24a]/25 bg-[#c8a24a]/[0.07] p-3.5 text-sm leading-7 text-[#f1e3bd]">
        علّمنا لكم مسبقاً ما يناسب نشاطكم وأهدافكم. أضيفوا أو احذفوا بلمسة، وأي ميزة لا تختارونها الآن يمكن إضافتها لاحقاً.
      </p>
      {groups.map(([g, title]) => (
        <fieldset key={g}>
          <legend className="mb-3 text-base font-black text-white">{title}</legend>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {shown
              .filter((f) => f.group === g)
              .map((f) => {
                const on = picked.has(f.id);
                return (
                  <label
                    key={f.id}
                    className={`relative flex cursor-pointer items-start gap-3 rounded-2xl border p-3.5 transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#8fa8ff] ${
                      on ? "border-[#8fa8ff]/60 bg-[#6f86ff]/[0.14]" : "border-white/10 bg-white/[0.025] hover:border-white/25"
                    }`}
                  >
                    <input type="checkbox" className="sr-only" checked={on} onChange={() => toggle(f.id)} />
                    <span className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border ${on ? "border-[#8fa8ff] bg-[#8fa8ff] text-[#07091a]" : "border-white/25"}`} aria-hidden="true">
                      {on ? <Check className="size-3.5" strokeWidth={3} /> : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold leading-6 text-white">{f.label}</span>
                      {f.hint ? <span className="mt-0.5 block text-xs leading-5 text-[#8d97c4]">{f.hint}</span> : null}
                      <span className="mt-1.5 flex flex-wrap gap-1.5">
                        {f.ai ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-[#6f86ff]/20 px-1.5 py-0.5 text-[10px] font-black text-[#bcc8ff]">
                            <Bot className="size-3" aria-hidden="true" /> ذكاء اصطناعي
                          </span>
                        ) : null}
                        {recommended.has(f.id) ? <span className="rounded-md bg-[#c8a24a]/20 px-1.5 py-0.5 text-[10px] font-black text-[#f1e3bd]">موصى به</span> : null}
                      </span>
                    </span>
                  </label>
                );
              })}
          </div>
        </fieldset>
      ))}
    </div>
  );
}

function PalettePicker({ data, set, error }: { data: BriefDraft; set: SetFn; error?: string }) {
  return (
    <fieldset data-field-error={error ? "" : undefined}>
      <legend className="mb-1 text-base font-black text-white">ألوان الموقع</legend>
      <p className="mb-3 text-xs text-[#8d97c4]">اختاروا الأقرب لكم، أو ألوان هويتكم، أو اتركوا الاختيار لنا</p>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {PALETTES.map((p) => {
          const on = data.palette === p.id;
          return (
            <label
              key={p.id}
              className={`flex cursor-pointer flex-col gap-2 rounded-2xl border p-3 transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#8fa8ff] ${on ? "border-[#8fa8ff]/70 bg-[#6f86ff]/[0.14]" : "border-white/10 bg-white/[0.025] hover:border-white/25"}`}
            >
              <input type="radio" name="palette" className="sr-only" checked={on} onChange={() => set("palette", p.id)} />
              <span className="flex h-9 overflow-hidden rounded-xl ring-1 ring-white/10" aria-hidden="true">
                {"colors" in p ? (
                  p.colors.map((c) => <span key={c} className="flex-1" style={{ background: c }} />)
                ) : p.id === "custom" ? (
                  <>
                    <span className="flex-1" style={{ background: data.primaryColor || "#1c2f57" }} />
                    <span className="flex-1" style={{ background: data.accentColor || "#c8a24a" }} />
                  </>
                ) : (
                  <span className="flex flex-1 items-center justify-center bg-gradient-to-l from-[#6f86ff]/40 via-[#c8a24a]/40 to-[#0f3d33]/60">
                    <Sparkles className="size-4 text-white" />
                  </span>
                )}
              </span>
              <span className="flex items-center justify-between gap-1">
                <span className="text-sm font-bold text-white">{p.label}</span>
                {on ? <Check className="size-4 text-[#8fa8ff]" aria-hidden="true" /> : null}
              </span>
              {p.hint ? <span className="-mt-1.5 text-[11px] text-[#8d97c4]">{p.hint}</span> : null}
            </label>
          );
        })}
      </div>
      {data.palette === "custom" ? (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <ColorInput label="اللون الأساسي" value={data.primaryColor || "#1c2f57"} onChange={(v) => set("primaryColor", v)} />
          <ColorInput label="لون التمييز" value={data.accentColor || "#c8a24a"} onChange={(v) => set("accentColor", v)} />
        </div>
      ) : null}
      <FieldError text={error} />
    </fieldset>
  );
}

function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <label className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-2.5">
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="size-10 shrink-0 cursor-pointer rounded-lg border-0 bg-transparent p-0" aria-label={label} />
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-bold text-[#8d97c4]">{label}</span>
        <input
          dir="ltr"
          value={text}
          maxLength={7}
          onChange={(e) => {
            const v = e.target.value.trim();
            setText(v);
            if (/^#[0-9a-f]{6}$/i.test(v)) onChange(v.toLowerCase());
          }}
          className="w-full bg-transparent font-mono text-sm text-white outline-none"
          aria-label={`${label} (رمز اللون)`}
        />
      </span>
    </label>
  );
}

// ─── عناصر الإدخال ────────────────────────────────────────────────────────

function FieldError({ text }: { text?: string }) {
  if (!text) return null;
  return (
    <p className="mt-2 flex items-center gap-1.5 text-xs font-bold text-rose-300" role="alert">
      <CircleAlert className="size-3.5 shrink-0" aria-hidden="true" /> {text}
    </p>
  );
}

function Group({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <fieldset id={`f-${id}`} data-field-error={error ? "" : undefined} aria-describedby={error ? `e-${id}` : undefined}>
      <legend className="text-base font-black text-white">{label}</legend>
      {hint ? <p className="mt-1 text-xs text-[#8d97c4]">{hint}</p> : null}
      <div className="mt-3">{children}</div>
      <span id={`e-${id}`}>
        <FieldError text={error} />
      </span>
    </fieldset>
  );
}

const optionClass = (on: boolean, disabled = false) =>
  `relative flex cursor-pointer items-center gap-3 rounded-2xl border transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#8fa8ff] ${
    on ? "border-[#8fa8ff]/70 bg-[#6f86ff]/[0.16] text-white" : "border-white/10 bg-white/[0.025] text-[#dce3ff] hover:border-white/25"
  } ${disabled ? "cursor-not-allowed opacity-45" : ""}`;

function Single<T extends string>({
  id,
  label,
  hint,
  options,
  value,
  onChange,
  error,
  icons,
  columns = 1,
  compact,
}: {
  id: string;
  label: string;
  hint?: string;
  options: readonly Option<T>[];
  value?: string;
  onChange: (v: T) => void;
  error?: string;
  icons?: Record<string, LucideIcon>;
  columns?: 1 | 2;
  compact?: boolean;
}) {
  return (
    <Group id={id} label={label} hint={hint} error={error}>
      <div className={compact ? "flex flex-wrap gap-2" : `grid gap-2.5 ${columns === 2 ? "sm:grid-cols-2" : ""}`}>
        {options.map((o) => {
          const on = value === o.id;
          const Icon = icons?.[o.id];
          return (
            <label key={o.id} className={`${optionClass(on)} ${compact ? "px-4 py-2.5" : "p-3.5"}`}>
              <input type="radio" name={id} value={o.id} className="sr-only" checked={on} onChange={() => onChange(o.id)} />
              {Icon ? (
                <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${on ? "bg-[#8fa8ff] text-[#07091a]" : "bg-white/[0.06] text-[#8fa8ff]"}`} aria-hidden="true">
                  <Icon className="size-5" />
                </span>
              ) : null}
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold leading-6">{o.label}</span>
                {o.hint && !compact ? <span className="block text-xs leading-5 text-[#8d97c4]">{o.hint}</span> : null}
              </span>
              {on && !compact ? <Check className="size-4 shrink-0 text-[#8fa8ff]" aria-hidden="true" /> : null}
            </label>
          );
        })}
      </div>
    </Group>
  );
}

function Multi<T extends string>({
  id,
  label,
  hint,
  options,
  value,
  onChange,
  error,
  max,
}: {
  id: string;
  label: string;
  hint?: string;
  options: readonly Option<T>[];
  value?: string[];
  onChange: (v: string[]) => void;
  error?: string;
  max?: number;
}) {
  const picked = value ?? [];
  const full = max !== undefined && picked.length >= max;
  return (
    <Group id={id} label={label} hint={hint} error={error}>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = picked.includes(o.id);
          const disabled = !on && full;
          return (
            <label key={o.id} className={`${optionClass(on, disabled)} px-3.5 py-2.5`} title={o.hint}>
              <input
                type="checkbox"
                className="sr-only"
                checked={on}
                disabled={disabled}
                onChange={() => onChange(on ? picked.filter((p) => p !== o.id) : options.map((x) => x.id).filter((x) => x === o.id || picked.includes(x)))}
              />
              {on ? <Check className="size-3.5 shrink-0 text-[#8fa8ff]" strokeWidth={3} aria-hidden="true" /> : null}
              <span className="text-sm font-bold leading-5">
                {o.label}
                {o.hint ? <span className="block text-[11px] font-medium text-[#8d97c4]">{o.hint}</span> : null}
              </span>
            </label>
          );
        })}
      </div>
      {max !== undefined ? (
        <p className="mt-2 text-[11px] font-bold text-[#8d97c4]" aria-live="polite">
          اخترتم {picked.length} من {max}
        </p>
      ) : null}
    </Group>
  );
}

const inputClass = (error?: string) =>
  `mt-2 w-full rounded-2xl border bg-white/[0.04] px-4 py-3.5 text-base text-white placeholder:text-[#8d97c4]/70 outline-none transition focus:border-[#8fa8ff] focus:bg-white/[0.06] focus:ring-2 focus:ring-[#8fa8ff]/30 ${
    error ? "border-rose-400/70" : "border-white/12"
  }`;

function TextField({
  id,
  label,
  hint,
  error,
  value,
  onChange,
  placeholder,
  maxLength,
  inputMode,
  autoComplete,
  dir,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
  inputMode?: "text" | "tel" | "email" | "url";
  autoComplete?: string;
  dir?: "ltr" | "rtl";
}) {
  return (
    <div data-field-error={error ? "" : undefined}>
      <label htmlFor={`i-${id}`} className="text-base font-black text-white">
        {label}
      </label>
      {hint ? <p className="mt-1 text-xs text-[#8d97c4]">{hint}</p> : null}
      <input
        id={`i-${id}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        inputMode={inputMode}
        autoComplete={autoComplete}
        dir={dir}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `e-${id}` : undefined}
        className={`${inputClass(error)} ${dir === "ltr" ? "text-left" : ""}`}
      />
      <span id={`e-${id}`}>
        <FieldError text={error} />
      </span>
    </div>
  );
}

function TextArea({ id, label, hint, value, onChange, placeholder, maxLength }: { id: string; label: string; hint?: string; value: string; onChange: (v: string) => void; placeholder?: string; maxLength: number }) {
  return (
    <div>
      <label htmlFor={`i-${id}`} className="text-base font-black text-white">
        {label}
      </label>
      {hint ? <p className="mt-1 text-xs text-[#8d97c4]">{hint}</p> : null}
      <textarea id={`i-${id}`} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} maxLength={maxLength} rows={3} className={`${inputClass()} resize-y leading-7`} />
      <p className="mt-1 text-left text-[11px] text-[#8d97c4]" dir="ltr">
        {value.length}/{maxLength}
      </p>
    </div>
  );
}
