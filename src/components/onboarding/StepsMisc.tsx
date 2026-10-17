"use client";

// StepsMisc — التواصل وكود الخصم. واتساب إلزامي (قناة الطلبات)، والبقية اختيارية. كود الخصم يُنشئه التاجر وحده بعد شرح أثره.
import { useState } from "react";
import { MessageCircle, Ticket } from "lucide-react";
import { saveContactStepAction } from "@/server/actions/setup";
import { saveDiscountAction } from "@/server/actions/discounts";
import { cleanFacebook, cleanInstagram, cleanTiktok } from "@/lib/store-settings";
import { normalizeEgyptianPhone } from "@/lib/phone";
import { cn } from "@/lib/utils";
import { btnGhost, Field, inputCls, Notice } from "./ui";
import { StepActions } from "./StepsCommerce";
import type { SetupData } from "@/lib/onboarding";

export function StepContact({ data, onSaved, onBack }: { data: SetupData["contact"]; onSaved: () => void; onBack: () => void }) {
  const [v, setV] = useState(data);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (p: Partial<typeof v>) => setV({ ...v, ...p });

  async function submit() {
    setErr(null);
    const e: Record<string, string> = {};
    if (!v.whatsapp.trim()) e.whatsapp = "أضيفوا رقم واتساب المتجر";
    else if (!normalizeEgyptianPhone(v.whatsapp)) e.whatsapp = "رقم موبايل مصري من 11 رقماً يبدأ بـ 01";
    if (cleanInstagram(v.instagram) === null) e.instagram = "اسم الحساب فقط (حروف إنجليزية وأرقام و . و _) أو رابط الحساب";
    if (cleanFacebook(v.facebook) === null) e.facebook = "رابط صفحتكم على فيسبوك (facebook.com/...)";
    if (cleanTiktok(v.tiktok) === null) e.tiktok = "اسم الحساب فقط أو رابطه";
    setErrs(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    const r = await saveContactStepAction(v);
    setBusy(false);
    if (!r.ok) {
      if ("errors" in r && r.errors) setErrs({ whatsapp: r.errors.whatsapp ?? "", instagram: r.errors.instagram ?? "", facebook: r.errors.facebook ?? "", tiktok: r.errors.tiktok ?? "" });
      return setErr(r.error);
    }
    onSaved();
  }

  return (
    <form
      noValidate
      className="space-y-5"
      onSubmit={(ev) => {
        ev.preventDefault();
        void submit();
      }}
    >
      <Field label="رقم واتساب المتجر" error={errs.whatsapp} hint="يصلكم عليه تأكيد الطلبات، ويتواصل منه الزبائن. يظهر زر واتساب في المتجر.">
        {(p) => <input {...p} dir="ltr" inputMode="tel" autoComplete="tel" value={v.whatsapp} onChange={(e) => set({ whatsapp: e.target.value })} placeholder="01012345678" className={cn(inputCls, "text-start")} />}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="حساب إنستجرام" optional error={errs.instagram}>
          {(p) => <input {...p} dir="ltr" value={v.instagram} onChange={(e) => set({ instagram: e.target.value })} placeholder="brand_name" className={cn(inputCls, "text-start")} />}
        </Field>
        <Field label="حساب تيك توك" optional error={errs.tiktok}>
          {(p) => <input {...p} dir="ltr" value={v.tiktok} onChange={(e) => set({ tiktok: e.target.value })} placeholder="brand_name" className={cn(inputCls, "text-start")} />}
        </Field>
        <div className="sm:col-span-2">
          <Field label="صفحة فيسبوك" optional error={errs.facebook}>
            {(p) => <input {...p} dir="ltr" value={v.facebook} onChange={(e) => set({ facebook: e.target.value })} placeholder="facebook.com/brand" className={cn(inputCls, "text-start")} />}
          </Field>
        </div>
      </div>
      <p className="flex items-start gap-2 text-[12px] leading-5 text-ink-3">
        <MessageCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        تظهر هذه القنوات في أسفل المتجر وفي صفحة التواصل، ويمكن تعديلها في أي وقت من الإعدادات.
      </p>
      {err ? <Notice tone="bad">{err}</Notice> : null}
      <StepActions onBack={onBack} busy={busy} />
    </form>
  );
}

// ─── كود الخصم (اختياري) ─────────────────────────────────────────────────────
type DType = "percentage" | "fixed" | "free_shipping";

export function StepDiscount({ existing, onSaved, onSkip, onBack }: { existing: number; onSaved: () => void; onSkip: () => void; onBack: () => void }) {
  const [make, setMake] = useState(false);
  const [code, setCode] = useState("");
  const [type, setType] = useState<DType>("percentage");
  const [value, setValue] = useState("10");
  const [min, setMin] = useState("");
  const [uses, setUses] = useState("");
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setErr(null);
    setErrs({});
    setBusy(true);
    const r = await saveDiscountAction({
      code,
      type,
      value: type === "free_shipping" ? 0 : Number(value),
      minSubtotal: min.trim() ? Number(min) : null,
      maxUses: uses.trim() ? Number(uses) : null,
      perCustomerLimit: 1,
      startsAt: null,
      endsAt: null,
      isActive: true,
    });
    setBusy(false);
    if (!r.ok) {
      if (r.field) setErrs({ [r.field]: r.error });
      return setErr(r.error);
    }
    onSaved();
  }

  return (
    <div className="space-y-4">
      <div className="dash-card flex gap-3 p-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-nova/12 text-nova-2">
          <Ticket className="size-5" aria-hidden="true" />
        </span>
        <div className="text-[13px] leading-7 text-ink-2">
          <p className="font-black text-ink">ما هو كود الخصم؟</p>
          <p>كلمة قصيرة (مثل WELCOME10) يكتبها الزبون عند إتمام الطلب فيحصل على نسبة أو مبلغ أو شحن مجاني. تستخدمونه في إعلاناتكم أو تعطونه لأول زبائنكم. لا ننشئ أي كود نيابة عنكم، وكل ما تنشئونه هنا تتحكمون فيه كاملاً من صفحة «أكواد الخصم».</p>
        </div>
      </div>
      {existing > 0 ? <Notice tone="ok">لديكم {existing} {existing === 1 ? "كود" : "أكواد"} خصم بالفعل. يمكنكم إضافة آخر أو المتابعة.</Notice> : null}

      {!make ? (
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btnGhost} onClick={() => setMake(true)}>
            إنشاء كود خصم
          </button>
          <button type="button" className={btnGhost} onClick={onBack}>
            رجوع
          </button>
          <button type="button" onClick={onSkip} className="inline-flex min-h-11 items-center rounded-xl bg-nova px-5 text-[13.5px] font-black text-white hover:brightness-110 dark:text-space">
            {existing > 0 ? "متابعة" : "تخطي هذه الخطوة"}
          </button>
        </div>
      ) : (
        <form
          noValidate
          className="dash-card space-y-4 p-4"
          onSubmit={(ev) => {
            ev.preventDefault();
            void submit();
          }}
        >
          <Field label="الكود" error={errs.code} hint="3 إلى 20 حرفاً إنجليزياً أو أرقاماً، مثل WELCOME10.">
            {(p) => <input {...p} dir="ltr" value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 20))} placeholder="WELCOME10" className={cn(inputCls, "text-start tracking-wider")} />}
          </Field>
          <fieldset>
            <legend className="mb-1.5 text-[12.5px] font-bold text-ink">نوع الخصم</legend>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["percentage", "نسبة مئوية"],
                  ["fixed", "مبلغ ثابت"],
                  ["free_shipping", "شحن مجاني"],
                ] as const
              ).map(([v, l]) => (
                <label key={v} className={cn("flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border px-3 text-[12.5px] font-bold transition", type === v ? "border-nova bg-nova/10 text-ink" : "border-edge/12 text-ink-2 hover:border-edge/30")}>
                  <input type="radio" name="dtype" checked={type === v} onChange={() => setType(v)} className="accent-[var(--dash-nova)]" />
                  {l}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="grid gap-3 sm:grid-cols-3">
            {type !== "free_shipping" ? (
              <Field label={type === "percentage" ? "النسبة (%)" : "المبلغ (ج)"} error={errs.value}>
                {(p) => <input {...p} inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value)} className={cn(inputCls, "tabular-nums")} />}
              </Field>
            ) : null}
            <Field label="أقل قيمة للطلب (ج)" optional error={errs.minSubtotal}>
              {(p) => <input {...p} inputMode="numeric" value={min} onChange={(e) => setMin(e.target.value)} className={cn(inputCls, "tabular-nums")} />}
            </Field>
            <Field label="أقصى عدد استخدامات" optional error={errs.maxUses}>
              {(p) => <input {...p} inputMode="numeric" value={uses} onChange={(e) => setUses(e.target.value)} className={cn(inputCls, "tabular-nums")} />}
            </Field>
          </div>
          {err && !Object.keys(errs).length ? <Notice tone="bad">{err}</Notice> : null}
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={busy} className="inline-flex min-h-11 items-center rounded-xl bg-nova px-5 text-[13.5px] font-black text-white hover:brightness-110 disabled:opacity-50 dark:text-space">
              حفظ الكود ومتابعة
            </button>
            <button type="button" className={btnGhost} onClick={() => setMake(false)} disabled={busy}>
              إلغاء
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

