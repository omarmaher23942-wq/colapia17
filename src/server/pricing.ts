import "server-only";
// pricing.ts — أسعار Colapia v4 من إعداد «pricing» (لوحة المالك /admin/pricing)، ومقاعد «الدائرة الذهبية».
// مصدر واحد للهبوط والوكيل وصفحة الدفع والتحقق من الإيصال. المنطق الخالص في lib/platform-pricing.ts.
import { and, count, eq, inArray, ne } from "drizzle-orm";
import { db } from "@/db/client";
import { platformPayments } from "@/db/schema";
import { getFlag } from "@/lib/flags";
import { agentPricingFacts, goldenAvailability, normalizeCoupon, pricingFrom, quote, type PaymentKind, type PricingModel } from "@/lib/platform-pricing";

export const PRICING_FLAG = "pricing";

export type CurrentPricing = PricingModel;

/** نموذج الأسعار الحالي (رسوم التجهيز، الباقات وحدودها، المدد، الدائرة الذهبية). */
export async function currentPricing(): Promise<CurrentPricing> {
  const f = await getFlag<Record<string, unknown>>(PRICING_FLAG).catch(() => ({ enabled: true, config: null }));
  return pricingFrom(f.config);
}

/** المبلغ المطلوب لدفعة بباقتها ومدتها ونوعها (null = اختيار غير متاح). */
export async function amountFor(input: { planId: unknown; months: unknown; kind: PaymentKind; golden?: boolean }): Promise<number | null> {
  const q = quote(await currentPricing(), input);
  return q.ok ? q.total : null;
}

async function goldenCounts(excludeStoreId?: string): Promise<{ confirmed: number; underReview: number }> {
  const rows = await db
    .select({ status: platformPayments.status, n: count() })
    .from(platformPayments)
    .where(
      and(
        eq(platformPayments.plan, "golden"),
        inArray(platformPayments.status, ["confirmed", "under_review"]),
        excludeStoreId ? ne(platformPayments.storeId, excludeStoreId) : undefined
      )
    )
    .groupBy(platformPayments.status)
    .catch(() => [] as { status: string; n: number }[]);
  const by = (s: string) => Number(rows.find((r) => r.status === s)?.n ?? 0);
  return { confirmed: by("confirmed"), underReview: by("under_review") };
}

export type GoldenStatus = ReturnType<typeof goldenAvailability> & {
  confirmed: number;
  underReview: number;
  seats: number;
  code: string;
  buildPrice: number;
  /** رسوم التجهيز العادية (للمقارنة الصادقة: «بدلاً من …»). */
  regularBuildPrice: number;
};

/**
 * حالة «الدائرة الذهبية»: المقعد يُحسب بكل دفعة مسجّلة كدائرة ذهبية مؤكدة أو قيد المراجعة (فلا يتجاوز العدد أثناء
 * المراجعة)، أياً كان الكود الذي استُخدم يومها. excludeStoreId: لا يُحسب على المتجر مقعده هو (إعادة إرسال إيصال).
 */
export async function goldenStatus(excludeStoreId?: string): Promise<GoldenStatus> {
  const [model, c] = await Promise.all([currentPricing(), goldenCounts(excludeStoreId)]);
  return {
    ...goldenAvailability(model.golden, c.confirmed + c.underReview),
    ...c,
    seats: model.golden.seats,
    code: model.golden.code,
    buildPrice: model.golden.buildPrice,
    regularBuildPrice: model.build.price,
  };
}

/** كود «الدائرة الذهبية» لمتجر بعينه (للدفعة الأولى فقط؛ يتحقق المستدعي من نوع الدفعة). */
export async function resolveCoupon(
  raw: unknown,
  storeId: string
): Promise<{ ok: true; code: string; buildPrice: number; regularBuildPrice: number; seatsLeft: number } | { ok: false; error: string }> {
  const code = normalizeCoupon(raw);
  if (!code) return { ok: false, error: "اكتبوا الكود." };
  const g = await goldenStatus(storeId);
  if (code !== g.code) return { ok: false, error: "هذا الكود غير صحيح." };
  if (!g.enabled) return { ok: false, error: "هذا الكود غير متاح حالياً." };
  if (!g.available) return { ok: false, error: "اكتملت مقاعد هذا العرض، ويمكنكم المتابعة برسوم التجهيز العادية." };
  return { ok: true, code, buildPrice: g.buildPrice, regularBuildPrice: g.regularBuildPrice, seatsLeft: g.seatsLeft };
}

/** حقائق الأسعار الحالية لبرومبت وكيل المبيعات (بالمقاعد الحقيقية). */
export async function agentPricingText(): Promise<string> {
  const [model, c] = await Promise.all([currentPricing(), goldenCounts()]);
  return agentPricingFacts(model, c.confirmed + c.underReview);
}
