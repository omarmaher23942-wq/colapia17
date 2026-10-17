"use server";
// order-requests.ts — ما بعد الشراء من جهة العميل بلا حسابات: طلب إلغاء، طلب استبدال/استرجاع بصور، وإعادة الطلب بالأسعار الحالية.
// الوصول بجهاز العميل أو رابط الطلب الموقّع أو رقم الموبايل (hasOrderAccess)، والقرار النهائي للتاجر من لوحته.
import { headers } from "next/headers";
import { z } from "zod";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { getBlueprint, getStoreBySubdomain } from "@/lib/tenant";
import { getTenantDb } from "@/db/tenant";
import { orderItems, orders, productVariants, products, returnRequests } from "@/db/schema";
import { allow, clientIp } from "@/lib/ratelimit";
import { hasOrderAccess, currentDeviceId } from "@/lib/order-access";
import { normalizeEgyptianPhone } from "@/lib/phone";
import { isTrustedUploadUrl } from "@/lib/upload-hosts";
import { canRequestCancel, returnKindsAllowed, returnWindow, validateReturnLines } from "@/lib/order-requests";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

const base = z.object({
  code: z.string().trim().min(1).max(24),
  accessPhone: z.string().max(30).optional(),
});

async function loadOrder(subdomain: string, code: string, accessPhone?: string) {
  const store = await getStoreBySubdomain(subdomain);
  if (!store) return { ok: false, error: "المتجر غير موجود" } as const;
  const db = await getTenantDb(store.id);
  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.storeId, store.id), eq(orders.code, code.toUpperCase())))
    .limit(1);
  if (!order) return { ok: false, error: "الطلب غير موجود" } as const;
  const phone = accessPhone ? normalizeEgyptianPhone(accessPhone) : null;
  const ok = (await hasOrderAccess(store.id, order.code, order.visitorId)) || Boolean(phone && phone === order.customerPhone);
  if (!ok) return { ok: false, error: "افتحوا الطلب من الجهاز الذي طُلب منه أو من رابط الطلب" } as const;
  return { ok: true, store, db, order } as const;
}

export async function requestCancelAction(subdomain: string, raw: unknown): Promise<Result<{ at: string }>> {
  const p = base.extend({ reason: z.string().trim().max(300).optional() }).safeParse(raw);
  if (!p.success) return { ok: false, error: "بيانات غير صالحة" };
  if (!(await allow("track", `cancel:${clientIp(await headers())}`))) return { ok: false, error: "محاولات كثيرة، يرجى الانتظار قليلاً" };
  const r = await loadOrder(subdomain, p.data.code, p.data.accessPhone);
  if (!r.ok) return { ok: false, error: r.error };
  const { order, db, store } = r;
  if (!canRequestCancel(order)) {
    return { ok: false, error: order.cancelRequestedAt ? "تم استلام طلب الإلغاء، وسيتواصل معكم المتجر" : "لا يمكن طلب الإلغاء بعد بدء تجهيز الطلب، يرجى التواصل مع المتجر" };
  }
  const now = new Date();
  const history = Array.isArray(order.statusHistory) ? [...order.statusHistory] : [];
  history.push({ status: order.status, at: now.toISOString(), note: `طلب العميل إلغاء الطلب${p.data.reason ? `: ${p.data.reason}` : ""}` });
  const done = await db
    .update(orders)
    .set({ cancelRequestedAt: now, statusHistory: history, updatedAt: now })
    .where(and(eq(orders.id, order.id), eq(orders.storeId, store.id), isNull(orders.cancelRequestedAt), inArray(orders.status, ["new", "confirmed"])))
    .returning({ id: orders.id });
  if (!done.length) return { ok: false, error: "تعذّر تسجيل الطلب، يرجى تحديث الصفحة" };
  return { ok: true, data: { at: now.toISOString() } };
}

const returnSchema = base.extend({
  kind: z.enum(["exchange", "refund"]),
  items: z.array(z.object({ orderItemId: z.string().uuid(), qty: z.number().int().min(1).max(50), reason: z.string().trim().max(200).optional() })).min(1).max(30),
  reason: z.string().trim().min(3, "اكتبوا سبب الطلب").max(500),
  photos: z.array(z.string().max(500).refine(isTrustedUploadUrl, "رابط صورة غير صالح")).max(4).default([]),
});

export async function requestReturnAction(subdomain: string, raw: unknown): Promise<Result<{ id: string }>> {
  const p = returnSchema.safeParse(raw);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "بيانات غير صالحة" };
  if (!(await allow("track", `return:${clientIp(await headers())}`))) return { ok: false, error: "محاولات كثيرة، يرجى الانتظار قليلاً" };
  const r = await loadOrder(subdomain, p.data.code, p.data.accessPhone);
  if (!r.ok) return { ok: false, error: r.error };
  const { order, db, store } = r;
  const bp = await getBlueprint(store.id);
  const policy = bp.returns;
  const win = returnWindow(order, policy.windowDays);
  if (!win.open) {
    return { ok: false, error: win.reason === "expired" ? `انتهت مدة الاستبدال والاسترجاع (${policy.windowDays} يوماً من التسليم)` : win.reason === "disabled" ? "المتجر لا يقبل الاستبدال أو الاسترجاع" : "يمكن الطلب بعد تسليم الطلب" };
  }
  if (!returnKindsAllowed(policy).includes(p.data.kind)) return { ok: false, error: p.data.kind === "exchange" ? "المتجر لا يقبل الاستبدال" : "المتجر لا يقبل الاسترجاع" };

  const items = await db.select({ id: orderItems.id, quantity: orderItems.quantity, unitPiasters: orderItems.unitPiasters }).from(orderItems).where(and(eq(orderItems.orderId, order.id), eq(orderItems.storeId, store.id)));
  const bad = validateReturnLines(p.data.items, items);
  if (bad) return { ok: false, error: bad };

  const open = await db
    .select({ id: returnRequests.id })
    .from(returnRequests)
    .where(and(eq(returnRequests.storeId, store.id), eq(returnRequests.orderId, order.id), inArray(returnRequests.status, ["new", "approved", "received"])))
    .limit(1);
  if (open.length) return { ok: false, error: "لديكم طلب مفتوح على هذا الطلب بالفعل، وسيتواصل معكم المتجر" };

  const [row] = await db
    .insert(returnRequests)
    .values({
      storeId: store.id,
      orderId: order.id,
      kind: p.data.kind,
      items: p.data.items,
      reason: p.data.reason,
      photos: p.data.photos,
      visitorId: (await currentDeviceId()) ?? order.visitorId,
    })
    .returning({ id: returnRequests.id });
  return { ok: true, data: { id: row!.id } };
}

export type ReorderItem = {
  productId: string;
  variantId?: string;
  slug: string;
  name: string;
  imageUrl?: string;
  unitPiasters: number;
  variantLabel?: string;
  maxQty: number | null;
  qty: number;
};

/** «إعادة الطلب»: أصناف الطلب التي ما زالت متاحة، بأسعارها وكمياتها المتاحة الآن (لا بما كانت عليه). */
export async function reorderAction(subdomain: string, raw: unknown): Promise<Result<{ items: ReorderItem[]; dropped: number }>> {
  const p = base.safeParse(raw);
  if (!p.success) return { ok: false, error: "بيانات غير صالحة" };
  const r = await loadOrder(subdomain, p.data.code, p.data.accessPhone);
  if (!r.ok) return { ok: false, error: r.error };
  const { order, db, store } = r;
  const lines = (await db.select().from(orderItems).where(and(eq(orderItems.orderId, order.id), eq(orderItems.storeId, store.id)))).filter((l) => l.unitPiasters > 0 && l.productId);
  const pids = [...new Set(lines.map((l) => l.productId!))];
  const vids = lines.map((l) => l.variantId).filter((x): x is string => Boolean(x));
  const [prods, vars] = await Promise.all([
    pids.length ? db.select().from(products).where(and(eq(products.storeId, store.id), inArray(products.id, pids), eq(products.status, "active"), isNull(products.deletedAt))) : Promise.resolve([]),
    vids.length ? db.select().from(productVariants).where(and(eq(productVariants.storeId, store.id), inArray(productVariants.id, vids))) : Promise.resolve([]),
  ]);
  const items: ReorderItem[] = [];
  for (const l of lines) {
    const pr = prods.find((x) => x.id === l.productId);
    if (!pr) continue;
    const v = l.variantId ? vars.find((x) => x.id === l.variantId && x.productId === pr.id) : undefined;
    if (l.variantId && (!v || !v.isAvailable)) continue;
    const stock = v ? v.stock : pr.stock;
    const limited = pr.trackStock && stock !== null;
    if (limited && stock! <= 0) continue;
    items.push({
      productId: pr.id,
      variantId: v?.id,
      slug: pr.slug,
      name: pr.name,
      imageUrl: v?.imageUrl ?? pr.images[0]?.url,
      unitPiasters: v?.pricePiasters ?? pr.pricePiasters,
      variantLabel: v?.optionValues.join(" / "),
      maxQty: limited ? stock! : null,
      qty: limited ? Math.min(l.quantity, stock!) : l.quantity,
    });
  }
  return { ok: true, data: { items, dropped: lines.length - items.length } };
}
