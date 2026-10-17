// attention-items.ts — بنود «ما يحتاج انتباهك» من أعداد النبض: مصدر واحد للجرس في الشريط العلوي
// ولقائمة الانتباه في صفحة النظرة العامة. دالة نقية بلا React state، تعمل في الخادم والعميل.
import { BellRing, CircleHelp, Layers, PackageOpen, Ban, PackageMinus, PackageX, Receipt, ShoppingBag, ShoppingCart, Star, type LucideIcon } from "lucide-react";
import { arCount, NOUN } from "@/lib/format";
import type { AttentionCounts } from "@/server/repos/attention";

export type AttentionTone = "nova" | "warn" | "bad" | "ok";

export type AttentionItem = {
  key: string;
  icon: LucideIcon;
  tone: AttentionTone;
  title: string;
  chip: string;
  desc: string;
  href: string;
};

export const ATTENTION_TONE: Record<AttentionTone, string> = {
  nova: "bg-nova/12 text-nova-2",
  warn: "bg-warn/12 text-warn",
  bad: "bg-bad/12 text-bad",
  ok: "bg-ok/12 text-ok",
};

/** بنود الانتباه بالترتيب: المال والعملاء أولاً، ثم المخزون، ثم فرص البيع. */
export function attentionItems(c: AttentionCounts): AttentionItem[] {
  const items: AttentionItem[] = [];
  if (c.newOrders > 0)
    items.push({
      key: "new",
      icon: ShoppingCart,
      tone: "nova",
      title: "طلبات بانتظار التأكيد",
      chip: arCount(c.newOrders, NOUN.order),
      desc: "أكّد الطلب ليطمئن العميل أن طلبه وصل ويبدأ التجهيز.",
      href: "/dashboard/orders?status=new",
    });
  if (c.receipts > 0)
    items.push({
      key: "receipts",
      icon: Receipt,
      tone: "warn",
      title: "إيصالات تحويل للمراجعة",
      chip: arCount(c.receipts, NOUN.receipt),
      desc: "طابق المبلغ في محفظتك أو حسابك، ثم أكّد الدفع أو ارفضه.",
      href: "/dashboard/orders?pay=review",
    });
  if (c.cancelRequests > 0)
    items.push({
      key: "cancel",
      icon: Ban,
      tone: "bad",
      title: "طلبات إلغاء من العملاء",
      chip: arCount(c.cancelRequests, NOUN.order),
      desc: "عملاء طلبوا إلغاء طلباتهم قبل الشحن. وافقوا أو اعتذروا برسالة قبل خروج الشحنة.",
      href: "/dashboard/returns?tab=cancel",
    });
  if (c.returnsOpen > 0)
    items.push({
      key: "returns",
      icon: PackageOpen,
      tone: "warn",
      title: "طلبات استبدال واسترجاع",
      chip: String(c.returnsOpen),
      desc: "راجعوا الصور والسبب ثم اعتمدوا أو اعتذروا، وسجّلوا الاستلام ليعود المخزون.",
      href: "/dashboard/returns",
    });
  if (c.questionsPending > 0)
    items.push({
      key: "questions",
      icon: CircleHelp,
      tone: "nova",
      title: "أسئلة عن المنتجات بانتظار إجابتكم",
      chip: String(c.questionsPending),
      desc: "السؤال المجاب عنه يظهر في صفحة المنتج ويحسم تردد الزائرين.",
      href: "/dashboard/questions",
    });
  if (c.pendingReviews > 0)
    items.push({
      key: "reviews",
      icon: Star,
      tone: "nova",
      title: "تقييمات بانتظار اعتمادك",
      chip: arCount(c.pendingReviews, NOUN.review),
      desc: "التقييم لا يظهر في متجرك قبل أن تعتمده.",
      href: "/dashboard/reviews",
    });
  if (c.outOfStock > 0)
    items.push({
      key: "out",
      icon: PackageX,
      tone: "bad",
      title: "نفد المخزون",
      chip: arCount(c.outOfStock, NOUN.product),
      desc: "يراها العملاء «نفدت الكمية». حدّث الكمية أو أخفِ المنتج.",
      href: "/dashboard/products?status=active&stock=out",
    });
  if (c.restockReady > 0)
    items.push({
      key: "restock",
      icon: BellRing,
      tone: "warn",
      title: "رجع للمخزون وفيه منتظرون",
      chip: arCount(c.restockReady, NOUN.product),
      desc: "عملاء طلبوا التنبيه عند توفره. رسالة «رجع تاني» جاهزة لهم في صفحة المنتج.",
      href: "/dashboard/products?stock=waiting",
    });
  if (c.variantsOut > 0)
    items.push({
      key: "variants",
      icon: Layers,
      tone: "warn",
      title: "نفد مقاس أو لون",
      chip: arCount(c.variantsOut, NOUN.product),
      desc: "تركيبة واحدة على الأقل نفدت بينما بقية المنتج متاحة.",
      href: "/dashboard/products?status=active&stock=variants_out",
    });
  if (c.lowStock > 0)
    items.push({
      key: "low",
      icon: PackageMinus,
      tone: "warn",
      title: "مخزون منخفض",
      chip: arCount(c.lowStock, NOUN.product),
      desc: "بقيت 3 قطع أو أقل. جهّز الكمية قبل أن تنفد.",
      href: "/dashboard/products?status=active&stock=low",
    });
  if (c.abandoned > 0)
    items.push({
      key: "carts",
      icon: ShoppingBag,
      tone: "ok",
      title: "سلات متروكة يمكن استرجاعها",
      chip: arCount(c.abandoned, NOUN.cart),
      desc: "عملاء كتبوا رقمهم ولم يكملوا الطلب خلال 7 أيام. راسلهم على واتساب.",
      href: "/dashboard#abandoned",
    });
  return items;
}

/** ما يُحسب في رقم الجرس: ما ينتظر قرار التاجر الآن (لا المخزون ولا الفرص). */
export function urgentCount(c: AttentionCounts): number {
  return c.ordersToHandle + c.pendingReviews + c.cancelRequests;
}
