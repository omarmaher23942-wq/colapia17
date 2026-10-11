import "server-only";
// pricing.ts — السعر الحالي من سلّم الأسعار (إعداد «pricing» في لوحة المالك) وعدد الباقات المدفوعة فعلاً (دفعات
// setup مؤكدة)، وسعر متجر بعينه (المثبَّت عند تسليمه). مصدر واحد للهبوط والوكيل والدفع والتحقق من الإيصال.
import { and, count, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { platformPayments } from "@/db/schema";
import { getFlag } from "@/lib/flags";
import { ladderFrom, priceAt, type LadderPosition, type PaymentKind, type PriceLadder } from "@/lib/platform-pricing";

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
