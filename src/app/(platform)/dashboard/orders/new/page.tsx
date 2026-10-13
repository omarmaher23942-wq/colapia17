// dashboard/orders/new/page.tsx — «طلب من الشات»: تسجيل طلب جاء في رسائل إنستجرام أو واتساب أو مكالمة، بنفس أسعار
// المتجر ومخزونه، ثم يفتح الطلب برسالة التأكيد الجاهزة برابطها.
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { requireStoreArea } from "@/server/merchant-guard";
import { manualOrderCatalog } from "@/server/repos/manual-order";
import { ManualOrderForm } from "@/components/dashboard/orders/ManualOrderForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "طلب من الشات" };

export default async function ManualOrderPage() {
  const s = await requireStoreArea("orders", "manage");
  const catalog = await manualOrderCatalog(s.storeId);
  return (
    <div className="mx-auto max-w-3xl space-y-4 pb-28">
      <header>
        <Link href="/dashboard/orders" className="inline-flex items-center gap-1 text-[12px] font-bold text-ink-3 hover:text-ink">
          <ArrowRight className="size-3.5" aria-hidden="true" /> الطلبات
        </Link>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-ink">طلب من الشات</h1>
        <p className="mt-1 text-[12.5px] leading-5 text-ink-3">
          سجّل الطلب الذي جاءك في الرسائل ليدخل مع بقية طلباتك: يُخصم من المخزون، ويظهر في المراحل والتقرير، ومعه رسالة تأكيد جاهزة برابط للعميل.
        </p>
      </header>
      <ManualOrderForm catalog={catalog} />
    </div>
  );
}
