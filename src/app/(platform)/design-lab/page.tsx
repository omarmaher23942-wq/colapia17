// معمل التصميم: معاينة مكونات الواجهة ببيانات تجريبية بلا قاعدة بيانات. في التطوير فقط (404 في الإنتاج).
import { notFound } from "next/navigation";
import { RealtimeProvider } from "@/components/dashboard/RealtimeProvider";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { DashboardTopbar } from "@/components/dashboard/DashboardTopbar";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { Copilot } from "@/components/dashboard/Copilot";
import { OwnershipCenter } from "@/components/dashboard/own/OwnershipCenter";
import { Wallet, ShoppingCart, Users, Eye } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DesignLab({ searchParams }: { searchParams: Promise<{ theme?: string; paid?: string; view?: string }> }) {
  if (process.env.NODE_ENV !== "development") notFound();
  const { theme, view } = await searchParams;
  if (view === "shell") {
    return (
      <div dir="rtl" className={`dash dash-cosmos min-h-dvh text-ink ${theme === "light" ? "" : "dark"}`}>
        <RealtimeProvider merchantId="00000000-0000-0000-0000-000000000001" storeId={null}>
          <div className="flex min-h-dvh">
            <DashboardSidebar
              merchant={{ displayName: "عمر ماهر", email: "omar@example.com", avatarUrl: null }}
              store={{ name: "متجر نوفا", subdomain: "nova", status: "trial" }}
              badges={{ orders: 3, trialDaysLeft: 1 }}
            />
            <div className="flex min-w-0 flex-1 flex-col">
              <DashboardTopbar merchantName="عمر ماهر" merchantEmail="omar@example.com" merchantAvatarUrl={null} storeStatus="trial" theme={theme === "light" ? "light" : "dark"} />
              <main className="min-w-0 flex-1 p-4 md:p-8">
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                  <KpiCard title="المبيعات (30 يوماً)" value="48,250 ج" delta={18} deltaType="up" icon={Wallet} href="#" sparkline={[3, 5, 4, 7, 6, 9, 8, 12, 11, 14]} />
                  <KpiCard title="الطلبات" value="126" delta={9} deltaType="up" icon={ShoppingCart} href="#" sparkline={[5, 6, 5, 8, 7, 9, 10, 9, 12, 13]} />
                  <KpiCard title="عملاء جدد" value="41" delta={-4} deltaType="down" icon={Users} href="#" sparkline={[6, 5, 7, 6, 5, 4, 5, 4, 4, 3]} />
                  <KpiCard title="الزيارات" value="3,920" delta={0} deltaType="neutral" icon={Eye} href="#" sparkline={[4, 4, 5, 4, 5, 5, 4, 5, 5, 5]} />
                </div>
              </main>
            </div>
          </div>
          <Copilot storeName="متجر نوفا" />
        </RealtimeProvider>
      </div>
    );
  }
  return (
    <div dir="rtl" className={`dash dash-cosmos min-h-dvh p-4 text-ink md:p-8 ${theme === "light" ? "" : "dark"}`}>
      <OwnershipCenter
        storeName="متجر نوفا"
        subdomain="nova"
        active={view !== "locked"}
        githubEnabled
        repo={view === "repo" || view === "transfer" || view === "owned" ? "omar/nova-store" : null}
        github={{ state: null, message: null }}
        purgeAfter={null}
        purgedAt={view === "owned" ? new Date().toISOString() : null}
        live={{
          transfer: view === "transfer" ? { status: "importing", siteUrl: "https://nova-store.vercel.app", lastSeenAt: new Date().toISOString(), expiresAt: new Date().toISOString() } : null,
          ownedUrl: view === "owned" ? "https://nova-store.vercel.app" : null,
          ownedAt: view === "owned" ? new Date().toISOString() : null,
        }}
      />
    </div>
  );
}
