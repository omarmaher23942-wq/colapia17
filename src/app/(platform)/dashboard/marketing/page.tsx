// dashboard/marketing — «التسويق»: ربط المتجر بحسابات الإعلانات (بكسل ميتا وواجهة التحويلات وGA4 وتيك توك وSearch
// Console)، وروابط الحملات بأدائها، وكتالوج المنتجات لإعلانات ميتا الديناميكية وGoogle Merchant Center.
import type { Metadata } from "next";
import { requireStoreArea, sessionPerms } from "@/server/merchant-guard";
import { getBlueprintOrNull } from "@/lib/tenant";
import { trackingFrom } from "@/lib/tracking";
import { metaCapiToken } from "@/server/store-secrets";
import { allows } from "@/lib/store-perms";
import { publicStoreUrl } from "@/lib/utils";
import { TrackingPanel } from "@/components/dashboard/marketing/TrackingPanel";
import { CopyField } from "@/components/dashboard/marketing/CopyField";
import { CampaignsPanel } from "@/components/dashboard/marketing/CampaignsPanel";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { getStoreFacts } from "@/server/repos/facts";
import { LaunchKit } from "@/components/dashboard/marketing/LaunchKit";
import { getTenantDb } from "@/db/tenant";
import { categories, products } from "@/db/schema";
import { listDiscounts } from "@/server/repos/discounts-list";
import { discountState, discountValueLabel } from "@/lib/discounts";
import { campaignStats } from "@/server/repos/campaigns";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "التسويق" };

export default async function MarketingPage() {
  const s = await requireStoreArea("discounts");
  const db = await getTenantDb(s.storeId);
  const [bp, capi, prods, cats, discs] = await Promise.all([
    getBlueprintOrNull(s.storeId),
    metaCapiToken(s.storeId),
    db
      .select({ id: products.id, slug: products.slug, name: products.name, price: products.pricePiasters, compareAt: products.compareAtPiasters, images: products.images })
      .from(products)
      .where(and(eq(products.storeId, s.storeId), eq(products.status, "active"), isNull(products.deletedAt)))
      .orderBy(desc(products.orderCount), asc(products.name))
      .limit(300),
    db.select({ slug: categories.slug, name: categories.name }).from(categories).where(eq(categories.storeId, s.storeId)).orderBy(asc(categories.name)),
    listDiscounts(s.storeId).catch(() => []),
  ]);
  const campaigns = bp?.campaigns ?? [];
  const [stats, facts] = await Promise.all([campaignStats(s.storeId, campaigns.map((c) => c.slug)), bp ? getStoreFacts(s.storeId, bp) : Promise.resolve([])]);
  const activeCodes = discs.filter((d) => discountState(d) === "active").map((d) => ({ code: d.code, label: discountValueLabel(d) }));
  const publicUrl = publicStoreUrl(s.store);
  const ids = trackingFrom(bp?.seo);
  const canEdit = allows(sessionPerms(s), "discounts", "manage") && allows(sessionPerms(s), "content", "manage");
  const feed = publicStoreUrl(s.store, "/feed.xml");

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header>
        <h1 className="text-2xl font-black text-ink">التسويق</h1>
        <p className="mt-1 text-[13px] leading-6 text-ink-2">كل ما تحتاجه لتشغيل إعلانات تبيع وتقيس نتيجتها.</p>
      </header>

      <TrackingPanel
        canEdit={canEdit}
        capiMasked={capi ? `••••${capi.slice(-4)}` : null}
        initial={{
          metaPixelId: ids.metaPixelId ?? "",
          gaMeasurementId: ids.gaMeasurementId ?? "",
          tiktokPixelId: ids.tiktokPixelId ?? "",
          googleVerification: ids.googleVerification ?? "",
        }}
      />

      <CampaignsPanel
        campaigns={campaigns}
        stats={stats}
        baseUrl={publicUrl.replace(/\/$/, "")}
        products={prods.map((p) => ({ slug: p.slug, name: p.name }))}
        categories={cats}
        codes={activeCodes}
        canEdit={canEdit}
      />

      {bp ? (
        <LaunchKit
          storeName={bp.brand.name}
          tagline={bp.brand.tagline ?? null}
          url={publicUrl}
          host={publicUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")}
          logo={bp.brand.logo?.url ?? null}
          colors={{ primary: bp.theme.palette.primary, onPrimary: bp.theme.palette.primaryForeground, background: bp.theme.palette.background, foreground: bp.theme.palette.foreground }}
          products={prods.map((p) => ({ id: p.id, name: p.name, pricePiasters: p.price, compareAtPiasters: p.compareAt, image: p.images.find((i) => /^https?:/.test(i.url))?.url ?? null }))}
          facts={facts.map((f) => f.title)}
          codes={activeCodes}
        />
      ) : null}

      <section className="dash-card space-y-3 p-5">
        <h2 className="text-[15px] font-black text-ink">كتالوج المنتجات</h2>
        <p className="text-[12.5px] leading-6 text-ink-2">
          رابط واحد بكل منتجاتك المنشورة (الاسم والسعر والخصم والصور والتوفر) يتحدث تلقائياً مع كل تعديل. استخدمه لإعلانات المنتجات الديناميكية في ميتا ولعرض منتجاتك في Google.
        </p>
        <CopyField value={feed} label="رابط كتالوج المنتجات" />
        <ol className="list-decimal space-y-1.5 ps-5 text-[12.5px] leading-6 text-ink-2">
          <li>
            <b className="text-ink">ميتا:</b> مدير التجارة ← الكتالوج ← مصادر البيانات ← إضافة عناصر ← «موجز بيانات» ← «جدولة الموجز» والصق الرابط، واختر التحديث يومياً.
          </li>
          <li>
            <b className="text-ink">Google:</b> Merchant Center ← المنتجات ← إضافة منتجات ← «ملف» ← «إضافة رابط ملف» والصق الرابط.
          </li>
          <li>المنتج بلا صورة أو بلا سعر لا يظهر في الكتالوج (المنصتان ترفضانه).</li>
        </ol>
      </section>
    </div>
  );
}
