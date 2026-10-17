// timings-rules.ts — قراءة مدد ما بعد التسليم ومواعيدها (منطق خالص مختبَر).
import { graceDaysFrom } from "@/lib/hosting";

/** graceDays = مهلة السماح بعد انتهاء الاشتراك المدفوع قبل إيقاف المتجر (بالأيام، بلا حذف). */
export type LifecycleTimings = { trialHours: number; noticeHours: number; deleteHours: number; graceDays: number };

const hours = (v: unknown, min: number, max: number, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? Math.round(n) : fallback;
};

export function timingsFrom(config: unknown, trialFallback = 24): LifecycleTimings {
  const c = (config && typeof config === "object" ? config : {}) as Record<string, unknown>;
  return {
    trialHours: hours(c.trialHours, 1, 24 * 30, hours(trialFallback, 1, 24 * 30, 24)),
    noticeHours: hours(c.noticeHours, 1, 24 * 30, 24),
    deleteHours: hours(c.deleteHours, 1, 24 * 30, 24),
    graceDays: graceDaysFrom(c.graceDays),
  };
}

/** مواعيد ما بعد التسليم: تذكيران خلال التجربة (منتصفها وقبل نهايتها بساعتين)، الإيقاف، التنبيه الأخير، الحذف. */
export function trialSchedule(deliveredAt: Date, t: LifecycleTimings) {
  const at = (h: number) => new Date(deliveredAt.getTime() + h * 3_600_000);
  const ideas = Math.min(12, t.trialHours / 2);
  const pay = Math.max(t.trialHours - 2, ideas + 0.5);
  return {
    ideas: at(ideas),
    pay: at(pay),
    freeze: at(t.trialHours),
    lastChance: at(t.trialHours + t.noticeHours),
    purge: at(t.trialHours + t.noticeHours + t.deleteHours),
  };
}
