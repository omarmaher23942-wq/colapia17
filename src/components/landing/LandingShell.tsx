// غلاف صفحات المنصة العامة (الرئيسية، من نحن، أعمالنا): الخلفية والهيدر والفوتر ومبدّل الوضع الفاتح/الداكن.
// يُرسم على الخادم بالكامل (سرعة وظهور في البحث)، والتفاعل في جزر صغيرة (Header وThemeToggle).
import type { ReactNode } from "react";
import { InstallPrompt } from "@/components/InstallPrompt";
import { CosmicBackdrop } from "./CosmicBackdrop";
import { Footer } from "./Footer";
import { Header } from "./Header";
import type { SessionState } from "./types";

export function LandingShell({ session, children }: { session: SessionState; children: ReactNode }) {
  return (
    <div dir="rtl" lang="ar" suppressHydrationWarning className="land relative min-h-dvh overflow-x-clip bg-[#07091a] text-[#eaf0ff]">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-[100] focus:rounded-xl focus:bg-[#8fa8ff] focus:px-4 focus:py-2 focus:text-[#07091a]">
        تخطَّوا إلى المحتوى الرئيسي
      </a>
      {/* يضبط الوضع قبل أول رسم فلا يحدث وميض (يتبع اختيار الزائر ثم نظام الجهاز). */}
      <script
        dangerouslySetInnerHTML={{
          __html: `try{var t=localStorage.getItem("clp-land-theme");if(t==="light"||(!t&&matchMedia("(prefers-color-scheme: light)").matches))document.currentScript.parentElement.classList.add("land-light")}catch(e){}`,
        }}
      />
      <CosmicBackdrop />
      <Header session={session} />
      <main id="main-content">{children}</main>
      <Footer />
      <InstallPrompt variant="platform" />
    </div>
  );
}
