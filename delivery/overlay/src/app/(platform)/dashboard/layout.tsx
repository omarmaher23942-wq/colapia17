// dashboard/layout.tsx — غلاف لوحة التحكم: القائمة، والشريط العلوي، ونبض اللوحة (الشارات وتنبيه الطلب الجديد)،
// ولوحة الأوامر (Ctrl/⌘+K)، وجولة الترحيب. أسفل المحتوى رابط واحد لطلب تعديل من فريق التنفيذ (رابط فقط).
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { getMerchantSession } from "@/server/auth";
import { DashboardPulse } from "@/components/dashboard/DashboardPulse";
import { attentionCounts } from "@/server/repos/attention";
import { CommandPalette } from "@/components/dashboard/CommandPalette";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { DashboardTopbar } from "@/components/dashboard/DashboardTopbar";
import { OnboardingTour } from "@/components/dashboard/OnboardingTour";
import { DASH_THEME_COOKIE } from "@/lib/dash-theme";
import { DASHBOARD_TITLE_TEMPLATE } from "@/lib/edition";
import { storeUrl } from "@/lib/utils";
import { InstallPrompt } from "@/components/InstallPrompt";
import { STORE } from "@/store.config";

export const metadata: Metadata = {
  title: { default: "لوحة التحكم", template: DASHBOARD_TITLE_TEMPLATE },
  description: "إدارة المتجر والطلبات والعملاء من مكان واحد.",
};

export const dynamic = "force-dynamic";

function isNewMerchant(merchantCreatedAt: Date | null): boolean {
  if (!merchantCreatedAt) return false;
  return Date.now() - merchantCreatedAt.getTime() < 7 * 86_400_000;
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getMerchantSession();

  if (!session) {
    // يعود بعد الدخول للصفحة التي فُتحت.
    const back = (await headers()).get("x-pathname") ?? "/dashboard";
    redirect(`/login?redirect=${encodeURIComponent(back.startsWith("/dashboard") ? back : "/dashboard")}&reason=no_session`);
  }

  // أعداد «ما يحتاج انتباهكم» من الخادم مع أول رسم، فلا تومض الشارات من صفر.
  const pulseAt = new Date().toISOString();
  const pulse = session.storeId ? await attentionCounts(session.storeId).catch(() => null) : null;

  const jar = await cookies();
  const tourSeen = jar.get("clp_tour_v3_seen")?.value === "1";
  // الافتراضي «حسب النظام»: فاتح في أول زيارة، ويتبع تفضيل الجهاز بسكربت صغير قبل الرسم، حتى يختار صاحب المتجر بنفسه (كوكي).
  const themeCookie = jar.get(DASH_THEME_COOKIE)?.value;
  const theme = themeCookie === "dark" ? "dark" : "light";
  const followSystem = !themeCookie;
  const showTour = !tourSeen && (isNewMerchant(session.merchant.createdAt) || session.store === null);

  return (
    <div dir="rtl" suppressHydrationWarning className={`dash dash-cosmos min-h-dvh text-ink ${theme === "dark" ? "dark" : ""}`}>
      {followSystem ? (
        <script dangerouslySetInnerHTML={{ __html: "try{if(matchMedia('(prefers-color-scheme: dark)').matches)document.currentScript.parentElement.classList.add('dark')}catch(e){}" }} />
      ) : null}
      <a
        href="#dashboard-main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:start-4 focus:z-[100] focus:rounded-lg focus:bg-nova focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-white focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-edge/40"
      >
        تخطي إلى المحتوى الرئيسي
      </a>

      <DashboardPulse storeId={session.storeId} initial={pulse} initialAt={pulseAt}>
        <div className="flex min-h-dvh">
          <DashboardSidebar
            merchant={{ displayName: session.merchant.displayName, email: session.merchant.email, avatarUrl: session.merchant.avatarUrl }}
            store={session.store ? { id: session.store.id, name: session.store.name, subdomain: session.store.subdomain, status: session.store.status } : null}
            allStores={session.stores.map((s) => ({ id: s.id, name: s.name, subdomain: s.subdomain, status: s.status }))}
            perms={null}
            locked={false}
          />

          <div className="flex min-w-0 flex-1 flex-col">
            <DashboardTopbar
              merchantName={session.merchant.displayName}
              merchantEmail={session.merchant.email}
              merchantAvatarUrl={session.merchant.avatarUrl}
              storeStatus={session.store?.status ?? null}
              acceptingOrders={session.store?.acceptingOrders ?? true}
              locked={false}
              theme={theme}
            />

            <main id="dashboard-main" className="min-w-0 flex-1 p-4 pb-40 md:p-6 md:pb-40 lg:p-8 lg:pb-28">
              {children}
              <footer className="mt-10 border-t border-edge/10 pt-4 text-center text-[12px] text-ink-3">
                <a href={STORE.agencyUrl} target="_blank" rel="noopener noreferrer" className="font-bold text-nova-2 underline-offset-4 hover:underline">
                  طلب تعديل
                </a>
              </footer>
            </main>
          </div>
        </div>

        <CommandPalette storeHref={session.store ? storeUrl(session.store.subdomain) : null} hasStore={Boolean(session.store)} locked={false} perms={null} subdomain={session.store?.subdomain ?? null} />

        <OnboardingTour autoOpen={showTour} />
        {showTour ? null : <InstallPrompt variant="platform" />}
      </DashboardPulse>
    </div>
  );
}
