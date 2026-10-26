// TrialCard — لا تجربة ولا اشتراك في مشروعك: لا شيء يُعرض. يبقى المكوّن ليعمل مستورده المشترك (النظرة العامة) كما هو.
type Store = { priceLockedEgp: number | null; trialEndsAt: Date | null; demoExpiresAt?: Date | null; demoStartedAt: Date | null; deliveredAt: Date | null };

export async function TrialCard(_props: { store: Store }) {
  return null;
}
