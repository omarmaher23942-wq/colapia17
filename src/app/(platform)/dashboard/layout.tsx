// dashboard/layout.tsx — غلاف لوحة التاجر: القائمة، والشريط العلوي، ونبض اللوحة (الشارات وتنبيه الطلب الجديد)،
// ولوحة الأوامر (Ctrl/⌘+K)، والمساعد نوفا، وجولة التاجر الجديد.
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { getMerchantSession } from "@/server/auth";
import { DashboardPulse } from "@/components/dashboard/DashboardPulse";
import { attentionCounts } from "@/server/repos/attention";
import { CommandPalette } from "@/components/dashboard/CommandPalette";
import { memberPerms, storeLock } from "@/server/merchant-guard";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { DashboardTopbar } from "@/components/dashboard/DashboardTopbar";
import { OnboardingTour } from "@/components/dashboard/OnboardingTour";
import { DASH_THEME_COOKIE } from "@/lib/dash-theme";
import { readRequestId } from "@/lib/correlation";
import { log } from "@/lib/logger";
import { DASHBOARD_TITLE_TEMPLATE } from "@/lib/edition";
import { storeUrl } from "@/lib/utils";
import { hostingState } from "@/lib/hosting";
import { InstallPrompt } from "@/components/InstallPrompt";
import { PathBanners } from "@/components/dashboard/PathBanners";
import { hostingGraceDays } from "@/server/hosting-grace";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { platformPayments } from "@/db/schema";

export const metadata: Metadata = {
  title: { default: "لوحة التحكم", template: DASHBOARD_TITLE_TEMPLATE },
  description: "إدارة متجرك، طلباتك، وعملائك من مكان واحد.",
};

export const dynamic = "force-dynamic";

function isNewMerchant(merchantCreatedAt: Date | null): boolean {
  if (!merchantCreatedAt) return false;
  const age = Date.now() - merchantCreatedAt.getTime();
  return age < 7 * 86_400_000;
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const reqId = await readRequestId();
  const session = await getMerchantSession();

  if (!session) {
    log.info("auth", "dashboard_unauthorized_redirect", { reqId });
    // يعود بعد الدخول للصفحة التي فتحها (رابط «تفعيل المتجر» في بريد أو صفحة المتابعة مثلاً).
    const back = (await headers()).get("x-pathname") ?? "/dashboard";
    redirect(`/login?redirect=${encodeURIComponent(back.startsWith("/dashboard") ? back : "/dashboard")}&reason=no_session`);
  }

  // اشتراك الاستضافة: تذكير في كل الصفحات قبل الانتهاء وفي السماح. عند التجميد أو الإيقاف تُقفل اللوحة إلا الاشتراك
  // (requireStoreArea يفرض ذلك في كل صفحة، وهنا اللافتة فقط)، والتجربة الجارية لها عدّاد تنازلي حي (V3: D3، D4).
  const hosting = session.store ? hostingState(session.store, new Date(), await hostingGraceDays().catch(() => undefined)) : ({ phase: "none" } as const);
  const lock = session.store ? await storeLock(session.store).catch(() => null) : null;
  const trialEnd = session.store?.status === "trial" ? (session.store.trialEndsAt ?? session.store.demoExpiresAt ?? null) : null;
  const trial =
    session.store && trialEnd
      ? {
          endsAt: trialEnd.toISOString(),
          reviewPending: Boolean(
            (
              await db
                .select({ id: platformPayments.id })
                .from(platformPayments)
                .where(and(eq(platformPayments.storeId, session.store.id), eq(platformPayments.status, "under_review")))
                .limit(1)
                .catch(() => [])
            ).length
          ),
        }
      : null;

  // أعداد «ما يحتاج انتباهك» من الخادم مع أول رسم، فلا تومض الشارات من صفر.
  const pulseAt = new Date().toISOString();
  const pulse = session.storeId && !lock ? await attentionCounts(session.storeId).catch(() => null) : null;

  // فحص tour الدخول الأول: نستخدم cookie لمنع التكرار المزعج.
  const jar = await cookies();
  const tourSeen = jar.get("clp_tour_v3_seen")?.value === "1";
  // الافتراضي «حسب النظام»: فاتح في أول زيارة، ويتبع تفضيل الجهاز بسكربت صغير قبل الرسم، حتى يختار التاجر بنفسه (كوكي).
  const themeCookie = jar.get(DASH_THEME_COOKIE)?.value;
  const theme = themeCookie === "dark" ? "dark" : "light";
  const followSystem = !themeCookie;
  const showTour =
    !tourSeen &&
    (isNewMerchant(session.merchant.createdAt) || session.store === null);

  return (
    <div dir="rtl" suppressHydrationWarning className={`dash dash-cosmos min-h-dvh text-ink ${theme === "dark" ? "dark" : ""}`}>
      {followSystem ? (
        <script
          dangerouslySetInnerHTML={{ __html: "try{if(matchMedia('(prefers-color-scheme: dark)').matches)document.currentScript.parentElement.classList.add('dark')}catch(e){}" }}
        />
      ) : null}
      {/* Skip-to-content — يظهر عند focus فقط */}
      <a
        href="#dashboard-main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:start-4 focus:z-[100] focus:rounded-lg focus:bg-nova focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-white focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-edge/40"
      >
        تخطي إلى المحتوى الرئيسي
      </a>

      <DashboardPulse storeId={session.storeId} initial={pulse} initialAt={pulseAt}>
        <div className="flex min-h-dvh">
          <DashboardSidebar
            merchant={{
              displayName: session.merchant.displayName,
              email: session.merchant.email,
              avatarUrl: session.merchant.avatarUrl,
            }}
            store={
              session.store
                ? {
                    id: session.store.id,
                    name: session.store.name,
                    subdomain: session.store.subdomain,
                    status: session.store.status,
                  }
                : null
            }
            allStores={session.stores.map((s) => ({ id: s.id, name: s.name, subdomain: s.subdomain, status: s.status }))}
            perms={memberPerms(session)}
            locked={Boolean(lock)}
          />

          <div className="flex min-w-0 flex-1 flex-col">
            <DashboardTopbar
              merchantName={session.merchant.displayName}
              merchantEmail={session.merchant.email}
              merchantAvatarUrl={session.merchant.avatarUrl}
              storeStatus={session.store?.status ?? null}
              acceptingOrders={session.store?.acceptingOrders ?? true}
              locked={Boolean(lock)}
              theme={theme}
            />

            <main
              id="dashboard-main"
              className="min-w-0 flex-1 p-4 pb-40 md:p-6 md:pb-40 lg:p-8 lg:pb-28"
            >
              <PathBanners hosting={hosting} perms={memberPerms(session)} trial={trial} lock={lock} />
              {children}
            </main>
          </div>
        </div>

        {/* Command Palette — متاح عالمياً بـ ⌘K */}
        <CommandPalette storeHref={session.store && !lock ? storeUrl(session.store.subdomain) : null} hasStore={Boolean(session.store) && !lock} locked={Boolean(lock)} perms={memberPerms(session)} subdomain={session.store?.subdomain ?? null} />

        {/* Onboarding Tour — للتاجر الجديد فقط */}
        <OnboardingTour autoOpen={showTour} />
        {showTour ? null : <InstallPrompt variant="platform" />}
      </DashboardPulse>
    </div>
  );
}