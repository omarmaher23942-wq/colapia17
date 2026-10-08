// dashboard/onboarding/[token]/page.tsx — redirect للـ onboarding الجذري.
//
// السبب الجذري:
// الـ dashboard له base path /dashboard، لكن الاستمارة تعيش على /onboarding.
// هذا الملف يعمل كـ convenience redirect للحالات القديمة.
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function OnboardingTokenRedirectPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  redirect(`/onboarding/${encodeURIComponent(token)}`);
}