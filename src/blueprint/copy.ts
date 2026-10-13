// copy.ts — نصوص أزرار وعناوين الواجهة بصوت كل متجر.
// يكتبها فريق البناء في bp.copy؛ وما لم يُكتب يأخذ صياغة وظيفية قصيرة ومحايدة (مصدر لا فعل أمر مذكر أو مؤنث، فتخاطب أي عميل)،
// فلا يظهر أبداً زر بلا نص، ولا عبارة ترحيب عامة لا تخص المتجر.
import type { StoreCopy } from "./schema";

export const COPY_FALLBACK: Required<StoreCopy> = {
  addToCart: "إضافة للسلة",
  buyNow: "شراء الآن",
  soldOut: "نفدت الكمية",
  viewAll: "عرض الكل",
  cartTitle: "سلة المشتريات",
  emptyCart: "سلتك فارغة حتى الآن.",
  continueShopping: "متابعة التسوق",
  checkout: "إتمام الطلب",
  searchPlaceholder: "البحث عن منتج",
  newBadge: "جديد",
  saleBadge: "خصم",
  bestSellerBadge: "الأكثر طلباً",
  lowStock: "باقي {n} فقط",
  freeShippingGap: "باقي {amount} على الشحن المجاني",
  freeShippingReached: "طلبك شحنه مجاني",
  orderSuccessTitle: "تم استلام طلبك",
  trackOrder: "تتبع الطلب",
  menu: "القائمة",
  allProducts: "كل المنتجات",
};

export type CopyKey = keyof StoreCopy;

/** نص الواجهة بصوت المتجر مع تعويض {n} و{amount}. */
export function copyOf(copy: StoreCopy | undefined, key: CopyKey, vars: Record<string, string | number> = {}): string {
  const raw = (copy?.[key] ?? "").trim() || COPY_FALLBACK[key];
  return raw.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : ""));
}
