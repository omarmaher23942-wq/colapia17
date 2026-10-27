// setup-time.ts — تقدير الوقت المتبقي في الإعداد وعلامات الانتباه على الخطوات (خالص ومختبَر).
import type { StepId } from "@/lib/onboarding";

export const STEP_MINUTES: Record<StepId, number> = { identity: 1, products: 4, look: 2, commerce: 3, publish: 1 };

/** الدقائق المتبقية للخطوات غير المنجزة المعروضة، بحد أدنى دقيقة ما دام هناك خطوة. */
export function remainingMinutes(done: readonly StepId[], visible: readonly StepId[]): number {
  const left = visible.filter((s) => !done.includes(s));
  return left.length ? Math.max(1, left.reduce((a, s) => a + STEP_MINUTES[s], 0)) : 0;
}

export function remainingLabel(min: number): string {
  if (min <= 0) return "جاهز للنشر";
  if (min === 1) return "نحو دقيقة متبقية";
  if (min === 2) return "نحو دقيقتين متبقيتين";
  return min <= 10 ? `نحو ${min} دقائق متبقية` : `نحو ${min} دقيقة متبقية`;
}

/** خطوات منجزة لكن بياناتها الحية ناقصة (مثلاً حُذفت المنتجات بعد إنهاء الخطوة) ← تظهر بعلامة انتباه. */
export const needsAttention = (done: readonly StepId[], failing: readonly StepId[]): StepId[] => failing.filter((s) => done.includes(s));
