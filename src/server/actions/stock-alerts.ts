"use server";
// stock-alerts.ts — «نبّهني عند التوفر» (الجولة 2.2): الزائر يترك رقمه على منتج أو مقاس نافد، والتاجر يرى المنتظرين
// في صفحة المنتج ويراسلهم على واتساب برسالة جاهزة حين يعود المنتج، ثم يعلّمهم «تم الإبلاغ». لا رسائل آلية لزبائن التاجر.
import { headers } from "next/headers";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import { getTenantDb } from "@/db/tenant";
import { productVariants, products, stockAlerts } from "@/db/schema";
import { allow, clientIp } from "@/lib/ratelimit";
import { getStoreBySubdomain, isStorePubliclyVisible } from "@/lib/tenant";
import { normalizeEgyptianPhone } from "@/lib/phone";
import { storeFor } from "@/server/merchant-guard";

const requestSchema = z.object({
  subdomain: z.string().min(1).max(63),
  productId: z.string().uuid(),
  variantId: z.string().uuid().optional(),
  phone: z.string().trim().max(20),
  name: z.string().trim().max(60).optional(),
});

export async function requestStockAlertAction(raw: z.input<typeof requestSchema>): Promise<{ ok: true } | { ok: false; error: string }> {
  const p = requestSchema.safeParse(raw);
  if (!p.success) return { ok: false, error: "بيانات غير صالحة" };
  const phone = normalizeEgyptianPhone(p.data.phone);
  if (!phone) return { ok: false, error: "رقم الموبايل غير صحيح (مثال: 01012345678)" };
  if (!(await allow("review", `stock:${clientIp(await headers())}`))) return { ok: false, error: "محاولات كثيرة، حاول بعد دقائق" };

  const store = await getStoreBySubdomain(p.data.subdomain);
  if (!store || !isStorePubliclyVisible(store)) return { ok: false, error: "المتجر غير متاح الآن" };
  const db = await getTenantDb(store.id);
  const [prod] = await db.select({ id: products.id }).from(products).where(and(eq(products.id, p.data.productId), eq(products.storeId, store.id), isNull(products.deletedAt))).limit(1);
  if (!prod) return { ok: false, error: "المنتج غير موجود" };
  let label: string | null = null;
  if (p.data.variantId) {
    const [v] = await db
      .select({ values: productVariants.optionValues })
      .from(productVariants)
      .where(and(eq(productVariants.id, p.data.variantId), eq(productVariants.productId, prod.id), eq(productVariants.storeId, store.id)))
      .limit(1);
    if (!v) return { ok: false, error: "الاختيار غير موجود" };
    label = (v.values as string[]).join(" / ");
  }
  await db
    .insert(stockAlerts)
    .values({ storeId: store.id, productId: prod.id, variantKey: p.data.variantId ?? "", variantLabel: label, phone, name: p.data.name || null })
    .onConflictDoUpdate({ target: [stockAlerts.storeId, stockAlerts.productId, stockAlerts.variantKey, stockAlerts.phone], set: { notifiedAt: null, name: p.data.name || null, createdAt: new Date() } });
  return { ok: true };
}

/** التاجر يعلّم طلبات «تم الإبلاغ» بعد مراسلتها (أو يلغي التعليم). */
export async function markStockAlertsAction(ids: string[], notified = true): Promise<{ ok: true } | { ok: false; error: string }> {
  const s = await storeFor("products");
  if (!s) return { ok: false, error: "غير مصرح" };
  const valid = z.array(z.string().uuid()).min(1).max(200).safeParse(ids);
  if (!valid.success) return { ok: false, error: "اختيار غير صالح" };
  const db = await getTenantDb(s.storeId);
  await db.update(stockAlerts).set({ notifiedAt: notified ? new Date() : null }).where(and(eq(stockAlerts.storeId, s.storeId), inArray(stockAlerts.id, valid.data)));
  return { ok: true };
}

export async function deleteStockAlertAction(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const s = await storeFor("products");
  if (!s) return { ok: false, error: "غير مصرح" };
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: "اختيار غير صالح" };
  const db = await getTenantDb(s.storeId);
  await db.delete(stockAlerts).where(and(eq(stockAlerts.storeId, s.storeId), eq(stockAlerts.id, id)));
  return { ok: true };
}
