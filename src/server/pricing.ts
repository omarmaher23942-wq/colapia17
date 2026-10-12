import "server-only";
// pricing.ts — السعر الحالي من سلّم الأسعار (إعداد «pricing» في لوحة المالك) وعدد الباقات المدفوعة فعلاً (دفعات
// setup مؤكدة)، وسعر متجر بعينه (المثبَّت عند تسليمه). مصدر واحد للهبوط والوكيل والدفع والتحقق من الإيصال.
import { and, count, eq, inArray, ne } from "drizzle-orm";
import { db } from "@/db/client";
import { platformPayments } from "@/db/schema";
import { getFlag } from "@/lib/flags";
import { ladderFrom, normalizeCoupon, priceAt, type LadderPosition, type PaymentKind, type PriceLadder } from "@/lib/platform-pricing";

export const PRICING_FLAG = "pricing";

export type CurrentPricing = LadderPosition & { basePrice: number; renewal: number; paid: number; ladder: PriceLadder };

export async function priceLadder(): Promise<PriceLadder> {
  const f = await getFlag<Record<string, unknown>>(PRICING_FLAG).catch(() => ({ enabled: true, config: null }));
  return ladderFrom(f.config);
}

export async function paidStoresCount(): Promise<number> {
  const [r] = await db
    .select({ n: count() })
    .from(platformPayments)
    .where(and(eq(platformPayments.status, "confirmed"), eq(platformPayments.kind, "setup")))
    .catch(() => [{ n: 0 }]);
  return Number(r?.n ?? 0);
}

/** سعر الباقة لمتجر جديد الآن، وكم بقي بهذا السعر (عدّاد حقيقي من المدفوعات المؤكدة). */
export async function currentPricing(): Promise<CurrentPricing> {
  const [ladder, paid] = await Promise.all([priceLadder(), paidStoresCount()]);
  return { ...priceAt(paid, ladder), basePrice: ladder.basePrice, renewal: ladder.renewal, paid, ladder };
}

/** المبلغ المطلوب من متجر بعينه: الباقة بسعره المثبَّت عند التسليم (وإلا الحالي)، والتجديد بسعر التجديد. */
export async function amountForStore(store: { priceLockedEgp: number | null }, kind: PaymentKind): Promise<number> {
  const p = await currentPricing();
  if (kind === "renewal") return p.renewal;
  return store.priceLockedEgp ?? p.price;
}

/**
 * كود «الدائرة الذهبية» لمتجر بعينه: صحيح، للباقة الأولى فقط، والمقاعد لم تكتمل. المقعد يُحسب بالدفعات المؤكدة
 * بالكود وبالإيصالات قيد المراجعة من متاجر أخرى (فلا يتجاوز العدد أثناء المراجعة).
 */
export async function resolveCoupon(raw: unknown, storeId: string): Promise<{ ok: true; code: string; price: number; seatsLeft: number } | { ok: false; error: string }> {
  const code = normalizeCoupon(raw);
  if (!code) return { ok: false, error: "اكتب الكود." };
  const { golden } = await priceLadder();
  if (code !== golden.code) return { ok: false, error: "الكود غير صحيح." };
  const [r] = await db
    .select({ n: count() })
    .from(platformPayments)
    .where(
      and(
        eq(platformPayments.coupon, code),
        inArray(platformPayments.status, ["confirmed", "under_review"]),
        ne(platformPayments.storeId, storeId)
      )
    );
  const taken = Number(r?.n ?? 0);
  if (taken >= golden.seats) return { ok: false, error: "اكتملت مقاعد هذا العرض." };
  return { ok: true, code, price: golden.price, seatsLeft: golden.seats - taken };
}

/** مقاعد «الدائرة الذهبية» المستخدمة فعلاً (دفعات مؤكدة بالكود الحالي). */
export async function goldenSeatsUsed(): Promise<number> {
  const { golden } = await priceLadder();
  const [r] = await db
    .select({ n: count() })
    .from(platformPayments)
    .where(and(eq(platformPayments.coupon, golden.code), eq(platformPayments.status, "confirmed")))
    .catch(() => [{ n: 0 }]);
  return Number(r?.n ?? 0);
}
