// /admin/setup على نطاق المتجر — مسار قديم لروابط التفعيل المُرسلة سابقاً.
// الاستلام الآن يتم حصراً على نطاق المنصة عبر /claim (حيث تعيش جلسة التاجر).
import { redirect } from "next/navigation";
import { clientEnv } from "@/lib/env";
import { activationUrl } from "@/server/claims";

export const dynamic = "force-dynamic";

export default async function LegacySetupRedirect({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  redirect(token ? activationUrl(token) : `${clientEnv.NEXT_PUBLIC_APP_URL}/dashboard`);
}
