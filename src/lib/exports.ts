// exports.ts — ترويسات وصفوف ملفات التصدير (CSV) لمنتجات المتجر وأكواد الخصم والتقييمات والمخزون والربحية.
// ملف المنتجات بترويسات يفهمها «استيراد المنتجات» نفسه، فيصلح للنقل والنسخ الاحتياطي والتعديل في Excel.
import type { InventoryLine, ProductProfit } from "@/lib/reports";

const egp = (p: number | null | undefined) => (typeof p === "number" ? Math.round(p) / 100 : "");

export const PRODUCT_EXPORT_HEADERS = ["الاسم", "السعر", "السعر قبل الخصم", "سعر التكلفة", "الكمية", "كود المنتج", "القسم", "الوصف", "الصور", "الحالة"] as const;

export type ProductExportRow = { name: string; price: number; compareAt: number | null; cost: number | null; stock: number | null; trackStock: boolean; sku: string | null; category: string | null; description: string | null; images: string[]; status: string };

const STATUS_AR: Record<string, string> = { active: "منشور", draft: "مسودة", hidden: "مخفي", archived: "مؤرشف" };

export function productRows(rows: ProductExportRow[]): unknown[][] {
  return rows.map((r) => [r.name, egp(r.price), egp(r.compareAt), egp(r.cost), r.trackStock ? (r.stock ?? "") : "", r.sku, r.category, r.description, r.images.join(" "), STATUS_AR[r.status] ?? r.status]);
}

export const DISCOUNT_HEADERS = ["الكود", "النوع", "القيمة", "حد أدنى للطلب", "أقصى استخدام", "مرات الاستخدام", "يبدأ", "ينتهي", "فعّال"];
export type DiscountExportRow = { code: string; type: string; value: number; minSubtotal: number | null; maxUses: number | null; used: number; startsAt: Date | null; endsAt: Date | null; active: boolean };
export function discountRows(rows: DiscountExportRow[]): unknown[][] {
  return rows.map((d) => [d.code, d.type === "percentage" ? "نسبة" : d.type === "fixed" ? "مبلغ ثابت" : d.type === "free_shipping" ? "شحن مجاني" : d.type, d.type === "percentage" ? `${d.value}%` : egp(d.value), egp(d.minSubtotal), d.maxUses, d.used, d.startsAt, d.endsAt, d.active ? "نعم" : "لا"]);
}

export const REVIEW_HEADERS = ["المنتج", "الاسم", "التقييم", "التعليق", "معتمد", "التاريخ"];
export type ReviewExportRow = { product: string; name: string; rating: number; body: string | null; approved: boolean; createdAt: Date };
export function reviewRows(rows: ReviewExportRow[]): unknown[][] {
  return rows.map((r) => [r.product, r.name, r.rating, r.body, r.approved ? "نعم" : "لا", r.createdAt]);
}

export const INVENTORY_HEADERS = ["المنتج", "القسم", "الكمية", "سعر البيع", "قيمة بالبيع", "قيمة بالتكلفة", "مبيع الفترة", "أيام التغطية", "راكد"];
export function inventoryRows(lines: InventoryLine[]): unknown[][] {
  return lines.map((l) => [l.name, l.categoryName, l.stock, egp(l.pricePiasters), egp(l.retailValue), l.costValue === null ? "" : egp(l.costValue), l.soldInWindow, l.daysCover ?? "", l.dead ? "نعم" : ""]);
}

export const PROFIT_HEADERS = ["المنتج", "القسم", "الوحدات", "المبيعات", "التكلفة", "الربح", "الهامش %"];
export function profitRows(rows: ProductProfit[]): unknown[][] {
  return rows.map((r) => [r.name, r.categoryName, r.qty, egp(r.revenuePiasters), r.costTotalPiasters === null ? "" : egp(r.costTotalPiasters), r.profitPiasters === null ? "" : egp(r.profitPiasters), r.marginPct ?? ""]);
}
