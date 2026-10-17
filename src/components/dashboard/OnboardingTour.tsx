"use client";

// OnboardingTour — جولة من 4 خطوات تعرّف التاجر الجديد بأهم ما في لوحته. تظهر وحدها في أول أسبوع
// (مرة واحدة، وتُحفظ في كوكي)، ويعيد فتحها أي وقت أمر «جولة سريعة في اللوحة» في لوحة الأوامر.
import { useCallback, useEffect, useRef, useState } from "react";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  BarChart3,
  X,
  ArrowLeft,
  ArrowRight,
  Check,
  Sparkles,
} from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";

const SW = 1.75;

type Step = {
  icon: typeof LayoutDashboard;
  title: string;
  description: string;
};

const STEPS: Step[] = [
  {
    icon: LayoutDashboard,
    title: "ابدؤوا من الرئيسية",
    description: "«مهام اليوم» تجمع ما ينتظر قراركم الآن، وتحتها هدف الشهر ووتيرة مبيعاتكم الفعلية وصافي الربح بعد الإعلانات.",
  },
  {
    icon: ShoppingCart,
    title: "الطلبات من التأكيد إلى الشحن",
    description: "أكّدوا الطلب، ثم جهّزوه من «التجهيز» بقائمة مجمّعة بالمقاس، وصدّروه لشركة الشحن من «الشحن» مع ملصقات جاهزة للطباعة وتتبع للتحصيل.",
  },
  {
    icon: Package,
    title: "منتجات بلا عناء",
    description: "عدّلوا أسعار ومخزون عدة منتجات معاً من «تعديل جماعي»، واستوردوا منتجاتكم، وأجيبوا أسئلة الزوار لتظهر تحت المنتج.",
  },
  {
    icon: Sparkles,
    title: "محتوى وتسويق جاهز",
    description: "«استوديو المحتوى» يكتب لكم تعليقات وستوري وتقويماً أسبوعياً من منتجاتكم الفعلية، و«الحملات والتتبع» تقيس من أين يأتي كل طلب.",
  },
  {
    icon: BarChart3,
    title: "الاستخدام والاشتراك",
    description: "تابعوا حدود الاستخدام الشهرية من «الاستخدام»، وجدّدوا الاشتراك من «الاشتراك» قبل انتهائه. على الموبايل استخدموا الشريط السفلي وزر «طلب من الشات» العائم.",
  },
];

const COOKIE_NAME = "clp_tour_v3_seen";

export function OnboardingTour({ autoOpen }: { autoOpen: boolean }) {
  const [open, setOpen] = useState(autoOpen);
  const [step, setStep] = useState(0);
  const reduce = useReducedMotion();
  // السحب الأفقي على الموبايل: يسار = التالي، يمين = السابق (الواجهة من اليمين لليسار).
  const touchX = useRef<number | null>(null);

  // نصغي لحدث إعادة الفتح من Command Palette.
  useEffect(() => {
    const handler = () => {
      setStep(0);
      setOpen(true);
    };
    window.addEventListener("clp:reopen-tour", handler);
    return () => window.removeEventListener("clp:reopen-tour", handler);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    // نحفظ الكوكي لسنة كاملة.
    document.cookie = `${COOKIE_NAME}=1; max-age=${365 * 24 * 3600}; path=/; samesite=lax`;
  }, []);

  // Esc → close.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") setStep((s) => Math.min(STEPS.length - 1, s + 1));
      if (e.key === "ArrowRight") setStep((s) => Math.max(0, s - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  if (!open) return null;

  const current = STEPS[step]!;
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: reduce ? 0 : 0.2 }}
        className="fixed inset-0 z-[95] grid place-items-center bg-black/75 p-4 backdrop-blur-sm"
        onClick={close}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
      >
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduce ? undefined : { opacity: 0, y: 16, scale: 0.97 }}
          transition={{ duration: reduce ? 0 : 0.24, ease: [0.22, 1, 0.36, 1] }}
          onClick={(e) => e.stopPropagation()}
          onTouchStart={(e) => {
            touchX.current = e.touches[0]?.clientX ?? null;
          }}
          onTouchEnd={(e) => {
            const x0 = touchX.current;
            touchX.current = null;
            const dx = x0 === null ? 0 : (e.changedTouches[0]?.clientX ?? x0) - x0;
            if (Math.abs(dx) < 50) return;
            setStep((st) => (dx < 0 ? Math.min(STEPS.length - 1, st + 1) : Math.max(0, st - 1)));
          }}
          className="relative w-full max-w-md overflow-hidden rounded-3xl border border-edge/10 bg-space-2 shadow-2xl"
          dir="rtl"
        >
          {/* توهج خلفي */}
          <div
            aria-hidden
            className="pointer-events-none absolute -top-24 start-1/2 size-64 -translate-x-1/2 rounded-full bg-nova/15 blur-3xl"
          />

          {/* Skip */}
          <button
            type="button"
            onClick={close}
            aria-label="تخطي الجولة"
            className="absolute end-4 top-4 z-10 rounded-lg p-2 text-ink-3 transition-colors hover:bg-edge/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova"
          >
            <X className="size-4" strokeWidth={SW} aria-hidden="true" />
          </button>

          <div className="relative p-6 text-center sm:p-8">
            {/* Icon */}
            <motion.div
              key={step}
              initial={reduce ? false : { opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: reduce ? 0 : 0.2 }}
              className="mx-auto grid size-16 place-items-center rounded-2xl border border-nova-2/30 bg-gradient-to-br from-nova/20 to-aurora/10"
            >
              <Icon className="size-7 text-nova-2" strokeWidth={1.75} aria-hidden="true" />
            </motion.div>

            {/* Content */}
            <motion.div
              key={`text-${step}`}
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reduce ? 0 : 0.22 }}
            >
              <h2
                id="tour-title"
                className="mt-5 text-lg font-black text-ink"
              >
                {current.title}
              </h2>
              <p className="mx-auto mt-2 max-w-xs text-[13px] leading-relaxed text-ink-2">
                {current.description}
              </p>
            </motion.div>

            {/* Progress dots */}
            <div className="mt-6 flex items-center justify-center gap-1.5">
              {STEPS.map((_, i) => (
                <span
                  key={i}
                  className={
                    i === step
                      ? "h-1.5 w-6 rounded-full bg-nova transition-all"
                      : i < step
                      ? "size-1.5 rounded-full bg-nova/50"
                      : "size-1.5 rounded-full bg-edge/15"
                  }
                />
              ))}
            </div>

            {/* Actions */}
            <div className="mt-6 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={close}
                className="text-[11.5px] font-bold text-ink-3 transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova"
              >
                تخطي الجولة
              </button>

              <div className="flex items-center gap-2">
                {step > 0 ? (
                  <button
                    type="button"
                    onClick={() => setStep((s) => Math.max(0, s - 1))}
                    className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-edge/10 bg-edge/[0.03] px-4 text-xs font-bold text-ink-2 transition-colors hover:bg-edge/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova"
                  >
                    <ArrowRight className="size-3.5" strokeWidth={2.5} aria-hidden="true" />
                    السابق
                  </button>
                ) : null}

                {isLast ? (
                  <button
                    type="button"
                    onClick={close}
                    className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-gradient-to-l from-nova to-nova-2 px-4 text-xs font-black text-space shadow-md transition-all hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova-2/60"
                  >
                    <Check className="size-3.5" strokeWidth={2.5} aria-hidden="true" />
                    ابدأ الآن
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
                    className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-gradient-to-l from-nova to-nova-2 px-4 text-xs font-black text-space shadow-md transition-all hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova-2/60"
                  >
                    التالي
                    <ArrowLeft className="size-3.5" strokeWidth={2.5} aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>

            {/* Hint */}
            {step === 0 ? (
              <p className="mt-4 inline-flex items-center gap-1 text-[10.5px] text-ink-3">
                <Sparkles className="size-2.5 text-nova-2" strokeWidth={2.5} aria-hidden="true" />
                يمكنك إعادة الجولة من ⌘K
              </p>
            ) : null}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}