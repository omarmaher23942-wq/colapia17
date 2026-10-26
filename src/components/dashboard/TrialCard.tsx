// TrialCard — عدّاد المعاينة المجانية في النظرة العامة بسعر التفعيل الحالي (ذهبي متى بقي مقعد وإلا عادي).
import "server-only";
import { TrialCountdownCard } from "@/components/dashboard/TrialCountdownCard";
import { currentProjectQuote } from "@/server/pricing";

type Store = { priceLockedEgp: number | null; trialEndsAt: Date | null; demoExpiresAt?: Date | null; demoStartedAt: Date | null; deliveredAt: Date | null };

export async function TrialCard({ store }: { store: Store }) {
  const ends = store.trialEndsAt ?? store.demoExpiresAt ?? null;
  if (!ends) return null;
  return (
    <TrialCountdownCard
      expiresAt={ends.toISOString()}
      startedAt={(store.demoStartedAt ?? store.deliveredAt)?.toISOString() ?? null}
      serverNow={Date.now()}
      planPrice={(await currentProjectQuote()).price}
    />
  );
}
