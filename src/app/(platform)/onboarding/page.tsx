// /onboarding — «إعداد المتجر» بملء الشاشة (خارج تخطيط اللوحة). يصل إليه صاحب متجر حالته `setup` بعد الدخول بـ Google،
// ويحوّله إليه حارس اللوحة تلقائياً. بعد التفعيل (تجربة/نشط) يعود إلى اللوحة.
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getMerchantSession } from "@/server/auth";
import { loadSetupData } from "@/server/setup-data";
import { DASH_THEME_COOKIE } from "@/lib/dash-theme";
import { OnboardingApp } from "@/components/onboarding/OnboardingApp";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "إعداد المتجر", robots: { index: false } };

export default async function OnboardingPage() {
  const session = await getMerchantSession();
  if (!session) redirect("/login?redirect=/onboarding");
  const store = session.store;
  if (!store) redirect("/start");
  if (session.access !== "owner") redirect("/dashboard/setup-pending");
  if (store.status !== "setup") redirect("/dashboard");

  const data = await loadSetupData(store);
  if (!data) redirect("/dashboard");

  const dark = (await cookies()).get(DASH_THEME_COOKIE)?.value === "dark";
  return (
    <div dir="rtl" className={`dash ${dark ? "dark" : ""}`}>
      <OnboardingApp data={data} />
    </div>
  );
}
