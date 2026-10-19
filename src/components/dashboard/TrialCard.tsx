// TrialCard — عدّاد التجربة في النظرة العامة بأقل دفعة أولى حقيقية (التجهيز + أرخص باقة لأقصر مدة متاحة).
import "server-only";
import { TrialCountdownCard } from "@/components/dashboard/TrialCountdownCard";
import { currentPricing } from "@/server/pricing";
import { startingPrice } from "@/lib/platform-pricing";
import type { PricingModel } from "@/lib/platform-pricing";

const firstPayment = (m: PricingModel) => m.build.price + startingPrice(m) * (m.months[0] ?? 1);

type Store = { priceLockedEgp: number | null; trialEndsAt: Date | null; demoExpiresAt?: Date | null; demoStartedAt: Date | null; deliveredAt: Date | null };

export async function TrialCard({ store }: { store: Store }) {
  const ends = store.trialEndsAt ?? store.demoExpiresAt ?? null;
  if (!ends) return null;
  return (
    <TrialCountdownCard
      expiresAt={ends.toISOString()}
      startedAt={(store.demoStartedAt ?? store.deliveredAt)?.toISOString() ?? null}
      serverNow={Date.now()}
      planPrice={firstPayment(await currentPricing())}
    />
  );
}
