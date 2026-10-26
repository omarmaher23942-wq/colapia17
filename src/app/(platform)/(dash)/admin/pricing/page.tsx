// /admin/pricing — أسعار Colapia (V4، للمالك وحده): سعر المشروع، والدائرة الذهبية بمقاعدها الحقيقية، وشروط التعديل بعد
// التسليم، ونص المشاريع الأخرى، مع معاينة حية لما تعرضه صفحة الحجز ويقوله الوكيل.
import { BadgeDollarSign } from "lucide-react";
import { requirePlatformPage } from "@/server/platform-guard";
import { currentPricing, goldenStatus } from "@/server/pricing";
import { PricingConsole } from "@/components/platform/PricingEditor";

export const dynamic = "force-dynamic";

export default async function PricingPage() {
  await requirePlatformPage({ cap: "pricing" });
  const [p, golden] = await Promise.all([currentPricing(), goldenStatus()]);
  return (
    <div className="mx-auto max-w-4xl space-y-6 text-[#eaf0ff]" dir="rtl">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-black">
          <BadgeDollarSign className="size-6 text-[#8fa8ff]" aria-hidden="true" /> الأسعار
        </h1>
        <p className="mt-1 text-[13px] leading-6 text-[#a9b3dc]">التغيير يسري على الحجوزات الجديدة فوراً، أما الدفعة المسجّلة فتحتفظ بمبلغها كما سُجّل لحظة الحجز.</p>
      </header>
      <PricingConsole initial={p} usage={{ confirmed: golden.confirmed, underReview: golden.underReview }} />
    </div>
  );
}
