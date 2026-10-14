"use client";

// IntakeForm.tsx — استمارة طلب المتجر: صفحة واحدة تُملأ في دقائق من الموبايل. الإلزامي: اسم المتجر ووسيلة تواصل ومنتج
// واحد على الأقل وطريقة دفع بتفاصيلها ونطاق التوصيل وسعر الشحن؛ وأسئلة التصميم فيها «يختارها الفريق». حفظ تلقائي من
// أول حرف، وزر الإرسال ظاهر دائماً في الشريط السفلي.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { AtSign, Clock, Clapperboard, Globe, Loader2, MessageCircle, MessageSquare, Package, Palette, RefreshCcw, Send, Sparkles, Store, Truck, Wallet } from "lucide-react";
import { ColapiaLogo } from "@/components/brand/ColapiaLogo";
import {
  COMPLETION_STEPS,
  completion,
  DELIVERY_OPTIONS,
  FEE_OPTIONS,
  GOLDEN_SUGGESTED_PRODUCTS,
  INSPECTION_OPTIONS,
  PAYMENT_OPTIONS,
  RETURN_OPTIONS,
  validateSubmission,
  type IntakeData,
  type IntakeErrors,
  type PaymentId,
} from "@/intake/schema";
import { revealFirstError } from "@/lib/reveal-error";
import { cn } from "@/lib/utils";
import { Card, Choice, Field, SaveBadge, TeamToggle, inputCls } from "./ui";
import { ContactHelp } from "./ContactHelp";
import { DRAFT_STORAGE_KEY, useIntakeDraft } from "./useIntakeDraft";
import { ProductsEditor } from "./ProductsEditor";
import { ColorChoice, LogoPicker } from "./LogoAndColors";

/** أقل زمن بين إنشاء المسودة والإرسال (الخادم يعامل الأسرع كبرنامج آلي). */
const MIN_SUBMIT_MS = 9_000;

/** آخر طلب أُرسل من هذا الجهاز (رابط متابعته). */
const FOLLOW_STORAGE_KEY = "clp-intake-follow";
const FOLLOW_TTL_MS = 45 * 86_400_000;
function savedFollowUrl(): string | null {
  try {
    const v = JSON.parse(localStorage.getItem(FOLLOW_STORAGE_KEY) ?? "null") as { url?: string; at?: number } | null;
    return v?.url && /^\/follow\/[A-Za-z0-9_-]{16,}$/.test(v.url) && typeof v.at === "number" && Date.now() - v.at < FOLLOW_TTL_MS ? v.url : null;
  } catch {
    return null;
  }
}

export function IntakeForm({
  initial,
  initialUrls,
  etaText,
  whatsappUrl,
  closedMessage,
}: {
  initial: { token: string | null; version: number; data: IntakeData };
  initialUrls: Record<string, string>;
  etaText: string;
  whatsappUrl: string | null;
  closedMessage: string | null;
}) {
  const router = useRouter();
  const { data, getData, update, state, online, problem, ensureToken, flush, forget, token } = useIntakeDraft(initial);
  const [urls, setUrls] = useState<Record<string, string>>(initialUrls);
  const setUrl = (k: string, u: string) => setUrls((m) => ({ ...m, [k]: u }));
  const [showErrors, setShowErrors] = useState(false);
  const [serverErrors, setServerErrors] = useState<IntakeErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  /** حجب «طلب مفتوح بنفس البيانات»: ماذا نعرض لصاحبه (رابط محفوظ على هذا الجهاز، أو إرسال الرابط لبريده). */
  const [openRequest, setOpenRequest] = useState<{ canResend: boolean; followUrl: string | null } | null>(null);
  const [resend, setResend] = useState<"idle" | "sending" | "sent">("idle");
  const [sending, setSending] = useState(false);
  /** رفع صورة أو شعار جارٍ: الإرسال ينتظره (وإلا يخرج الطلب بلا ما رفعه العميل ولا يعرف). */
  const [uploading, setUploading] = useState(0);
  const onBusy = useCallback((delta: 1 | -1) => setUploading((n) => Math.max(0, n + delta)), []);
  const hp = useRef<HTMLInputElement>(null);
  const tokenSince = useRef<number>(initial.token ? 0 : Number.POSITIVE_INFINITY);

  useEffect(() => {
    if (token && tokenSince.current === Number.POSITIVE_INFINITY) tokenSince.current = Date.now();
  }, [token]);

  // عودة لاستمارة لم تُرسل: رابط المسودة المحفوظ في المتصفح. رابط قديم غير صالح في العنوان يُنسى (بلا حلقة).
  useEffect(() => {
    if (initial.token) return;
    const q = new URLSearchParams(window.location.search);
    if (q.get("d")) return void forget();
    try {
      const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (saved && /^[A-Za-z0-9_-]{32}$/.test(saved)) window.location.replace(`/start?d=${saved}${q.toString() ? `&${q.toString()}` : ""}`);
    } catch {
      /* لا شيء */
    }
  }, [initial.token, forget]);

  const liveErrors = useMemo(() => (showErrors ? validateSubmission(data) : {}), [showErrors, data]);
  const errors: IntakeErrors = { ...serverErrors, ...liveErrors };
  const done = completion(data);
  const set = (fn: (d: IntakeData) => IntakeData) => {
    setServerErrors({});
    setSubmitError(null);
    setOpenRequest(null);
    update(fn);
  };

  const sendFollowLink = async () => {
    if (!token) return;
    setResend("sending");
    await fetch("/api/intake/resend-follow", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) }).catch(() => null);
    setResend("sent");
  };

  const submit = async () => {
    setShowErrors(true);
    setSubmitError(null);
    setOpenRequest(null);
    setResend("idle");
    const errs = validateSubmission(getData());
    if (Object.keys(errs).length) {
      revealFirstError();
      return;
    }
    if (uploading > 0) {
      setSubmitError("ما زالت بعض الصور قيد الرفع. لحظات ونرسل الطلب.");
      return;
    }
    setSending(true);
    try {
      await flush();
      const t = await ensureToken();
      if (!t) throw new Error("no_token");
      const wait = MIN_SUBMIT_MS - (Date.now() - (tokenSince.current === Number.POSITIVE_INFINITY ? Date.now() : tokenSince.current));
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      const send = () =>
        fetch("/api/intake/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // أحدث ما على الشاشة وقت الإرسال الفعلي (بعد انتظار الحفظ والمهلة)، لا نسخة لحظة الضغط.
          body: JSON.stringify({ token: t, data: getData(), hp: hp.current?.value ?? "" }),
        });
      let res = await send();
      let j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; followUrl?: string; errors?: IntakeErrors; message?: string; retryAfterMs?: number; reason?: string; canResend?: boolean };
      // الخادم يطلب ثواني إضافية (المسودة أُنشئت للتو): ننتظر ونعيد مرة واحدة.
      if (j.error === "too_fast" && typeof j.retryAfterMs === "number") {
        await new Promise((r) => setTimeout(r, Math.min(15_000, j.retryAfterMs ?? 0)));
        res = await send();
        j = (await res.json().catch(() => ({}))) as typeof j;
      }
      if (res.ok && j.ok && j.followUrl) {
        // رابط المتابعة يبقى على هذا الجهاز: إن حاول صاحبه إرسال استمارة ثانية يجد طلبه بضغطة.
        try {
          localStorage.setItem(FOLLOW_STORAGE_KEY, JSON.stringify({ url: j.followUrl.split("?")[0], at: Date.now() }));
        } catch {
          /* تخزين محجوب */
        }
        forget();
        router.push(j.followUrl);
        return;
      }
      if (res.status === 429 && j.reason === "contact") {
        setOpenRequest({ canResend: Boolean(j.canResend), followUrl: savedFollowUrl() });
        setSubmitError(j.message ?? "عندنا طلب مفتوح بنفس البيانات.");
      } else if (res.status === 422 && j.errors) {
        setServerErrors(j.errors);
        revealFirstError();
      } else {
        setSubmitError(j.message ?? "حدث خطأ أثناء الإرسال ولم يُرسل الطلب بعد. أبقوا الصفحة مفتوحة وأعيدوا المحاولة.");
      }
    } catch {
      setSubmitError("يبدو أن الاتصال بالإنترنت ضعيف، ولم يُرسل الطلب بعد. أبقوا الصفحة مفتوحة وأعيدوا المحاولة بعد قليل.");
    }
    setSending(false);
  };

  if (closedMessage) {
    return (
      <Shell state={state} online={online}>
        <div className="dash-card mx-auto mt-10 max-w-lg space-y-3 p-6 text-center">
          <h1 className="text-[22px] font-black text-ink">استقبال الطلبات متوقف مؤقتاً</h1>
          <p className="text-[14px] leading-7 text-ink-2">{closedMessage}</p>
          <ContactHelp whatsappUrl={whatsappUrl} />
        </div>
      </Shell>
    );
  }

  const golden = data.offer === "golden";
  const paymentValue: PaymentId[] = data.payment.methods;

  return (
    <Shell state={state} online={online}>
      <fieldset disabled={sending} className="m-0 mx-auto block min-w-0 max-w-2xl space-y-5 border-0 px-4 pb-52 pt-6 sm:pt-10">
        <motion.header initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
          {golden ? (
            <span className="inline-flex items-center gap-2 rounded-full border border-amber-300/30 bg-amber-300/10 px-3.5 py-1.5 text-[12.5px] font-black text-amber-200">
              <Sparkles className="size-3.5" aria-hidden="true" /> الدائرة الذهبية
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 rounded-full border border-nova/25 bg-nova/10 px-3.5 py-1.5 text-[12.5px] font-black text-nova-2">
              <Clock className="size-3.5" aria-hidden="true" /> التسليم {etaText} من وقت إرسال الطلب
            </span>
          )}
          <h1 className="text-[28px] font-black leading-tight tracking-tight text-ink sm:text-4xl">{golden ? "منتجاتك هنا، ومتجرك يبدأ" : "أخبرونا عن متجركم، ونحن نبنيه"}</h1>
          <p className="text-[15px] leading-8 text-ink-2">
            {golden
              ? `ضيف ${GOLDEN_SUGGESTED_PRODUCTS} منتجات، وأي كلام عن كل منتج (الاسم، الألوان، المقاسات، السعر) وصوره لو موجودة. الباقي كله على فريق Colapia، والتسليم ${etaText} من وقت الإرسال.`
              : "دقائق قليلة. يصمّم فريق Colapia متجركم ويبنيه ويراجعه قبل تسليمه. المطلوب: اسم المتجر ووسيلة تواصل والمنتجات وطريقة الدفع والتوصيل، والباقي اختياري أو يتولاه الفريق."}
          </p>
        </motion.header>

        {problem && problem.kind !== "submitted" ? (
          <div role="status" className="space-y-2 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-3 text-[13.5px] font-bold leading-6 text-amber-200">
            <p>{problem.message || "الاستمارة قيد التجهيز، لحظات وتكون جاهزة."}</p>
            {problem.kind === "closed" || problem.kind === "limited" ? <ContactHelp whatsappUrl={whatsappUrl} className="text-[13px]" /> : null}
          </div>
        ) : null}

        {golden ? (
          <GoldenCards data={data} set={set} errors={errors} urls={urls} setUrl={setUrl} ensureToken={ensureToken} onBusy={onBusy} />
        ) : (
          <>
        <Card n={1} icon={Store} title="متجرك">
          <Field label="اسم المتجر" htmlFor="store-name" error={errors["store.name"]} hint="يمكن تغييره لاحقاً.">
            <input
              id="store-name"
              value={data.store.name ?? ""}
              maxLength={60}
              autoComplete="organization"
              onChange={(e) => set((d) => ({ ...d, store: { ...d.store, name: e.target.value } }))}
              placeholder="مثلاً: نور للملابس"
              aria-invalid={Boolean(errors["store.name"])}
              className={cn(inputCls, "h-14 text-lg")}
            />
          </Field>
          <Field label="ماذا يبيع البراند؟ في سطر" htmlFor="store-line" optional>
            <input
              id="store-line"
              value={data.store.oneLine ?? ""}
              maxLength={200}
              onChange={(e) => set((d) => ({ ...d, store: { ...d.store, oneLine: e.target.value } }))}
              placeholder="مثال: تيشيرتات قطن مصري"
              className={inputCls}
            />
          </Field>
        </Card>

        <Card n={2} icon={MessageCircle} title="كيف نتواصل معكم؟" sub="وسيلة واحدة تكفي، والاثنتان أفضل.">
          <Field label="رقم واتساب" htmlFor="wa" error={errors["contact.whatsapp"]} hint="نراسلكم عليه إن احتجنا تفصيلة، ونرسل لكم المتجر.">
            <input
              id="wa"
              value={data.contact.whatsapp ?? ""}
              maxLength={30}
              inputMode="tel"
              autoComplete="tel"
              dir="ltr"
              onChange={(e) => set((d) => ({ ...d, contact: { ...d.contact, whatsapp: e.target.value } }))}
              placeholder="01012345678"
              aria-invalid={Boolean(errors["contact.whatsapp"])}
              className={cn(inputCls, "text-end font-mono")}
            />
          </Field>
          <Field label="البريد الإلكتروني" htmlFor="email" error={errors["contact.email"]} hint="يفضّل بريد Google: تدخلون به لوحة تحكم المتجر، ونرسل عليه تأكيد الطلب وأي تنبيه مهم.">
            <input
              id="email"
              type="email"
              value={data.contact.email ?? ""}
              maxLength={120}
              inputMode="email"
              autoComplete="email"
              dir="ltr"
              onChange={(e) => set((d) => ({ ...d, contact: { ...d.contact, email: e.target.value } }))}
              placeholder="you@gmail.com"
              aria-invalid={Boolean(errors["contact.email"])}
              className={cn(inputCls, "text-end")}
            />
          </Field>
        </Card>

        <Card n={3} icon={AtSign} title="صفحتك على إنستجرام أو فيسبوك" sub="إن كنتم تبيعون عبر صفحة، أضيفوا رابطها.">
          <Field label="رابط الصفحة أو اسم الحساب" htmlFor="social" error={errors["social.url"]} optional>
            <input
              id="social"
              value={data.social.url ?? ""}
              maxLength={300}
              dir="ltr"
              autoCapitalize="none"
              autoCorrect="off"
              onChange={(e) => set((d) => ({ ...d, social: { ...d.social, url: e.target.value } }))}
              placeholder="@mystore أو instagram.com/mystore"
              aria-invalid={Boolean(errors["social.url"])}
              className={cn(inputCls, "text-end")}
            />
          </Field>
        </Card>

        <Card
          n={4}
          icon={Palette}
          title="الشكل"
          sub="ألوان المتجر وشعاره."
          action={<TeamToggle on={data.colors.mode === "team"} ariaLabel="يختارها الفريق: الألوان" onChange={(v) => set((d) => ({ ...d, colors: v ? { mode: "team" } : {} }))} />}
        >
          {data.colors.mode !== "team" ? <ColorChoice data={data} update={set} error={errors["colors.mode"]} /> : <p className="text-[13.5px] leading-7 text-ink-2">تمام، يختار فريق التصميم ألواناً تناسب النشاط والعملاء.</p>}
          <div className="border-t border-edge/[0.07] pt-4">
            <p className="mb-3 text-[14px] font-black text-ink">
              الشعار <span className="text-[12px] font-bold text-ink-3">(اختياري)</span>
            </p>
            <LogoPicker data={data} update={set} urls={urls} setUrl={setUrl} ensureToken={ensureToken} onBusy={onBusy} />
          </div>
        </Card>

        <Card n={5} icon={Package} title="المنتجات" sub="اكتبوا عن كل منتج بما تعرفونه، وأضيفوا صوره إن وُجدت.">
          <ProductsEditor items={data.products.items} errors={errors} urls={urls} setUrl={setUrl} update={set} ensureToken={ensureToken} onBusy={onBusy} />
        </Card>

        <Card n={6} icon={Wallet} title="الدفع" sub="كيف يدفع العملاء؟ اختاروا كل الطرق التي تقبلونها.">
          <Field label="طرق الدفع" error={errors["payment.methods"]}>
            <Choice
              label="طرق الدفع"
              options={PAYMENT_OPTIONS}
              value={paymentValue}
              onToggle={(id) => set((d) => ({ ...d, payment: { ...d.payment, methods: d.payment.methods.includes(id) ? d.payment.methods.filter((m) => m !== id) : [...d.payment.methods, id] } }))}
            />
          </Field>
          {paymentValue.includes("wallet") ? (
            <Field label="رقم المحفظة اللي العملاء هيحوّلوا عليه" htmlFor="wallet-number" error={errors["payment.walletNumber"]} hint="فودافون كاش أو أي محفظة إلكترونية. الرقم هيظهر للعميل في صفحة الدفع.">
              <input
                id="wallet-number"
                value={data.payment.walletNumber ?? ""}
                maxLength={30}
                inputMode="tel"
                dir="ltr"
                onChange={(e) => set((d) => ({ ...d, payment: { ...d.payment, walletNumber: e.target.value } }))}
                placeholder="01012345678"
                aria-invalid={Boolean(errors["payment.walletNumber"])}
                className={cn(inputCls, "text-end font-mono")}
              />
            </Field>
          ) : null}
          {paymentValue.includes("instapay") ? (
            <Field label="إنستاباي: الرقم أو العنوان أو اسم الحساب" htmlFor="instapay-address" error={errors["payment.instapayAddress"]} hint="اللي العميل هيكتبه وهو بيحوّل، مثل name@instapay أو رقم موبايلك.">
              <input
                id="instapay-address"
                value={data.payment.instapayAddress ?? ""}
                maxLength={80}
                dir="ltr"
                autoCapitalize="none"
                autoCorrect="off"
                onChange={(e) => set((d) => ({ ...d, payment: { ...d.payment, instapayAddress: e.target.value } }))}
                placeholder="name@instapay"
                aria-invalid={Boolean(errors["payment.instapayAddress"])}
                className={cn(inputCls, "text-end")}
              />
            </Field>
          ) : null}
          {paymentValue.includes("cod") ? (
            <Field label="هل المعاينة وفتح الشحنة متاحين؟" error={errors["payment.inspection"]} hint="في الدفع عند الاستلام: هل العميل يقدر يفتح الشحنة ويعاينها قبل ما يدفع؟ هنكتبها في المتجر زي ما تقول.">
              <Choice
                label="المعاينة وفتح الشحنة"
                options={INSPECTION_OPTIONS}
                value={data.payment.inspection ? [data.payment.inspection] : []}
                onToggle={(id) => set((d) => ({ ...d, payment: { ...d.payment, inspection: d.payment.inspection === id ? undefined : id } }))}
              />
            </Field>
          ) : null}
        </Card>

        <Card n={7} icon={Truck} title="التوصيل والشحن" sub="يظهر نطاق التوصيل وسعر الشحن للعميل في المتجر كما تكتبونهما.">
          <Field label="نطاق التوصيل" error={errors["delivery.scope"]}>
            <Choice
              label="نطاق التوصيل"
              options={DELIVERY_OPTIONS}
              value={data.delivery.scope && data.delivery.scope !== "unsure" ? [data.delivery.scope] : []}
              onToggle={(id) => set((d) => ({ ...d, delivery: { ...d.delivery, scope: d.delivery.scope === id ? undefined : id } }))}
            />
          </Field>
          {data.delivery.scope === "custom" ? (
            <Field label="المحافظات" htmlFor="delivery-note" error={errors["delivery.note"]}>
              <input
                id="delivery-note"
                value={data.delivery.note ?? ""}
                maxLength={200}
                onChange={(e) => set((d) => ({ ...d, delivery: { ...d.delivery, note: e.target.value } }))}
                placeholder="مثلاً: القاهرة والجيزة والإسكندرية"
                aria-invalid={Boolean(errors["delivery.note"])}
                className={inputCls}
              />
            </Field>
          ) : null}
          <Field label="سعر الشحن" error={errors["delivery.fee"]}>
            <Choice
              label="سعر الشحن"
              options={FEE_OPTIONS}
              value={data.delivery.fee ? [data.delivery.fee] : []}
              onToggle={(id) => set((d) => ({ ...d, delivery: { ...d.delivery, fee: d.delivery.fee === id ? undefined : id } }))}
            />
          </Field>
          {data.delivery.fee === "flat" ? (
            <Field label="سعر الشحن بالجنيه" htmlFor="fee-amount" error={errors["delivery.feeAmount"]}>
              <input
                id="fee-amount"
                value={data.delivery.feeAmount ?? ""}
                inputMode="numeric"
                dir="ltr"
                maxLength={5}
                onChange={(e) => set((d) => ({ ...d, delivery: { ...d.delivery, feeAmount: Number(e.target.value.replace(/\D/g, "")) || undefined } }))}
                placeholder="60"
                aria-invalid={Boolean(errors["delivery.feeAmount"])}
                className={cn(inputCls, "text-end font-mono")}
              />
            </Field>
          ) : null}
          {data.delivery.fee === "varies" ? (
            <Field label="أسعار المحافظات" htmlFor="fee-note" optional hint="اكتبوها إن أمكن، وإلا نسألكم عنها على واتساب.">
              <input
                id="fee-note"
                value={data.delivery.feeNote ?? ""}
                maxLength={300}
                onChange={(e) => set((d) => ({ ...d, delivery: { ...d.delivery, feeNote: e.target.value } }))}
                placeholder="مثال: القاهرة 50، الإسكندرية 65، الصعيد 90"
                className={inputCls}
              />
            </Field>
          ) : null}
          <Field label="مدة التوصيل" htmlFor="eta" optional>
            <input
              id="eta"
              value={data.delivery.eta ?? ""}
              maxLength={60}
              onChange={(e) => set((d) => ({ ...d, delivery: { ...d.delivery, eta: e.target.value } }))}
              placeholder="مثلاً: من 2 إلى 4 أيام"
              className={inputCls}
            />
          </Field>
        </Card>

        <Card n={8} icon={RefreshCcw} title="الاستبدال والاسترجاع" sub="اختياري. إن تركتموه نسألكم عنه لاحقاً.">
          <Field label="سياسة المتجر">
            <Choice
              label="الاستبدال والاسترجاع"
              options={RETURN_OPTIONS}
              value={data.returns.mode ? [data.returns.mode] : []}
              onToggle={(id) => set((d) => ({ ...d, returns: d.returns.mode === id ? {} : { mode: id, days: id === "none" ? undefined : d.returns.days } }))}
            />
          </Field>
          {data.returns.mode === "full" || data.returns.mode === "exchange" ? (
            <Field label="المدة بالأيام من تاريخ الاستلام" htmlFor="return-days" error={errors["returns.days"]}>
              <input
                id="return-days"
                value={data.returns.days ?? ""}
                inputMode="numeric"
                dir="ltr"
                maxLength={2}
                onChange={(e) => set((d) => ({ ...d, returns: { ...d.returns, days: Number(e.target.value.replace(/\D/g, "")) || undefined } }))}
                placeholder="14"
                aria-invalid={Boolean(errors["returns.days"])}
                className={cn(inputCls, "text-end font-mono")}
              />
            </Field>
          ) : null}
        </Card>

        <Card
          n={9}
          icon={Globe}
          title="موقع يعجبكم شكله"
          sub="أي متجر أو موقع، حتى لو أجنبياً، يعجبكم أسلوبه."
          action={<TeamToggle on={data.inspiration.team} ariaLabel="يختارها الفريق: موقع الإلهام" onChange={(v) => set((d) => ({ ...d, inspiration: { url: v ? undefined : d.inspiration.url, team: v } }))} />}
        >
          {!data.inspiration.team ? (
            <Field label="رابط الموقع" htmlFor="insp" error={errors["inspiration.url"]} optional>
              <input
                id="insp"
                value={data.inspiration.url ?? ""}
                maxLength={300}
                dir="ltr"
                autoCapitalize="none"
                autoCorrect="off"
                onChange={(e) => set((d) => ({ ...d, inspiration: { ...d.inspiration, url: e.target.value } }))}
                placeholder="example.com"
                aria-invalid={Boolean(errors["inspiration.url"])}
                className={cn(inputCls, "text-end")}
              />
            </Field>
          ) : (
            <p className="text-[13.5px] leading-7 text-ink-2">تمام، يختار الفريق الاتجاه الأنسب لنشاطكم.</p>
          )}
        </Card>

        <Card n={10} icon={MessageSquare} title="اطلبوا بحرية" sub="صِفوا المتجر أو لوحة التحكم كما تتخيلونها، بلا حدود. كل ما تذكرونه ننفذه، وما لا تذكرونه نضيف عليه ما يخدم مبيعاتكم.">
          <Field label="طلبكم" htmlFor="notes" optional>
            <textarea
              id="notes"
              value={data.notes ?? ""}
              maxLength={8000}
              rows={8}
              onChange={(e) => set((d) => ({ ...d, notes: e.target.value }))}
              placeholder="الشكل، الإحساس، ميزات تريدونها في المتجر أو لوحة التحكم، أمثلة تعجبكم، عروض، أي فكرة…"
              className="w-full rounded-xl border border-edge/10 bg-edge/[0.04] p-3 text-[16px] leading-7 text-ink outline-none placeholder:text-ink-3/60 focus:border-nova focus:ring-2 focus:ring-nova/25 sm:text-[15px]"
            />
          </Field>
        </Card>

          </>
        )}

        {/* فخ للبرامج الآلية: لا يراه الإنسان ولا يصله بالتبويب. */}
        <div aria-hidden="true" className="pointer-events-none absolute -start-[9999px] h-0 w-0 overflow-hidden">
          <label>
            Leave this field empty
            <input ref={hp} type="text" name="hp_cf7x" tabIndex={-1} autoComplete="off" data-1p-ignore data-lpignore="true" data-form-type="other" defaultValue="" />
          </label>
        </div>

        <p className="text-center text-[12.5px] leading-6 text-ink-3">
          بإرسال الطلب تتم الموافقة على{" "}
          <Link href="/terms" className="font-bold text-ink-2 underline">
            الشروط
          </Link>{" "}
          و
          <Link href="/privacy" className="font-bold text-ink-2 underline">
            سياسة الخصوصية
          </Link>
          . الطلب مجاني ولا يلزم بأي دفع.
        </p>
      </fieldset>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-edge/[0.07] bg-space/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-2xl">
        {submitError || problem ? (
          <div role="alert" className="space-y-2 border-b border-rose-400/20 bg-rose-500/10 px-4 py-2 text-center text-[13px] font-bold text-rose-300">
            <p>{submitError ?? problem?.message}</p>
            {openRequest ? (
              <div className="flex flex-wrap items-center justify-center gap-2">
                {openRequest.followUrl ? (
                  <a href={openRequest.followUrl} className="inline-flex min-h-11 items-center rounded-xl bg-rose-500/20 px-4 font-black text-rose-100 underline">
                    افتح متابعة طلبك
                  </a>
                ) : null}
                {openRequest.canResend ? (
                  resend === "sent" ? (
                    <span className="text-[13px] font-bold text-emerald-300">إن وُجد طلب على بريدكم يصلكم الرابط خلال دقيقة (راجعوا الرسائل غير المرغوبة أيضاً).</span>
                  ) : (
                    <button type="button" onClick={() => void sendFollowLink()} disabled={resend === "sending"} className="inline-flex min-h-11 items-center rounded-xl bg-rose-500/20 px-4 font-black text-rose-100 underline disabled:opacity-60">
                      {resend === "sending" ? "بنرسل…" : "ابعتوا لي رابط المتابعة على بريدي"}
                    </button>
                  )
                ) : null}
              </div>
            ) : null}
            {!submitError && problem?.href ? (
              <a href={problem.href} className="inline-flex min-h-11 items-center rounded-xl bg-rose-500/20 px-4 font-black text-rose-100 underline">
                افتح متابعة طلبك
              </a>
            ) : null}
            {submitError || problem?.kind === "limited" || problem?.kind === "closed" ? <ContactHelp whatsappUrl={whatsappUrl} className="mx-auto text-[13px]" /> : null}
          </div>
        ) : null}
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2 text-[12px] font-bold text-ink-3">
              <span>{golden ? (done >= 1 ? "جاهز للإرسال" : `اكتمل ${Math.round(done * 100)}%`) : done >= 1 ? "كل الأسئلة متجاوب عليها" : `اتجاوب على ${Math.round(done * COMPLETION_STEPS)} من ${COMPLETION_STEPS}`}</span>
              <SaveBadge state={state} online={online} />
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-edge/[0.08]" aria-hidden="true">
              <motion.div className="h-full rounded-full bg-gradient-to-l from-nova to-aurora" animate={{ width: `${Math.max(4, done * 100)}%` }} />
            </div>
          </div>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={sending || uploading > 0}
            className="inline-flex min-h-12 shrink-0 items-center gap-2 rounded-2xl bg-gradient-to-l from-[#6f86ff] to-[#8fa8ff] px-5 text-[15px] font-black text-[#07091a] shadow-[0_0_30px_-8px_rgba(111,134,255,0.75)] transition active:scale-95 disabled:opacity-70"
          >
            {sending || uploading > 0 ? <Loader2 className="size-5 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Send className="size-5" aria-hidden="true" />}
            {sending ? "بنرسل…" : uploading > 0 ? "بنرفع الملفات…" : "إرسال الطلب"}
          </button>
        </div>
      </div>
    </Shell>
  );
}

function Shell({ children, state, online }: { children: React.ReactNode; state: "idle" | "saving" | "saved" | "error"; online: boolean }) {
  return (
    <div dir="rtl" className="dash dark dash-cosmos relative min-h-dvh text-ink">
      <div className="sticky top-0 z-20 border-b border-edge/[0.06] bg-space/70 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
          <ColapiaLogo size={28} priority />
          <span className="hidden sm:block">
            <SaveBadge state={state} online={online} />
          </span>
        </div>
      </div>
      {children}
    </div>
  );
}

/**
 * استمارة «الدائرة الذهبية» المصغّرة: البراند وحسابه، وسيلة تواصل، 5–6 منتجات حقيقية بصورة وسطر (اسم، ألوان/مقاسات،
 * سعر)، والموافقة على فيديو الإطلاق. نفس الحفظ التلقائي والإرسال والحماية، والفريق يكمّل الباقي.
 */
function GoldenCards({
  data,
  set,
  errors,
  urls,
  setUrl,
  ensureToken,
  onBusy,
}: {
  data: IntakeData;
  set: (fn: (d: IntakeData) => IntakeData) => void;
  errors: IntakeErrors;
  urls: Record<string, string>;
  setUrl: (k: string, u: string) => void;
  ensureToken: () => Promise<string | null>;
  onBusy: (delta: 1 | -1) => void;
}) {
  return (
    <>
      <Card n={1} icon={Store} title="البراند">
        <Field label="اسم البراند" htmlFor="store-name" error={errors["store.name"]}>
          <input
            id="store-name"
            value={data.store.name ?? ""}
            maxLength={60}
            autoComplete="organization"
            onChange={(e) => set((d) => ({ ...d, store: { ...d.store, name: e.target.value } }))}
            placeholder="مثلاً: نور"
            aria-invalid={Boolean(errors["store.name"])}
            className={cn(inputCls, "h-14 text-lg")}
          />
        </Field>
        <Field label="حساب إنستجرام" htmlFor="social" error={errors["social.url"]} optional>
          <input
            id="social"
            value={data.social.url ?? ""}
            maxLength={300}
            dir="ltr"
            autoCapitalize="none"
            autoCorrect="off"
            onChange={(e) => set((d) => ({ ...d, social: { ...d.social, url: e.target.value } }))}
            placeholder="@yourbrand"
            aria-invalid={Boolean(errors["social.url"])}
            className={cn(inputCls, "text-end")}
          />
        </Field>
      </Card>

      <Card n={2} icon={MessageCircle} title="كيف نتواصل معكم؟" sub="البريد هو مدخلكم إلى لوحة المتجر.">
        <Field label="البريد (يفضّل Gmail)" htmlFor="email" error={errors["contact.email"] ?? (data.contact.whatsapp?.trim() ? undefined : errors["contact.whatsapp"])}>
          <input
            id="email"
            type="email"
            value={data.contact.email ?? ""}
            maxLength={120}
            inputMode="email"
            autoComplete="email"
            dir="ltr"
            onChange={(e) => set((d) => ({ ...d, contact: { ...d.contact, email: e.target.value } }))}
            placeholder="you@gmail.com"
            aria-invalid={Boolean(errors["contact.email"] ?? (data.contact.whatsapp?.trim() ? undefined : errors["contact.whatsapp"]))}
            className={cn(inputCls, "text-end")}
          />
        </Field>
        <Field label="رقم واتساب" htmlFor="wa" error={data.contact.whatsapp?.trim() ? errors["contact.whatsapp"] : undefined} optional>
          <input
            id="wa"
            value={data.contact.whatsapp ?? ""}
            maxLength={30}
            inputMode="tel"
            autoComplete="tel"
            dir="ltr"
            onChange={(e) => set((d) => ({ ...d, contact: { ...d.contact, whatsapp: e.target.value } }))}
            placeholder="01012345678"
            aria-invalid={Boolean(data.contact.whatsapp?.trim() && errors["contact.whatsapp"])}
            className={cn(inputCls, "text-end font-mono")}
          />
        </Field>
      </Card>

      <Card n={3} icon={Package} title={`المنتجات (${GOLDEN_SUGGESTED_PRODUCTS} تكفي)`} sub="اكتبوا عن كل منتج: الاسم والألوان والمقاسات والسعر، وأضيفوا صوره إن وُجدت.">
        <ProductsEditor
          items={data.products.items}
          errors={errors}
          urls={urls}
          setUrl={setUrl}
          update={set}
          ensureToken={ensureToken}
          onBusy={onBusy}
          hint={`الأفضل ${GOLDEN_SUGGESTED_PRODUCTS} منتجات، و3 على الأقل.`}
          textPlaceholder="مثلاً: فستان كتان، أسود وبيج، مقاسات S M L، السعر 850"
        />
      </Card>

      <Card n={4} icon={Clapperboard} title="فيديو الإطلاق">
        <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-2xl border border-edge/10 bg-edge/[0.03] p-3">
          <input
            type="checkbox"
            checked={data.golden.videoConsent}
            onChange={(e) => set((d) => ({ ...d, golden: { ...d.golden, videoConsent: e.target.checked } }))}
            className="mt-1 size-5 accent-[#6f86ff]"
          />
          <span className="text-[14px] font-bold leading-6 text-ink">
            موافقة على تصوير فيديو قصير عن البراند
            <span className="block text-[12.5px] font-medium text-ink-3">دقيقة أو أقل من الموبايل. يراجعه فريقنا ويمنتجه، وننشره منشوراً مشتركاً معكم بعد جاهزية المتجر.</span>
          </span>
        </label>
        {errors["golden.video"] ? (
          <p role="alert" data-invalid="true" className="text-[13px] font-bold text-rose-300">
            {errors["golden.video"]}
          </p>
        ) : null}
        <Field label="ملاحظات" htmlFor="notes" optional>
          <textarea
            id="notes"
            value={data.notes ?? ""}
            maxLength={8000}
            rows={3}
            onChange={(e) => set((d) => ({ ...d, notes: e.target.value }))}
            placeholder="الشحن، الدفع عند الاستلام، ألوان البراند… أي تفصيلة مهمة."
            className="w-full rounded-xl border border-edge/10 bg-edge/[0.04] p-3 text-[16px] leading-7 text-ink outline-none placeholder:text-ink-3/60 focus:border-nova focus:ring-2 focus:ring-nova/25 sm:text-[15px]"
          />
        </Field>
      </Card>
    </>
  );
}
