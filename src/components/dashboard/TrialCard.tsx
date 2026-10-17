// TrialCard — عدّاد التجربة في النظرة العامة بسعر المتجر الحقيقي (أرخص باقة حالية).
// للمنصة فقط: مشروع التاجر الخاص يستبدله بنسخة فارغة (template/src/components/dashboard/TrialCard.tsx).
import "server-only";
import { TrialCountdownCard } from "@/components/dashboard/TrialCountdownCard";
import { currentPricing } from "@/server/pricing";
import { startingPrice } from "@/lib/platform-pricing";

type Store = { priceLockedEgp: number | null; demoExpiresAt: Date | null; demoStartedAt: Date | null; deliveredAt: Date | null };

export async function TrialCard({ store }: { store: Store }) {
  if (!store.demoExpiresAt) return null;
  return (
    <TrialCountdownCard
      expiresAt={store.demoExpiresAt.toISOString()}
      startedAt={(store.demoStartedAt ?? store.deliveredAt)?.toISOString() ?? null}
      serverNow={Date.now()}
      planPrice={startingPrice(await currentPricing())}
    />
  );
}
