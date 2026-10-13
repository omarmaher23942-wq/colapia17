// /admin/pricing — سلّم الأسعار (قرار المالك): مراحل «من متجر كذا إلى كذا بسعر كذا»، السعر «قبل الخصم»، والتجديد،
// والعدّاد الحقيقي من الباقات المدفوعة فعلاً. ومدد ما بعد التسليم (التجربة، التنبيه الأخير، الحذف).
import { BadgeDollarSign } from "lucide-react";
import { requirePlatformPage } from "@/server/platform-guard";
import { currentPricing, goldenSeatsUsed } from "@/server/pricing";
import { lifecycleTimings } from "@/lifecycle/timings";
import { PricingEditor, TimingsEditor } from "@/components/platform/PricingEditor";

export const dynamic = "force-dynamic";

export default async function PricingPage() {
  await requirePlatformPage({ cap: "pricing" });
  const [p, t, goldenUsed] = await Promise.all([currentPricing(), lifecycleTimings(), goldenSeatsUsed()]);
  return (
    <div className="mx-auto max-w-4xl space-y-6 text-[#eaf0ff]" dir="rtl">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-black">
          <BadgeDollarSign className="size-6 text-[#8fa8ff]" aria-hidden="true" /> الأسعار والمدد
        </h1>
        <p className="mt-1 text-[13px] text-[#8d97c4]">السعر يُثبَّت لكل متجر لحظة تسليمه، فتغيير السلّم يسري على من يُسلَّم بعده فقط.</p>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-[#0b0f2a] p-4">
          <p className="text-[12px] font-bold text-[#8d97c4]">السعر الآن لمتجر جديد</p>
          <p className="mt-1 text-2xl font-black">{p.price.toLocaleString("en-US")} ج</p>
          {p.basePrice > p.price ? <p className="text-[12px] text-[#8d97c4] line-through">{p.basePrice.toLocaleString("en-US")} ج</p> : null}
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#0b0f2a] p-4">
          <p className="text-[12px] font-bold text-[#8d97c4]">باقات مدفوعة فعلاً</p>
          <p className="mt-1 text-2xl font-black">{p.paid}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#0b0f2a] p-4">
          <p className="text-[12px] font-bold text-[#8d97c4]">باقٍ بهذا السعر في السلّم</p>
          <p className="mt-1 text-2xl font-black">{p.remaining ?? "بلا حد"}</p>
          {p.nextPrice ? <p className="text-[12px] text-[#8d97c4]">ثم {p.nextPrice.toLocaleString("en-US")} ج</p> : null}
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-[#0b0f2a] p-5">
        <h2 className="mb-3 text-sm font-black">سلّم الأسعار</h2>
        <PricingEditor initial={p.ladder} goldenUsed={goldenUsed} />
      </section>

      <section className="rounded-3xl border border-white/10 bg-[#0b0f2a] p-5">
        <h2 className="mb-1 text-sm font-black">مدد ما بعد التسليم</h2>
        <p className="mb-3 text-[12.5px] text-[#8d97c4]">التجربة ← إيقاف وبريد ← بعد «مهلة التنبيه» بريد «تنبيه أخير قبل الحذف» ← بعد «مهلة الحذف» يُحذف المتجر وبياناته وصوره. الدفع في أي لحظة قبل الحذف يعيده فوراً.</p>
        <TimingsEditor initial={t} />
      </section>
    </div>
  );
}
