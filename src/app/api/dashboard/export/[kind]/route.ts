// GET /api/dashboard/export/<kind> — تصدير CSV يفتح في Excel: products (متوافق مع الاستيراد)، discounts، reviews،
// inventory، profit (الأخيران بفترة التقرير ?period=&from=&to=). كل نوع بصلاحية مجاله (عرض) ومحصور في متجر الجلسة.
import { NextResponse } from "next/server";
import { and, desc, eq, isNull } from "drizzle-orm";
import { storeFor } from "@/server/merchant-guard";
import { getTenantDb } from "@/db/tenant";
import { categories, discounts, products, reviews } from "@/db/schema";
import { csvResponse, toCsv } from "@/server/csv";
import { DISCOUNT_HEADERS, INVENTORY_HEADERS, PRODUCT_EXPORT_HEADERS, PROFIT_HEADERS, REVIEW_HEADERS, discountRows, inventoryRows, productRows, profitRows, reviewRows } from "@/lib/exports";
import { resolvePeriod } from "@/lib/reports";
import { inventoryReportData, productsReport } from "@/server/repos/reports";

export const dynamic = "force-dynamic";

const AREA = { products: "products", discounts: "discounts", reviews: "reviews", inventory: "analytics", profit: "analytics" } as const;

export async function GET(req: Request, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  if (!Object.hasOwn(AREA, kind)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const s = await storeFor(AREA[kind as keyof typeof AREA], "view");
  if (!s?.storeId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const db = await getTenantDb(s.storeId);
  const url = new URL(req.url);

  if (kind === "products") {
    const rows = await db
      .select({ p: products, cat: categories.name })
      .from(products)
      .leftJoin(categories, eq(categories.id, products.categoryId))
      .where(and(eq(products.storeId, s.storeId), isNull(products.deletedAt)))
      .orderBy(desc(products.createdAt));
    return csvResponse(
      "products",
      toCsv(
        [...PRODUCT_EXPORT_HEADERS],
        productRows(rows.map(({ p, cat }) => ({ name: p.name, price: p.pricePiasters, compareAt: p.compareAtPiasters, cost: p.costPiasters, stock: p.stock, trackStock: p.trackStock, sku: p.sku, category: cat, description: p.description, images: (p.images ?? []).map((i) => i.url), status: p.status })))
      )
    );
  }
  if (kind === "discounts") {
    const rows = await db.select().from(discounts).where(eq(discounts.storeId, s.storeId)).orderBy(desc(discounts.createdAt));
    return csvResponse("discounts", toCsv(DISCOUNT_HEADERS, discountRows(rows.map((d) => ({ code: d.code, type: d.type, value: d.value, minSubtotal: d.minSubtotalPiasters, maxUses: d.maxUses, used: d.usedCount, startsAt: d.startsAt, endsAt: d.endsAt, active: d.isActive })))));
  }
  if (kind === "reviews") {
    const rows = await db
      .select({ r: reviews, product: products.name })
      .from(reviews)
      .leftJoin(products, eq(products.id, reviews.productId))
      .where(eq(reviews.storeId, s.storeId))
      .orderBy(desc(reviews.createdAt))
      .limit(5000);
    return csvResponse("reviews", toCsv(REVIEW_HEADERS, reviewRows(rows.map(({ r, product }) => ({ product: product ?? "", name: r.customerName, rating: r.rating, body: r.body, approved: r.isApproved, createdAt: r.createdAt })))));
  }
  const period = resolvePeriod({ period: url.searchParams.get("period") ?? undefined, from: url.searchParams.get("from") ?? undefined, to: url.searchParams.get("to") ?? undefined });
  if (kind === "inventory") {
    const days = Math.max(1, Math.round((period.to.getTime() - period.from.getTime()) / 86_400_000));
    const inv = await inventoryReportData(s.storeId, days);
    return csvResponse("inventory", toCsv(INVENTORY_HEADERS, inventoryRows(inv.lines)));
  }
  const rep = await productsReport(s.storeId, period);
  return csvResponse("profit", toCsv(PROFIT_HEADERS, profitRows(rep.rows)));
}
