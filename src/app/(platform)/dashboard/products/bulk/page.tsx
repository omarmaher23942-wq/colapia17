// dashboard/products/bulk — تعديل جماعي لأسعار المنتجات ومخزونها وحالتها من جدول واحد (مجال المنتجات بمستوى الإدارة).
import { requireStoreArea } from "@/server/merchant-guard";
import { bulkRows } from "@/server/repos/bulk-products";
import { BulkEditor } from "@/components/dashboard/products/BulkEditor";

export const dynamic = "force-dynamic";
export const metadata = { title: "تعديل جماعي" };

export default async function BulkPage() {
  const access = await requireStoreArea("products", "manage");
  const rows = await bulkRows(access.store.id);
  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <header className="border-b border-edge/10 pb-4">
        <h1 className="text-2xl font-black text-ink">تعديل جماعي</h1>
        <p className="mt-1 text-[13px] leading-6 text-ink-2">عدّلوا الأسعار والمخزون والحالة لعدة منتجات معاً ثم احفظوا مرة واحدة. لا يُحفظ شيء قبل ضغط «حفظ التغييرات».</p>
      </header>
      <BulkEditor initial={rows} />
    </div>
  );
}
