"use server";

// returns.ts — قرارات التاجر في طابور الاستبدال والاسترجاع وطلبات الإلغاء. مجال الطلبات بمستوى الإدارة.
// عند «استُلمت القطع» يعود المخزون (اختيارياً) عبر server/inventory.ts في نفس دفعة التحديث، ولا يتكرر.
// الاستبدال ينشئ طلباً جديداً بنفس محرك التسعير والمخزون (createManualOrderAction) برصيد الراجع كخصم.
import { revalidatePath } from "next/cache";
import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { getTenantDb } from "@/db/tenant";
import { orderItems, orders, returnRequests } from "@/db/schema";
import { storeFor } from "@/server/merchant-guard";
import { stockMovement } from "@/server/inventory";
import { applyOrderStatus } from "@/server/order-status-change";
import { createManualOrderAction } from "@/server/actions/manual-order";
import { canMoveReturn, type ReturnStatusKey } from "@/lib/returns";

type R = { ok: true } | { ok: false; error: string };
const NO_SESSION = { ok: false as const, error: "انتهت جلستكم، سجّلوا الدخول من جديد" };

async function ctx() {
  const s = await storeFor("orders");
  return s ? { ...s, db: await getTenantDb(s.storeId) } : null;
}

const statusInput = z.object({
  id: z.string().uuid(),
  to: z.enum(["approved", "rejected", "received", "completed"]),
  note: z.string().trim().max(500).optional(),
  restock: z.boolean().optional(),
});

export async function setReturnStatusAction(raw: unknown): Promise<R> {
  const s = await ctx();
  if (!s) return NO_SESSION;
  const p = statusInput.safeParse(raw);
  if (!p.success) return { ok: false, error: "بيانات غير صالحة" };
  const { id, to, note, restock } = p.data;
  const { db, storeId } = s;
  const [r] = await db.select().from(returnRequests).where(and(eq(returnRequests.id, id), eq(returnRequests.storeId, storeId))).limit(1);
  if (!r) return { ok: false, error: "الطلب غير موجود" };
  if (!canMoveReturn(r.status as ReturnStatusKey, to)) return { ok: false, error: "لا يمكن نقل الطلب إلى هذه الحالة من حالته الحالية" };

  const now = new Date();
  let moves: ReturnType<typeof stockMovement> = [];
  if (to === "received" && restock) {
    const lines = await db
      .select({ id: orderItems.id, productId: orderItems.productId, variantId: orderItems.variantId, quantity: orderItems.quantity })
      .from(orderItems)
      .where(and(eq(orderItems.storeId, storeId), eq(orderItems.orderId, r.orderId)));
    const back = r.items
      .map((ri) => {
        const l = lines.find((x) => x.id === ri.orderItemId);
        return l ? { productId: l.productId, variantId: l.variantId, quantity: Math.min(ri.qty, l.quantity) } : null;
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x));
    const applied = sql`exists (select 1 from return_requests q where q.id = ${id} and q.store_id = ${storeId} and q.status = 'received' and q.updated_at = ${now})`;
    moves = stockMovement(db, storeId, back, 1, applied);
  }
  const res = (await db.batch([
    db
      .update(returnRequests)
      .set({ status: to, updatedAt: now, ...(note ? { merchantNote: note } : {}) })
      .where(and(eq(returnRequests.id, id), eq(returnRequests.storeId, storeId), eq(returnRequests.status, r.status)))
      .returning({ id: returnRequests.id }),
    ...moves,
  ] as never)) as unknown[];
  if (!(res[0] as unknown[] | undefined)?.length) return { ok: false, error: "تغيّرت حالة الطلب للتو، حدّثوا الصفحة" };
  revalidatePath("/dashboard/returns");
  return { ok: true };
}

const exchangeInput = z.object({
  returnId: z.string().uuid(),
  /** تركيبة بديلة اختيارية لكل سطر راجع (غيابها = نفس التركيبة الأصلية). */
  replacements: z.array(z.object({ orderItemId: z.string().uuid(), variantId: z.string().uuid().optional() })).max(30).default([]),
});

export async function createExchangeOrderAction(raw: unknown): Promise<{ ok: true; code: string } | { ok: false; error: string }> {
  const s = await ctx();
  if (!s) return NO_SESSION;
  const p = exchangeInput.safeParse(raw);
  if (!p.success) return { ok: false, error: "بيانات غير صالحة" };
  const { db, storeId } = s;
  const [r] = await db.select().from(returnRequests).where(and(eq(returnRequests.id, p.data.returnId), eq(returnRequests.storeId, storeId))).limit(1);
  if (!r || r.kind !== "exchange") return { ok: false, error: "ليس طلب استبدال" };
  if (r.status !== "received" && r.status !== "approved") return { ok: false, error: "أنشئوا طلب الاستبدال بعد الموافقة على الطلب" };
  const [o] = await db.select().from(orders).where(and(eq(orders.id, r.orderId), eq(orders.storeId, storeId))).limit(1);
  if (!o) return { ok: false, error: "الطلب الأصلي غير موجود" };
  if ((o.tags ?? []).some((t) => t.startsWith(`exchange:${r.id}:`))) return { ok: false, error: "أُنشئ طلب استبدال لهذا الطلب من قبل" };

  const lines = await db
    .select()
    .from(orderItems)
    .where(and(eq(orderItems.storeId, storeId), eq(orderItems.orderId, r.orderId), inArray(orderItems.id, r.items.map((i) => i.orderItemId))));
  const items = r.items
    .map((ri) => {
      const l = lines.find((x) => x.id === ri.orderItemId);
      if (!l?.productId) return null;
      const rep = p.data.replacements.find((x) => x.orderItemId === l.id);
      const qty = Math.max(1, Math.min(ri.qty, l.quantity));
      return { productId: l.productId, variantId: rep?.variantId ?? l.variantId ?? undefined, qty, credit: l.unitPiasters * qty };
    })
    .filter((x): x is NonNullable<typeof x> => Boolean(x));
  if (!items.length) return { ok: false, error: "لا قطع قابلة للاستبدال في هذا الطلب (منتج محذوف)" };

  const credit = items.reduce((a, i) => a + i.credit, 0);
  const created = await createManualOrderAction({
    source: "other",
    name: o.customerName,
    phone: o.customerPhone,
    altPhone: o.customerAltPhone ?? undefined,
    governorate: o.governorate,
    city: o.city ?? undefined,
    address: o.address,
    landmark: o.landmark ?? undefined,
    notes: `استبدال للطلب ${o.code}`,
    paymentMethod: "cod",
    paid: false,
    confirmed: true,
    items: items.map((i) => ({ productId: i.productId, variantId: i.variantId, qty: i.qty })),
    shippingPiasters: 0,
    discountPiasters: credit,
  });
  if (!created.ok) return { ok: false, error: created.error };
  await db
    .update(orders)
    .set({ tags: [...(o.tags ?? []), `exchange:${r.id}:${created.data.code}`], updatedAt: new Date() })
    .where(and(eq(orders.id, o.id), eq(orders.storeId, storeId)));
  revalidatePath("/dashboard/returns");
  revalidatePath("/dashboard/orders");
  return { ok: true, code: created.data.code };
}

const cancelInput = z.object({ orderId: z.string().uuid(), decision: z.enum(["approved", "declined"]), note: z.string().trim().max(300).optional() });

/** قرار التاجر في طلب إلغاء من العميل: موافقة (يُلغى الطلب ويعود المخزون) أو اعتذار (يُسجَّل في سجل الطلب). */
export async function decideCancelAction(raw: unknown): Promise<R> {
  const s = await ctx();
  if (!s) return NO_SESSION;
  const p = cancelInput.safeParse(raw);
  if (!p.success) return { ok: false, error: "بيانات غير صالحة" };
  const { db, storeId } = s;
  const [o] = await db.select().from(orders).where(and(eq(orders.id, p.data.orderId), eq(orders.storeId, storeId))).limit(1);
  if (!o || !o.cancelRequestedAt) return { ok: false, error: "لا طلب إلغاء على هذا الطلب" };
  if (p.data.decision === "approved") {
    const r = await applyOrderStatus({ db, storeId, subdomain: s.store.subdomain, actor: `merchant:${s.merchantId}` }, o.id, "cancelled", "إلغاء بطلب العميل");
    if (!r.ok) return r;
  } else {
    await db
      .update(orders)
      .set({ statusHistory: [...o.statusHistory, { status: o.status, at: new Date().toISOString(), note: `اعتُذر عن إلغاء الطلب${p.data.note ? `: ${p.data.note}` : ""}` }], updatedAt: new Date() })
      .where(and(eq(orders.id, o.id), eq(orders.storeId, storeId)));
  }
  await db.update(orders).set({ cancelRequestedAt: null }).where(and(eq(orders.id, o.id), eq(orders.storeId, storeId)));
  revalidatePath("/dashboard/returns");
  revalidatePath(`/dashboard/orders/${o.id}`);
  return { ok: true };
}
