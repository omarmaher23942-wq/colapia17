import "server-only";
// pricing.ts — أسعار Colapia v3 من إعداد «pricing» (لوحة المالك /admin/pricing)، ومقاعد «الدائرة الذهبية».
// مصدر واحد للهبوط والوكيل وصفحة الدفع والتحقق من الإيصال. المنطق الخالص في lib/platform-pricing.ts.
import { and, count, eq, inArray, ne } from "drizzle-orm";
import { db } from "@/db/client";
import { platformPayments } from "@/db/schema";
import { getFlag } from "@/lib/flags";
import { goldenAvailability, normalizeCoupon, planAmount, pricingFrom, type PaymentKind, type PricingModel } from "@/lib/platform-pricing";

export const PRICING_FLAG = "pricing";

export type CurrentPricing = PricingModel;

/** نموذج الأسعار الحالي (الباقات والتجديد والمميَّزة والدائرة الذهبية). */
export async function currentPricing(): Promise<CurrentPricing> {
  const f = await getFlag<Record<string, unknown>>(PRICING_FLAG).catch(() => ({ enabled: true, config: null }));
  return pricingFrom(f.config);
}

/** المبلغ المطلوب لباقة بمدتها (3/6/12) ونوع الدفعة؛ null = مدة غير متاحة. */
export async function amountFor(months: unknown, kind: PaymentKind): Promise<number | null> {
  return planAmount(await currentPricing(), months, kind);
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
  price: number;
  months: number;
};

/**
 * حالة «الدائرة الذهبية»: المقعد يُحسب بكل دفعة مسجّلة كدائرة ذهبية مؤكدة أو قيد المراجعة (فلا يتجاوز العدد أثناء
 * المراجعة)، أياً كان الكود الذي استُخدم يومها.
 */
export async function goldenStatus(excludeStoreId?: string): Promise<GoldenStatus> {
  const [{ golden }, c] = await Promise.all([currentPricing(), goldenCounts(excludeStoreId)]);
  return {
    ...goldenAvailability(golden, c.confirmed + c.underReview),
    ...c,
    seats: golden.seats,
    code: golden.code,
    price: golden.price,
    months: golden.months,
  };
}

/** كود «الدائرة الذهبية» لمتجر بعينه (للباقة الأولى فقط؛ يتحقق المستدعي من نوع الدفعة). */
export async function resolveCoupon(
  raw: unknown,
  storeId: string
): Promise<{ ok: true; code: string; price: number; months: number; seatsLeft: number } | { ok: false; error: string }> {
  const code = normalizeCoupon(raw);
  if (!code) return { ok: false, error: "اكتبوا الكود." };
  const g = await goldenStatus(storeId);
  if (code !== g.code) return { ok: false, error: "هذا الكود غير صحيح." };
  if (!g.enabled) return { ok: false, error: "هذا الكود غير متاح حالياً." };
  if (!g.available) return { ok: false, error: "اكتملت مقاعد هذا العرض، ويمكنكم اختيار أي باقة أخرى." };
  return { ok: true, code, price: g.price, months: g.months, seatsLeft: g.seatsLeft };
}
