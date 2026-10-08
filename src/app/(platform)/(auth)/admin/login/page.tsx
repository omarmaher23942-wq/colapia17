import { redirect } from "next/navigation";
import { ShieldCheck, AlertTriangle } from "lucide-react";
import { ColapiaLogo } from "@/components/brand/ColapiaLogo";
import { getPlatformSession } from "@/server/auth";
import { initiatePlatformGoogleAuthAction } from "@/server/actions/platform-auth";

export const dynamic = "force-dynamic";

export default async function PlatformLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; reason?: string }>;
}) {
  const session = await getPlatformSession();
  if (session) redirect("/admin");

  const { error, reason } = await searchParams;
  const showUnauthorized = error === "unauthorized" || reason === "unauthorized";

  return (
    <div
      className="relative flex min-h-dvh items-center justify-center bg-[#07091a] p-4 font-sans text-slate-100"
      dir="rtl"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      >
        <div className="absolute -top-40 start-1/2 size-[520px] -translate-x-1/2 rounded-full bg-[#6f86ff]/10 blur-3xl" />
        <div className="absolute -bottom-32 end-1/3 size-[360px] rounded-full bg-[#a78bfa]/10 blur-3xl" />
      </div>

      <div className="absolute top-8 start-1/2 -translate-x-1/2">
        <ColapiaLogo size={40} />
      </div>

      <div className="w-full max-w-md space-y-6 rounded-[2rem] border border-white/10 bg-[#090d24]/90 p-8 text-center shadow-2xl backdrop-blur-xl sm:p-10">
        <div className="mx-auto grid size-16 place-items-center rounded-3xl border border-[#8fa8ff]/30 bg-[#6f86ff]/20 text-[#8fa8ff] shadow-[0_0_30px_-5px_rgba(111,134,255,0.4)]">
          <ShieldCheck className="size-8" strokeWidth={1.75} aria-hidden="true" />
        </div>

        <div>
          <h1 className="text-2xl font-black text-white">مركز قيادة المنصة</h1>
          <p className="mt-2 text-xs font-medium leading-relaxed text-slate-400">
            تسجيل دخول آمن لإدارة متاجر كولابيا، متابعة التحويلات، وخط إنتاج
            الذكاء الاصطناعي.
          </p>
        </div>

        {showUnauthorized ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-start"
          >
            <AlertTriangle
              className="mt-0.5 size-4 shrink-0 text-red-300"
              strokeWidth={2.25}
              aria-hidden="true"
            />
            <div className="text-[11.5px] font-bold leading-relaxed text-red-200">
              <p>هذا الحساب غير مصرح له بالدخول لمركز القيادة.</p>
              <p className="mt-1 text-[10.5px] font-medium text-red-200/70">
                لو تعتقد أن هذا خطأ، تواصل مع مالك المنصة لإضافتك إلى قائمة
                المسؤولين.
              </p>
            </div>
          </div>
        ) : null}

        <form
          action={async (formData: FormData) => {
            "use server";
            await initiatePlatformGoogleAuthAction();
          }}
        >
          <button
            type="submit"
            className="inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-white px-4 py-3.5 text-xs font-black text-slate-900 shadow-md transition-all hover:bg-slate-100 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8fa8ff] focus-visible:ring-offset-2 focus-visible:ring-offset-[#090d24] sm:text-sm"
          >
            <svg
              className="size-5"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M23.7449 12.27C23.7449 11.48 23.6749 10.73 23.5549 10H12.2148V14.51H18.7248C18.4348 15.99 17.5848 17.24 16.3248 18.09V21.09H20.2148C22.4749 19.01 23.7449 15.92 23.7449 12.27Z"
                fill="#4285F4"
              />
              <path
                d="M12.2148 24C15.4548 24 18.1648 22.92 20.2148 21.09L16.3248 18.09C15.2448 18.81 13.8448 19.25 12.2148 19.25C9.09484 19.25 6.45484 17.14 5.50484 14.33H1.48486V17.44C3.46486 21.36 7.51484 24 12.2148 24Z"
                fill="#34A853"
              />
              <path
                d="M5.50484 14.33C5.25484 13.59 5.11484 12.81 5.11484 12C5.11484 11.19 5.25484 10.41 5.50484 9.67V6.56H1.48486C0.674863 8.16 0.214844 9.99 0.214844 12C0.214844 14.01 0.674863 15.84 1.48486 17.44L5.50484 14.33Z"
                fill="#FBBC05"
              />
              <path
                d="M12.2148 4.75C13.9848 4.75 15.5648 5.36 16.8148 6.54L20.3048 3.05C18.1548 1.05 15.4548 0 12.2148 0C7.51484 0 3.46486 2.64 1.48486 6.56L5.50484 9.67C6.45484 6.86 9.09484 4.75 12.2148 4.75Z"
                fill="#EA4335"
              />
            </svg>
            <span>الدخول بحساب Google</span>
          </button>
        </form>

        <p className="text-[10.5px] leading-relaxed text-slate-500">
          الدخول مقتصر على المسؤولين المسجلين مسبقاً في قائمة المنصة. لا يوجد
          بديل بكلمة مرور.
        </p>
      </div>
    </div>
  );
}