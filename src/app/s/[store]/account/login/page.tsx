// app/s/[store]/account/login/page.tsx — تسجيل دخول العميل (v2).
//
// التحديثات الجذرية (موجة 4):
//  1) Magic Link login (إيميل → رابط).
//  2) Google login.
//  3) تصميm يستخدم CSS vars من المتجر (لا هوية Colapia).
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { User, Sparkles, Mail, ShieldCheck } from "lucide-react";
import { requireStore } from "@/lib/tenant";
import { getCustomerSession } from "@/server/auth";
import { CustomerGoogleAuthButton } from "@/components/storefront/CustomerGoogleAuthButton";
import { MagicLinkLoginForm } from "@/components/storefront/MagicLinkLoginForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "تسجيل الدخول | حسابي",
  robots: { index: false, follow: false },
};

export default async function CustomerLoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ store: string }>;
  searchParams: Promise<{ redirect?: string; error?: string }>;
}) {
  const { store: sub } = await params;
  const { redirect: redirectParam, error } = await searchParams;

  const store = await requireStore(sub);
  const session = await getCustomerSession(store.id);
  if (session) redirect("/account");

  const safeRedirect =
    redirectParam && redirectParam.startsWith("/") && !redirectParam.startsWith("//")
      ? redirectParam
      : "/account";

  return (
    <div
      className="container-x max-w-md py-12"
      dir="rtl"
    >
      <div
        className="space-y-6 rounded-3xl border p-6 text-center sm:p-8"
        style={{
          background: "var(--card)",
          borderColor: "var(--border)",
          color: "var(--card-foreground)",
        }}
      >
        {/* Icon */}
        <div
          className="mx-auto grid size-16 place-items-center rounded-3xl border"
          style={{
            background: "color-mix(in srgb, var(--primary) 12%, transparent)",
            borderColor: "color-mix(in srgb, var(--primary) 30%, transparent)",
            color: "var(--primary)",
          }}
        >
          <User className="size-7" strokeWidth={1.75} aria-hidden="true" />
        </div>

        <div className="space-y-2">
          <h1 className="font-heading text-2xl font-black">
            أهلاً بك في {store.name}
          </h1>
          <p className="mx-auto max-w-sm text-xs leading-relaxed opacity-75">
            سجّل الدخول لتتبّع طلباتك، حفظ عناوينك، وتقييم مشترياتك.
          </p>
        </div>

        {error ? (
          <div
            role="alert"
            className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs font-bold text-rose-300"
          >
            {error === "magic_expired"
              ? "الرابط انتهت صلاحيته. اطلب رابطاً جديداً."
              : "تعذّر تسجيل الدخول. حاول مرة أخرى."}
          </div>
        ) : null}

        {/* Magic Link Form */}
        <MagicLinkLoginForm
          storeSubdomain={store.subdomain}
          redirectAfter={safeRedirect}
        />

        {/* Separator */}
        <div className="relative">
          <div
            className="absolute inset-0 flex items-center"
            aria-hidden="true"
          >
            <div
              className="w-full border-t"
              style={{ borderColor: "var(--border)" }}
            />
          </div>
          <div className="relative flex justify-center">
            <span
              className="px-3 text-[10.5px] font-bold uppercase tracking-wider"
              style={{
                background: "var(--card)",
                color: "var(--muted-foreground)",
              }}
            >
              أو
            </span>
          </div>
        </div>

        {/* Google Login */}
        <CustomerGoogleAuthButton
          storeSubdomain={store.subdomain}
          redirectAfter={safeRedirect}
          label="متابعة بحساب Google"
          className="inline-flex h-12 w-full items-center justify-center gap-2.5 rounded-2xl text-sm font-black shadow-md transition-all hover:brightness-110 active:scale-[0.98]"
        />

        {/* Privacy */}
        <div className="flex items-start justify-center gap-1.5 pt-2 text-[10.5px] leading-relaxed opacity-55">
          <ShieldCheck
            className="mt-0.5 size-3 shrink-0"
            strokeWidth={2.25}
            aria-hidden="true"
          />
          <span>
            نستخدم بريدك واسمك فقط لتسهيل تسجيل الدخول ومتابعة طلباتك.
          </span>
        </div>

        {/* Guest option */}
        <div
          className="border-t pt-4 text-[11px] opacity-70"
          style={{ borderColor: "var(--border)" }}
        >
          <a
            href="/"
            className="font-bold transition-opacity hover:opacity-100"
            style={{ color: "var(--primary)" }}
          >
            متابعة التسوق كزائر
          </a>
        </div>
      </div>
    </div>
  );
}