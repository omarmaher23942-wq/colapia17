// صفحة إنشاء الحساب — تعيد استخدام LoginForm بنمط signup.
// نفس منطق /login: تفحص الجلسة، sanitize للـ redirect، ثم تعرض البطاقة.
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { LoginForm } from "../login/LoginForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "ابدأ مجاناً | Colapia",
  description:
    "أنشئ متجرك الإلكتروني الاحترافي مع Colapia بحساب Google — تجربة مجانية 8 ساعات.",
  openGraph: {
    title: "ابدأ مجاناً | Colapia",
    description:
      "أنشئ متجرك الإلكتروني الاحترافي مع Colapia بحساب Google.",
    type: "website",
  },
};

type SearchParams = Promise<{ redirect?: string; error?: string }>;

function sanitizeRedirect(input: string | undefined): string {
  if (!input) return "/dashboard";
  if (!input.startsWith("/") || input.startsWith("//")) return "/dashboard";
  return input;
}

export default async function SignupPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const jar = await cookies();
  if (jar.get("clp_m")?.value) {
    redirect("/dashboard");
  }

  const params = await searchParams;

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
      <LoginForm
        redirectTo={sanitizeRedirect(params.redirect)}
        error={params.error}
        variant="signup"
      />
    </main>
  );
}