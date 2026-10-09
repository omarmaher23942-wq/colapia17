"use server";

// inventory.ts — اختيار التاجر الصريح لطريقة المخزون في متجره كله:
//  - تتبع الكميات: كل منتج له كمية تنقص مع كل طلب حقيقي، ويظهر «نفد» عند الصفر. المنتج بلا كمية مكتوبة يبقى متاحاً
//    (null = بلا حد) حتى يكتبها التاجر، فلا يتحول شيء إلى «نفد» لحظة التفعيل.
//  - متاح دائماً: لا تُتبع الكميات ولا يظهر «نفد» أبداً.
// الكميات المكتوبة لا تُمسح عند الإيقاف، فالعودة للتتبع تستعيدها كما كانت.
import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { and, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { getTenantDb } from "@/db/tenant";
import { products, storeBlueprints } from "@/db/schema";
import { getMerchantStoreOrNull } from "@/server/auth";
import { blueprintSchema } from "@/blueprint/schema";
import { invalidateStoreCache } from "@/lib/tenant";
import { saveBlueprintAction } from "./blueprint";

export type InventoryResult = { ok: true; tracking: boolean; withoutQuantity: number } | { ok: false; error: string };

export async function setInventoryTrackingAction(tracking: unknown): Promise<InventoryResult> {
  const s = await getMerchantStoreOrNull();
  if (!s) return { ok: false, error: "انتهت جلستك، سجّل الدخول من جديد" };
  const parsed = z.boolean().safeParse(tracking);
  if (!parsed.success) return { ok: false, error: "اختيار غير صالح" };
  const on = parsed.data;

  try {
    const [row] = await db.select().from(storeBlueprints).where(eq(storeBlueprints.storeId, s.storeId)).limit(1);
    const cur = row ? blueprintSchema.safeParse(row.data) : null;
    if (!cur?.success) return { ok: false, error: "تعذر قراءة إعدادات المتجر" };
    if (cur.data.inventory.tracking !== on) {
      const r = await saveBlueprintAction({ ...cur.data, inventory: { ...cur.data.inventory, tracking: on } }, on ? "تتبع المخزون" : "كل المنتجات متاحة دائماً");
      if (!r.ok) return { ok: false, error: r.error };
    }
    const tdb = await getTenantDb(s.storeId);
    const scoped = and(eq(products.storeId, s.storeId), isNull(products.deletedAt));
    await tdb.update(products).set({ trackStock: on, updatedAt: new Date() }).where(scoped);
    const [n] = on
      ? await tdb.select({ n: sql<number>`count(*)`.mapWith(Number) }).from(products).where(and(scoped, isNull(products.stock)))
      : [{ n: 0 }];
    await invalidateStoreCache(s.store).catch(() => {});
    revalidatePath("/dashboard", "layout");
    return { ok: true, tracking: on, withoutQuantity: n?.n ?? 0 };
  } catch (e) {
    unstable_rethrow(e);
    console.error("[setInventoryTrackingAction]", e);
    return { ok: false, error: "تعذر الحفظ، حاول مرة أخرى" };
  }
}
