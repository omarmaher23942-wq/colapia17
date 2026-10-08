// صفحة تسجيل الدخول — Server Component:
// - تقرأ كوكي clp_m أولاً، وإذا وُجد تاجر مسجّل → redirect مباشر لـ /dashboard.
// - تستقبل redirect intent عبر ?redirect= وتحفظه لتمريره للـ Server Action (E2).
// - SEO/OpenGraph Tags (E5) + noindex لأنها صفحة وظيفية.
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "تسجيل الدخول | Colapia",
  description: "سجّل الدخول إلى حسابك في Colapia بحساب Google في ثوانٍ.",
  robots: { index: false, follow: false },
  openGraph: {
    title: "تسجيل الدخول | Colapia",
    description: "سجّل الدخول إلى حسابك في Colapia بحساب Google.",
    type: "website",
  },
};

type SearchParams = Promise<{ redirect?: string; error?: string }>;

function sanitizeRedirect(input: string | undefined): string {
  if (!input) return "/dashboard";
  if (!input.startsWith("/") || input.startsWith("//")) return "/dashboard";
  return input;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const jar = await cookies();
  if (jar.get("clp_m")?.value) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const redirectTo = sanitizeRedirect(params.redirect);

  return (
    <main
      dir="rtl"
      lang="ar"
      className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[#07091a] px-5 py-16 text-[#eaf0ff]"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(111,134,255,0.22),transparent_70%),radial-gradient(50%_40%_at_80%_100%,rgba(143,168,255,0.12),transparent_70%)]"
      />
      <LoginForm redirectTo={redirectTo} error={params.error} variant="login" />
    </main>
  );
}