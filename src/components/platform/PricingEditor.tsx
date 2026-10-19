"use client";

// PricingEditor.tsx — صفحة أسعار المالك (/admin/pricing) بنموذج v4: رسوم التجهيز، والدائرة الذهبية بمفتاح ومقاعد حية،
// والباقات الثلاث (الاسم والسعر الشهري وكل حد قابل للتعديل)، والمدد المسموح بها، والباقة المميَّزة، مع معاينة حية لما
// سيراه التاجر في صفحة الدفع والهبوط ويقوله الوكيل. حفظ واحد للنموذج كله؛ الخادم يفرض صلاحية المالك ويتحقق من كل رقم.
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Crown, Loader2, Save, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  MONTH_CHOICES,
  monthsLabel,
  previewLines,
  type HostingPlan,
  type PlanId,
  type PricingModel,
} from "@/lib/platform-pricing";
import type { LifecycleTimings } from "@/lifecycle/timings-rules";
import { saveLifecycleAction, savePricingAction } from "@/server/actions/agency-pricing";

const input =
  "h-11 w-full rounded-xl border border-white/10 bg-[#07091a] px-3 text-[14px] text-white outline-none focus-visible:border-[#8fa8ff] focus-visible:ring-2 focus-visible:ring-[#8fa8ff]/40";
const label = "block text-[12px] font-bold text-[#a9b3dc]";
const card = "rounded-3xl border border-white/10 bg-[#0b0f2a] p-4 sm:p-5";
const digits = (v: string) => v.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/\D/g, "");
const MB = 1024 * 1024;
const GB = 1024 * MB;

type PlanRow = {
  id: PlanId;
  name: string;
  monthly: string;
  products: string;
  storageGb: string;
  videos: string;
  videoMaxMb: string;
  aiPerMonth: string;
  visualSearchPerMonth: string;
  teamMembers: string;
  customDomain: boolean;
};

const toRow = (p: HostingPlan): PlanRow => ({
  id: p.id,
  name: p.name,
  monthly: String(p.monthly),
  products: String(p.limits.products),
  storageGb: String(Math.round((p.limits.storageBytes / GB) * 10) / 10),
  videos: String(p.limits.videos),
  videoMaxMb: String(Math.round(p.limits.videoMaxBytes / MB)),
  aiPerMonth: String(p.limits.aiPerMonth),
  visualSearchPerMonth: String(p.limits.visualSearchPerMonth),
  teamMembers: String(p.limits.teamMembers),
  customDomain: p.limits.customDomain,
});

const n = (v: string) => (v.trim() === "" ? NaN : Number(v));
const fromRow = (r: PlanRow): HostingPlan => ({
  id: r.id,
  name: r.name.trim(),
  monthly: n(r.monthly),
  limits: {
    products: n(r.products),
    storageBytes: Math.round(n(r.storageGb) * GB),
    videos: n(r.videos),
    videoMaxBytes: Math.round(n(r.videoMaxMb) * MB),
    aiPerMonth: n(r.aiPerMonth),
    visualSearchPerMonth: n(r.visualSearchPerMonth),
    teamMembers: n(r.teamMembers),
    customDomain: r.customDomain,
  },
});

function NumField({ id, text, value, onChange, suffix, decimal }: { id: string; text: string; value: string; onChange: (v: string) => void; suffix?: string; decimal?: boolean }) {
  return (
    <div>
      <label htmlFor={id} className={label}>
        {text}
      </label>
      <div className="relative mt-1.5">
        <input
          id={id}
          className={`${input} tabular-nums ${suffix ? "pe-14" : ""}`}
          inputMode={decimal ? "decimal" : "numeric"}
          dir="ltr"
          value={value}
          onChange={(e) => onChange(decimal ? e.target.value.replace(/[^\d.]/g, "") : digits(e.target.value))}
        />
        {suffix ? <span className="pointer-events-none absolute inset-y-0 end-3 grid place-items-center text-[11.5px] font-bold text-[#8d97c4]">{suffix}</span> : null}
      </div>
    </div>
  );
}

type GoldenUsage = { confirmed: number; underReview: number };

export function PricingConsole({ initial, usage }: { initial: PricingModel; usage: GoldenUsage }) {
  const router = useRouter();
  const [build, setBuild] = useState(String(initial.build.price));
  const [g, setG] = useState({ enabled: initial.golden.enabled, code: initial.golden.code, buildPrice: String(initial.golden.buildPrice), seats: String(initial.golden.seats), firstMonthFree: initial.golden.firstMonthFree });
  const [rows, setRows] = useState<PlanRow[]>(initial.plans.map(toRow));
  const [months, setMonths] = useState<number[]>(initial.months);
  const [featured, setFeatured] = useState<PlanId>(initial.featured);
  const [pending, start] = useTransition();
  const used = usage.confirmed + usage.underReview;

  const model = useMemo<PricingModel>(
    () => ({
      v: 4,
      build: { price: n(build) },
      golden: { enabled: g.enabled, code: g.code.trim().toUpperCase(), buildPrice: n(g.buildPrice), seats: n(g.seats), firstMonthFree: g.firstMonthFree },
      plans: rows.map(fromRow),
      months: [...months].sort((a, b) => a - b),
      featured,
    }),
    [build, g, rows, months, featured]
  );
  // المعاينة لا تنتظر الحفظ: تُبنى من القيم المكتوبة، وما لم يكتمل يظهر بالقيمة المحفوظة.
  const safe = useMemo<PricingModel>(() => {
    const ok = (v: number, d: number) => (Number.isFinite(v) ? v : d);
    return {
      ...model,
      build: { price: ok(model.build.price, initial.build.price) },
      golden: { ...model.golden, buildPrice: ok(model.golden.buildPrice, initial.golden.buildPrice), seats: ok(model.golden.seats, initial.golden.seats), code: model.golden.code || initial.golden.code },
      months: model.months.length ? model.months : initial.months,
      plans: model.plans.map((p, i) => {
        const d = initial.plans[i]!;
        return {
          ...p,
          name: p.name || d.name,
          monthly: ok(p.monthly, d.monthly),
          limits: Object.fromEntries(Object.entries(p.limits).map(([k, v]) => [k, typeof v === "number" ? ok(v, d.limits[k as keyof typeof d.limits] as number) : v])) as HostingPlan["limits"],
        };
      }),
    };
  }, [model, initial]);
  const preview = previewLines(safe, used);
  const seatsLeft = Math.max(0, (Number.isFinite(model.golden.seats) ? model.golden.seats : 0) - used);

  const setRow = (i: number, patch: Partial<PlanRow>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const save = () =>
    start(async () => {
      const r = await savePricingAction(model);
      if (!r.ok) return void toast.error(r.error);
      toast.success("حُفظت الأسعار، وتسري على الدفعات الجديدة الآن");
      router.refresh();
    });

  return (
    <div className="space-y-5">
      <section className={card} aria-labelledby="build-h">
        <h2 id="build-h" className="text-sm font-black">
          رسوم تجهيز المتجر
        </h2>
        <p className="mb-3 mt-1 text-[12.5px] leading-6 text-[#a9b3dc]">تُدفع مرة واحدة مع أول دفعة، ولا تتكرر في التجديد.</p>
        <div className="max-w-xs">
          <NumField id="build-price" text="الرسوم بالجنيه" value={build} onChange={setBuild} suffix="ج.م" />
        </div>
      </section>

      <section className="rounded-3xl border border-amber-300/25 bg-amber-300/[0.05] p-4 sm:p-5" aria-labelledby="golden-h">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="golden-h" className="flex items-center gap-2 text-sm font-black text-amber-200">
            <Crown className="size-4" aria-hidden="true" /> الدائرة الذهبية
          </h2>
          <label className="flex min-h-11 cursor-pointer items-center gap-2 text-[13px] font-black text-white">
            <input type="checkbox" role="switch" aria-checked={g.enabled} checked={g.enabled} onChange={(e) => setG({ ...g, enabled: e.target.checked })} className="size-5 accent-amber-300" />
            {g.enabled ? "العرض مفعّل" : "العرض متوقف"}
          </label>
        </div>
        <p className="mb-4 mt-1 text-[12.5px] leading-6 text-[#a9b3dc]">
          كود يُكتب في صفحة الدفع للدفعة الأولى فيخفّض رسوم التجهيز ويهدي الشهر الأول من الباقة الأساسية (قابل للإيقاف). يُرفض تلقائياً باكتمال المقاعد أو إيقاف العرض، والمقعد يُحسب بالإيصال المؤكد وقيد المراجعة.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor="golden-code" className={label}>
              الكود
            </label>
            <input id="golden-code" className={`${input} mt-1.5 font-mono uppercase`} dir="ltr" value={g.code} onChange={(e) => setG({ ...g, code: e.target.value.replace(/[^A-Za-z0-9_-]/g, "").toUpperCase() })} />
          </div>
          <NumField id="golden-build" text="رسوم التجهيز بالكود" value={g.buildPrice} onChange={(v) => setG({ ...g, buildPrice: v })} suffix="ج.م" />
          <NumField id="golden-seats" text="عدد المقاعد" value={g.seats} onChange={(v) => setG({ ...g, seats: v })} />
          <label className="flex min-h-11 cursor-pointer items-center gap-2 text-[12.5px] font-bold text-white sm:col-span-3">
            <input type="checkbox" checked={g.firstMonthFree} onChange={(e) => setG({ ...g, firstMonthFree: e.target.checked })} className="size-5 accent-amber-300" />
            الشهر الأول من الباقة الأساسية هدية مع الكود
          </label>
        </div>
        <div className="mt-4 rounded-2xl bg-black/20 p-3" aria-live="polite">
          <div className="flex flex-wrap items-baseline justify-between gap-2 text-[12.5px] font-bold text-[#e6ebff]">
            <span>
              المستخدم: {usage.confirmed} مؤكد + {usage.underReview} قيد المراجعة
            </span>
            <span className={seatsLeft > 0 ? "text-amber-200" : "text-rose-300"}>متبقٍ {seatsLeft}</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-label="مقاعد الدائرة الذهبية المستخدمة" aria-valuemin={0} aria-valuemax={Math.max(1, Number(g.seats) || 0)} aria-valuenow={used}>
            <div className="h-full rounded-full bg-amber-300" style={{ width: `${Math.min(100, ((used || 0) / Math.max(1, Number(g.seats) || 0)) * 100)}%` }} />
          </div>
        </div>
      </section>

      <section className={card} aria-labelledby="plans-h">
        <h2 id="plans-h" className="text-sm font-black">
          الباقات الشهرية وحدودها
        </h2>
        <p className="mb-4 mt-1 text-[12.5px] leading-6 text-[#a9b3dc]">
          كل حد هنا يُطبَّق فعلاً على الخادم (المنتجات، المساحة، الفيديو، العمليات التلقائية، البحث بالصورة، الفريق، النطاق الخاص). التجربة المجانية تستخدم حدود الباقة الوسطى.
        </p>
        <div className="grid gap-4 lg:grid-cols-3">
          {rows.map((r, i) => (
            <fieldset key={r.id} className={`min-w-0 rounded-2xl border p-3.5 ${featured === r.id ? "border-[#8fa8ff]/50 bg-[#8fa8ff]/[0.06]" : "border-white/10"}`}>
              <legend className="sr-only">باقة {r.name}</legend>
              <div className="grid gap-3">
                <div>
                  <label htmlFor={`name-${r.id}`} className={label}>
                    اسم الباقة
                  </label>
                  <input id={`name-${r.id}`} className={`${input} mt-1.5 font-black`} maxLength={24} value={r.name} onChange={(e) => setRow(i, { name: e.target.value })} />
                </div>
                <NumField id={`monthly-${r.id}`} text="السعر الشهري" value={r.monthly} onChange={(v) => setRow(i, { monthly: v })} suffix="ج.م" />
                <div className="grid grid-cols-2 gap-3">
                  <NumField id={`products-${r.id}`} text="المنتجات" value={r.products} onChange={(v) => setRow(i, { products: v })} />
                  <NumField id={`storage-${r.id}`} text="المساحة" value={r.storageGb} onChange={(v) => setRow(i, { storageGb: v })} suffix="GB" decimal />
                  <NumField id={`videos-${r.id}`} text="عدد الفيديوهات" value={r.videos} onChange={(v) => setRow(i, { videos: v })} />
                  <NumField id={`vmax-${r.id}`} text="حجم الفيديو الأقصى" value={r.videoMaxMb} onChange={(v) => setRow(i, { videoMaxMb: v })} suffix="MB" />
                  <NumField id={`ai-${r.id}`} text="عمليات تلقائية/شهر" value={r.aiPerMonth} onChange={(v) => setRow(i, { aiPerMonth: v })} />
                  <NumField id={`vs-${r.id}`} text="بحث بالصورة/شهر" value={r.visualSearchPerMonth} onChange={(v) => setRow(i, { visualSearchPerMonth: v })} />
                  <NumField id={`team-${r.id}`} text="أعضاء الفريق" value={r.teamMembers} onChange={(v) => setRow(i, { teamMembers: v })} />
                </div>
                <label className="flex min-h-11 cursor-pointer items-center gap-2 text-[12.5px] font-bold text-[#e6ebff]">
                  <input type="checkbox" checked={r.customDomain} onChange={(e) => setRow(i, { customDomain: e.target.checked })} className="size-4 accent-[#8fa8ff]" />
                  يتيح ربط نطاق خاص
                </label>
                <label className="flex min-h-11 cursor-pointer items-center gap-2 text-[12.5px] font-bold text-[#e6ebff]">
                  <input type="radio" name="featured" checked={featured === r.id} onChange={() => setFeatured(r.id)} className="size-4 accent-[#8fa8ff]" />
                  الأكثر اختياراً (تُبرز وتُحدَّد افتراضياً)
                </label>
              </div>
            </fieldset>
          ))}
        </div>
      </section>

      <section className={card} aria-labelledby="months-h">
        <h2 id="months-h" className="text-sm font-black">
          مدد الدفع المسموح بها
        </h2>
        <p className="mb-3 mt-1 text-[12.5px] leading-6 text-[#a9b3dc]">يختار التاجر منها عند الدفع والتجديد. المبلغ = السعر الشهري × عدد الأشهر.</p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="المدد المسموح بها">
          {MONTH_CHOICES.map((m) => {
            const on = months.includes(m);
            return (
              <button
                key={m}
                type="button"
                aria-pressed={on}
                onClick={() => setMonths((xs) => (on ? xs.filter((x) => x !== m) : [...xs, m]))}
                className={`min-h-11 rounded-xl border px-4 text-[13px] font-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8fa8ff]/50 ${on ? "border-[#8fa8ff]/60 bg-[#8fa8ff]/15 text-white" : "border-white/10 text-[#a9b3dc] hover:text-white"}`}
              >
                {monthsLabel(m)}
              </button>
            );
          })}
        </div>
      </section>

      <section className={card} aria-labelledby="preview-h">
        <h2 id="preview-h" className="mb-3 flex items-center gap-2 text-sm font-black">
          <Sparkles className="size-4 text-[#8fa8ff]" aria-hidden="true" /> معاينة حية (قبل الحفظ)
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="min-w-0">
            <p className="mb-1.5 text-[12px] font-bold text-[#a9b3dc]">صفحة الدفع عند التاجر</p>
            <ul className="space-y-1.5 text-[13px] leading-6 text-[#eaf0ff]">
              {preview.billing.map((l) => (
                <li key={l} className="break-words">
                  {l}
                </li>
              ))}
            </ul>
          </div>
          <div className="min-w-0">
            <p className="mb-1.5 text-[12px] font-bold text-[#a9b3dc]">الهبوط والشروط</p>
            <ul className="space-y-1.5 text-[13px] leading-6 text-[#eaf0ff]">
              {preview.landing.map((l) => (
                <li key={l} className="break-words">
                  {l}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <p className="mb-1.5 mt-4 text-[12px] font-bold text-[#a9b3dc]">ما يعرفه وكيل الرسائل</p>
        <pre className="whitespace-pre-wrap break-words rounded-xl bg-white/[0.04] p-3 font-sans text-[12.5px] leading-6 text-[#d6ddff]">{preview.agent}</pre>
      </section>

      <div className="sticky bottom-3 z-10 flex justify-end">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-[#8fa8ff] px-6 text-[14px] font-black text-[#07091a] shadow-xl shadow-black/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:opacity-60"
        >
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Save className="size-4" aria-hidden="true" />}
          حفظ الأسعار
        </button>
      </div>
    </div>
  );
}

export function TimingsEditor({ initial }: { initial: LifecycleTimings }) {
  const router = useRouter();
  const [t, setT] = useState({
    trialHours: String(initial.trialHours),
    noticeHours: String(initial.noticeHours),
    deleteHours: String(initial.deleteHours),
    graceDays: String(initial.graceDays),
  });
  const [pending, start] = useTransition();
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-4">
        <NumField id="t-trial" text="مدة التجربة (ساعات)" value={t.trialHours} onChange={(v) => setT({ ...t, trialHours: v })} />
        <NumField id="t-notice" text="التنبيه الأخير بعد الإيقاف (ساعات)" value={t.noticeHours} onChange={(v) => setT({ ...t, noticeHours: v })} />
        <NumField id="t-delete" text="الحذف بعد التنبيه (ساعات)" value={t.deleteHours} onChange={(v) => setT({ ...t, deleteHours: v })} />
        <NumField id="t-grace" text="السماح بعد انتهاء الاشتراك (أيام)" value={t.graceDays} onChange={(v) => setT({ ...t, graceDays: v })} />
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await saveLifecycleAction({
              trialHours: Number(t.trialHours),
              noticeHours: Number(t.noticeHours),
              deleteHours: Number(t.deleteHours),
              graceDays: Number(t.graceDays),
            });
            if (!r.ok) return void toast.error(r.error);
            toast.success("حُفظت المدد");
            router.refresh();
          })
        }
        className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 px-5 text-[13.5px] font-black text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8fa8ff]/50 disabled:opacity-60"
      >
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Save className="size-4" aria-hidden="true" />}
        حفظ المدد
      </button>
    </div>
  );
}
