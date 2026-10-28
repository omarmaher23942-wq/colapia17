"use client";

// PricingEditor.tsx — صفحة أسعار المالك (/admin/pricing) بنموذج V4: سعر المشروع العادي، وعرض الإطلاق (السعر والمقاعد
// والمشغول سلفاً بمفتاح تشغيل)، وشروط التعديل بعد التسليم (الرسوم ونافذة المجاني)، ونص المشاريع الأخرى الذي يقوله الوكيل.
// معاينة حية بالأرقام المكتوبة الآن. حفظ واحد للنموذج كله؛ الخادم يفرض صلاحية المالك ويتحقق من كل رقم.
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Crown, Loader2, Save, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { MAX_OTHER_SERVICES, previewLines, validatePricing, type PricingModel } from "@/lib/platform-pricing";
import { savePricingAction } from "@/server/actions/agency-pricing";

const input =
  "h-11 w-full rounded-xl border border-white/10 bg-[#07091a] px-3 text-[14px] text-white outline-none focus-visible:border-[#8fa8ff] focus-visible:ring-2 focus-visible:ring-[#8fa8ff]/40";
const label = "block text-[12px] font-bold text-[#a9b3dc]";
const card = "rounded-3xl border border-white/10 bg-[#0b0f2a] p-4 sm:p-5";
const digits = (v: string) => v.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/\D/g, "");

type Form = { regularPrice: string; enabled: boolean; goldenPrice: string; seats: string; base: string; fee: string; freeDays: string; otherServices: string };
const toForm = (p: PricingModel): Form => ({
  regularPrice: String(p.regularPrice),
  enabled: p.golden.enabled,
  goldenPrice: String(p.golden.price),
  seats: String(p.golden.seats),
  base: String(p.golden.base),
  fee: String(p.edit.fee),
  freeDays: String(p.edit.freeDays),
  otherServices: p.otherServices,
});
const toInput = (f: Form) => ({
  regularPrice: Number(f.regularPrice),
  golden: { enabled: f.enabled, price: Number(f.goldenPrice), seats: Number(f.seats), base: Number(f.base) },
  edit: { fee: Number(f.fee), freeDays: Number(f.freeDays) },
  otherServices: f.otherServices,
});

function Num({ id, text, value, onChange, hint }: { id: string; text: string; value: string; onChange: (v: string) => void; hint?: string }) {
  return (
    <div>
      <label htmlFor={id} className={label}>
        {text}
      </label>
      <input id={id} inputMode="numeric" dir="ltr" value={value} onChange={(e) => onChange(digits(e.target.value))} className={`${input} mt-1.5 text-start`} />
      {hint ? <p className="mt-1 text-[11.5px] text-[#8d97c4]">{hint}</p> : null}
    </div>
  );
}

export function PricingConsole({ initial, usage }: { initial: PricingModel; usage: { confirmed: number; underReview: number } }) {
  const router = useRouter();
  const [form, setForm] = useState<Form>(() => toForm(initial));
  const [pending, start] = useTransition();
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  const checked = useMemo(() => validatePricing(toInput(form)), [form]);
  const preview = useMemo(() => (checked.ok ? previewLines(checked.model, usage.confirmed) : null), [checked, usage.confirmed]);

  const save = () =>
    start(async () => {
      const r = await savePricingAction(toInput(form));
      if (!r.ok) return void toast.error(r.error);
      toast.success("حُفظت الأسعار وتسري على الحجوزات الجديدة فوراً");
      router.refresh();
    });

  return (
    <div className="space-y-5">
      <section className={card}>
        <h2 className="mb-3 text-sm font-black">مشروع المتجر</h2>
        <div className="max-w-xs">
          <Num id="regular" text="السعر العادي (جنيه)" value={form.regularPrice} onChange={(v) => set("regularPrice", v)} hint="يُدفع كاملاً قبل التسليم، وهو سعر الحجز حين تكتمل مقاعد عرض الإطلاق." />
        </div>
      </section>

      <section className={card}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-sm font-black">
            <Crown className="size-4 text-amber-300" aria-hidden="true" /> عرض الإطلاق
          </h2>
          <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-[13px] font-bold">
            <input type="checkbox" checked={form.enabled} onChange={(e) => set("enabled", e.target.checked)} className="size-4 accent-[#6f86ff]" />
            مفعّلة
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Num id="gprice" text="سعر الدائرة (جنيه)" value={form.goldenPrice} onChange={(v) => set("goldenPrice", v)} />
          <Num id="gseats" text="إجمالي المقاعد" value={form.seats} onChange={(v) => set("seats", v)} />
          <Num id="gbase" text="مقاعد مشغولة سلفاً" value={form.base} onChange={(v) => set("base", v)} hint="العميل الأول (Qima) يشغل مقعداً خارج النظام." />
        </div>
        <p className="mt-3 text-[12.5px] leading-6 text-[#a9b3dc]">
          المتبقي يتناقص بتأكيدك لكل دفعة ذهبية فقط. مؤكَّدة الآن: <b className="text-white">{usage.confirmed}</b> · قيد المراجعة: <b className="text-white">{usage.underReview}</b> (لا تنقص العدّاد قبل تأكيدك).
        </p>
      </section>

      <section className={card}>
        <h2 className="mb-3 text-sm font-black">التعديل بعد التسليم</h2>
        <div className="grid max-w-xl gap-3 sm:grid-cols-2">
          <Num id="fee" text="رسوم التعديل (جنيه)" value={form.fee} onChange={(v) => set("fee", v)} />
          <Num id="free" text="نافذة التعديل المجاني (أيام)" value={form.freeDays} onChange={(v) => set("freeDays", v)} hint="تعديل مجاني واحد داخل النافذة من لحظة التسليم." />
        </div>
      </section>

      <section className={card}>
        <h2 className="mb-1 text-sm font-black">المشاريع الأخرى (غير المتاجر)</h2>
        <p className="mb-2 text-[12.5px] leading-6 text-[#a9b3dc]">يقوله الوكيل كما هو. لا يطلب دفعاً أبداً، ويصلكم إشعار لتردوا بأنفسكم.</p>
        <textarea
          value={form.otherServices}
          onChange={(e) => set("otherServices", e.target.value)}
          rows={3}
          maxLength={MAX_OTHER_SERVICES}
          aria-label="نص المشاريع الأخرى"
          className="w-full rounded-xl border border-white/10 bg-[#07091a] p-3 text-[14px] leading-7 text-white outline-none focus-visible:border-[#8fa8ff] focus-visible:ring-2 focus-visible:ring-[#8fa8ff]/40"
        />
      </section>

      <section className={card}>
        <h2 className="mb-2 flex items-center gap-2 text-sm font-black">
          <Sparkles className="size-4 text-[#8fa8ff]" aria-hidden="true" /> معاينة حية
        </h2>
        {preview ? (
          <div className="space-y-3 text-[13px] leading-7 text-[#c3cdf0]">
            <ul className="list-disc space-y-1 ps-5">
              {[...preview.booking, ...preview.edits].map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
            <div>
              <p className="mb-1 text-[12px] font-bold text-[#a9b3dc]">ما يعرفه الوكيل:</p>
              <pre dir="rtl" className="whitespace-pre-wrap rounded-2xl border border-white/10 bg-[#050716] p-3 text-[12px] leading-6">
                {preview.agent}
              </pre>
            </div>
          </div>
        ) : (
          <p className="text-[13px] font-bold text-amber-200">{checked.ok ? "" : checked.error}</p>
        )}
      </section>

      <div className="flex justify-end">
        <button type="button" onClick={save} disabled={pending || !checked.ok} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#6f86ff] px-5 text-[14px] font-black text-[#07091a] disabled:opacity-50">
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Save className="size-4" aria-hidden="true" />}
          حفظ الأسعار
        </button>
      </div>
    </div>
  );
}
