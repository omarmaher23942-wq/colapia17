// today-tasks.ts — «مهام اليوم» في النظرة العامة (الجولة 3.1): قائمة واحدة مرتبة بما يكسب التاجر مالاً أو يحفظ
// عميله أولاً. تجمع أعداد النبض الحية (attention-items) مع مهام لا تظهر في الجرس: طلبات مؤكدة تأخر شحنها، وشحنات
// تأخر تسليمها، وما أُنجز اليوم، واقتراح نمو واحد حين لا يوجد ما ينتظر. منطق خالص مختبَر بلا React.
import { Megaphone, PackageCheck, Truck, type LucideIcon } from "lucide-react";
import { arCount, fmtNum, NOUN } from "@/lib/format";
import type { AttentionCounts } from "@/server/repos/attention";
import { attentionItems, type AttentionItem } from "@/components/dashboard/attention-items";

/** ساعات بعد التأكيد يُعدّ بعدها الطلب متأخراً في الشحن. */
export const STUCK_PREP_HOURS = 48;
/** أيام بعد الشحن يُعدّ بعدها التسليم متأخراً. */
export const STALE_SHIPPED_DAYS = 5;
/** أيام بلا طلبات يظهر بعدها اقتراح «شارك متجرك اليوم». */
export const QUIET_DAYS = 3;

export type TodayExtras = {
  /** طلبات مؤكدة أو قيد التجهيز مر على إنشائها أكثر من STUCK_PREP_HOURS ولم تُشحن. */
  stuckPrep: number;
  /** طلبات مشحونة منذ أكثر من STALE_SHIPPED_DAYS ولم تُعلَّم مستلمة. */
  staleShipped: number;
  /** ما أُنجز اليوم بتوقيت القاهرة. */
  done: { confirmed: number; shipped: number; delivered: number; asked: number };
  /** أيام منذ آخر طلب حقيقي (null = لا طلبات أبداً). */
  quietDays: number | null;
  /** منتجات منشورة. */
  activeProducts: number;
};

export type TodayTask = AttentionItem & { urgent: boolean };

const ORDER_KEYS = ["new", "receipts", "cancel", "stuck", "shipped", "returns", "questions", "reviews", "restock", "out", "variants", "low", "carts"] as const;
const URGENT = new Set(["new", "receipts", "cancel", "stuck", "shipped", "returns", "reviews"]);

const task = (key: string, icon: LucideIcon, tone: AttentionItem["tone"], title: string, chip: string, desc: string, href: string): AttentionItem => ({
  key,
  icon,
  tone,
  title,
  chip,
  desc,
  href,
});

/** المهام بالترتيب: المال والعملاء المنتظرون، ثم المخزون، ثم فرص البيع. */
export function todayTasks(counts: AttentionCounts, x: TodayExtras): TodayTask[] {
  const items = attentionItems(counts);
  if (x.stuckPrep > 0)
    items.push(
      task(
        "stuck",
        PackageCheck,
        "bad",
        "طلبات مؤكدة لم تُشحن بعد",
        arCount(x.stuckPrep, NOUN.order),
        "مر على طلبها أكثر من يومين. كل يوم تأخير يرفع احتمال رفض الاستلام: اشحنها اليوم أو طمئن العميل برسالة.",
        "/dashboard/orders?view=board"
      )
    );
  if (x.staleShipped > 0)
    items.push(
      task(
        "shipped",
        Truck,
        "warn",
        "شحنات تأخر تسليمها",
        arCount(x.staleShipped, NOUN.order),
        `خرجت للشحن منذ أكثر من ${STALE_SHIPPED_DAYS} أيام. تابعها مع شركة الشحن، وعلّمها «تم التسليم» متى استلمها العميل.`,
        "/dashboard/orders?status=shipped"
      )
    );
  const rank = (k: string) => {
    const i = (ORDER_KEYS as readonly string[]).indexOf(k);
    return i < 0 ? ORDER_KEYS.length : i;
  };
  const sorted = items.sort((a, b) => rank(a.key) - rank(b.key)).map((it) => ({ ...it, urgent: URGENT.has(it.key) }));
  const growth = growthTask(x);
  return growth && !sorted.some((t) => t.urgent) ? [...sorted, { ...growth, urgent: false }] : sorted;
}

/** اقتراح نمو واحد فقط، وحين يكون صادقاً: متجر فيه منتجات ولم يصله طلب منذ أيام. */
export function growthTask(x: TodayExtras): AttentionItem | null {
  if (x.activeProducts === 0) return null;
  if (x.quietDays !== null && x.quietDays < QUIET_DAYS) return null;
  return task(
    "share",
    Megaphone,
    "nova",
    x.quietDays === null ? "انشر متجرك لأول طلب" : "شارك متجرك اليوم",
    x.quietDays === null ? "لا طلبات بعد" : `آخر طلب منذ ${arCount(x.quietDays, NOUN.day)}`,
    "صورة ستوري وبوست جاهزتان بألوان متجرك ومنتج تختاره، ونصوص للنشر والبث على واتساب في «التسويق».",
    "/dashboard/marketing"
  );
}

/** سطر «اليوم» بما أُنجز فعلاً (لا يظهر إن لم يُنجز شيء). */
export function doneLine(d: TodayExtras["done"]): string | null {
  const parts = [
    d.confirmed ? `${fmtNum(d.confirmed)} تأكيد` : "",
    d.shipped ? `${fmtNum(d.shipped)} شحن` : "",
    d.delivered ? `${fmtNum(d.delivered)} تسليم` : "",
    d.asked ? `${fmtNum(d.asked)} طلب تقييم` : "",
  ].filter(Boolean);
  return parts.length ? `أُنجز اليوم: ${parts.join(" · ")}` : null;
}
