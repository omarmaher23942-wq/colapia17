import { requireMerchantStore } from "@/server/auth";
import { ReferralDashboard } from "@/components/growth/ReferralDashboard";
import { SocialShareCardGenerator } from "@/components/growth/SocialShareCardGenerator";
import { getTenantDb } from "@/db/tenant";
import { products } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function GrowthDashboardPage() {
  const s = await requireMerchantStore();
  const db = await getTenantDb(s.storeId);

  // جلب منتج عشوائي لتوليد كارت السوشيال ميديا كبداية
  const [randomProduct] = await db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.storeId, s.storeId), isNull(products.deletedAt)))
    .limit(1);

  return (
    <div className="space-y-8 bg-space text-ink" dir="rtl">
      <div className="border-b border-edge/10 pb-5">
        <h1 className="text-2xl font-black text-ink">محرك النمو والتسويق (Growth Engine)</h1>
        <p className="mt-1 text-xs text-ink-3">برنامج الشركاء، توليد كروت السوشيال ميديا، وأدوات زيادة المبيعات الفيروسية.</p>
      </div>

      <ReferralDashboard />

      {randomProduct ? (
        <SocialShareCardGenerator productId={randomProduct.id} />
      ) : (
        <div className="rounded-3xl border border-dashed border-edge/10 p-12 text-center text-ink-3">
          أضف منتجات أولاً لتتمكن من توليد كروت السوشيال ميديا التسويقية.
        </div>
      )}
    </div>
  );
}