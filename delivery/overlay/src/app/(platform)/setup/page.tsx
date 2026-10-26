// /setup — الإعداد الأول للمشروع (مرة واحدة): التأكد من الربط، تجهيز قاعدة البيانات، ثم إنشاء حساب صاحب المتجر.
// بعد وجود المالك تتحول إلى رسالة «تم الإعداد» ولا تقبل أي إجراء.
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { getMerchantSession } from "@/server/auth";
import { setupStatus } from "@/server/setup/status";
import { AuthShell, authCard, authGhost } from "@/components/owner/AuthShell";
import { STORE } from "@/store.config";
import { SetupWizard } from "./SetupWizard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "الإعداد الأول", robots: { index: false, follow: false } };

export default async function SetupPage() {
  const status = await setupStatus();

  if (status.ownerExists) {
    const session = await getMerchantSession().catch(() => null);
    if (session?.store?.status === "setup") redirect("/onboarding");
    return (
      <AuthShell>
        <div className={`${authCard} text-center`}>
          <CheckCircle2 className="mx-auto size-10 text-emerald-300" aria-hidden="true" />
          <h1 className="mt-3 text-xl font-black">تم إعداد المشروع</h1>
          <p className="mx-auto mt-3 max-w-sm text-[14px] leading-7 text-[#c3cdf0]/80">لوحة التحكم جاهزة. سجّلوا الدخول بالبريد المسجّل.</p>
          <Link href={session ? "/dashboard" : "/login"} className={`${authGhost} mt-5`}>
            {session ? "فتح لوحة التحكم" : "تسجيل الدخول"}
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell wide>
      <SetupWizard status={status} ownerEmail={STORE.ownerEmail} needsCode={Boolean(process.env.SETUP_CODE?.trim())} />
    </AuthShell>
  );
}
