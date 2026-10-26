import "server-only";
// client-guard.ts — حارس صفحات بوابة العميل تحت /dashboard (حساب بلا متجر مستضاف). ليس "use server".
// بلا جلسة ← الدخول، ومن له متجر مستضاف (متجر العرض) يعود للوحة المتجر. tests/unit/merchant-guard-coverage.test.ts
// يفرض استدعاءه في كل صفحة بوابة.
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getMerchantSession, type MerchantSession } from "@/server/auth";

export type ClientSession = NonNullable<MerchantSession>;

export async function requireClientPortal(): Promise<ClientSession> {
  const session = await getMerchantSession();
  if (!session) {
    const back = (await headers()).get("x-pathname") ?? "/dashboard";
    redirect(`/login?redirect=${encodeURIComponent(back.startsWith("/dashboard") ? back : "/dashboard")}&reason=no_session`);
  }
  if (session.store) redirect("/dashboard");
  return session;
}
