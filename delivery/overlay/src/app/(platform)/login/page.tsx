// /login — دخول صاحب المتجر إلى لوحة التحكم. جلسة صالحة فعلاً ← الوجهة مباشرة (لا مجرد وجود الكوكي: المنتهي كان يدور).
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getMerchantSession } from "@/server/auth";
import { AuthShell, authCard } from "@/components/owner/AuthShell";
import { safeInternalPath } from "@/lib/safe-redirect";
import { STORE } from "@/store.config";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "تسجيل الدخول", robots: { index: false, follow: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ redirect?: string }> }) {
  const params = await searchParams;
  const redirectTo = safeInternalPath(params.redirect, "/dashboard");
  if (await getMerchantSession().catch(() => null)) redirect(redirectTo);
  return (
    <AuthShell>
      <div className={authCard}>
        <h1 className="mb-1 text-center text-xl font-black">لوحة التحكم</h1>
        <p className="mb-6 text-center text-[13.5px] leading-6 text-[#c3cdf0]/75">سجّلوا الدخول بالبريد الذي سُجّل عند التسليم.</p>
        <LoginForm redirectTo={redirectTo} defaultEmail={STORE.ownerEmail} />
      </div>
    </AuthShell>
  );
}
