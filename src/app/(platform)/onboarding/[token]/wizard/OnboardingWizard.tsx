"use client";

// OnboardingWizard — استمارة بناء المتجر في 5 محطات قصيرة، كل محطة شاشة واحدة واضحة:
//   1) الهوية  2) المنتجات (بالمقاسات والألوان)  3) الشحن (لكل محافظة)  4) الدفع والضمان  5) الشكل والمميزات.
// كل شيء له قيمة افتراضية مضبوطة على السوق المصري، فيكفي التاجر أن يكتب اسم متجره ومنتجاته.
// الحفظ تلقائي (useOnboardingForm)، والمعاينة الحية على اليسار تتحدث مع كل تعديل.
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { Sparkles, Package, Truck, ShieldCheck, Palette, ArrowLeft, ArrowRight, Check, Loader2, Rocket, Eye, X, AlertCircle } from "lucide-react";
import { revealFirstError } from "@/lib/reveal-error";
import { cn } from "@/lib/utils";
import { ColapiaLogo } from "@/components/brand/ColapiaLogo";
import type { OnboardingProduct, OnboardingSection, StepId as FormStep } from "@/onboarding/schema";
import { useOnboardingForm, normalizeProductsStep } from "../useOnboardingForm";
import { ImportLibraryDialog } from "../components/ImportLibraryDialog";
import { PhonePreview } from "./PhonePreview";
import { SaveBadge } from "./ui";
import { StepIdentity } from "./StepIdentity";
import { StepProducts } from "./StepProducts";
import { StepShipping } from "./StepShipping";
import { StepPolicies } from "./StepPolicies";
import { StepLook } from "./StepLook";
import { normalizeLaunch, normalizeProduct, validateStep, type LaunchValue, type StepId, type StoreValue } from "./model";

type Props = { token: string; draft: Record<string, unknown>; draftVersion: number; lastStep: string | null; expiresAt: string };

const STEPS: { id: StepId; title: string; icon: typeof Sparkles }[] = [
  { id: "identity", title: "الهوية", icon: Sparkles },
  { id: "products", title: "المنتجات", icon: Package },
  { id: "shipping", title: "الشحن", icon: Truck },
  { id: "policies", title: "الدفع والضمان", icon: ShieldCheck },
  { id: "look", title: "الشكل", icon: Palette },
];

// خطوات الحفظ في المسودة (مخطط الخادم) لكل محطة.
const FORM_STEP: Record<StepId, FormStep> = { identity: "store", products: "products", shipping: "launch", policies: "launch", look: "launch" };
const STEP_KEY = (token: string) => `clp-onb-step:${token}`;

export function OnboardingWizard(props: Props) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const form = useOnboardingForm(props);
  const { data, patch } = form;

  const [step, setStep] = useState<StepId>("identity");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const stepIndex = STEPS.findIndex((s) => s.id === step);

  // استئناف من آخر محطة فتحها التاجر.
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STEP_KEY(props.token)) as StepId | null;
      if (saved && STEPS.some((s) => s.id === saved)) setStep(saved);
      else if (props.lastStep === "products") setStep("products");
      else if (props.lastStep === "launch") setStep("shipping");
    } catch {
      /* التخزين غير متاح */
    }
  }, [props.token, props.lastStep]);

  const store = (data.store ?? {}) as StoreValue;
  const productsStep = normalizeProductsStep(data.products);
  const products = useMemo(() => (productsStep.products as Partial<OnboardingProduct>[]).map(normalizeProduct), [productsStep.products]);
  const sections = productsStep.sections as OnboardingSection[];
  const launch = useMemo(() => normalizeLaunch(data.launch as Partial<LaunchValue> | undefined), [data.launch]);

  const setStore = (p: Partial<StoreValue>) => patch("store", { ...store, ...p });
  const setProducts = (next: OnboardingProduct[]) => patch("products", { ...productsStep, products: next });
  const setSections = (next: OnboardingSection[]) => patch("products", { ...productsStep, sections: next });
  const setLaunch = (p: Partial<LaunchValue>) => patch("launch", normalizeLaunch({ ...launch, ...p }));

  // مسودة قديمة أو جديدة: احفظ قيم الإطلاق المكتملة مرة واحدة حتى يُرسل كائن صالح دائماً.
  useEffect(() => {
    if (step !== "identity" && !data.launch) patch("launch", launch);
  }, [step, data.launch, launch, patch]);

  const errorsFor = (s: StepId) => validateStep(s, store, products, launch);
  const errorCount = Object.keys(errors).length;

  // بعد ظهور الأخطاء نعيد التحقق مع كل تعديل: تختفي الرسالة فور تصحيح الحقل، ولا تبقى أخطاء قديمة معلّقة.
  useEffect(() => {
    if (!errorCount) return;
    const next = validateStep(step, store, products, launch);
    if (JSON.stringify(next) !== JSON.stringify(errors)) setErrors(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, products, launch, step]);

  /** يعرض الأخطاء ويأخذ التاجر إلى أولها: لا يوجد ضغط على «التالي» بلا نتيجة ظاهرة. */
  function blockWith(e: Record<string, string>, at: StepId) {
    setErrors(e);
    if (at !== step) {
      setStep(at);
      form.jumpTo(FORM_STEP[at]);
    }
    revealFirstError();
  }

  function go(to: StepId) {
    const idx = STEPS.findIndex((s) => s.id === to);
    if (idx > stepIndex) {
      for (const s of STEPS.slice(0, idx)) {
        const e = errorsFor(s.id);
        if (Object.keys(e).length) return blockWith(e, s.id);
      }
    }
    setErrors({});
    setStep(to);
    form.jumpTo(FORM_STEP[to]);
    try {
      sessionStorage.setItem(STEP_KEY(props.token), to);
    } catch {
      /* التخزين غير متاح */
    }
  }

  async function build() {
    for (const s of STEPS) {
      const e = errorsFor(s.id);
      if (Object.keys(e).length) return blockWith(e, s.id);
    }
    patch("launch", launch);
    const ok = await form.submit();
    if (ok) router.refresh();
  }

  const colors = !launch.autoTheme ? (launch.colorPreference?.match(/#[0-9a-f]{6}/gi) ?? undefined) : undefined;
  const preview = {
    name: store.storeName?.trim() || "متجرك",
    subdomain: store.desiredSubdomain || "mystore",
    logo: store.logo?.url,
    industry: store.industry ?? "other",
    products: products.slice(0, 4).map((p) => ({
      name: p.name || "منتج جديد",
      price: Number(p.priceEgp) || 0,
      compareAt: Number(p.compareAtEgp) || 0,
      image: (p.images.find((i) => i.id === p.primaryImageId) ?? p.images[0])?.url,
    })),
    // نفس وعود المتجر الحقيقية: ما يختاره التاجر فقط يظهر في المعاينة.
    claims: [
      launch.codEnabled ? "الدفع عند الاستلام" : null,
      launch.inspectionAllowed ? "معاينة قبل الدفع" : null,
      launch.shippingMode === "free" ? "شحن مجاني" : launch.freeOverEgp ? `شحن مجاني فوق ${launch.freeOverEgp} ج` : null,
      launch.returnDays > 0 && (launch.allowExchange || launch.allowRefund) ? `${launch.allowExchange ? "استبدال" : "استرجاع"} ${launch.returnDays} يوم` : null,
    ].filter((c): c is string => Boolean(c)),
    colors,
  } as const;

  return (
    <div dir="rtl" className="dash dark dash-cosmos min-h-dvh text-ink">
      <header className="sticky top-0 z-30 border-b border-edge/[0.07] bg-space/70 backdrop-blur-2xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
          <ColapiaLogo className="h-7 w-auto shrink-0" />
          <ol className="hidden items-center gap-1 md:flex" aria-label="خطوات بناء المتجر">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const done = i < stepIndex;
              const active = i === stepIndex;
              return (
                <li key={s.id} className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => go(s.id)}
                    aria-current={active ? "step" : undefined}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[12px] font-black transition",
                      active ? "bg-nova/15 text-ink ring-1 ring-nova/40" : done ? "text-ink-2 hover:bg-edge/[0.05]" : "text-ink-3 hover:bg-edge/[0.04]"
                    )}
                  >
                    <span className={cn("grid size-6 place-items-center rounded-full", done ? "bg-emerald-400 text-space" : active ? "bg-gradient-to-br from-nova to-aurora text-white" : "bg-edge/[0.06]")}>
                      {done ? <Check className="size-3.5" strokeWidth={3} /> : <Icon className="size-3.5" />}
                    </span>
                    {s.title}
                  </button>
                  {i < STEPS.length - 1 ? <span className="h-px w-4 bg-edge/15" aria-hidden="true" /> : null}
                </li>
              );
            })}
          </ol>
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-black text-ink-2 md:hidden">
              {stepIndex + 1}/{STEPS.length} · {STEPS[stepIndex]!.title}
            </span>
            <SaveBadge state={form.saveState} online={form.online} />
          </div>
        </div>
        <div className="h-0.5 bg-edge/[0.05] md:hidden">
          <motion.div className="h-full bg-gradient-to-l from-nova to-aurora" animate={{ width: `${((stepIndex + 1) / STEPS.length) * 100}%` }} />
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-6 pb-28 lg:grid-cols-[1fr_340px] lg:py-10">
        <main className="min-w-0" id="onboarding-main">
          {/* حركة دخول فقط: لا ننتظر انتهاء حركة خروج المحطة السابقة، فالتنقل فوري دائماً. */}
          <motion.div
            key={step}
            initial={reduce ? false : { opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
          >
              {step === "identity" ? (
                <StepIdentity token={props.token} store={store} setStore={setStore} errors={errors} />
              ) : step === "products" ? (
                <StepProducts
                  token={props.token}
                  industry={store.industry}
                  sections={sections}
                  products={products}
                  setProducts={setProducts}
                  setSections={setSections}
                  errors={errors}
                  onOpenLibrary={() => setLibraryOpen(true)}
                />
              ) : step === "shipping" ? (
                <StepShipping launch={launch} setLaunch={setLaunch} errors={errors} />
              ) : step === "policies" ? (
                <StepPolicies store={store} launch={launch} setLaunch={setLaunch} errors={errors} />
              ) : (
                <StepLook token={props.token} store={store} products={products} launch={launch} setLaunch={setLaunch} onEdit={go} />
              )}
          </motion.div>

          {form.submitError ? (
            <p role="alert" className="mt-6 rounded-xl bg-rose-400/10 px-4 py-3 text-[13px] font-bold text-rose-400">
              {form.submitError}
            </p>
          ) : null}
        </main>

        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-3">
            <p className="text-center text-[11px] font-black text-ink-3">معاينة حية لمتجرك</p>
            <PhonePreview {...preview} />
          </div>
        </aside>
      </div>

      {/* شريط التنقل ثابت أسفل الشاشة: في متناول الإبهام على الموبايل. */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-edge/[0.07] bg-space/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-2xl">
        {errorCount ? (
          <div role="alert" className="border-b border-rose-400/20 bg-rose-500/10">
            <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2">
              <AlertCircle className="size-4 shrink-0 text-rose-400" aria-hidden="true" />
              <p className="line-clamp-2 min-w-0 flex-1 text-[12.5px] font-bold leading-5 text-rose-300">
                {errorCount > 1 ? `${errorCount} أشياء تحتاج تعديلاً قبل المتابعة: ` : "قبل المتابعة: "}
                {Object.values(errors)[0]}
              </p>
              <button type="button" onClick={() => revealFirstError()} className="shrink-0 rounded-lg bg-rose-400/15 px-3 py-1.5 text-[12px] font-black text-rose-200 transition hover:bg-rose-400/25">
                أرني
              </button>
            </div>
          </div>
        ) : null}
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-3">
          {stepIndex > 0 ? (
            <button
              type="button"
              onClick={() => go(STEPS[stepIndex - 1]!.id)}
              className="inline-flex h-12 items-center gap-2 rounded-2xl border border-edge/10 bg-edge/[0.03] px-4 text-sm font-bold text-ink-2 transition hover:bg-edge/[0.06]"
            >
              <ArrowRight className="size-4" aria-hidden="true" />
              <span className="hidden sm:inline">السابق</span>
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            className="inline-flex h-12 items-center gap-2 rounded-2xl border border-edge/10 px-4 text-sm font-bold text-ink-2 lg:hidden"
          >
            <Eye className="size-4" /> معاينة
          </button>
          <span className="flex-1" />
          {step !== "look" ? (
            <button
              type="button"
              onClick={() => go(STEPS[stepIndex + 1]!.id)}
              className="inline-flex h-12 items-center gap-2 rounded-2xl bg-gradient-to-b from-nova to-nova-deep px-7 text-sm font-black text-white shadow-xl shadow-nova/30 transition hover:brightness-110"
            >
              التالي <ArrowLeft className="size-4" aria-hidden="true" />
            </button>
          ) : (
            <button
              type="button"
              onClick={build}
              disabled={form.submitting}
              className="inline-flex h-12 items-center gap-2 rounded-2xl bg-gradient-to-l from-nova via-aurora to-nova bg-[length:200%_100%] px-6 text-sm font-black text-white shadow-2xl shadow-nova/40 transition-[background-position] duration-700 hover:bg-[position:100%_0] disabled:opacity-60 sm:px-8 sm:text-base"
            >
              {form.submitting ? <Loader2 className="size-5 animate-spin" /> : <Rocket className="size-5" aria-hidden="true" />}
              {form.submitting ? "نبدأ البناء..." : "ابنِ متجري الآن"}
            </button>
          )}
        </div>
      </nav>

      <AnimatePresence>
        {previewOpen ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm lg:hidden"
            onClick={() => setPreviewOpen(false)}
            role="dialog"
            aria-label="معاينة المتجر"
          >
            <div onClick={(e) => e.stopPropagation()} className="relative">
              <button type="button" onClick={() => setPreviewOpen(false)} aria-label="إغلاق المعاينة" className="absolute -top-3 end-0 z-10 grid size-9 place-items-center rounded-full bg-white text-black shadow-lg">
                <X className="size-4" />
              </button>
              <PhonePreview {...preview} />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <ImportLibraryDialog
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        industry={store.industry}
        sections={sections}
        onImport={(picked) => {
          setProducts([...products, ...picked].slice(0, 50));
          setLibraryOpen(false);
        }}
      />
    </div>
  );
}
