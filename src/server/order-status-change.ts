import "server-only";
// order-status-change.ts — تغيير حالة طلب بكل آثاره (السجل، المخزون عند الإغلاق وإعادة الفتح، الحدث الحي، بريد العميل).
// يستخدمه التاجر من لوحته (actions/orders.ts) والعميل من رابط التأكيد (actions/order-confirm.ts) بنفس القواعد.
import { after } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import type { getTenantDb } from "@/db/tenant";
import { orders, orderItems } from "@/db/schema";
import { notifyCustomerOfStatus } from "@/server/order-notify";
import { stockMovement } from "@/server/inventory";
import { emitOrderStatusChanged } from "@/server/realtime/emitters";
import { dbErrorInfo, PG_CHECK } from "@/lib/db-errors";

type Status = (typeof orders.$inferSelect)["status"];
export type OrderActionResult = { ok: true } | { ok: false; error: string };
export type StatusCtx = { db: Awaited<ReturnType<typeof getTenantDb>>; storeId: string; subdomain: string; actor: string };
const CLOSED = new Set<Status>(["cancelled", "returned"]);

/** `expect`: الحالة الوحيدة المسموح بالانتقال منها (رابط التأكيد لا يلمس إلا «جديد»). */
export async function applyOrderStatus(
  s: StatusCtx,
  orderId: string,
  status: Status,
  note?: string,
  opts?: { expect?: Status }
): Promise<OrderActionResult> {
  const { db } = s;
  const [o] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.storeId, s.storeId)))
    .limit(1);
  if (!o) return { ok: false, error: "الطلب غير موجود" };
  if (o.status === status) return { ok: true };
  if (opts?.expect && o.status !== opts.expect) return { ok: false, error: "تغيّرت حالة الطلب، حدّث الصفحة وحاول مجدداً" };

  const closing = CLOSED.has(status) && !CLOSED.has(o.status);
  const reopening = !CLOSED.has(status) && CLOSED.has(o.status);
  // الطلب التجريبي لم يخصم مخزوناً عند إنشائه، فلا يعيده ولا يخصمه عند تغيير حالته.
  const items =
    (closing || reopening) && !o.isTest
      ? await db
          .select({ productId: orderItems.productId, variantId: orderItems.variantId, quantity: orderItems.quantity })
          .from(orderItems)
          .where(and(eq(orderItems.orderId, orderId), eq(orderItems.storeId, s.storeId)))
      : [];

  const now = new Date();
  const cleanNote = note?.trim().slice(0, 500) || undefined;
  // تحديث الحالة مشروط بالحالة التي قرأناها: تغيير متزامن من طرف آخر لا يُكتب فوقه ولا تتكرر حركة المخزون.
  const applied = sql`exists (select 1 from ${orders} o where o.id = ${orderId} and o.store_id = ${s.storeId} and o.status = ${status} and o.updated_at = ${now})`;
  let res: unknown[];
  try {
    res = (await db.batch([
      db
        .update(orders)
        .set({
          status,
          updatedAt: now,
          ...(status === "shipped" && !o.shippedAt ? { shippedAt: now } : {}),
          ...(status === "delivered"
            ? { deliveredAt: now, paymentStatus: o.paymentMethod === "cod" ? "confirmed" : o.paymentStatus }
            : {}),
          statusHistory: [...o.statusHistory, { status, at: now.toISOString(), note: cleanNote }],
        })
        .where(and(eq(orders.id, orderId), eq(orders.storeId, s.storeId), eq(orders.status, o.status)))
        .returning({ id: orders.id }),
      ...(closing ? stockMovement(db, s.storeId, items, 1, applied) : []),
      ...(reopening ? stockMovement(db, s.storeId, items, -1, applied) : []),
    ] as never)) as unknown[];
  } catch (e) {
    const info = dbErrorInfo(e);
    if (reopening && info.code === PG_CHECK && info.constraint?.includes("stock")) {
      return { ok: false, error: `لا يمكن إعادة فتح ${o.code}: المخزون الحالي لا يكفي لأصنافه. زِد الكمية أولاً.` };
    }
    throw e;
  }
  if (!(res[0] as unknown[] | undefined)?.length) return { ok: false, error: "تغيّرت حالة الطلب للتو، حدّث الصفحة وحاول مجدداً" };

  void emitOrderStatusChanged(s.storeId, o.code, {
    orderId,
    code: o.code,
    fromStatus: o.status,
    toStatus: status,
    note: cleanNote,
    changedBy: s.actor,
    changedAt: now.toISOString(),
  });

  after(() =>
    notifyCustomerOfStatus({ id: s.storeId, subdomain: s.subdomain }, o, status).catch((e) =>
      console.error("[orders] customer notify failed:", e)
    )
  );
  return { ok: true };
}

