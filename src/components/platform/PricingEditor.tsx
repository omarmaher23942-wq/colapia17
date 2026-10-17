"use client";

// PricingEditor.tsx — صفحة أسعار المالك (/admin/pricing): بطاقات واضحة لكل منها حفظ مستقل، ومعاينة حية لما سيقوله
// الهبوط وصفحة الدفع والوكيل. الخادم يفرض صلاحية المالك ويتحقق من كل رقم (server/actions/agency-pricing.ts).
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import {
  monthsLabel,
  previewLines,
  type GoldenOffer,
  type PlanMonths,
  type PricingModel,
} from "@/lib/platform-pricing";
import type { LifecycleTimings } from "@/lifecycle/timings-rules";
import { saveGoldenAction, saveLifecycleAction, savePlansAction } from "@/server/actions/agency-pricing";

const input = "h-11 w-full rounded-xl border border-white/10 bg-[#07091a] px-3 text-[14px] text-white outline-none focus:border-[#8fa8ff]";
const label = "block text-[12px] font-bold text-[#8d97c4]";
const card = "rounded-3xl border border-white/10 bg-[#0b0f2a] p-5";
const digits = (v: string) => v.replace(/\D/g, "");

function SaveButton({ pending, onClick, children, primary }: { pending: boolean; onClick: () => void; children: string; primary?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-5 text-[13.5px] font-black disabled:opacity-60 ${primary ? "bg-[#8fa8ff] text-[#07091a]" : "border border-white/15 text-white"}`}
    >
      {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Save className="size-4" aria-hidden="true" />}
      {children}
    </button>
  );
}

type GoldenUsage = { confirmed: number; underReview: number };

export function PricingConsole({ initial, usage }: { initial: PricingModel; usage: GoldenUsage }) {
  const router = useRouter();
  const [rows, setRows] = useState(initial.plans.map((p) => ({ months: p.months, price: String(p.price), renewal: String(p.renewal) })));
  const [featured, setFeatured] = useState<PlanMonths>(initial.featured);
  const [g, setG] = useState({
    enabled: initial.golden.enabled,
    code: initial.golden.code,
    price: String(initial.golden.price),
    months: String(initial.golden.months),
    seats: String(initial.golden.seats),
  });
  const [pendingPlans, startPlans] = useTransition();
  const [pendingGolden, startGolden] = useTransition();

  // معاينة حية من القيم المكتوبة الآن (قبل الحفظ).
  const live = useMemo<PricingModel>(() => {
    const golden: GoldenOffer = {
      enabled: g.enabled,
      code: g.code.trim().toUpperCase() || initial.golden.code,
      price: Number(g.price) || initial.golden.price,
      months: Number(g.months) || initial.golden.months,
      seats: Number(g.seats) || 0,
    };
    return {
      v: 3,
      featured,
      golden,
      plans: rows.map((r, i) => ({ months: r.months as PlanMonths, price: Number(r.price) || initial.plans[i]!.price, renewal: Number(r.renewal) || initial.plans[i]!.renewal })),
    };
  }, [rows, featured, g, initial]);
  const used = usage.confirmed + usage.underReview;
  const preview = previewLines(live, used);

  const savePlans = () =>
    startPlans(async () => {
      const r = await savePlansAction({ plans: rows.map((x) => ({ months: x.months, price: Number(x.price), renewal: Number(x.renewal) })), featured });
      if (!r.ok) return void toast.error(r.error);
      toast.success("حُفظت الباقات");
      router.refresh();
    });

  const saveGolden = () =>
    startGolden(async () => {
      const r = await saveGoldenAction({ enabled: g.enabled, code: g.code, price: Number(g.price), months: Number(g.months), seats: Number(g.seats) });
      if (!r.ok) return void toast.error(r.error);
      toast.success("حُفظ عرض الدائرة الذهبية");
      router.refresh();
    });

  return (
    <div className="space-y-6">
      <section className={card} aria-labelledby="plans-h">
        <h2 id="plans-h" className="mb-1 text-sm font-black">الباقات</h2>
        <p className="mb-4 text-[12.5px] leading-6 text-[#8d97c4]">
          «السعر أول مرة» يشمل بناء المتجر والاستضافة طوال المدة. «سعر التجديد» هو ما يدفعه التاجر عند اختيار المدة نفسها بعد انتهاء اشتراكه.
        </p>
        <fieldset className="space-y-3">
          <legend className="sr-only">الباقة المميَّزة</legend>
          {rows.map((r, i) => (
            <div key={r.months} className="grid items-end gap-3 rounded-2xl border border-white/10 p-3 sm:grid-cols-[120px_1fr_1fr_auto]">
              <p className="pb-2 text-[14px] font-black sm:pb-3">{monthsLabel(r.months)}</p>
              <label className={label}>
                السعر أول مرة (بناء + المدة) بالجنيه
                <input className={`${input} mt-1.5`} inputMode="numeric" value={r.price} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, price: digits(e.target.value) } : x)))} />
              </label>
              <label className={label}>
                سعر التجديد بالجنيه
                <input className={`${input} mt-1.5`} inputMode="numeric" value={r.renewal} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, renewal: digits(e.target.value) } : x)))} />
              </label>
              <label className="flex min-h-11 items-center gap-2 text-[12.5px] font-bold text-[#c3cdf0]">
                <input type="radio" name="featured" checked={featured === r.months} onChange={() => setFeatured(r.months as PlanMonths)} className="size-4 accent-[#8fa8ff]" />
                الأكثر اختياراً
              </label>
            </div>
          ))}
        </fieldset>
        <div className="mt-4">
          <SaveButton pending={pendingPlans} onClick={savePlans} primary>
            احفظ الباقات
          </SaveButton>
        </div>
      </section>

      <section className="rounded-3xl border border-amber-300/20 bg-amber-300/[0.04] p-5" aria-labelledby="golden-h">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
          <h2 id="golden-h" className="text-sm font-black text-amber-200">الدائرة الذهبية</h2>
          <label className="flex min-h-10 cursor-pointer items-center gap-2 text-[13px] font-black text-white">
            <input type="checkbox" role="switch" checked={g.enabled} onChange={(e) => setG({ ...g, enabled: e.target.checked })} className="size-5 accent-amber-300" />
            {g.enabled ? "العرض مفعّل" : "العرض متوقف"}
          </label>
        </div>
        <p className="mb-4 text-[12.5px] leading-6 text-[#8d97c4]">
          كود يُكتب في صفحة الدفع للباقة الأولى: سعر رمزي لاستضافة مدة قصيرة، والبناء مجاني، مقابل بوست Collab أو رأي يُنشر. يتوقف الكود تلقائياً باكتمال المقاعد، ويقول الوكيل المقاعد الحقيقية الباقية.
        </p>
        <div className="grid gap-3 sm:grid-cols-4">
          <label className={label}>
            الكود
            <input className={`${input} mt-1.5 font-mono uppercase`} dir="ltr" value={g.code} onChange={(e) => setG({ ...g, code: e.target.value.replace(/[^A-Za-z0-9_-]/g, "") })} />
          </label>
          <label className={label}>
            السعر بالجنيه
            <input className={`${input} mt-1.5`} inputMode="numeric" value={g.price} onChange={(e) => setG({ ...g, price: digits(e.target.value) })} />
          </label>
          <label className={label}>
            المدة بالأشهر
            <input className={`${input} mt-1.5`} inputMode="numeric" value={g.months} onChange={(e) => setG({ ...g, months: digits(e.target.value) })} />
          </label>
          <label className={label}>
            عدد المقاعد
            <input className={`${input} mt-1.5`} inputMode="numeric" value={g.seats} onChange={(e) => setG({ ...g, seats: digits(e.target.value) })} />
          </label>
        </div>
        <p className="mt-3 text-[12.5px] font-bold text-[#c3cdf0]">
          المستخدم: {usage.confirmed} مؤكد + {usage.underReview} قيد المراجعة من {Number(g.seats) || 0}
        </p>
        <div className="mt-4">
          <SaveButton pending={pendingGolden} onClick={saveGolden} primary>
            احفظ عرض الدائرة الذهبية
          </SaveButton>
        </div>
      </section>

      <section className={card} aria-labelledby="preview-h">
        <h2 id="preview-h" className="mb-3 text-sm font-black">معاينة حية (قبل الحفظ)</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-1.5 text-[12px] font-bold text-[#8d97c4]">الهبوط وصفحة الاشتراك</p>
            <ul className="space-y-1.5 text-[13px] leading-6 text-[#eaf0ff]">
              {preview.landing.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-1.5 text-[12px] font-bold text-[#8d97c4]">التجديد</p>
            <ul className="space-y-1.5 text-[13px] leading-6 text-[#eaf0ff]">
              {preview.billing.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </div>
        </div>
        <p className="mt-4 rounded-xl bg-white/[0.04] p-3 text-[12.5px] leading-6 text-[#c3cdf0]">{preview.agent}</p>
      </section>
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
  const field = (k: keyof typeof t, text: string) => (
    <label className={label}>
      {text}
      <input className={`${input} mt-1.5`} inputMode="numeric" value={t[k]} onChange={(e) => setT({ ...t, [k]: digits(e.target.value) })} />
    </label>
  );
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-4">
        {field("trialHours", "مدة التجربة (ساعات)")}
        {field("noticeHours", "التنبيه الأخير بعد الإيقاف (ساعات)")}
        {field("deleteHours", "الحذف بعد التنبيه (ساعات)")}
        {field("graceDays", "السماح بعد انتهاء الاشتراك (أيام)")}
      </div>
      <SaveButton
        pending={pending}
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
      >
        احفظ المدد
      </SaveButton>
    </div>
  );
}
