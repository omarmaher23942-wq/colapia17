// dashboard/products/import — إضافة منتجات بالجملة بنفس أداة الإعداد: صور مجمّعة (كل صورة تُقرأ منتجاً، مع إزالة خلفية
// اختيارية)، أو كتابة حرة، أو ملف (Excel/CSV/PDF/Word)، ثم مراجعة بحقول نشاط المتجر والسعر وحده إلزامي، ثم اعتماد.
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { eq } from "drizzle-orm";
import { requireStoreArea } from "@/server/merchant-guard";
import { getTenantDb } from "@/db/tenant";
import { categories } from "@/db/schema";
import { ImportTool } from "@/components/dashboard/products/ImportTool";
import { getBlueprintOrNull } from "@/lib/tenant";
import { resolveNiche } from "@/lib/niche-attributes";

export const dynamic = "force-dynamic";
// فرز الصور والملفات الطويلة قد يستغرق وقتاً.
export const maxDuration = 60;
export const metadata = { title: "إضافة منتجات بالجملة" };

export default async function ImportProductsPage() {
  const s = await requireStoreArea("products", "manage");
  const db = await getTenantDb(s.storeId);
  const [cats, bp] = await Promise.all([
    db.select({ name: categories.name }).from(categories).where(eq(categories.storeId, s.storeId)).orderBy(categories.sortOrder),
    getBlueprintOrNull(s.storeId),
  ]);
  const niche = resolveNiche(s.store.onboarding, bp?.brand.tagline, bp?.brand.description, bp?.brand.name ?? s.store.name);
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <header>
        <Link href="/dashboard/products" className="inline-flex items-center gap-1 text-[12.5px] font-bold text-ink-3 hover:text-ink">
          <ChevronRight className="size-4" aria-hidden="true" />
          المنتجات
        </Link>
        <h1 className="mt-1 text-[22px] font-black text-ink">إضافة منتجات بالجملة</h1>
        <p className="mt-1 text-[13px] leading-6 text-ink-3">اختاروا صور منتجاتكم مرة واحدة، أو اكتبوها، أو ارفعوا ملفاً جاهزاً. تراجعون كل منتج وتكتبون سعره قبل الاعتماد.</p>
      </header>
      <ImportTool existingCategories={cats.map((c) => c.name)} niche={niche} draftKey={`clp-import:${s.storeId}`} />
    </div>
  );
}
