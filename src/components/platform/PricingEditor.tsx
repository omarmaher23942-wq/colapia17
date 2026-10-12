"use client";

// PricingEditor.tsx — تحرير سلّم الأسعار ومدد ما بعد التسليم (المالك فقط؛ الخادم يفرضها في agency-pricing.ts).
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { PriceLadder } from "@/lib/platform-pricing";
import type { LifecycleTimings } from "@/lifecycle/timings-rules";
import { saveLifecycleAction, savePricingAction } from "@/server/actions/agency-pricing";

const input = "h-11 w-full rounded-xl border border-white/10 bg-[#07091a] px-3 text-[14px] text-white outline-none focus:border-[#8fa8ff]";
const label = "block text-[12px] font-bold text-[#8d97c4]";

export function PricingEditor({ initial, goldenUsed }: { initial: PriceLadder; goldenUsed: number }) {
  const router = useRouter();
  const [tiers, setTiers] = useState(initial.tiers.map((t) => ({ upTo: t.upTo === null ? "" : String(t.upTo), price: String(t.price) })));
  const [base, setBase] = useState(String(initial.basePrice));
  const [renewal, setRenewal] = useState(String(initial.renewal));
  const [golden, setGolden] = useState({ code: initial.golden.code, price: String(initial.golden.price), seats: String(initial.golden.seats) });
  const [pending, start] = useTransition();
  const from = (i: number) => (i === 0 ? 1 : Number(tiers[i - 1]!.upTo || 0) + 1);

  const save = () =>
    start(async () => {
      const r = await savePricingAction({
        tiers: tiers.map((t, i) => ({ upTo: i === tiers.length - 1 || !t.upTo ? null : Number(t.upTo), price: Number(t.price) })),
        basePrice: Number(base),
        renewal: Number(renewal),
        golden: { code: golden.code.trim().toUpperCase(), price: Number(golden.price), seats: Number(golden.seats) },
      });
      if (!r.ok) return void toast.error(r.error);
      toast.success("حُفظ السلّم");
      router.refresh();
    });

  return (
    <div className="space-y-4">
      <ol className="space-y-2">
        {tiers.map((t, i) => (
          <li key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] items-end gap-2">
            <span className="pb-3 text-[13px] font-bold text-[#c3cdf0]">من المتجر {from(i)}</span>
            <label className={label}>
              حتى المتجر
              {i === tiers.length - 1 ? <span className="mt-1.5 block h-11 pt-3 text-[13px] text-white">بلا حد</span> : <input className={`${input} mt-1.5`} inputMode="numeric" value={t.upTo} onChange={(e) => setTiers(tiers.map((x, j) => (j === i ? { ...x, upTo: e.target.value.replace(/\D/g, "") } : x)))} />}
            </label>
            <label className={label}>
              السعر (ج)
              <input className={`${input} mt-1.5`} inputMode="numeric" value={t.price} onChange={(e) => setTiers(tiers.map((x, j) => (j === i ? { ...x, price: e.target.value.replace(/\D/g, "") } : x)))} />
            </label>
            <button type="button" aria-label="احذف المرحلة" disabled={tiers.length === 1} onClick={() => setTiers(tiers.filter((_, j) => j !== i))} className="grid size-11 place-items-center rounded-xl text-rose-300 hover:bg-rose-500/10 disabled:opacity-30">
              <Trash2 className="size-4" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ol>
      <button
        type="button"
        onClick={() => {
          const last = tiers[tiers.length - 1]!;
          const prevMax = tiers.length > 1 ? Number(tiers[tiers.length - 2]!.upTo || 0) : 0;
          setTiers([...tiers.slice(0, -1), { ...last, upTo: String(prevMax + 10) }, { upTo: "", price: last.price }]);
        }}
        className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-white/15 px-3 text-[12.5px] font-black text-white"
      >
        <Plus className="size-4" aria-hidden="true" /> مرحلة جديدة
      </button>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={label}>
          السعر «قبل الخصم» المعلن (ج)
          <input className={`${input} mt-1.5`} inputMode="numeric" value={base} onChange={(e) => setBase(e.target.value.replace(/\D/g, ""))} />
        </label>
        <label className={label}>
          التجديد السنوي (ج)
          <input className={`${input} mt-1.5`} inputMode="numeric" value={renewal} onChange={(e) => setRenewal(e.target.value.replace(/\D/g, ""))} />
        </label>
      </div>
      <fieldset className="rounded-2xl border border-amber-300/20 bg-amber-300/[0.04] p-4">
        <legend className="px-1 text-[12.5px] font-black text-amber-200">الدائرة الذهبية</legend>
        <p className="mb-3 text-[12px] leading-5 text-[#8d97c4]">
          كود يُكتب في صفحة الدفع للباقة الأولى: سعر مرة واحدة واستضافة مدى الحياة، ويتوقف بعد عدد المقاعد. المستخدم الآن: {goldenUsed} من {golden.seats || 0}.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className={label}>
            الكود
            <input className={`${input} mt-1.5 font-mono uppercase`} dir="ltr" value={golden.code} onChange={(e) => setGolden({ ...golden, code: e.target.value.replace(/[^A-Za-z0-9_-]/g, "") })} />
          </label>
          <label className={label}>
            السعر مرة واحدة (ج)
            <input className={`${input} mt-1.5`} inputMode="numeric" value={golden.price} onChange={(e) => setGolden({ ...golden, price: e.target.value.replace(/\D/g, "") })} />
          </label>
          <label className={label}>
            عدد المقاعد
            <input className={`${input} mt-1.5`} inputMode="numeric" value={golden.seats} onChange={(e) => setGolden({ ...golden, seats: e.target.value.replace(/\D/g, "") })} />
          </label>
        </div>
      </fieldset>
      <button type="button" onClick={save} disabled={pending} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#8fa8ff] px-5 text-[13.5px] font-black text-[#07091a] disabled:opacity-60">
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Save className="size-4" aria-hidden="true" />}
        احفظ السلّم
      </button>
    </div>
  );
}

export function TimingsEditor({ initial }: { initial: LifecycleTimings }) {
  const router = useRouter();
  const [t, setT] = useState({ trialHours: String(initial.trialHours), noticeHours: String(initial.noticeHours), deleteHours: String(initial.deleteHours) });
  const [pending, start] = useTransition();
  const field = (k: keyof typeof t, text: string) => (
    <label className={label}>
      {text}
      <input className={`${input} mt-1.5`} inputMode="numeric" value={t[k]} onChange={(e) => setT({ ...t, [k]: e.target.value.replace(/\D/g, "") })} />
    </label>
  );
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        {field("trialHours", "مدة التجربة (ساعات)")}
        {field("noticeHours", "التنبيه الأخير بعد الإيقاف (ساعات)")}
        {field("deleteHours", "الحذف بعد التنبيه (ساعات)")}
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await saveLifecycleAction({ trialHours: Number(t.trialHours), noticeHours: Number(t.noticeHours), deleteHours: Number(t.deleteHours) });
            if (!r.ok) return void toast.error(r.error);
            toast.success("حُفظت المدد (تسري على المتاجر التي تُسلَّم بعد الآن)");
            router.refresh();
          })
        }
        className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 px-5 text-[13.5px] font-black text-white disabled:opacity-60"
      >
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Save className="size-4" aria-hidden="true" />}
        احفظ المدد
      </button>
    </div>
  );
}
