// dashboard/settings/data — بياناتكم ملككم: نسخة احتياطية كاملة (ZIP) وتصدير كل نوع بيانات على حدة إلى Excel.
import { redirect } from "next/navigation";
import { Archive, FileSpreadsheet } from "lucide-react";
import { getMerchantSession } from "@/server/auth";
import { isStoreOwner, requireStoreArea } from "@/server/merchant-guard";
import { NO_STORE_HREF } from "@/lib/edition";

export const dynamic = "force-dynamic";
export const metadata = { title: "النسخ الاحتياطي والتصدير" };

const EXPORTS = [
  { href: "/api/dashboard/export/products", title: "المنتجات", note: "بترويسات تقبلها صفحة «استيراد المنتجات»، فتصلح لنقل المنتجات أو تعديلها في Excel وإعادتها." },
  { href: "/api/dashboard/orders/export", title: "الطلبات", note: "كل الطلبات بعملائها ومبالغها وحالاتها." },
  { href: "/api/dashboard/customers/export", title: "العملاء", note: "الاسم والموبايل والعنوان وعدد الطلبات والمشتريات." },
  { href: "/api/dashboard/export/discounts", title: "أكواد الخصم", note: "القيمة والشروط وعدد مرات الاستخدام." },
  { href: "/api/dashboard/export/reviews", title: "التقييمات", note: "آراء العملاء بكل منتج وحالة اعتمادها." },
];

export default async function DataPage() {
  const session = await getMerchantSession();
  if (!session) redirect("/login?redirect=/dashboard/settings/data");
  if (!session.store) redirect(NO_STORE_HREF);
  const s = await requireStoreArea("settings");
  const owner = isStoreOwner(s);
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header>
        <h1 className="text-xl font-black text-ink">النسخ الاحتياطي والتصدير</h1>
        <p className="mt-1 text-[12.5px] leading-6 text-ink-3">بيانات المتجر ملككم. احتفظوا بنسخة منها بانتظام، أو صدّروا ما تحتاجونه إلى Excel.</p>
      </header>
      <section className="dash-card space-y-3 p-4 sm:p-5">
        <h2 className="flex items-center gap-2 text-[14px] font-black text-ink"><Archive className="size-4" aria-hidden="true" /> نسخة احتياطية كاملة</h2>
        <p className="text-[12.5px] leading-6 text-ink-3">ملف واحد يضم المنتجات وتركيباتها والأقسام والعملاء والطلبات وبنودها والخصومات والتقييمات والأسئلة ومناطق الشحن وإعدادات المتجر. المبالغ فيه بالقروش.</p>
        {owner ? (
          <a href="/api/dashboard/backup" download className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-nova px-4 text-[13px] font-black text-white hover:opacity-90">
            <Archive className="size-4" aria-hidden="true" /> تنزيل النسخة الاحتياطية
          </a>
        ) : (
          <p className="rounded-lg bg-edge/[0.05] p-3 text-[12.5px] text-ink-2">النسخة الاحتياطية الكاملة لصاحب المتجر وحده.</p>
        )}
      </section>
      <section className="dash-card p-4 sm:p-5">
        <h2 className="flex items-center gap-2 text-[14px] font-black text-ink"><FileSpreadsheet className="size-4" aria-hidden="true" /> تصدير إلى Excel</h2>
        <ul className="mt-3 divide-y divide-edge/[0.06]">
          {EXPORTS.map((e) => (
            <li key={e.href} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-black text-ink">{e.title}</p>
                <p className="text-[12px] leading-5 text-ink-3">{e.note}</p>
              </div>
              <a href={e.href} download className="inline-flex min-h-10 items-center rounded-xl border border-edge/10 px-3.5 text-[12px] font-bold text-ink-2 hover:bg-edge/[0.05] hover:text-ink">تنزيل</a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
