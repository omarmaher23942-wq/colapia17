"use client";

// StepsCommerce — خطوات الدفع والشحن والاستبدال. كل خطوة تحفظ فوراً في بيانات المتجر (نفس إجراءات اللوحة)، وتبدأ بخيارات
// مختارة مسبقاً مناسبة لأغلب المتاجر، وتشرح أثر كل اختيار على الزائر بلا مصطلحات.
import { useState } from "react";
import { saveReturnsStepAction, saveShippingStepAction } from "@/server/actions/setup";
import { SHIPPING_GROUP_LABEL, type ReturnsTemplate, type SetupData, type ShippingPlan } from "@/lib/onboarding";
import { cn } from "@/lib/utils";
import { btnGhost, btnPrimary, Field, inputCls, Notice, OptionCard, Spinner, Switch } from "./ui";

export type StepActionsProps = { onBack: () => void; busy: boolean; submitLabel?: string };

export function StepActions({ onBack, busy, submitLabel = "حفظ ومتابعة", extra }: StepActionsProps & { extra?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2 pt-1">
      <button type="submit" disabled={busy} className={btnPrimary}>
        {busy ? <Spinner /> : null}
        {submitLabel}
      </button>
      <button type="button" onClick={onBack} disabled={busy} className={btnGhost}>
        رجوع
      </button>
      {extra}
    </div>
  );
}

const numStr = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n));
const toNum = (s: string) => {
  const n = Number(s.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/[,٬\s]/g, ""));
  return s.trim() && Number.isFinite(n) && n >= 0 ? n : null;
};

function Money({ label, value, onChange, error, hint, placeholder = "0", optional }: { label: string; value: string; onChange: (v: string) => void; error?: string | null; hint?: string; placeholder?: string; optional?: boolean }) {
  return (
    <Field label={label} error={error} hint={hint} optional={optional}>
      {(p) => (
        <div className="relative">
          <input {...p} inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={cn(inputCls, "pe-12 tabular-nums")} />
          <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 end-3 grid place-items-center text-[12px] font-bold text-ink-3">
            ج
          </span>
        </div>
      )}
    </Field>
  );
}

// ─── الشحن ───────────────────────────────────────────────────────────────────
const GROUPS = Object.keys(SHIPPING_GROUP_LABEL) as (keyof typeof SHIPPING_GROUP_LABEL)[];

export function StepShipping({ data, onSaved, onBack }: { data: SetupData["shipping"]; onSaved: () => void; onBack: () => void }) {
  const init = data.plan;
  const [kind, setKind] = useState<ShippingPlan["kind"]>(init.kind);
  const [flat, setFlat] = useState(numStr(init.kind === "flat" ? init.fee : 60));
  const [cairo, setCairo] = useState(numStr(init.kind === "cairo_giza" ? init.cairoFee : 50));
  const [rest, setRest] = useState(numStr(init.kind === "cairo_giza" ? init.restFee : 75));
  const [groups, setGroups] = useState<Record<string, string>>(() => {
    const g = init.kind === "custom" ? init.groups : null;
    const def: Record<string, number> = { gc: 50, alex: 60, delta: 65, canal: 70, upper: 80, remote: 100 };
    return Object.fromEntries(GROUPS.map((k) => [k, g ? numStr(g[k]) : String(def[k])]));
  });
  const [etaMin, setEtaMin] = useState(String(data.etaMin));
  const [etaMax, setEtaMax] = useState(String(data.etaMax));
  const [freeOn, setFreeOn] = useState(data.freeOver !== null);
  const [free, setFree] = useState(numStr(data.freeOver));
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setErr(null);
    const e: Record<string, string> = {};
    let plan: ShippingPlan;
    if (kind === "flat") {
      const fee = toNum(flat);
      if (fee === null) e.flat = "اكتبوا سعر الشحن (صفر للشحن المجاني)";
      plan = { kind: "flat", fee: fee ?? 0 };
    } else if (kind === "cairo_giza") {
      const c = toNum(cairo);
      const r = toNum(rest);
      if (c === null) e.cairo = "اكتبوا سعر القاهرة والجيزة";
      if (r === null) e.rest = "اكتبوا سعر باقي المحافظات";
      plan = { kind: "cairo_giza", cairoFee: c ?? 0, restFee: r ?? 0 };
    } else {
      const g = Object.fromEntries(GROUPS.map((k) => [k, groups[k]!.trim() ? toNum(groups[k]!) : null])) as Record<(typeof GROUPS)[number], number | null>;
      if (GROUPS.some((k) => groups[k]!.trim() && g[k] === null)) e.groups = "اكتبوا أرقاماً صحيحة، أو اتركوا الحقل فارغاً لعدم الشحن لهذه المنطقة";
      else if (!GROUPS.some((k) => g[k] !== null)) e.groups = "حدّدوا سعراً لمجموعة واحدة على الأقل";
      plan = { kind: "custom", groups: g };
    }
    const mn = toNum(etaMin);
    const mx = toNum(etaMax);
    if (mn === null || mx === null || !Number.isInteger(mn) || !Number.isInteger(mx)) e.eta = "اكتبوا عدد الأيام بأرقام صحيحة";
    else if (mx < mn) e.eta = "أقصى مدة أقل من أدناها";
    const fo = freeOn ? toNum(free) : null;
    if (freeOn && (fo === null || fo <= 0)) e.free = "اكتبوا قيمة الطلب التي يصبح الشحن بعدها مجانياً";
    setErrs(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    const r = await saveShippingStepAction({ plan, etaMin: mn, etaMax: mx, freeOver: freeOn ? fo : null });
    setBusy(false);
    if (!r.ok) return setErr(r.error);
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
      <div className="space-y-2.5" role="radiogroup" aria-label="طريقة حساب الشحن">
        <OptionCard name="ship" selected={kind === "flat"} onSelect={() => setKind("flat")} title="سعر واحد لكل المحافظات" description="الأبسط للزبون: نفس سعر الشحن أينما كان.">
          <div className="max-w-60">
            <Money label="سعر الشحن" value={flat} onChange={setFlat} error={errs.flat} />
          </div>
        </OptionCard>
        <OptionCard name="ship" selected={kind === "cairo_giza"} onSelect={() => setKind("cairo_giza")} title="القاهرة والجيزة بسعر، وباقي المحافظات بسعر" description="الأكثر استخداماً: تكلفة الشحن للمحافظات الأبعد أعلى عادةً.">
          <div className="grid gap-3 sm:grid-cols-2">
            <Money label="القاهرة والجيزة" value={cairo} onChange={setCairo} error={errs.cairo} />
            <Money label="باقي المحافظات" value={rest} onChange={setRest} error={errs.rest} />
          </div>
        </OptionCard>
        <OptionCard name="ship" selected={kind === "custom"} onSelect={() => setKind("custom")} title="مخصص حسب مجموعات المحافظات" description="سعر لكل منطقة. اتركوا السعر فارغاً إن كنتم لا تشحنون إليها.">
          <div className="grid gap-3 sm:grid-cols-2">
            {GROUPS.map((k) => (
              <Money key={k} label={SHIPPING_GROUP_LABEL[k]} value={groups[k]!} onChange={(v) => setGroups({ ...groups, [k]: v })} placeholder="لا نشحن" />
            ))}
          </div>
          {errs.groups ? <p className="mt-2 text-[12px] font-bold text-bad">{errs.groups}</p> : null}
        </OptionCard>
      </div>

      <div className="dash-card space-y-4 p-4">
        <div>
          <p className="text-[13px] font-black text-ink">مدة التوصيل المعتادة</p>
          <div className="mt-2 flex flex-wrap items-end gap-3">
            <Field label="من (أيام عمل)" error={errs.eta}>
              {(p) => <input {...p} inputMode="numeric" value={etaMin} onChange={(e) => setEtaMin(e.target.value)} className={cn(inputCls, "w-24 tabular-nums")} />}
            </Field>
            <Field label="إلى (أيام عمل)">
              {(p) => <input {...p} inputMode="numeric" value={etaMax} onChange={(e) => setEtaMax(e.target.value)} className={cn(inputCls, "w-24 tabular-nums")} />}
            </Field>
          </div>
        </div>
        <Switch checked={freeOn} onChange={setFreeOn} label="شحن مجاني فوق مبلغ معين (اختياري)" hint="يظهر للزبون شريط «باقي كذا للشحن المجاني» وهو يحفّز على زيادة السلة." />
        {freeOn ? (
          <div className="max-w-60">
            <Money label="الشحن مجاني للطلبات فوق" value={free} onChange={setFree} error={errs.free} placeholder="1000" />
          </div>
        ) : null}
      </div>

      {err ? <Notice tone="bad">{err}</Notice> : null}
      <StepActions onBack={onBack} busy={busy} />
    </form>
  );
}

// ─── الاستبدال والاسترجاع ────────────────────────────────────────────────────
type Paid = "customer" | "store" | "store_if_defect";
const PAID: { v: Paid; label: string }[] = [
  { v: "customer", label: "الزبون" },
  { v: "store_if_defect", label: "المتجر عند العيب أو الخطأ فقط" },
  { v: "store", label: "المتجر دائماً" },
];

export function StepReturns({ data, onSaved, onBack }: { data: ReturnsTemplate; onSaved: () => void; onBack: () => void }) {
  const [kind, setKind] = useState<ReturnsTemplate["kind"]>(data.kind);
  const [days, setDays] = useState(String(data.kind === "none" ? 14 : data.days));
  const [paidBy, setPaidBy] = useState<Paid>(data.kind === "none" ? "store_if_defect" : data.paidBy);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setErr(null);
    const d = toNum(days);
    if (kind !== "none" && (d === null || !Number.isInteger(d) || d < 1 || d > 60)) return setErr("اكتبوا عدد الأيام بين 1 و60");
    setBusy(true);
    const r = await saveReturnsStepAction(kind === "none" ? { kind } : { kind, days: d, paidBy });
    setBusy(false);
    if (!r.ok) return setErr(r.error);
    onSaved();
  }

  const detail = (
    <div className="space-y-3">
      <Field label="المدة بالأيام من الاستلام">{(p) => <input {...p} inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} className={cn(inputCls, "w-28 tabular-nums")} />}</Field>
      <fieldset>
        <legend className="mb-1.5 text-[12.5px] font-bold text-ink">من يتحمل شحن المرتجع؟</legend>
        <div className="flex flex-wrap gap-2">
          {PAID.map((o) => (
            <label key={o.v} className={cn("flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border px-3 text-[12.5px] font-bold transition", paidBy === o.v ? "border-nova bg-nova/10 text-ink" : "border-edge/12 text-ink-2 hover:border-edge/30")}>
              <input type="radio" name="paid" checked={paidBy === o.v} onChange={() => setPaidBy(o.v)} className="accent-[var(--dash-nova)]" />
              {o.label}
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={(ev) => {
        ev.preventDefault();
        void submit();
      }}
    >
      <div className="space-y-2.5" role="radiogroup" aria-label="سياسة الاستبدال والاسترجاع">
        <OptionCard name="ret" selected={kind === "none"} onSelect={() => setKind("none")} title="لا استبدال ولا استرجاع" description="تظهر السياسة بوضوح في المتجر، ويقل ذلك ثقة بعض الزبائن." />
        <OptionCard name="ret" selected={kind === "exchange"} onSelect={() => setKind("exchange")} title="استبدال فقط" description="يستطيع الزبون استبدال المنتج خلال المدة، دون رد المبلغ.">
          {detail}
        </OptionCard>
        <OptionCard name="ret" selected={kind === "exchange_refund"} onSelect={() => setKind("exchange_refund")} title="استبدال واسترجاع" description="الأكثر طمأنة للمشتري: استبدال أو استرجاع المبلغ خلال المدة.">
          {detail}
        </OptionCard>
      </div>
      <p className="text-[12px] leading-5 text-ink-3">اختاروا ما تلتزمون به فعلاً؛ فهذه السياسة تُعرض للزبائن في صفحة مستقلة وفي صفحة المنتج.</p>
      {err ? <Notice tone="bad">{err}</Notice> : null}
      <StepActions onBack={onBack} busy={busy} />
    </form>
  );
}
