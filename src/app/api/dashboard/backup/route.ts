// GET /api/dashboard/backup — نسخة احتياطية كاملة لبيانات المتجر في ملف ZIP واحد: ملف CSV لكل نوع بيانات
// (منتجات، تركيبات، أقسام، عملاء، طلبات وبنودها، خصومات، تقييمات، أسئلة، مناطق الشحن) + إعدادات المتجر JSON.
// لصاحب المتجر وحده. البيانات ملك المتجر، والملف يصلح للنقل والأرشفة.
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { ownerStore } from "@/server/merchant-guard";
import { getTenantDb } from "@/db/tenant";
import { categories, customers, discounts, orderItems, orders, productQuestions, productVariants, products, reviews, shippingZones } from "@/db/schema";
import { getBlueprint } from "@/lib/tenant";
import { toCsv } from "@/server/csv";
import { buildZip } from "@/lib/zip";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : v);

/** كل أعمدة الجدول كما هي (القروش تبقى قروشاً)، والكائنات JSON، والتواريخ ISO. */
function table(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "﻿(لا بيانات)";
  const headers = Object.keys(rows[0]!);
  return toCsv(headers, rows.map((r) => headers.map((h) => { const v = iso(r[h]); return v !== null && typeof v === "object" ? JSON.stringify(v) : v; })));
}

export async function GET() {
  const s = await ownerStore();
  if (!s?.storeId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const db = await getTenantDb(s.storeId);
  const id = s.storeId;
  const [prods, vars, cats, custs, ords, items, discs, revs, qs, zones, bp] = await Promise.all([
    db.select().from(products).where(eq(products.storeId, id)),
    db.select().from(productVariants).where(eq(productVariants.storeId, id)),
    db.select().from(categories).where(eq(categories.storeId, id)),
    db.select().from(customers).where(eq(customers.storeId, id)),
    db.select().from(orders).where(eq(orders.storeId, id)),
    db.select().from(orderItems).where(eq(orderItems.storeId, id)),
    db.select().from(discounts).where(eq(discounts.storeId, id)),
    db.select().from(reviews).where(eq(reviews.storeId, id)),
    db.select().from(productQuestions).where(eq(productQuestions.storeId, id)),
    db.select().from(shippingZones).where(eq(shippingZones.storeId, id)),
    getBlueprint(id).catch(() => null),
  ]);
  const files: { path: string; data: string }[] = [
    { path: "products.csv", data: table(prods) },
    { path: "product-variants.csv", data: table(vars) },
    { path: "categories.csv", data: table(cats) },
    { path: "customers.csv", data: table(custs) },
    { path: "orders.csv", data: table(ords) },
    { path: "order-items.csv", data: table(items) },
    { path: "discounts.csv", data: table(discs) },
    { path: "reviews.csv", data: table(revs) },
    { path: "product-questions.csv", data: table(qs) },
    { path: "shipping-zones.csv", data: table(zones) },
    { path: "store-settings.json", data: JSON.stringify(bp ?? {}, null, 2) },
    {
      path: "README.txt",
      data: `نسخة احتياطية من متجر ${s.store.name}\nتاريخ النسخة: ${new Date().toISOString()}\n\nكل ملف CSV يفتح في Excel (UTF-8). المبالغ مخزنة بالقروش (100 قرش = 1 جنيه).\nstore-settings.json فيه شكل المتجر ونصوصه وسياساته.\n`,
    },
  ];
  const zip = buildZip(files);
  return new Response(new Uint8Array(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="store-backup-${new Date().toISOString().slice(0, 10)}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
