"use client";

// OnboardingApp — «إعداد المتجر» بملء الشاشة: خطوات بجانب، المحتوى في الوسط، ومعاينة حية لمتجر التاجر عند الحافة (ورقة على الجوال).
// كل خطوة تحفظ فوراً في بيانات المتجر الحقيقية، والتقدم محفوظ فيستأنف التاجر من حيث توقف. بلا ذكر لأي تقنية.
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, Check, CheckCircle2, Loader2 } from "lucide-react";
import { saveProgressAction } from "@/server/actions/setup";
import { nextStep, prevStep, progressPercent, STEPS, type SetupData, type StepId } from "@/lib/onboarding";
import { cn } from "@/lib/utils";
import { IdentityForm } from "./IdentityForm";
import { LookPanel } from "./LookPanel";
import { PreviewPane, PreviewSheet } from "./PreviewPane";
import { StepPayment, StepReturns, StepShipping } from "./StepsCommerce";
import { StepContact, StepDiscount } from "./StepsMisc";
import { StepProducts } from "./StepProducts";
import { StepPublish } from "./StepPublish";
import { ThemeSection } from "./ThemeSection";
import { btnGhost, btnPrimary, StepHeader } from "./ui";

type Save = "idle" | "saving" | "saved" | "failed";

export function OnboardingApp({ data }: { data: SetupData }) {
  const [step, setStep] = useState<StepId>(data.onboarding.step);
  const [done, setDone] = useState<StepId[]>(data.onboarding.done);
  const [version, setVersion] = useState(1);
  const [save, setSave] = useState<Save>("idle");
  const [products, setProducts] = useState(data.products);
  const [name, setName] = useState(data.identity.name);
  const main = useRef<HTMLDivElement>(null);
  const first = useRef(true);

  const info = STEPS.find((s) => s.id === step)!;
  const index = STEPS.findIndex((s) => s.id === step) + 1;
  const pct = progressPercent(done);

  const refreshPreview = useCallback(() => setVersion((v) => v + 1), []);

  // التركيز على بداية الخطوة عند الانتقال (قارئ الشاشة ولوحة المفاتيح)، وبلا تمرير مفاجئ عند الفتح الأول.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    main.current?.focus({ preventScroll: true });
    main.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [step]);

  // حفظ التقدم على التوالي: نقرات سريعة متتالية كانت تصل للخادم بترتيب غير مضمون فيُحفظ آخر ما وصل لا آخر ما اختير.
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const pending = useRef(0);
  const persist = useCallback((to: StepId, markDone?: StepId) => {
    pending.current += 1;
    setSave("saving");
    queue.current = queue.current.then(async () => {
      let ok = false;
      try {
        ok = (await saveProgressAction({ step: to, markDone })).ok;
      } catch {
        ok = false;
      }
      pending.current -= 1;
      if (pending.current === 0) setSave(ok ? "saved" : "failed");
    });
  }, []);

  const go = useCallback(
    (to: StepId, markDone?: StepId) => {
      setStep(to);
      if (markDone) setDone((d) => (d.includes(markDone) ? d : [...d, markDone]));
      persist(to, markDone);
    },
    [persist]
  );

  const advance = useCallback(
    (from: StepId) => {
      refreshPreview();
      go(nextStep(from), from);
    },
    [go, refreshPreview]
  );
  const back = useCallback((from: StepId) => go(prevStep(from)), [go]);

  return (
    <div dir="rtl" className="fixed inset-0 flex flex-col bg-space text-ink">
      <a href="#step-main" className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-nova focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-white">
        تخطي إلى المحتوى
      </a>

      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-edge/10 bg-space-2/80 px-4 backdrop-blur sm:px-6">
        <span className="text-[15px] font-black tracking-tight text-ink">Colapia</span>
        <span aria-hidden="true" className="h-4 w-px bg-edge/20" />
        <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-ink-2">{name || "متجركم"}</span>
        <div className="hidden w-48 items-center gap-2 sm:flex" role="progressbar" aria-label="تقدم الإعداد" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-edge/10">
            <div className="h-full rounded-full bg-nova transition-[width] duration-500" style={{ width: `${Math.max(4, pct)}%` }} />
          </div>
          <span className="w-9 text-[12px] font-black tabular-nums text-ink-2">{pct}%</span>
        </div>
        <span className="flex items-center gap-1.5 text-[12px] font-bold text-ink-3" role="status" aria-live="polite">
          {save === "saving" ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : save === "failed" ? <AlertCircle className="size-4 text-warn" aria-hidden="true" /> : <CheckCircle2 className="size-4 text-ok" aria-hidden="true" />}
          <span className={cn(save === "failed" ? "text-warn" : "hidden sm:inline")}>{save === "saving" ? "جارٍ الحفظ…" : save === "failed" ? "تعذر حفظ التقدم" : "حفظ تلقائي"}</span>
        </span>
      </header>

      {/* الخطوات على الجوال: شريط أفقي */}
      <nav aria-label="خطوات الإعداد" className="flex shrink-0 gap-1.5 overflow-x-auto border-b border-edge/10 px-3 py-2 lg:hidden">
        {STEPS.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => go(s.id)}
            aria-current={step === s.id ? "step" : undefined}
            className={cn("inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-[12px] font-bold transition", step === s.id ? "bg-nova text-white dark:text-space" : done.includes(s.id) ? "bg-ok/12 text-ok" : "bg-edge/[0.06] text-ink-3")}
          >
            {done.includes(s.id) && step !== s.id ? <Check className="size-3.5" strokeWidth={3} aria-hidden="true" /> : <span className="tabular-nums">{i + 1}</span>}
            {s.short}
          </button>
        ))}
      </nav>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[230px_minmax(0,1fr)_minmax(380px,34%)]">
        <nav aria-label="خطوات الإعداد" className="hidden overflow-y-auto border-e border-edge/10 p-4 lg:block">
          <ol className="space-y-1">
            {STEPS.map((s, i) => {
              const cur = step === s.id;
              const ok = done.includes(s.id);
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => go(s.id)}
                    aria-current={cur ? "step" : undefined}
                    className={cn("flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-start text-[13px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova/50", cur ? "bg-nova/12 text-ink" : "text-ink-2 hover:bg-edge/5")}
                  >
                    <span className={cn("grid size-7 shrink-0 place-items-center rounded-full text-[12px] font-black tabular-nums", cur ? "bg-nova text-white dark:text-space" : ok ? "bg-ok/15 text-ok" : "bg-edge/[0.07] text-ink-3")}>
                      {ok && !cur ? <Check className="size-3.5" strokeWidth={3} aria-hidden="true" /> : i + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{s.short}</span>
                    {s.optional ? <span className="text-[10.5px] font-normal text-ink-3">اختياري</span> : null}
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        <main className="min-h-0 overflow-y-auto">
          <div id="step-main" ref={main} tabIndex={-1} className="mx-auto w-full max-w-3xl px-4 py-6 pb-28 outline-none sm:px-8 sm:py-9 lg:pb-12">
            <StepHeader index={index} total={STEPS.length} title={info.title} why={info.why} />
            <div key={step} className="motion-safe:animate-[step-in_.28s_ease-out]">
              {step === "identity" ? (
                <IdentityForm
                  initial={data.identity}
                  onLogoSaved={refreshPreview}
                  onChange={(v) => setName(v.name)}
                  onSaved={(v) => {
                    setName(v.name);
                    advance("identity");
                  }}
                />
              ) : null}

              {step === "products" ? (
                <StepProducts
                  data={products}
                  niche={data.niche}
                  draftKey={`clp-import:${data.store.id}`}
                  dmImages={data.onboarding.dmImages}
                  onCommitted={(s) => {
                    setProducts((p) => ({ ...p, total: p.total + s.active + s.drafts, active: p.active + s.active, drafts: p.drafts + s.drafts }));
                    refreshPreview();
                  }}
                  onNext={() => advance("products")}
                  onBack={() => back("products")}
                />
              ) : null}

              {step === "payment" ? <StepPayment data={data.payments} onSaved={() => advance("payment")} onBack={() => back("payment")} /> : null}
              {step === "shipping" ? <StepShipping data={data.shipping} onSaved={() => advance("shipping")} onBack={() => back("shipping")} /> : null}
              {step === "returns" ? <StepReturns data={data.returns} onSaved={() => advance("returns")} onBack={() => back("returns")} /> : null}
              {step === "contact" ? <StepContact data={data.contact} onSaved={() => advance("contact")} onBack={() => back("contact")} /> : null}
              {step === "discount" ? <StepDiscount existing={data.discounts} onSaved={() => advance("discount")} onSkip={() => advance("discount")} onBack={() => back("discount")} /> : null}

              {step === "look" ? (
                <div className="space-y-6">
                  <ThemeSection initial={data.look.themeId} onChanged={refreshPreview} />
                  <div className="border-t border-edge/10 pt-6">
                    <LookPanel initialHero={data.look.heroKind} heroVideoUrl={data.look.videoUrl} onChanged={refreshPreview} />
                  </div>
                  <div className="flex flex-wrap gap-2 border-t border-edge/10 pt-5">
                    <button type="button" className={btnPrimary} onClick={() => advance("look")}>
                      متابعة
                    </button>
                    <button type="button" className={btnGhost} onClick={() => back("look")}>
                      رجوع
                    </button>
                  </div>
                </div>
              ) : null}

              {step === "publish" ? <StepPublish initial={data.readiness.items} inspection={data.payments.inspection} onBack={() => back("publish")} onGoto={(s) => go(s)} onPublished={() => setDone((d) => [...new Set([...d, "publish" as StepId])])} /> : null}
            </div>
          </div>
        </main>

        <PreviewPane version={version} onRefresh={refreshPreview} />
      </div>
      <PreviewSheet version={version} />
      <style>{`@keyframes step-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}`}</style>
    </div>
  );
}
