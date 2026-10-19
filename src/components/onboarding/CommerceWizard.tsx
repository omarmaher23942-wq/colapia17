"use client";

// CommerceWizard — «الدفع والشحن» كأسئلة قصيرة، سؤال في كل شاشة (مناسب للجوال): نعم/لا بأزرار كبيرة، ولا يُضاف شيء لم يُطلب.
// الأسئلة الاختيارية (الهدية، الإلغاء، كود الخصم) إجابتها الأصلية «لا». كل سؤال يحفظ فور «التالي» بنفس إجراءات اللوحة.
// شاشات الشحن والاستبدال والتواصل هي النماذج الكاملة نفسها (تُعرض في شاشة واحدة لكل منها).
import { useEffect, useMemo, useState } from "react";
import { saveExtrasStepAction, savePaymentStepAction } from "@/server/actions/setup";
import { normalizeEgyptianPhone } from "@/lib/phone";
import { cleanInstapay } from "@/lib/store-settings";
import { commerceQuestions, type CommerceQuestion as Q, type SetupData } from "@/lib/onboarding";
import { cn } from "@/lib/utils";
import { StepReturns, StepShipping } from "./StepsCommerce";
import { StepContact, StepDiscount } from "./StepsMisc";
import { btnGhost, btnPrimary, Field, inputCls, Notice, Spinner } from "./ui";

const TITLES: Record<Q, string> = {
  cod: "هل تقبلون الدفع عند الاستلام؟",
  inspection: "هل تسمحون بمعاينة الشحنة وفتحها قبل الدفع؟",
  transfer: "هل تقبلون الدفع بالتحويل؟",
  whatsapp: "كيف يتواصل معكم الزبائن؟",
  shipping: "كم تكلفة الشحن ومتى يصل الطلب؟",
  returns: "ما سياسة الاستبدال والاسترجاع؟",
  gift: "هل تقدمون خيار الهدية والتغليف؟",
  cancel: "هل يستطيع الزبون طلب إلغاء طلبه من صفحته؟",
  discount: "هل تريدون إنشاء كود خصم الآن؟",
};

function YesNo({ value, onChange, yes = "نعم", no = "لا", name }: { value: boolean; onChange: (v: boolean) => void; yes?: string; no?: string; name: string }) {
  return (
    <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label={name}>
      {(
        [
          [true, yes],
          [false, no],
        ] as const
      ).map(([v, t]) => (
        <button
          key={String(v)}
          type="button"
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className={cn("min-h-16 rounded-2xl border-2 text-[16px] font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova/50", value === v ? "border-nova bg-nova/[0.1] text-ink" : "border-edge/15 text-ink-2 hover:border-edge/30")}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

const KEY = (id: string) => `clp-commerce:${id}`;

export function CommerceWizard({ storeId, data, onDone, onBack }: { storeId: string; data: SetupData; onDone: () => void; onBack: () => void }) {
  const p0 = data.payments;
  const [cod, setCod] = useState(p0.cod);
  const [inspection, setInspection] = useState(p0.inspection);
  const [transfer, setTransfer] = useState(p0.vodafone.enabled || p0.instapay.enabled);
  const [vf, setVf] = useState(p0.vodafone);
  const [ip, setIp] = useState(p0.instapay);
  const [gift, setGift] = useState(data.extras.gift);
  const [giftFee, setGiftFee] = useState(data.extras.giftFeePounds ? String(data.extras.giftFeePounds) : "");
  const [cancel, setCancel] = useState(data.extras.customerCancel);
  const [idx, setIdx] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const list = useMemo(() => commerceQuestions(cod), [cod]);
  const q = list[Math.min(idx, list.length - 1)]!;

  // الاستئناف من آخر سؤال بلغه التاجر على هذا الجهاز.
  useEffect(() => {
    try {
      const n = Number(localStorage.getItem(KEY(storeId)));
      if (Number.isInteger(n) && n > 0 && n < 12) setIdx(n);
    } catch {
      /* التخزين غير متاح: نبدأ من الأول */
    }
  }, [storeId]);
  useEffect(() => {
    try {
      localStorage.setItem(KEY(storeId), String(idx));
    } catch {
      /* لا شيء */
    }
  }, [idx, storeId]);

  const go = (n: number) => {
    setErr(null);
    if (n >= list.length) {
      try {
        localStorage.removeItem(KEY(storeId));
      } catch {
        /* لا شيء */
      }
      return onDone();
    }
    if (n < 0) return onBack();
    setIdx(n);
    window.scrollTo?.({ top: 0 });
  };
  const next = () => go(idx + 1);
  const prev = () => go(idx - 1);

  async function savePayment(): Promise<boolean> {
    const vfOn = transfer && vf.enabled;
    const ipOn = transfer && ip.enabled;
    const r = await savePaymentStepAction({ cod, inspection: cod ? inspection : false, codFee: cod ? p0.codFee : 0, vodafone: { ...vf, enabled: vfOn }, instapay: { ...ip, enabled: ipOn } });
    if (!r.ok) {
      setErr(r.error);
      return false;
    }
    return true;
  }

  async function onNextPayment() {
    setErr(null);
    if (q === "transfer") {
      if (transfer && !vf.enabled && !ip.enabled) return setErr("اختاروا فودافون كاش أو إنستاباي، أو اجعلوا الإجابة «لا».");
      if (transfer && vf.enabled && !normalizeEgyptianPhone(vf.number)) return setErr("اكتبوا رقم محفظة فودافون كاش (11 رقماً يبدأ بـ 01).");
      if (transfer && ip.enabled && (!ip.target.trim() || cleanInstapay(ip.target) === null)) return setErr("اكتبوا عنوان إنستاباي (name@instapay) أو رقم الموبايل.");
      if (!cod && !transfer) return setErr("لا بد من وسيلة دفع واحدة على الأقل: الدفع عند الاستلام أو التحويل.");
    }
    setBusy(true);
    const ok = await savePayment();
    setBusy(false);
    if (ok) next();
  }

  async function onNextExtra() {
    setErr(null);
    const fee = Number(giftFee.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))) || 0);
    if (q === "gift" && gift && (!Number.isFinite(fee) || fee < 0 || fee > 1000)) return setErr("اكتبوا رسوم التغليف بين 0 و1000 جنيه، أو اتركوها فارغة.");
    setBusy(true);
    const r = await saveExtrasStepAction(q === "gift" ? { gift: { on: gift, feePounds: gift ? fee : 0 } } : { customerCancel: cancel });
    setBusy(false);
    if (!r.ok) return setErr(r.error);
    next();
  }

  const frame = (hint: string, body: React.ReactNode, action: React.ReactNode) => (
    <div className="space-y-5">
      <div>
        <h2 className="text-[19px] font-black leading-snug text-ink sm:text-[21px]">{TITLES[q]}</h2>
        <p className="mt-1.5 text-[13px] leading-6 text-ink-3">{hint}</p>
      </div>
      {body}
      {err ? <Notice tone="bad">{err}</Notice> : null}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        {action}
        <button type="button" onClick={prev} disabled={busy} className={btnGhost}>
          رجوع
        </button>
      </div>
    </div>
  );

  const nextBtn = (onClick: () => void, label = "التالي") => (
    <button type="button" onClick={onClick} disabled={busy} className={cn(btnPrimary, "min-h-12 px-8 text-[15px]")}>
      {busy ? <Spinner /> : null}
      {label}
    </button>
  );

  return (
    <div>
      <p className="mb-4 text-[12px] font-bold text-ink-3" aria-live="polite">
        سؤال {idx + 1} من {list.length}
      </p>
      <div key={q}>
        {q === "cod" &&
          frame(
            "الزبون يدفع للمندوب عند وصول الطلب. كثير من المشترين في مصر يفضلونه.",
            <YesNo name={TITLES.cod} value={cod} onChange={setCod} />,
            nextBtn(() => void onNextPayment())
          )}

        {q === "inspection" &&
          frame(
            "إجابتكم تظهر للزبون في صفحة المنتج والدفع والأسئلة الشائعة والفاتورة. اختاروا «نعم» فقط إن كانت شركة الشحن لديكم تسمح بذلك.",
            <YesNo name={TITLES.inspection} value={inspection} onChange={setInspection} yes="نعم، المعاينة مسموحة" no="لا، الدفع قبل الفتح" />,
            nextBtn(() => void onNextPayment())
          )}

        {q === "transfer" &&
          frame(
            "يحوّل الزبون على رقمكم ويرفع صورة التحويل مع الطلب. لا نعرض الوسيلة قبل أن تكتبوا رقمها.",
            <div className="space-y-4">
              <YesNo name={TITLES.transfer} value={transfer} onChange={setTransfer} />
              {transfer ? (
                <div className="space-y-4">
                  <div className={cn("rounded-2xl border p-4", vf.enabled ? "border-nova/60 bg-nova/[0.04]" : "border-edge/12")}>
                    <label className="flex min-h-11 cursor-pointer items-center gap-3 text-[14px] font-black text-ink">
                      <input type="checkbox" checked={vf.enabled} onChange={(e) => setVf({ ...vf, enabled: e.target.checked })} className="size-5 accent-[var(--dash-nova)]" />
                      فودافون كاش
                    </label>
                    {vf.enabled ? (
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <Field label="رقم المحفظة">{(p) => <input {...p} dir="ltr" inputMode="tel" value={vf.number} onChange={(e) => setVf({ ...vf, number: e.target.value })} placeholder="01012345678" className={cn(inputCls, "text-start")} />}</Field>
                        <Field label="اسم صاحب المحفظة" optional>
                          {(p) => <input {...p} value={vf.holder} onChange={(e) => setVf({ ...vf, holder: e.target.value })} className={inputCls} />}
                        </Field>
                      </div>
                    ) : null}
                  </div>
                  <div className={cn("rounded-2xl border p-4", ip.enabled ? "border-nova/60 bg-nova/[0.04]" : "border-edge/12")}>
                    <label className="flex min-h-11 cursor-pointer items-center gap-3 text-[14px] font-black text-ink">
                      <input type="checkbox" checked={ip.enabled} onChange={(e) => setIp({ ...ip, enabled: e.target.checked })} className="size-5 accent-[var(--dash-nova)]" />
                      إنستاباي
                    </label>
                    {ip.enabled ? (
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <Field label="عنوان إنستاباي أو الرقم">{(p) => <input {...p} dir="ltr" value={ip.target} onChange={(e) => setIp({ ...ip, target: e.target.value })} placeholder="name@instapay" className={cn(inputCls, "text-start")} />}</Field>
                        <Field label="اسم صاحب الحساب" optional>
                          {(p) => <input {...p} value={ip.holder} onChange={(e) => setIp({ ...ip, holder: e.target.value })} className={inputCls} />}
                        </Field>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>,
            nextBtn(() => void onNextPayment())
          )}

        {q === "whatsapp" && <StepContact data={data.contact} onSaved={next} onBack={prev} />}
        {q === "shipping" && <StepShipping data={data.shipping} onSaved={next} onBack={prev} />}
        {q === "returns" && <StepReturns data={data.returns} onSaved={next} onBack={prev} />}

        {q === "gift" &&
          frame(
            "الأصل «لا». عند «نعم» يظهر للزبون خيار تغليف الطلب كهدية مع رسالة، وتحددون رسوماً اختيارية.",
            <div className="space-y-4">
              <YesNo name={TITLES.gift} value={gift} onChange={setGift} />
              {gift ? (
                <div className="max-w-60">
                  <Field label="رسوم التغليف بالجنيه" optional hint="اتركوها فارغة إن كان التغليف مجانياً.">
                    {(p) => <input {...p} inputMode="decimal" value={giftFee} onChange={(e) => setGiftFee(e.target.value)} placeholder="0" className={cn(inputCls, "tabular-nums")} />}
                  </Field>
                </div>
              ) : null}
            </div>,
            nextBtn(() => void onNextExtra())
          )}

        {q === "cancel" &&
          frame(
            "الأصل «لا». عند «نعم» يظهر زر «طلب إلغاء الطلب» في صفحة طلب الزبون قبل التجهيز، والقرار النهائي لكم.",
            <YesNo name={TITLES.cancel} value={cancel} onChange={setCancel} />,
            nextBtn(() => void onNextExtra())
          )}

        {q === "discount" && <StepDiscount existing={data.discounts} onSaved={next} onSkip={next} onBack={prev} />}
      </div>
    </div>
  );
}
