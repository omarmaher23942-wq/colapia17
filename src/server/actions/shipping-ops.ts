"use server";

// shipping-ops.ts — إجراءات صفحة «الشحن»: تصدير ملف الرفع الجماعي لشركة شحن مع تعليم الطلبات «تم الشحن» اختيارياً،
// وحفظ أرقام التتبع، وتسوية التحصيل عند الاستلام (وسم على الطلب). كلها لمجال الطلبات بمستوى الإدارة.
import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import ExcelJS from "exceljs";
import { getTenantDb } from "@/db/tenant";
import { orderItems, orders } from "@/db/schema";
import { storeFor } from "@/server/merchant-guard";
import { applyOrderStatus } from "@/server/order-status-change";
import { toCsv } from "@/server/csv";
import { COURIER_INFO, courierTable, isCourierKey, type CourierKey, type ShipOrder } from "@/lib/courier-export";
import { SETTLED_TAG } from "@/lib/cod-reconcile";

const ids = z.array(z.string().uuid()).min(1).max(200);
const NO_SESSION = { ok: false as const, error: "انتهت جلستكم، سجّلوا الدخول من جديد" };

export type ExportResult =
  | { ok: true; filename: string; mime: string; base64: string; count: number; shipped: number; skipped: string[] }
  | { ok: false; error: string };

async function ctx() {
  const s = await storeFor("orders");
  return s ? { ...s, db: await getTenantDb(s.storeId) } : null;
}

export async function exportShipmentsAction(input: { ids: string[]; courier: string; format: "csv" | "xlsx"; markShipped: boolean }): Promise<ExportResult> {
  const s = await ctx();
  if (!s) return NO_SESSION;
  const parsed = ids.safeParse(input.ids);
  if (!parsed.success || !isCourierKey(input.courier)) return { ok: false, error: "اختاروا طلبات وشركة شحن" };
  const courier: CourierKey = input.courier;

  const rows = await s.db
    .select()
    .from(orders)
    .where(and(eq(orders.storeId, s.storeId), inArray(orders.id, parsed.data)));
  if (!rows.length) return { ok: false, error: "لم يُعثر على الطلبات" };
  const items = await s.db
    .select({ orderId: orderItems.orderId, name: orderItems.name, variant: orderItems.variantLabel, qty: orderItems.quantity })
    .from(orderItems)
    .where(and(eq(orderItems.storeId, s.storeId), inArray(orderItems.orderId, rows.map((r) => r.id))));
  const ordered = parsed.data.map((id) => rows.find((r) => r.id === id)).filter((r): r is (typeof rows)[number] => Boolean(r));
  const ship: ShipOrder[] = ordered.map((o) => ({
    code: o.code,
    customerName: o.customerName,
    customerPhone: o.customerPhone,
    customerAltPhone: o.customerAltPhone,
    governorate: o.governorate,
    city: o.city,
    address: o.address,
    landmark: o.landmark,
    customerNotes: o.customerNotes,
    paymentMethod: o.paymentMethod,
    paymentStatus: o.paymentStatus,
    totalPiasters: o.totalPiasters,
    paidPiasters: o.paidPiasters,
    items: items.filter((i) => i.orderId === o.id).map((i) => ({ name: i.name, variant: i.variant, qty: i.qty })),
  }));
  const table = courierTable(courier, ship);

  let shipped = 0;
  const skipped: string[] = [];
  const label = COURIER_INFO[courier].label;
  for (const o of ordered) {
    // اسم الشركة يُحفظ دائماً ليظهر في الطلب ورابط التتبع.
    await s.db.update(orders).set({ courierName: label, updatedAt: new Date() }).where(and(eq(orders.id, o.id), eq(orders.storeId, s.storeId)));
    if (!input.markShipped) continue;
    if (o.status !== "confirmed" && o.status !== "preparing") {
      if (o.status !== "shipped") skipped.push(o.code);
      continue;
    }
    const r = await applyOrderStatus({ db: s.db, storeId: s.storeId, subdomain: s.store.subdomain, actor: `merchant:${s.merchantId}` }, o.id, "shipped", `سُلّم إلى ${label}`).catch(() => ({ ok: false as const }));
    if (r.ok) shipped++;
    else skipped.push(o.code);
  }
  revalidatePath("/dashboard/orders");
  revalidatePath("/dashboard/orders/ship");

  const stamp = new Date().toISOString().slice(0, 10);
  if (input.format === "xlsx") {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(label.slice(0, 28));
    ws.addRow(table.headers).font = { bold: true };
    for (const r of table.rows) ws.addRow(r.map((v) => (typeof v === "string" && /^[=+\-@]/.test(v) ? `'${v}` : v)));
    ws.columns.forEach((c) => (c.width = 20));
    const buf = Buffer.from(await wb.xlsx.writeBuffer());
    return { ok: true, filename: `shipments-${courier}-${stamp}.xlsx`, mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", base64: buf.toString("base64"), count: ordered.length, shipped, skipped };
  }
  const csv = toCsv(table.headers, table.rows);
  return { ok: true, filename: `shipments-${courier}-${stamp}.csv`, mime: "text/csv;charset=utf-8", base64: Buffer.from(csv, "utf8").toString("base64"), count: ordered.length, shipped, skipped };
}

const trackingRows = z
  .array(z.object({ id: z.string().uuid(), trackingNumber: z.string().trim().max(80), courierName: z.string().trim().max(80).optional() }))
  .min(1)
  .max(200);

/** يحفظ أرقام التتبع (الفارغ يُتجاهل). */
export async function saveTrackingAction(rowsIn: unknown): Promise<{ ok: true; saved: number } | { ok: false; error: string }> {
  const s = await ctx();
  if (!s) return NO_SESSION;
  const parsed = trackingRows.safeParse(rowsIn);
  if (!parsed.success) return { ok: false, error: "بيانات غير صالحة" };
  let saved = 0;
  for (const r of parsed.data) {
    if (!r.trackingNumber) continue;
    const res = await s.db
      .update(orders)
      .set({ trackingNumber: r.trackingNumber, ...(r.courierName ? { courierName: r.courierName } : {}), updatedAt: new Date() })
      .where(and(eq(orders.id, r.id), eq(orders.storeId, s.storeId)))
      .returning({ id: orders.id });
    saved += res.length;
  }
  revalidatePath("/dashboard/orders/ship");
  return { ok: true, saved };
}

/** تسوية التحصيل: يوسم الطلبات «تمت التسوية» (وصل المبلغ من الشركة) أو يزيل الوسم. */
export async function setCodSettledAction(orderIds: string[], settled: boolean): Promise<{ ok: true; done: number } | { ok: false; error: string }> {
  const s = await ctx();
  if (!s) return NO_SESSION;
  const parsed = ids.safeParse(orderIds);
  if (!parsed.success) return { ok: false, error: "اختاروا طلباً واحداً على الأقل" };
  const rows = await s.db
    .select({ id: orders.id, tags: orders.tags })
    .from(orders)
    .where(and(eq(orders.storeId, s.storeId), inArray(orders.id, parsed.data), eq(orders.paymentMethod, "cod")));
  let done = 0;
  for (const r of rows) {
    const tags = (r.tags ?? []).filter((t) => t !== SETTLED_TAG);
    if (settled) tags.push(SETTLED_TAG);
    await s.db.update(orders).set({ tags }).where(and(eq(orders.id, r.id), eq(orders.storeId, s.storeId)));
    done++;
  }
  revalidatePath("/dashboard/orders/ship");
  return { ok: true, done };
}
