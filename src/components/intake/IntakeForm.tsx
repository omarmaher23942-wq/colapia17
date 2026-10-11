"use client";

// IntakeForm.tsx — استمارة طلب المتجر: صفحة واحدة تُملأ في دقيقتين من الموبايل. الإلزامي اسم المتجر ووسيلة تواصل
// واحدة فقط، وكل سؤال تصميم فيه «سيبها للفريق». حفظ تلقائي من أول حرف، وزر الإرسال ظاهر دائماً في الشريط السفلي.
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { AtSign, Clock, Globe, Loader2, MessageCircle, Mic, Package, Palette, Send, Store, Truck } from "lucide-react";
import { ColapiaLogo } from "@/components/brand/ColapiaLogo";
import { completion, DELIVERY_OPTIONS, PAYMENT_OPTIONS, validateSubmission, type IntakeData, type IntakeErrors, type PaymentId, type ProductMode } from "@/intake/schema";
import { revealFirstError } from "@/lib/reveal-error";
import { cn } from "@/lib/utils";
import { Card, Choice, Field, SaveBadge, TeamToggle, inputCls } from "./ui";
import { DRAFT_STORAGE_KEY, useIntakeDraft } from "./useIntakeDraft";
import { PhotoLines } from "./PhotoLines";
import { ColorChoice, LogoPicker } from "./LogoAndColors";
import { VoiceNote } from "./VoiceNote";

/** أقل زمن بين إنشاء المسودة والإرسال (الخادم يعامل الأسرع كبرنامج آلي). */
const MIN_SUBMIT_MS = 9_000;

const PRODUCT_MODES: { id: ProductMode; label: string }[] = [
  { id: "list", label: "هضيف صور وسطر لكل منتج" },
  { id: "team", label: "الفريق يجمعها من صفحتي" },
  { id: "later", label: "هضيفها بنفسي بعدين" },
];

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
  const { data, update, state, online, problem, ensureToken, flush, forget, token } = useIntakeDraft(initial);
  const [urls, setUrls] = useState<Record<string, string>>(initialUrls);
  const setUrl = (k: string, u: string) => setUrls((m) => ({ ...m, [k]: u }));
  const [showErrors, setShowErrors] = useState(false);
  const [serverErrors, setServerErrors] = useState<IntakeErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
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
    update(fn);
  };

  const submit = async () => {
    setShowErrors(true);
    setSubmitError(null);
    const errs = validateSubmission(data);
    if (Object.keys(errs).length) {
      revealFirstError();
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
          body: JSON.stringify({ token: t, data, hp: hp.current?.value ?? "" }),
        });
      let res = await send();
      let j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; followUrl?: string; errors?: IntakeErrors; message?: string; retryAfterMs?: number };
      // الخادم يطلب ثواني إضافية (المسودة أُنشئت للتو): ننتظر ونعيد مرة واحدة.
      if (j.error === "too_fast" && typeof j.retryAfterMs === "number") {
        await new Promise((r) => setTimeout(r, Math.min(15_000, j.retryAfterMs ?? 0)));
        res = await send();
        j = (await res.json().catch(() => ({}))) as typeof j;
      }
      if (res.ok && j.ok && j.followUrl) {
        forget();
        router.push(j.followUrl);
        return;
      }
      if (res.status === 422 && j.errors) {
        setServerErrors(j.errors);
        revealFirstError();
      } else {
        setSubmitError(j.message ?? "حصل خطأ أثناء الإرسال. بياناتك محفوظة، جرّب تاني.");
      }
    } catch {
      setSubmitError("النت فيه مشكلة. بياناتك محفوظة، جرّب تاني بعد شوية.");
    }
    setSending(false);
  };

  if (closedMessage) {
    return (
      <Shell state={state} online={online}>
        <div className="dash-card mx-auto mt-10 max-w-lg space-y-3 p-6 text-center">
          <h1 className="text-[22px] font-black text-ink">استقبال الطلبات متوقف مؤقتاً</h1>
          <p className="text-[14px] leading-7 text-ink-2">{closedMessage}</p>
          {whatsappUrl ? (
            <a href={whatsappUrl} target="_blank" rel="noopener" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#25D366] px-5 text-[14px] font-black text-[#062b15]">
              <MessageCircle className="size-4" aria-hidden="true" /> كلّمنا على واتساب
            </a>
          ) : null}
        </div>
      </Shell>
    );
  }

  const paymentValue: PaymentId[] = data.payment.methods;
  const productMode = data.products.mode;

  return (
    <Shell state={state} online={online}>
      <div className="mx-auto max-w-2xl space-y-5 px-4 pb-40 pt-6 sm:pt-10">
        <motion.header initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-nova/25 bg-nova/10 px-3.5 py-1.5 text-[12.5px] font-black text-nova-2">
            <Clock className="size-3.5" aria-hidden="true" /> التسليم {etaText}
          </span>
          <h1 className="text-[28px] font-black leading-tight tracking-tight text-ink sm:text-4xl">احكيلنا عن متجرك، وإحنا نبنيه</h1>
          <p className="text-[15px] leading-8 text-ink-2">
            دقيقتين بس. فريق Colapia يصمم متجرك ويبنيه ويراجعه صفحةً صفحة قبل ما يوصلك. المطلوب اسم المتجر ووسيلة تواصل، والباقي اختياري أو «سيبها للفريق».
          </p>
        </motion.header>

        {problem && problem.kind !== "submitted" ? (
          <p role="status" className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-3 text-[13.5px] font-bold leading-6 text-amber-200">
            {problem.message || "الاستمارة بتتجهز، جرّب بعد قليل."}
          </p>
        ) : null}

        <Card n={1} icon={Store} title="متجرك">
          <Field label="اسم المتجر" htmlFor="store-name" error={errors["store.name"]} hint="حتى لو مبدئي، نقدر نغيّره بعدين.">
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
          <Field label="بتبيع إيه؟ في سطر" htmlFor="store-line" optional>
            <input
              id="store-line"
              value={data.store.oneLine ?? ""}
              maxLength={200}
              onChange={(e) => set((d) => ({ ...d, store: { ...d.store, oneLine: e.target.value } }))}
              placeholder="مثلاً: تيشيرتات قطن مصري للشباب"
              className={inputCls}
            />
          </Field>
        </Card>

        <Card n={2} icon={MessageCircle} title="نتواصل معاك إزاي؟" sub="واحدة منهم كفاية، والاتنين أحسن.">
          <Field label="رقم واتساب" htmlFor="wa" error={errors["contact.whatsapp"]} hint="هنكلمك عليه لو احتجنا تفصيلة، ونبعتلك متجرك.">
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
          <Field label="بريدك (Gmail)" htmlFor="email" error={errors["contact.email"]} hint="هيكون حساب دخولك للوحة تحكم متجرك.">
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

        <Card n={3} icon={AtSign} title="صفحتك على إنستجرام أو فيسبوك" sub="لو عندك صفحة بتبيع منها، ابعت رابطها.">
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
          <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-2xl border border-edge/10 bg-edge/[0.03] p-3">
            <input
              type="checkbox"
              checked={data.social.teamCollects}
              onChange={(e) =>
                set((d) => ({
                  ...d,
                  social: { ...d.social, teamCollects: e.target.checked },
                  products: { ...d.products, mode: e.target.checked ? "team" : d.products.mode === "team" ? undefined : d.products.mode },
                }))
              }
              className="mt-1 size-5 accent-[#6f86ff]"
            />
            <span className="text-[14px] font-bold leading-6 text-ink">
              خلّوا الفريق يجمع منتجاتي من الصفحة
              <span className="block text-[12.5px] font-medium text-ink-3">الصور والأسماء والأسعار، وأنت تراجعها قبل التسليم.</span>
            </span>
          </label>
        </Card>

        <Card
          n={4}
          icon={Palette}
          title="الشكل"
          sub="ألوان متجرك وشعارك."
          action={<TeamToggle on={data.colors.mode === "team"} onChange={(v) => set((d) => ({ ...d, colors: v ? { mode: "team" } : {} }))} />}
        >
          {data.colors.mode !== "team" ? <ColorChoice data={data} update={set} error={errors["colors.mode"]} /> : <p className="text-[13.5px] leading-7 text-ink-2">تمام، فريق التصميم هيختار ألوان تناسب نشاطك وزبونك.</p>}
          <div className="border-t border-edge/[0.07] pt-4">
            <p className="mb-3 text-[14px] font-black text-ink">
              الشعار <span className="text-[12px] font-bold text-ink-3">(اختياري)</span>
            </p>
            <LogoPicker data={data} update={set} urls={urls} setUrl={setUrl} ensureToken={ensureToken} />
          </div>
        </Card>

        <Card n={5} icon={Package} title="منتجاتك" sub="صورة وسطر لكل منتج يكفي، والفريق يرتب الباقي.">
          <Choice
            label="طريقة إضافة المنتجات"
            options={PRODUCT_MODES}
            value={productMode ? [productMode] : []}
            onToggle={(id) =>
              set((d) => {
                const mode = d.products.mode === id ? undefined : id;
                // «الفريق يجمعها من صفحتي» و«خلّوا الفريق يجمع منتجاتي» نفس الاختيار في مكانين.
                const teamCollects = mode === "team" ? true : d.products.mode === "team" ? false : d.social.teamCollects;
                return { ...d, products: { ...d.products, mode }, social: { ...d.social, teamCollects } };
              })
            }
          />
          {productMode === "list" ? (
            <PhotoLines items={data.products.items} urls={urls} setUrl={setUrl} update={set} ensureToken={ensureToken} />
          ) : productMode === "team" ? (
            <p className="text-[13.5px] leading-7 text-ink-2">الفريق هيجمع المنتجات من صفحتك{data.social.url ? "" : "؛ اكتب رابطها في الخطوة 3"}.</p>
          ) : productMode === "later" ? (
            <p className="text-[13.5px] leading-7 text-ink-2">تمام، هتضيفها من لوحة التحكم بعد التسليم، وهي سهلة جداً.</p>
          ) : null}
        </Card>

        <Card n={6} icon={Truck} title="الدفع والتوصيل">
          <Field label="عملاءك هيدفعوا إزاي؟">
            <div className="flex flex-wrap items-center gap-2">
              <Choice
                label="طرق الدفع"
                multi
                options={PAYMENT_OPTIONS}
                value={data.payment.unsure ? [] : paymentValue}
                onToggle={(id) =>
                  set((d) => ({ ...d, payment: { unsure: false, methods: d.payment.methods.includes(id) ? d.payment.methods.filter((m) => m !== id) : [...d.payment.methods, id] } }))
                }
              />
              <TeamToggle on={data.payment.unsure} onChange={(v) => set((d) => ({ ...d, payment: { methods: v ? [] : d.payment.methods, unsure: v } }))} label="مش متأكد" />
            </div>
          </Field>
          <Field label="بتوصّل فين؟">
            <Choice
              label="نطاق التوصيل"
              options={DELIVERY_OPTIONS}
              value={data.delivery.scope ? [data.delivery.scope] : []}
              onToggle={(id) => set((d) => ({ ...d, delivery: { ...d.delivery, scope: d.delivery.scope === id ? undefined : id } }))}
            />
          </Field>
          {data.delivery.scope === "custom" ? (
            <Field label="المحافظات أو أي تفصيلة" htmlFor="delivery-note" optional>
              <input
                id="delivery-note"
                value={data.delivery.note ?? ""}
                maxLength={200}
                onChange={(e) => set((d) => ({ ...d, delivery: { ...d.delivery, note: e.target.value } }))}
                placeholder="مثلاً: القاهرة والجيزة والإسكندرية، والشحن 60 جنيه"
                className={inputCls}
              />
            </Field>
          ) : null}
        </Card>

        <Card
          n={7}
          icon={Globe}
          title="موقع عاجبك شكله"
          sub="أي متجر أو موقع (حتى لو أجنبي) عايز روحه في متجرك."
          action={<TeamToggle on={data.inspiration.team} onChange={(v) => set((d) => ({ ...d, inspiration: { url: v ? undefined : d.inspiration.url, team: v } }))} />}
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
            <p className="text-[13.5px] leading-7 text-ink-2">تمام، الفريق هيختار الاتجاه الأنسب لنشاطك.</p>
          )}
        </Card>

        <Card n={8} icon={Mic} title="عايز تقول حاجة؟" sub="سجّل رسالة صوتية بدل الكتابة، أو اكتب أي تفصيلة تحبها.">
          <VoiceNote data={data} update={set} urls={urls} setUrl={setUrl} ensureToken={ensureToken} whatsappUrl={whatsappUrl} />
          <Field label="ملاحظات" htmlFor="notes" optional>
            <textarea
              id="notes"
              value={data.notes ?? ""}
              maxLength={2000}
              rows={4}
              onChange={(e) => set((d) => ({ ...d, notes: e.target.value }))}
              placeholder="أي حاجة عايز الفريق يعرفها: ستايل معين، ألوان مش بتحبها، عروض…"
              className="w-full rounded-xl border border-edge/10 bg-edge/[0.04] p-3 text-base leading-7 text-ink outline-none placeholder:text-ink-3/60 focus:border-nova focus:ring-2 focus:ring-nova/25 sm:text-[15px]"
            />
          </Field>
        </Card>

        {/* فخ للبرامج الآلية: لا يراه الإنسان ولا يصله بالتبويب. */}
        <div aria-hidden="true" className="pointer-events-none absolute -start-[9999px] h-0 w-0 overflow-hidden">
          <label>
            Website
            <input ref={hp} type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
          </label>
        </div>

        <p className="text-center text-[12.5px] leading-6 text-ink-3">
          بإرسال الطلب أنت موافق على{" "}
          <Link href="/terms" className="font-bold text-ink-2 underline">
            الشروط
          </Link>{" "}
          و
          <Link href="/privacy" className="font-bold text-ink-2 underline">
            سياسة الخصوصية
          </Link>
          . الطلب مجاني ولا يلزمك بأي دفع.
        </p>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-edge/[0.07] bg-space/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-2xl">
        {submitError ? (
          <p role="alert" className="border-b border-rose-400/20 bg-rose-500/10 px-4 py-2 text-center text-[13px] font-bold text-rose-300">
            {submitError}
          </p>
        ) : null}
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2 text-[12px] font-bold text-ink-3">
              <span>{done >= 1 ? "كل الأسئلة متجاوب عليها" : `اتجاوب على ${Math.round(done * 10)} من 10`}</span>
              <SaveBadge state={state} online={online} />
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-edge/[0.08]" aria-hidden="true">
              <motion.div className="h-full rounded-full bg-gradient-to-l from-nova to-aurora" animate={{ width: `${Math.max(4, done * 100)}%` }} />
            </div>
          </div>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={sending}
            className="inline-flex min-h-12 shrink-0 items-center gap-2 rounded-2xl bg-gradient-to-l from-[#6f86ff] to-[#8fa8ff] px-5 text-[15px] font-black text-[#07091a] shadow-[0_0_30px_-8px_rgba(111,134,255,0.75)] transition active:scale-95 disabled:opacity-70"
          >
            {sending ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : <Send className="size-5" aria-hidden="true" />}
            {sending ? "بنرسل…" : "ابعت الطلب"}
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
