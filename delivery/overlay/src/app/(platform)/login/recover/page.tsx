// /login/recover — استرجاع الدخول برمز الاسترجاع الذي ظهر مرة واحدة عند الإعداد الأول.
import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell, authCard } from "@/components/owner/AuthShell";
import { RecoverForm } from "./RecoverForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "استرجاع الدخول", robots: { index: false, follow: false } };

export default function RecoverPage() {
  return (
    <AuthShell>
      <div className={authCard}>
        <h1 className="mb-1 text-center text-xl font-black">استرجاع الدخول</h1>
        <p className="mb-6 text-center text-[13.5px] leading-6 text-[#c3cdf0]/75">اكتبوا رمز الاسترجاع المحفوظ لديكم واختاروا كلمة مرور جديدة. سيُصدر رمز استرجاع جديد بعدها.</p>
        <RecoverForm />
        <p className="mt-5 text-center text-[13px]">
          <Link href="/login" className="text-[#c3cdf0]/80 underline underline-offset-4 hover:text-white">
            العودة لتسجيل الدخول
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
