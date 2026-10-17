// bulk-edit.ts — التعديل الجماعي للمنتجات من جدول واحد: قراءة القيم وتحققها قبل الحفظ (منطق خالص مختبَر).
import { toNumber } from "@/components/dashboard/product/model";

export const BULK_STATUSES = ["active", "draft", "hidden", "archived"] as const;
export type BulkStatus = (typeof BULK_STATUSES)[number];

export type BulkVariantRow = { id: string; label: string; stock: string; price: string };
export type BulkRow = {
  id: string;
  name: string;
  price: string;
  compareAt: string;
  /** فارغ = غير محدود. لمنتج بتركيبات يُحسب من مجموعها ولا يُعدَّل هنا. */
  stock: string;
  status: BulkStatus;
  variants: BulkVariantRow[];
};

export type BulkPatch = {
  id: string;
  pricePiasters: number;
  compareAtPiasters: number | null;
  /** undefined = منتج بتركيبات: لا يُمس مخزونه المباشر. */
  stock: number | null | undefined;
  status: BulkStatus;
  variants: { id: string; stock: number | null; pricePiasters: number | null }[];
};

export type BulkIssue = { id: string; field: "price" | "compareAt" | "stock" | "variant"; message: string };

const MAX_PRICE_EGP = 10_000_000;
const MAX_STOCK = 1_000_000;

/** الجنيه إلى قروش؛ null لقيمة فارغة، NaN لغير صالحة. */
function egpToPiasters(s: string): number | null {
  if (!s.trim()) return null;
  const n = toNumber(s);
  if (n === null || !Number.isFinite(n)) return Number.NaN;
  return Math.round(n * 100);
}

function stockOf(s: string): number | null | "bad" {
  if (!s.trim()) return null;
  const n = toNumber(s);
  if (n === null || !Number.isInteger(n) || n < 0 || n > MAX_STOCK) return "bad";
  return n;
}

/** يقارن الصفوف المعدلة بالأصلية، ويعيد التغييرات الصالحة مع أخطاء كل خانة. لا يُحفظ شيء إن وُجد خطأ. */
export function planBulkEdit(original: BulkRow[], edited: BulkRow[]): { patches: BulkPatch[]; issues: BulkIssue[] } {
  const base = new Map(original.map((r) => [r.id, r]));
  const patches: BulkPatch[] = [];
  const issues: BulkIssue[] = [];
  for (const r of edited) {
    const o = base.get(r.id);
    if (!o) continue;
    const same =
      r.price === o.price &&
      r.compareAt === o.compareAt &&
      r.stock === o.stock &&
      r.status === o.status &&
      r.variants.every((v, i) => v.stock === o.variants[i]?.stock && v.price === o.variants[i]?.price);
    if (same) continue;
    const before = issues.length;
    const price = egpToPiasters(r.price);
    if (price === null || Number.isNaN(price) || price <= 0 || price > MAX_PRICE_EGP * 100) issues.push({ id: r.id, field: "price", message: "أدخلوا سعراً صحيحاً أكبر من صفر" });
    const compare = egpToPiasters(r.compareAt);
    if (compare !== null && (Number.isNaN(compare) || compare <= 0)) issues.push({ id: r.id, field: "compareAt", message: "السعر قبل الخصم غير صالح" });
    else if (compare !== null && price !== null && !Number.isNaN(price) && compare <= price) issues.push({ id: r.id, field: "compareAt", message: "السعر قبل الخصم يجب أن يكون أعلى من سعر البيع" });
    const stock = r.variants.length ? undefined : stockOf(r.stock);
    if (stock === "bad") issues.push({ id: r.id, field: "stock", message: "المخزون عدد صحيح من صفر فأكثر، أو يُترك فارغاً لغير المحدود" });
    const variants: BulkPatch["variants"] = [];
    for (const v of r.variants) {
      const vs = stockOf(v.stock);
      const vp = egpToPiasters(v.price);
      if (vs === "bad" || (vp !== null && (Number.isNaN(vp) || vp <= 0))) {
        issues.push({ id: r.id, field: "variant", message: `بيانات التركيبة «${v.label}» غير صالحة` });
        continue;
      }
      variants.push({ id: v.id, stock: vs, pricePiasters: vp });
    }
    if (issues.length > before) continue;
    patches.push({ id: r.id, pricePiasters: price as number, compareAtPiasters: compare as number | null, stock: stock as number | null | undefined, status: r.status, variants });
  }
  return { patches, issues };
}
