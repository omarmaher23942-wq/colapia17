// dashboard/studio — استوديو المحتوى: نصوص تسويقية من منتجات المتجر الفعلية (مجال المحتوى).
import { and, desc, eq, isNull } from "drizzle-orm";
import { requireStoreArea } from "@/server/merchant-guard";
import { getTenantDb } from "@/db/tenant";
import { products } from "@/db/schema";
import { ContentStudio } from "@/components/dashboard/studio/ContentStudio";

export const dynamic = "force-dynamic";
export const metadata = { title: "استوديو المحتوى" };

export default async function StudioPage() {
  const access = await requireStoreArea("content");
  const db = await getTenantDb(access.store.id);
  const rows = await db
    .select({ id: products.id, name: products.name, d: products.description })
    .from(products)
    .where(and(eq(products.storeId, access.store.id), eq(products.status, "active"), isNull(products.deletedAt)))
    .orderBy(desc(products.orderCount), desc(products.updatedAt))
    .limit(60);
  return <ContentStudio productsList={rows.map((r) => ({ id: r.id, name: r.name, hasDescription: Boolean(r.d && r.d.trim().length > 20) }))} />;
}
