// /admin/pricing — أسعار Colapia v4 (للمالك وحده): رسوم التجهيز، والدائرة الذهبية بمقاعدها الحقيقية، والباقات الشهرية
// الثلاث بكل حدودها، والمدد، ومعاينة حية لما يراه التاجر والهبوط والوكيل. ومدد دورة الحياة (التجربة والحذف والسماح).
import { BadgeDollarSign } from "lucide-react";
import { requirePlatformPage } from "@/server/platform-guard";
import { currentPricing, goldenStatus } from "@/server/pricing";
import { lifecycleTimings } from "@/lifecycle/timings";
import { PricingConsole, TimingsEditor } from "@/components/platform/PricingEditor";

export const dynamic = "force-dynamic";

export default async function PricingPage() {
  await requirePlatformPage({ cap: "pricing" });
  const [p, t, golden] = await Promise.all([currentPricing(), lifecycleTimings(), goldenStatus()]);
  return (
    <div className="mx-auto max-w-6xl space-y-6 text-[#eaf0ff]" dir="rtl">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-black">
          <BadgeDollarSign className="size-6 text-[#8fa8ff]" aria-hidden="true" /> الأسعار والمدد
        </h1>
        <p className="mt-1 text-[13px] leading-6 text-[#a9b3dc]">
          التغيير يسري على الدفعات الجديدة فوراً، أما الدفعة المسجّلة فتحتفظ بباقتها ومدتها ومبلغها كما اختارها التاجر. الحدود تُطبَّق على كل متجر حسب باقته.
        </p>
      </header>

      <PricingConsole initial={p} usage={{ confirmed: golden.confirmed, underReview: golden.underReview }} />

      <section className="rounded-3xl border border-white/10 bg-[#0b0f2a] p-5">
        <h2 className="mb-1 text-sm font-black">مدد دورة الحياة</h2>
        <p className="mb-3 text-[12.5px] leading-6 text-[#a9b3dc]">
          التجربة ← إيقاف وبريد ← بعد «مهلة التنبيه» بريد «تنبيه أخير قبل الحذف» ← بعد «مهلة الحذف» يُحذف المتجر غير المدفوع. أما المتجر المدفوع فبعد انتهاء اشتراكه يبقى
          يعمل طوال «السماح» ثم يتوقف عن الظهور <b>بلا حذف أبداً</b>، ويعود فور التجديد.
        </p>
        <TimingsEditor initial={t} />
      </section>
    </div>
  );
}
