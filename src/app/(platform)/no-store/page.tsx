// /no-store — حساب سجّل الدخول لكن لا متجر مرتبط به. شاشة لطيفة بتبديل الحساب (لا /login: يعيد من له جلسة إلى اللوحة فتدور حلقة).
import type { Metadata } from "next";
import { ColapiaLogo } from "@/components/brand/ColapiaLogo";
import { NoStoreNotice } from "@/components/auth/NoStoreNotice";
import { switchMerchantAccountAction } from "../login/actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "لا يوجد متجر مرتبط", robots: { index: false, follow: false } };

export default function NoStorePage() {
  return (
    <main dir="rtl" lang="ar" className="flex min-h-dvh items-center justify-center bg-[#07091a] px-4 py-12 text-[#eaf0ff]">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <ColapiaLogo size={36} />
        </div>
        <NoStoreNotice switchAction={switchMerchantAccountAction.bind(null, "/dashboard")} />
      </div>
    </main>
  );
}
