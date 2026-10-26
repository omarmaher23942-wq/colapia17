// /login/reset/<رمز> — رابط إعادة تعيين كلمة المرور الذي يولّده فريق Colapia لمن تعذّر عليه البريد (يومان، لمرة واحدة).
import type { Metadata } from "next";
import Link from "next/link";
import { resolveResetToken } from "@/agent/setup-access";
import { AuthNotice, AuthShell, AUTH_BTN, AUTH_CARD } from "@/components/auth/AuthShell";
import { ResetForm } from "./ResetForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "كلمة مرور جديدة", robots: { index: false, follow: false } };

export default async function ResetPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const r = await resolveResetToken(token);
  if (!r.ok) {
    return (
      <AuthShell>
        <AuthNotice
          title="الرابط غير صالح أو استُعمل من قبل"
          action={
            <Link href="/login" className={AUTH_BTN}>
              صفحة الدخول
            </Link>
          }
        >
          <p>اطلبوا رابطاً جديداً من الفريق في المحادثة نفسها.</p>
        </AuthNotice>
      </AuthShell>
    );
  }
  return (
    <AuthShell>
      <div className={AUTH_CARD}>
        <h1 className="text-center text-2xl font-black">اختاروا كلمة مرور جديدة</h1>
        <div className="mt-6">
          <ResetForm token={token} email={r.target.email} />
        </div>
      </div>
    </AuthShell>
  );
}
