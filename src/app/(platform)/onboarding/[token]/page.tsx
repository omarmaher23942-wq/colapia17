import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Clock, Link2Off } from "lucide-react";
import { ColapiaLogo } from "@/components/brand/ColapiaLogo";
import { openOnboarding } from "@/onboarding/load";
import { OnboardingWizard } from "./wizard/OnboardingWizard";
import { LiveBuildingScreen } from "./components/LiveBuildingScreen";
import { db } from "@/db/client";
import { onboardingSessions, stores } from "@/db/schema";
import { eq } from "drizzle-orm";
import { hashToken } from "@/onboarding/token";

export const dynamic = "force-dynamic";

const MESSENGER_URL = "https://www.facebook.com/profile.php?id=61594961601396";

export const metadata: Metadata = {
  title: "استمارة بناء متجرك",
  description: "استمارة ذكية تبني متجرك الإلكتروني الاحترافي خطوة بخطوة",
  robots: { index: false, follow: false },
};

export default async function OnboardingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const result = await openOnboarding(token);

  if (result.state === "invalid") notFound();

  // إذا تم الإرسال، نعرض شاشة البناء الحية بدلاً من الشاشة الثابتة القديمة
  if (result.state === "submitted") {
    const [sessionData] = await db
      .select({ storeName: stores.name, subdomain: stores.subdomain })
      .from(onboardingSessions)
      .leftJoin(stores, eq(stores.id, onboardingSessions.storeId))
      .where(eq(onboardingSessions.tokenHash, hashToken(token)))
      .limit(1);

    return (
      <LiveBuildingScreen
        token={token}
        subdomain={sessionData?.subdomain ?? "mystore"}
        storeName={sessionData?.storeName ?? "متجرك"}
      />
    );
  }

  if (result.state === "expired" || result.state === "revoked") {
    const isExpired = result.state === "expired";
    return (
      <Shell>
        <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-[#ff5c6c]/15 text-[#ff5c6c] ring-1 ring-[#ff5c6c]/30">
          {isExpired ? <Clock className="size-7" strokeWidth={1.75} /> : <Link2Off className="size-7" strokeWidth={1.75} />}
        </div>
        <h1 className="mt-5 text-2xl font-black text-[#eaf0ff]">
          {isExpired ? "انتهت صلاحية الرابط" : "تم استبدال الرابط"}
        </h1>
        <p className="mt-2 text-sm text-[#c3cdf0]">
          {isExpired ? "اطلب رابطاً جديداً من المحادثة، وكل ما كتبته محفوظ." : "استخدم آخر رابط وصلك على المحادثة."}
        </p>
        <a href={MESSENGER_URL} target="_blank" rel="noopener" className="btn-cosmic mt-6 inline-flex">
          افتح المحادثة
        </a>
      </Shell>
    );
  }

  if (result.state !== "ok") notFound();

  return (
    <OnboardingWizard
      token={token}
      draft={result.draft}
      draftVersion={result.draftVersion}
      lastStep={result.lastStep}
      expiresAt={result.expiresAt}
    />
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="container-x mx-auto max-w-xl py-16 text-center" dir="rtl">
      <div className="mb-8 flex justify-center">
        <ColapiaLogo size={44} />
      </div>
      {children}
    </div>
  );
}