// dashboard/marketing — «التسويق»: ربط المتجر بحسابات الإعلانات (بكسل ميتا وواجهة التحويلات وGA4 وتيك توك وSearch
// Console)، وكتالوج المنتجات لإعلانات ميتا الديناميكية وGoogle Merchant Center.
import type { Metadata } from "next";
import { requireStoreArea, sessionPerms } from "@/server/merchant-guard";
import { getBlueprintOrNull } from "@/lib/tenant";
import { trackingFrom } from "@/lib/tracking";
import { metaCapiToken } from "@/server/store-secrets";
import { allows } from "@/lib/store-perms";
import { storeUrl } from "@/lib/utils";
import { TrackingPanel } from "@/components/dashboard/marketing/TrackingPanel";
import { CopyField } from "@/components/dashboard/marketing/CopyField";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "التسويق" };

export default async function MarketingPage() {
  const s = await requireStoreArea("discounts");
  const [bp, capi] = await Promise.all([getBlueprintOrNull(s.storeId), metaCapiToken(s.storeId)]);
  const ids = trackingFrom(bp?.seo);
  const canEdit = allows(sessionPerms(s), "discounts", "manage") && allows(sessionPerms(s), "content", "manage");
  const feed = storeUrl(s.store.subdomain, "/feed.xml");

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
