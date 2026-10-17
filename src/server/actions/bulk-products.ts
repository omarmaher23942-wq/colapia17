"use server";

// bulk-products.ts — حفظ التعديل الجماعي: يقارن بالقيم الحالية في القاعدة (لا بما يرسله المتصفح)، ويتحقق من كل خانة
// بنفس قواعد lib/bulk-edit.ts، ثم يحفظ كل التغييرات في دفعة واحدة. لا حفظ جزئي إن وُجد خطأ في أي صف.
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getTenantDb } from "@/db/tenant";
import { products, productVariants } from "@/db/schema";
import { storeFor } from "@/server/merchant-guard";
import { bulkRows } from "@/server/repos/bulk-products";
import { syncVariantTotals } from "@/server/inventory";
import { invalidateStoreCache } from "@/lib/tenant";
import { BULK_STATUSES, planBulkEdit, type BulkIssue, type BulkRow } from "@/lib/bulk-edit";

const rowSchema = z.object({
  id: z.string().uuid(),
  name: z.string().max(300),
  price: z.string().max(20),
  compareAt: z.string().max(20),
  stock: z.string().max(12),
  status: z.enum(BULK_STATUSES),
  variants: z.array(z.object({ id: z.string().uuid(), label: z.string().max(200), stock: z.string().max(12), price: z.string().max(20) })).max(200),
});

export type BulkSaveResult = { ok: true; saved: number } | { ok: false; error: string; issues?: BulkIssue[] };

export async function saveBulkProductsAction(raw: unknown): Promise<BulkSaveResult> {
  const s = await storeFor("products");
  if (!s) return { ok: false, error: "انتهت جلستكم، سجّلوا الدخول من جديد" };
  const parsed = z.array(rowSchema).max(300).safeParse(raw);
  if (!parsed.success) return { ok: false, error: "بيانات غير صالحة" };

  const original = (await bulkRows(s.storeId)) as BulkRow[];
  const { patches, issues } = planBulkEdit(original, parsed.data);
  if (issues.length) return { ok: false, error: "صحّحوا الخانات المعلَّمة ثم احفظوا", issues };
  if (!patches.length) return { ok: true, saved: 0 };

  const db = await getTenantDb(s.storeId);
  const now = new Date();
  const queries = patches.flatMap((p) => {
    const orig = original.find((o) => o.id === p.id)!;
    return [
      db
        .update(products)
        .set({
          pricePiasters: p.pricePiasters,
          compareAtPiasters: p.compareAtPiasters,
          status: p.status,
          updatedAt: now,
          ...(p.stock !== undefined && orig.variants.length === 0 ? { stock: p.stock } : {}),
        })
        .where(and(eq(products.id, p.id), eq(products.storeId, s.storeId))),
      ...p.variants.map((v) =>
        db
          .update(productVariants)
          .set({ stock: v.stock, pricePiasters: v.pricePiasters })
          .where(and(eq(productVariants.id, v.id), eq(productVariants.productId, p.id), eq(productVariants.storeId, s.storeId)))
      ),
    ];
  });
  const withVariants = patches.filter((p) => p.variants.length).map((p) => p.id);
  if (withVariants.length) queries.push(syncVariantTotals(db, s.storeId, withVariants));
  await db.batch(queries as never);
  await invalidateStoreCache(s.store);
  revalidatePath("/dashboard/products");
  revalidatePath("/dashboard/products/bulk");
  return { ok: true, saved: patches.length };
}
