"use client";

// PayForm — الدفع لـ Colapia بتحويل يدوي (V3): اختيار الباقة الشهرية والمدة، وكود «الدائرة الذهبية» للدفعة الأولى، وتفصيل
// المبلغ (التجهيز + الباقة × الأشهر، أو الباقة × الأشهر للتجديد)، ثم التحويل والرقم المحوَّل منه وصورة الإيصال (تُضغط في
// المتصفح وتُرفع لمسار platformReceipt الخاص بصاحب المتجر). المبلغ يُعاد حسابه على الخادم وحده. بعد الإرسال تتحول الصفحة
// لحالة «قيد المراجعة» من الخادم (router.refresh)، فلا حالة نجاح محلية قد تخالف الواقع.
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import imageCompression from "browser-image-compression";
import { Check, Copy, Crown, ImagePlus, Loader2, RefreshCw, Send, Smartphone, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { fmtNum } from "@/lib/format";
import { normalizeEgyptianPhone, prettyPhone } from "@/lib/phone";
import { monthsLabel, quote, type PlanId, type PricingModel } from "@/lib/platform-pricing";
import { useMediaUpload } from "@/lib/media-upload";
import { checkCouponAction, submitPlatformPaymentAction } from "@/server/actions/platform";
import { requestPulse } from "../DashboardPulse";
import { inputCls } from "../product/parts";

type Method = "vodafone_cash" | "instapay";
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

export type PayGolden = { code: string; buildPrice: number; regularBuildPrice: number; seatsLeft: number };
export type PayPlan = { id: PlanId; name: string; monthly: number; highlights: string[] };

/**
 * kind="setup": الدفعة الأولى (التجهيز + الباقة × الأشهر، وكود الدائرة الذهبية إن كان متاحاً).
 * kind="renewal": تجديد بالباقة × الأشهر فقط، ويمكن تغيير الباقة.
 */
export function PayForm({
  model,
  plans,
  kind,
  vodafone,
  instapay,
  golden,
  suggestCoupon,
  currentPlan,
}: {
  /** نموذج الأسعار (لحساب التفصيل في المتصفح بنفس دالة الخادم). */
  model: PricingModel;
  /** الباقات بأبرز حدودها للعرض. */
  plans: PayPlan[];
  kind: "setup" | "renewal";
  vodafone: string;
  instapay: string;
  golden?: PayGolden | null;
  suggestCoupon?: string;
  /** الباقة الحالية لتُحدَّد مسبقاً عند التجديد. */
  currentPlan?: PlanId | null;
}) {
  const router = useRouter();
  const [planId, setPlanId] = useState<PlanId>(() => (kind === "renewal" && currentPlan ? currentPlan : model.featured));
  const [months, setMonths] = useState<number>(() => (model.months.includes(3) ? 3 : model.months[0] ?? 1));
  const [couponOpen, setCouponOpen] = useState(Boolean(suggestCoupon));
  const [couponInput, setCouponInput] = useState(suggestCoupon ?? "");
  const [couponError, setCouponError] = useState("");
  const [checking, setChecking] = useState(false);
  const [applied, setApplied] = useState<{ code: string; buildPrice: number } | null>(null);
  const q = useMemo(() => quote(model, { planId, months, golden: Boolean(applied), kind }), [model, planId, months, applied, kind]);
  const total = q.ok ? q.total : 0;

  async function applyCoupon() {
    setChecking(true);
    setCouponError("");
    const r = await checkCouponAction(couponInput).catch(() => ({ ok: false as const, error: "انقطع الاتصال، يمكن المحاولة مرة أخرى." }));
    setChecking(false);
    if (!r.ok) return setCouponError(r.error);
    setApplied({ code: r.code, buildPrice: r.buildPrice });
    toast.success("طُبّق كود الدائرة الذهبية");
  }
  const [method, setMethod] = useState<Method>("vodafone_cash");
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [receipt, setReceipt] = useState<{ url: string; preview: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [receiptError, setReceiptError] = useState("");
  const [sending, setSending] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const target = method === "vodafone_cash" ? vodafone : instapay;

  const { startUpload } = useMediaUpload("platformReceipt", {
    onUploadError: (e) => setReceiptError(/[؀-ۿ]/.test(e?.message ?? "") ? e.message : "تعذر رفع الصورة. يُرجى التأكد من الاتصال والمحاولة مرة أخرى."),
  });

  async function pick(files: FileList | File[] | null) {
    const f = files ? Array.from(files)[0] : undefined;
    if (!f) return;
    if (!IMAGE_TYPES.includes(f.type) && !f.type.startsWith("image/")) return setReceiptError("المطلوب صورة (لقطة شاشة للإيصال)، لا ملف آخر.");
    setReceiptError("");
    setUploading(true);
    const preview = URL.createObjectURL(f);
    let file = f;
    try {
      // مقروءة بعد الضغط: الإيصال نص صغير، فلا نصغّره كثيراً.
      const c = await imageCompression(f, { maxSizeMB: 1.5, maxWidthOrHeight: 2400, useWebWorker: false, initialQuality: 0.9 });
      file = new File([c], f.name.replace(/\.\w+$/, "") + ".jpg", { type: c.type || "image/jpeg" });
    } catch {
      /* يُرفع الأصل */
    }
    const res = await startUpload([file]).catch(() => undefined);
    setUploading(false);
    const url = res?.[0]?.ufsUrl;
    if (!url) {
      URL.revokeObjectURL(preview);
      return setReceiptError((e) => e || "تعذر رفع الصورة. يمكن المحاولة مرة أخرى.");
    }
    if (receipt) URL.revokeObjectURL(receipt.preview);
    setReceipt({ url, preview });
  }

  function checkPhone(): string | null {
    const n = normalizeEgyptianPhone(phone);
    if (!n) {
      setPhoneError(phone.trim() ? "رقم غير صحيح: 11 رقماً يبدأ بـ 010 أو 011 أو 012 أو 015." : "رقم المحفظة أو الحساب الذي تم التحويل منه مطلوب.");
      return null;
    }
    setPhoneError("");
    setPhone(n);
    return n;
  }

  async function submit() {
    if (!q.ok) return void toast.error(q.error);
    const n = checkPhone();
    if (!receipt) setReceiptError("صورة الإيصال مطلوبة.");
    if (!n) return void document.getElementById("pay-phone")?.focus();
    if (!receipt) return void fileRef.current?.closest("section")?.scrollIntoView({ block: "center", behavior: "smooth" });
    setSending(true);
    const r = await submitPlatformPaymentAction({ method, senderPhone: n, screenshotUrl: receipt.url, planId, months, coupon: applied?.code }).catch(() => ({
      ok: false as const,
      error: "انقطع الاتصال، يمكن المحاولة مرة أخرى.",
    }));
    setSending(false);
    if (!r.ok) {
      toast.error(r.error);
      // إيصال سابق قيد المراجعة أو تغيّرت حالة المتجر أو الأسعار: الصفحة تعرض الواقع.
      router.refresh();
      return;
    }
    toast.success("وصل الإيصال، وسنراجعه بأنفسنا");
    requestPulse();
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {/* 1) الباقة */}
      <Step n={1} title={kind === "renewal" ? "باقة التجديد" : "اختيار الباقة"} id="plans">
        <div role="radiogroup" aria-label="الباقة الشهرية" className="grid gap-2.5 md:grid-cols-3">
          {plans.map((p) => {
            const on = planId === p.id;
            return (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setPlanId(p.id)}
                className={cn(
                  "relative flex min-h-32 flex-col items-start gap-1 rounded-xl border p-3.5 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova/50",
                  on ? "border-nova/60 bg-nova/10" : "border-edge/10 hover:border-edge/20 hover:bg-edge/[0.03]"
                )}
              >
                {p.id === model.featured ? <span className="absolute -top-2.5 end-3 rounded-full bg-nova px-2 py-0.5 text-[10.5px] font-black text-white">الأكثر اختياراً</span> : null}
                {kind === "renewal" && currentPlan === p.id ? <span className="text-[10.5px] font-black text-ok">باقتكم الحالية</span> : null}
                <span className="text-[13px] font-black text-ink">{p.name}</span>
                <span className="text-[22px] font-black leading-none tabular-nums text-ink">
                  {fmtNum(p.monthly)} <span className="text-[12px] font-bold text-ink-2">ج.م شهرياً</span>
                </span>
                <ul className="mt-1.5 space-y-0.5 text-[11.5px] leading-5 text-ink-3">
                  {p.highlights.slice(0, 4).map((h) => (
                    <li key={h} className="flex gap-1">
                      <Check className="mt-1 size-3 shrink-0 text-ok" aria-hidden="true" />
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              </button>
            );
          })}
        </div>

        <p className="mb-2 mt-4 text-[12.5px] font-black text-ink">المدة</p>
        <div role="radiogroup" aria-label="مدة الاشتراك" className="flex flex-wrap gap-2">
          {model.months.map((m) => {
            const on = months === m;
            return (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setMonths(m)}
                className={cn(
                  "min-h-11 rounded-xl border px-4 text-[13px] font-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova/50",
                  on ? "border-nova/60 bg-nova/10 text-ink" : "border-edge/10 text-ink-2 hover:border-edge/20"
                )}
              >
                {monthsLabel(m)}
              </button>
            );
          })}
        </div>

        {kind === "setup" && golden ? (
          applied ? (
            <div className="mt-4 flex flex-wrap items-start gap-3 rounded-xl border border-amber-400/30 bg-amber-400/[0.07] p-3.5 text-[12.5px] leading-6 text-ink-2">
              <Crown className="mt-0.5 size-4 shrink-0 text-amber-500" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-black text-ink">
                  الدائرة الذهبية: تجهيز المتجر بـ {fmtNum(applied.buildPrice)} ج.م بدلاً من {fmtNum(golden.regularBuildPrice)} ج.م
                </p>
                <p>العرض يخفّض رسوم التجهيز فقط، والاستضافة الشهرية بسعر الباقة المختارة.</p>
              </div>
              <button type="button" onClick={() => setApplied(null)} className="min-h-9 text-[12px] font-bold text-ink-3 hover:text-ink">
                إلغاء الكود
              </button>
            </div>
          ) : couponOpen ? (
            <div className="mt-4">
              <label htmlFor="pay-coupon" className="mb-1.5 block text-[12.5px] font-bold text-ink-2">
                كود الدائرة الذهبية
              </label>
              <div className="flex gap-2">
                <input
                  id="pay-coupon"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && couponInput.trim() && applyCoupon()}
                  dir="ltr"
                  autoCapitalize="characters"
                  aria-invalid={Boolean(couponError)}
                  aria-describedby={couponError ? "pay-coupon-err" : undefined}
                  className={cn(inputCls, "font-mono uppercase")}
                />
                <button
                  type="button"
                  disabled={checking || !couponInput.trim()}
                  onClick={applyCoupon}
                  className="inline-flex min-h-11 shrink-0 items-center rounded-xl bg-nova px-4 text-[13px] font-black text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova/50 focus-visible:ring-offset-2 disabled:opacity-50"
                >
                  {checking ? <Loader2 className="size-4 animate-spin" aria-label="جارٍ التحقق" /> : "تطبيق"}
                </button>
              </div>
              {couponError ? (
                <p id="pay-coupon-err" role="alert" className="mt-1.5 text-[12px] font-bold text-bad">
                  {couponError}
                </p>
              ) : null}
            </div>
          ) : (
            <button type="button" onClick={() => setCouponOpen(true)} className="mt-4 min-h-9 text-[12.5px] font-bold text-nova-2 underline-offset-4 hover:underline">
              لديكم كود عرض؟
            </button>
          )
        ) : null}

        {/* تفصيل المبلغ */}
        {q.ok ? (
          <div className="mt-4 rounded-xl border border-edge/10 bg-edge/[0.02] p-3.5" aria-live="polite">
            <ul className="space-y-1.5 text-[12.5px] text-ink-2">
              {q.lines.map((l) => (
                <li key={l.label} className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0">{l.label}</span>
                  <span className="shrink-0 font-bold tabular-nums text-ink">{fmtNum(l.amount)} ج.م</span>
                </li>
              ))}
            </ul>
            <div className="mt-2.5 flex items-baseline justify-between gap-3 border-t border-edge/10 pt-2.5">
              <span className="text-[13px] font-black text-ink">الإجمالي</span>
              <span className="text-[22px] font-black tabular-nums text-ink">
                {fmtNum(q.total)} <span className="text-[12px] font-bold text-ink-2">ج.م</span>
              </span>
            </div>
            <p className="mt-1.5 text-[11.5px] leading-5 text-ink-3">
              {kind === "renewal"
                ? "تُضاف المدة لنهاية اشتراككم الحالي فلا يضيع يوم، والباقة الجديدة تسري فور قبول الإيصال."
                : "رسوم التجهيز مرة واحدة فقط، والتجديد لاحقاً للباقة وحدها. بلا عمولة على مبيعاتكم."}
            </p>
          </div>
        ) : null}
      </Step>

      {/* 2) التحويل */}
      <Step n={2} title="تحويل المبلغ">
        <div role="radiogroup" aria-label="وسيلة التحويل" className="grid grid-cols-2 gap-2">
          {(
            [
              { key: "vodafone_cash", label: "فودافون كاش", hint: "من أي محفظة موبايل", icon: Smartphone },
              { key: "instapay", label: "إنستاباي", hint: "من تطبيق InstaPay", icon: Wallet },
            ] as const
          ).map((m) => {
            const on = method === m.key;
            return (
              <button
                key={m.key}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setMethod(m.key)}
                className={cn(
                  "flex min-h-16 items-center gap-3 rounded-xl border p-3 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova/50",
                  on ? "border-nova/50 bg-nova/10" : "border-edge/10 hover:border-edge/20 hover:bg-edge/[0.03]"
                )}
              >
                <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg", on ? "bg-nova text-white" : "bg-edge/[0.06] text-ink-3")}>
                  <m.icon className="size-4" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-black text-ink">{m.label}</span>
                  <span className="block text-[11px] text-ink-3">{m.hint}</span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-3 divide-y divide-edge/10 rounded-xl border border-edge/10 bg-edge/[0.02]">
          <CopyRow label={method === "vodafone_cash" ? "التحويل إلى رقم المحفظة" : "التحويل إلى الرقم المربوط بإنستاباي"} display={prettyPhone(target)} value={target} />
          <CopyRow label="المبلغ بالضبط" display={`${fmtNum(total)} ج.م`} value={String(total)} />
        </div>
        <p className="mt-2 text-[11.5px] leading-5 text-ink-3">المبلغ كاملاً في تحويل واحد، ثم لقطة شاشة لنجاح التحويل.</p>
      </Step>

      {/* 3) الرقم المحوَّل منه */}
      <Step n={3} title="الرقم الذي تم التحويل منه">
        <label htmlFor="pay-phone" className="sr-only">
          الرقم الذي تم التحويل منه
        </label>
        <input
          id="pay-phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          dir="ltr"
          placeholder="01xxxxxxxxx"
          value={phone}
          onChange={(e) => {
            setPhone(e.target.value);
            if (phoneError) setPhoneError("");
          }}
          onBlur={() => phone.trim() && checkPhone()}
          aria-invalid={Boolean(phoneError)}
          aria-describedby="pay-phone-hint"
          className={cn(inputCls, "text-end font-mono tabular-nums", phoneError && "border-bad/60")}
        />
        <p id="pay-phone-hint" className={cn("mt-1.5 text-[11.5px]", phoneError ? "font-bold text-bad" : "text-ink-3")}>
          {phoneError || "نطابقه مع الإيصال للتأكد من التحويل."}
        </p>
      </Step>

      {/* 4) الإيصال */}
      <Step n={4} title="صورة الإيصال">
        <input ref={fileRef} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => void pick(e.target.files).finally(() => (e.target.value = ""))} />
        {receipt ? (
          <div className="flex items-center gap-3 rounded-xl border border-edge/10 bg-edge/[0.02] p-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={receipt.preview} alt="صورة الإيصال المرفوعة" className="h-24 w-20 shrink-0 rounded-lg bg-edge/5 object-cover" />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-[12.5px] font-bold text-ok">
                <Check className="size-4" aria-hidden="true" /> رُفعت الصورة
              </p>
              <p className="mt-0.5 text-[11.5px] text-ink-3">يُرجى التأكد أن المبلغ والتاريخ ظاهران فيها.</p>
              <div className="mt-2 flex gap-1.5">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-edge/10 px-2.5 text-[12px] font-bold text-ink-2 hover:bg-edge/5"
                >
                  {uploading ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <RefreshCw className="size-3.5" aria-hidden="true" />} تغيير
                </button>
                <button
                  type="button"
                  onClick={() => {
                    URL.revokeObjectURL(receipt.preview);
                    setReceipt(null);
                  }}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-[12px] font-bold text-ink-3 hover:bg-bad/10 hover:text-bad"
                >
                  <Trash2 className="size-3.5" aria-hidden="true" /> حذف
                </button>
              </div>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              void pick(e.dataTransfer.files);
            }}
            disabled={uploading}
            aria-describedby="pay-receipt-hint"
            className={cn(
              "flex min-h-32 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-4 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova/50",
              receiptError ? "border-bad/50 bg-bad/[0.04]" : "border-edge/15 hover:border-nova/40 hover:bg-nova/[0.04]"
            )}
          >
            {uploading ? <Loader2 className="size-6 animate-spin text-nova-2" aria-hidden="true" /> : <ImagePlus className="size-6 text-ink-3" aria-hidden="true" />}
            <span className="text-[13px] font-black text-ink">{uploading ? "جارٍ رفع الصورة…" : "اختيار صورة الإيصال"}</span>
            <span className="text-[11.5px] text-ink-3">لقطة شاشة من المحفظة أو التطبيق، حتى 8 ميجابايت</span>
          </button>
        )}
        <p id="pay-receipt-hint" role={receiptError ? "alert" : undefined} className={cn("mt-1.5 text-[11.5px] font-bold text-bad", !receiptError && "sr-only")}>
          {receiptError}
        </p>
      </Step>

      <button
        type="button"
        onClick={() => void submit()}
        disabled={sending || uploading || !q.ok}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-nova to-nova-deep px-5 text-[14px] font-black text-white shadow-lg shadow-nova/20 transition hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova/60 focus-visible:ring-offset-2 disabled:opacity-60"
      >
        {sending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Send className="size-4" aria-hidden="true" />}
        {sending ? "جارٍ إرسال الإيصال…" : `إرسال إيصال ${fmtNum(total)} ج.م للمراجعة`}
      </button>
      <p className="text-center text-[11.5px] leading-5 text-ink-3">
        نراجع كل إيصال بأنفسنا. عند القبول يُفعَّل المتجر ويصلكم بريد، ولا يتجمد المتجر ولا يُحذف أثناء المراجعة.
      </p>
    </div>
  );
}

function Step({ n, title, id, children }: { n: number; title: string; id?: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`pay-step-${n}`} className="dash-card scroll-mt-24 p-4 sm:p-5">
      <h3 id={`pay-step-${n}`} className="mb-3 flex items-center gap-2 text-[14px] font-black text-ink">
        <span className="grid size-6 place-items-center rounded-full bg-nova/15 text-[12px] font-black tabular-nums text-nova-2">{n}</span>
        {title}
      </h3>
      {children}
    </section>
  );
}

function CopyRow({ label, display, value }: { label: string; display: string; value: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-[11.5px] text-ink-3">{label}</p>
        <p dir="ltr" className="text-end text-[17px] font-black tabular-nums text-ink">
          {display}
        </p>
      </div>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard?.writeText(value).then(
            () => {
              setDone(true);
              setTimeout(() => setDone(false), 1800);
            },
            () => toast.error("تعذر النسخ، يمكن النسخ يدوياً.")
          );
        }}
        aria-label={`نسخ ${label}`}
        className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg border border-edge/10 px-3 text-[12px] font-bold text-ink-2 hover:bg-edge/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova/50"
      >
        {done ? <Check className="size-4 text-ok" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
        {done ? "نُسخ" : "نسخ"}
      </button>
    </div>
  );
}
