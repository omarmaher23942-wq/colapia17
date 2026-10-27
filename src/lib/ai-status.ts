// ai-status.ts — حالة الميزات الذكية (خالص ومختبَر): هل يوجد مفتاح، وحدود التكلفة اليومية والشهرية القابلة للضبط.
// الميزات الذكية اختيارية دائماً: بلا مفتاح تعمل الواجهة يدوياً وبرسالة واضحة، ولا تفشل.
export type AiEnv = Record<string, string | undefined>;

const real = (v: string | undefined) => Boolean(v && v.trim().length >= 16 && !/^(x+|your|changeme|placeholder|dummy)/i.test(v.trim()));

export function aiAvailable(env: AiEnv): boolean {
  return real(env.GROQ_API_KEY) || real(env.GEMINI_API_KEY);
}

export type AiCaps = { perDay: number; perMonth: number };
/** حدود الاستدعاءات من AI_CAP_DAILY وAI_CAP_MONTHLY (الافتراضي 300 يومياً و4000 شهرياً)، وقيمة غير صالحة ترجع للافتراضي. */
export function aiCaps(env: AiEnv): AiCaps {
  const num = (v: string | undefined, d: number) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 1 && n <= 1_000_000 ? Math.floor(n) : d;
  };
  return { perDay: num(env.AI_CAP_DAILY, 300), perMonth: num(env.AI_CAP_MONTHLY, 4000) };
}

export type CapVerdict = { ok: true } | { ok: false; reason: "day" | "month"; message: string };
export function checkCaps(used: { day: number; month: number }, caps: AiCaps, units = 1): CapVerdict {
  if (used.day + units > caps.perDay) return { ok: false, reason: "day", message: "بلغت العمليات التلقائية حدها اليومي. تتجدد غداً، ويمكنكم المتابعة يدوياً الآن." };
  if (used.month + units > caps.perMonth) return { ok: false, reason: "month", message: "بلغت العمليات التلقائية حدها الشهري. تتجدد مطلع الشهر القادم، ويمكنكم المتابعة يدوياً الآن." };
  return { ok: true };
}

export const NO_AI_NOTICE = "المساعد الذكي غير مفعّل حالياً، فتعمل هذه الأداة يدوياً: اكتبوا الأسماء والبيانات بأنفسكم وستجدون كل شيء جاهزاً للتعديل.";
