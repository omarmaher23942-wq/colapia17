import "server-only";
// pricing.ts — أسعار Colapia (V4) من إعداد «pricing» (لوحة المالك /admin/pricing)، ومقاعد «الدائرة الذهبية».
// مصدر واحد لصفحة الحجز والوكيل والتحقق من الإيصال. المنطق الخالص في lib/platform-pricing.ts.
import { and, count, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { platformPayments } from "@/db/schema";
import { getFlag } from "@/lib/flags";
import { agentPricingFacts, goldenAvailability, pricingFrom, projectQuote, type PricingModel, type ProjectQuote } from "@/lib/platform-pricing";

export const PRICING_FLAG = "pricing";

export type CurrentPricing = PricingModel;

/** نموذج الأسعار الحالي (السعر العادي، الدائرة الذهبية، شروط التعديل، نص المشاريع الأخرى). */
export async function currentPricing(): Promise<CurrentPricing> {
  const f = await getFlag<Record<string, unknown>>(PRICING_FLAG).catch(() => ({ enabled: true, config: null }));
  return pricingFrom(f.config);
}

/** حجوزات الدائرة الذهبية: المؤكَّدة (تُحتسب من المقاعد) وقيد المراجعة (للمالك فقط، لا تنقص العدّاد). */
async function goldenCounts(): Promise<{ confirmed: number; underReview: number }> {
  const rows = await db
    .select({ status: platformPayments.status, n: count() })
    .from(platformPayments)
    .where(and(eq(platformPayments.kind, "project"), eq(platformPayments.plan, "golden")))
    .groupBy(platformPayments.status)
    .catch(() => [] as { status: string; n: number }[]);
  const by = (s: string) => Number(rows.find((r) => r.status === s)?.n ?? 0);
  return { confirmed: by("confirmed"), underReview: by("under_review") };
}

export type GoldenStatus = ReturnType<typeof goldenAvailability> & {
  confirmed: number;
  underReview: number;
  seats: number;
  /** سعر الدائرة الذهبية والسعر العادي (للمقارنة الصادقة «بدلاً من …»). */
  price: number;
  regularPrice: number;
  /** أسماء قديمة تقرؤها الوكيل ولوحة المالك: تساوي price وregularPrice. */
  buildPrice: number;
  regularBuildPrice: number;
};

/** حالة «الدائرة الذهبية» الآن: المقعد يُحسب عند تأكيد المالك للدفع فقط (العدّاد الحقيقي). */
export async function goldenStatus(): Promise<GoldenStatus> {
  const [model, c] = await Promise.all([currentPricing(), goldenCounts()]);
  return {
    ...goldenAvailability(model.golden, c.confirmed),
    ...c,
    seats: model.golden.seats,
    price: model.golden.price,
    regularPrice: model.regularPrice,
    buildPrice: model.golden.price,
    regularBuildPrice: model.regularPrice,
  };
}

/** سعر حجز جديد الآن (ذهبي متى كان فيه مقعد وإلا العادي)، وكل ما تحتاجه صفحة الحجز لعرضه. */
export async function currentProjectQuote(): Promise<ProjectQuote & { model: PricingModel }> {
  const [model, c] = await Promise.all([currentPricing(), goldenCounts()]);
  return { ...projectQuote(model, c.confirmed), model };
}

/** حقائق الأسعار الحالية لبرومبت وكيل المبيعات (بالمقاعد الحقيقية). */
export async function agentPricingText(): Promise<string> {
  const [model, c] = await Promise.all([currentPricing(), goldenCounts()]);
  return agentPricingFacts(model, c.confirmed);
}
