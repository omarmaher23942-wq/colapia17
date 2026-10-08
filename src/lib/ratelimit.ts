import { Ratelimit } from "@upstash/ratelimit";
import { redis } from "./redis";

/**
 * حدود معدل الطلبات لكل مسار عام (حماية من الإساءة بدون أي تكلفة).
 * sliding window أدق وأعدل من fixed window.
 */
export const limits = {
  /** إنشاء طلب: 5 طلبات لكل IP كل 10 دقائق (يمنع الطلبات الوهمية) */
  checkout: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, "10 m"), prefix: "rl:checkout" }),
  /** حساب الشحن والخصم أثناء التعبئة: يمنع تخمين أكواد الخصم */
  quote: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(40, "1 m"), prefix: "rl:quote" }),
  /** تسجيل السلة المتروكة: يمنع إغراق قائمة التاجر ببيانات وهمية */
  abandoned: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, "10 m"), prefix: "rl:abandoned" }),
  /** رفع إثبات التحويل */
  proof: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, "10 m"), prefix: "rl:proof" }),
  /** تتبع الطلب: 20 محاولة كل 10 دقائق */
  track: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(20, "10 m"), prefix: "rl:track" }),
  /** تسجيل الدخول: 10 محاولات كل 15 دقيقة */
  login: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, "15 m"), prefix: "rl:login" }),
  /** أحداث التحليلات: 120 حدثًا كل دقيقة لكل زائر */
  track_events: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(120, "1 m"), prefix: "rl:events" }),
  /** تقييمات العملاء: 5 كل 10 دقائق لكل IP */
  review: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, "10 m"), prefix: "rl:review" }),
  /** إيصالات الدفع للمنصة: 5 كل ساعة لكل تاجر */
  platformPayment: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, "1 h"), prefix: "rl:ppay" }),
  /** البحث: 60 كل دقيقة */
  search: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(60, "1 m"), prefix: "rl:search" }),
  // مشروع التاجر يسحب بيانات متجره صفحةً صفحة عند الاستلام.
  transfer: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(240, "1 m"), prefix: "rl:transfer" }),
  // توليد مشروع المتجر (ZIP / GitHub) عملية ثقيلة.
  ownership: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(6, "10 m"), prefix: "rl:own" }),
  // إعادة تصميم المتجر بالذكاء الاصطناعي: 6 مرات في اليوم لكل متجر.
  redesign: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(6, "1 d"), prefix: "rl:redesign" }),
};

export type LimitName = keyof typeof limits;

/**
 * فحص الحد بأمان: لو Redis متعطل نسمح بالطلب (fail-open) بدل إسقاط الصفحة.
 * الحدود طبقة حماية إضافية، وقيود قاعدة البيانات هي خط الدفاع الأساسي.
 */
export async function allow(name: LimitName, key: string): Promise<boolean> {
  try {
    const { success } = await limits[name].limit(key);
    return success;
  } catch (e) {
    console.error(`[ratelimit] ${name} unavailable`, e);
    return true;
  }
}

/** استخراج IP الزائر خلف Vercel */
export function clientIp(headers: Headers) {
  return headers.get("x-real-ip") ?? headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "0.0.0.0";
}
