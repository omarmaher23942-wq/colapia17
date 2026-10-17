// dashboard/products/import — استيراد منتجات لاحقاً بنفس أداة الإعداد: كتابة حرة أو صور أو ملف (Excel/CSV/PDF/Word)،
// ثم مراجعة وتعديل سريع، ثم اعتماد. الأقسام والخيارات تُفرز وتُقترح، ولا شيء يُحفظ قبل الاعتماد.
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { eq } from "drizzle-orm";
import { requireStoreArea } from "@/server/merchant-guard";
import { getTenantDb } from "@/db/tenant";
import { categories } from "@/db/schema";
import { ImportTool } from "@/components/dashboard/products/ImportTool";

export const dynamic = "force-dynamic";
// فرز الصور والملفات الطويلة قد يستغرق وقتاً.
export const maxDuration = 60;
export const metadata = { title: "استيراد منتجات" };

export default async function ImportProductsPage() {
  const s = await requireStoreArea("products", "manage");
  const db = await getTenantDb(s.storeId);
  const cats = await db.select({ name: categories.name }).from(categories).where(eq(categories.storeId, s.storeId)).orderBy(categories.sortOrder);
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <header>
        <Link href="/dashboard/products" className="inline-flex items-center gap-1 text-[12.5px] font-bold text-ink-3 hover:text-ink">
          <ChevronRight className="size-4" aria-hidden="true" />
          المنتجات
        </Link>
        <h1 className="mt-1 text-[22px] font-black text-ink">استيراد منتجات</h1>
        <p className="mt-1 text-[13px] leading-6 text-ink-3">اكتبوا منتجاتكم أو ارفعوا صورها أو ملفاً جاهزاً، وسنفرزها إلى منتجات وأقسام تراجعونها قبل الاعتماد.</p>
      </header>
      <ImportTool existingCategories={cats.map((c) => c.name)} />
    </div>
  );
}
