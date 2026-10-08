"use server";

import { and, eq, inArray } from "drizzle-orm";
import { getTenantDb } from "@/db/tenant";
import { orders, orderItems } from "@/db/schema";
import { getMerchantStoreOrNull } from "@/server/auth";
import { governorateName } from "@/lib/egypt";
import ExcelJS from "exceljs";

export async function exportOrdersExcelAction(statusFilter?: string) {
  const s = await getMerchantStoreOrNull();
  if (!s) throw new Error("غير مصرح");
  const db = await getTenantDb(s.storeId);

  const statuses = statusFilter ? statusFilter.split(",") : undefined;
  
  const rows = await db
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.storeId, s.storeId),
        statuses ? inArray(orders.status, statuses as any) : undefined
      )
    )
    .orderBy(orders.createdAt);

  const items = rows.length
    ? await db
        .select()
        .from(orderItems)
        .where(inArray(orderItems.orderId, rows.map((r) => r.id)))
    : [];

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("الطلبات", { views: [{ rightToLeft: true }] });

  ws.columns = [
    { key: "code", header: "الكود", width: 15 },
    { key: "name", header: "الاسم", width: 25 },
    { key: "phone", header: "الموبايل", width: 15 },
    { key: "gov", header: "المحافظة", width: 15 },
    { key: "city", header: "المدينة", width: 15 },
    { key: "address", header: "العنوان", width: 40 },
    { key: "items", header: "المنتجات", width: 50 },
    { key: "total", header: "الإجمالي", width: 12 },
    { key: "cod", header: "المطلوب عند الاستلام", width: 20 },
    { key: "status", header: "الحالة", width: 15 },
    { key: "date", header: "التاريخ", width: 20 },
  ];

  for (const o of rows) {
    const orderItemsList = items
      .filter((i) => i.orderId === o.id)
      .map((i) => `${i.name}${i.variantLabel ? ` (${i.variantLabel})` : ""} ×${i.quantity}`)
      .join(" | ");

    ws.addRow({
      code: o.code,
      name: o.customerName,
      phone: o.customerPhone,
      gov: governorateName(o.governorate),
      city: o.city || "",
      address: o.address,
      items: orderItemsList,
      total: o.totalPiasters / 100,
      cod: o.paymentMethod === "cod" ? o.totalPiasters / 100 : 0,
      status: o.status,
      date: o.createdAt.toLocaleString("ar-EG", { timeZone: "Africa/Cairo" }),
    });
  }

  ws.getRow(1).font = { bold: true };
  const buf = await wb.xlsx.writeBuffer();
  
  return Buffer.from(buf).toString("base64");
}