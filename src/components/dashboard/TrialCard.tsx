// TrialCard — عدّاد التجربة في النظرة العامة بسعر المتجر الحقيقي (المثبَّت عند التسليم، وإلا سعر السلّم الحالي).
// للمنصة فقط: مشروع التاجر الخاص يستبدله بنسخة فارغة (template/src/components/dashboard/TrialCard.tsx).
import "server-only";
import { TrialCountdownCard } from "@/components/dashboard/TrialCountdownCard";
import { amountForStore } from "@/server/pricing";

type Store = { priceLockedEgp: number | null; trialEndsAt: Date | null; demoExpiresAt?: Date | null; demoStartedAt: Date | null; deliveredAt: Date | null };

export async function TrialCard({ store }: { store: Store }) {
  const ends = store.trialEndsAt ?? store.demoExpiresAt ?? null;
  if (!ends) return null;
  return (
    <TrialCountdownCard
      expiresAt={ends.toISOString()}
      startedAt={(store.demoStartedAt ?? store.deliveredAt)?.toISOString() ?? null}
      serverNow={Date.now()}
      planPrice={await amountForStore(store, "setup")}
    />
  );
}
