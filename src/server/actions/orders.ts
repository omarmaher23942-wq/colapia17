"use server";

// orders.ts — إجراءات التاجر على الطلبات: تغيير الحالة (فردي وجماعي)، ومراجعة إيصال التحويل، وبيانات الشحن.
// كل إجراء يعيد { ok } أو { ok: false, error } برسالة عربية واضحة بدل رمي الأخطاء للواجهة.
// المخزون: الإلغاء والارتجاع يعيدان الكمية، وإعادة فتح طلب ملغي تخصمها من جديد (أو تُرفض إن لم يكفِ المخزون).
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { applyOrderStatus } from "@/server/order-status-change";
import { getTenantDb } from "@/db/tenant";
import { orders, payments, orderItems } from "@/db/schema";
import { storeFor } from "@/server/merchant-guard";
import { stockMovement } from "@/server/inventory";
import { emitOrderStatusChanged, emitPaymentConfirmed } from "@/server/realtime/emitters";
import { dbErrorInfo, PG_CHECK } from "@/lib/db-errors";

type Status = (typeof orders.$inferSelect)["status"];
export type OrderActionResult = { ok: true } | { ok: false; error: string };

const statusSchema = z.enum(["new", "confirmed", "preparing", "shipped", "delivered", "returned", "cancelled"]);
const uuid = z.string().uuid();
const CLOSED = new Set<Status>(["cancelled", "returned"]);

async function own() {
  const s = await storeFor("orders");
  if (!s) return null;
  return { ...s, db: await getTenantDb(s.storeId) };
}

type Ctx = NonNullable<Awaited<ReturnType<typeof own>>>;

const changeStatus = (s: Ctx, orderId: string, status: Status, note?: string) =>
  applyOrderStatus({ db: s.db, storeId: s.storeId, subdomain: s.store.subdomain, actor: `merchant:${s.merchantId}` }, orderId, status, note);

/** تغيير حالة طلب واحد مع تسجيلها في سجل الطلب وإبلاغ العميل بالبريد إن كتبه. */
export async function setOrderStatusAction(orderId: string, status: string, note?: string): Promise<OrderActionResult> {
  const s = await own();
  if (!s) return { ok: false, error: "انتهت جلستك، سجّل الدخول من جديد" };
  const st = statusSchema.safeParse(status);
  if (!uuid.safeParse(orderId).success || !st.success) return { ok: false, error: "بيانات غير صالحة" };
  const res = await changeStatus(s, orderId, st.data, note);
  revalidatePath("/dashboard/orders");
  revalidatePath(`/dashboard/orders/${orderId}`);
  return res;
}

/** تغيير حالة مجموعة طلبات؛ ما يتعذر منها يُذكر بكوده ولا يوقف البقية. */
export async function bulkUpdateOrdersStatusAction(
  orderIds: string[],
  status: string
): Promise<{ ok: true; done: number } | { ok: false; error: string; done: number }> {
  const s = await own();
  if (!s) return { ok: false, error: "انتهت جلستك، سجّل الدخول من جديد", done: 0 };
  const ids = z.array(uuid).max(200).safeParse(orderIds);
  const st = statusSchema.safeParse(status);
  if (!ids.success || !st.success) return { ok: false, error: "بيانات غير صالحة", done: 0 };

  let done = 0;
  const failed: string[] = [];
  for (const id of ids.data) {
    const r = await changeStatus(s, id, st.data).catch(() => ({ ok: false as const, error: "تعذر التحديث" }));
    if (r.ok) done++;
    else failed.push(r.error);
  }
  revalidatePath("/dashboard/orders");
  if (failed.length) return { ok: false, error: failed.length === 1 ? failed[0]! : `تعذر تحديث ${failed.length} من الطلبات. ${failed[0]}`, done };
  return { ok: true, done };
}

/** قرار التاجر في إيصال تحويل: تأكيد وصول المبلغ أو رفضه، ويُسجَّل في سجل الطلب. */
export async function setPaymentStatusAction(orderId: string, decision: string, note?: string): Promise<OrderActionResult> {
  const s = await own();
  if (!s) return { ok: false, error: "انتهت جلستك، سجّل الدخول من جديد" };
  if (!uuid.safeParse(orderId).success || (decision !== "confirmed" && decision !== "rejected")) return { ok: false, error: "بيانات غير صالحة" };
  const { db } = s;
  const now = new Date();
  const [order] = await db
    .select({ id: orders.id, code: orders.code, totalPiasters: orders.totalPiasters, status: orders.status, history: orders.statusHistory })
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.storeId, s.storeId)))
    .limit(1);
  if (!order) return { ok: false, error: "الطلب غير موجود" };

  const cleanNote = note?.trim().slice(0, 500) || undefined;
  const entry = {
    status: order.status,
    at: now.toISOString(),
    note: decision === "confirmed" ? "تأكيد وصول التحويل" : `رفض إيصال التحويل${cleanNote ? `: ${cleanNote}` : ""}`,
  };
  await db.batch([
    db
      .update(orders)
      .set({ paymentStatus: decision, updatedAt: now, statusHistory: [...order.history, entry] })
      .where(and(eq(orders.id, orderId), eq(orders.storeId, s.storeId))),
    db
      .update(payments)
      .set({ status: decision, reviewedAt: now, reviewNote: cleanNote })
      .where(and(eq(payments.orderId, orderId), eq(payments.storeId, s.storeId), inArray(payments.status, ["pending", "under_review"]))),
  ]);

  if (decision === "confirmed") {
    void emitPaymentConfirmed(s.storeId, {
      paymentId: orderId,
      storeId: s.storeId,
      amountPiasters: order.totalPiasters,
      confirmedAt: now.toISOString(),
      confirmedBy: `merchant:${s.merchantId}`,
    });
  }
  revalidatePath("/dashboard/orders");
  revalidatePath(`/dashboard/orders/${orderId}`);
  return { ok: true };
}

/** بيانات الشحن والملاحظات الداخلية فقط — لا يمكن تعديل أي عمود آخر من هنا. */
const orderMetaSchema = z.object({
  courierName: z.string().trim().max(80),
  trackingNumber: z.string().trim().max(80),
  internalNotes: z.string().trim().max(2000),
});

export async function updateOrderMetaAction(orderId: string, data: unknown): Promise<OrderActionResult> {
  const s = await own();
  if (!s) return { ok: false, error: "انتهت جلستك، سجّل الدخول من جديد" };
  const parsed = orderMetaSchema.safeParse(data);
  if (!uuid.safeParse(orderId).success || !parsed.success) return { ok: false, error: "بيانات غير صالحة" };
  const v = parsed.data;
  const rows = await s.db
    .update(orders)
    .set({
      courierName: v.courierName || null,
      trackingNumber: v.trackingNumber || null,
      internalNotes: v.internalNotes || null,
      updatedAt: new Date(),
    })
    .where(and(eq(orders.id, orderId), eq(orders.storeId, s.storeId)))
    .returning({ id: orders.id });
  if (!rows.length) return { ok: false, error: "الطلب غير موجود" };
  revalidatePath(`/dashboard/orders/${orderId}`);
  return { ok: true };
}

/** تسجيل أن التاجر راسل العميل على واتساب بخصوص الطلب (يُخفي طلب التقييم من «مهام اليوم» بعد إرساله). */
export async function markOrderContactedAction(orderId: string): Promise<OrderActionResult> {
  const s = await own();
  if (!s) return { ok: false, error: "انتهت جلستك، سجّل الدخول من جديد" };
  if (!uuid.safeParse(orderId).success) return { ok: false, error: "بيانات غير صالحة" };
  const rows = await s.db
    .update(orders)
    .set({ whatsappContactedAt: new Date() })
    .where(and(eq(orders.id, orderId), eq(orders.storeId, s.storeId)))
    .returning({ id: orders.id });
  return rows.length ? { ok: true } : { ok: false, error: "الطلب غير موجود" };
}
