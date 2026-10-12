// monthly-report.ts — التقرير الشهري لصاحب المتجر (المرحلة 9.7): الشهر السابق بتوقيت القاهرة، ونص البريد من أرقام
// متجره الفعلية فقط مع المقارنة بالشهر الذي قبله. لا تقدير ولا رقم افتراضي: ما لا يتوفر لا يُذكر. منطق خالص مختبَر.
import { cairoMonthStart } from "@/lib/change-requests";
import { formatEgp } from "@/lib/money";
import { arCount, NOUN } from "@/lib/format";

const MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

/** الشهر المنتهي (من، إلى) والشهر قبله، واسمه ومفتاحه YYYY-MM. */
export function reportMonth(now = new Date()) {
  const to = cairoMonthStart(now);
  const from = cairoMonthStart(new Date(to.getTime() - 86400_000));
  const prevFrom = cairoMonthStart(new Date(from.getTime() - 86400_000));
  const mid = new Date(from.getTime() + 10 * 86400_000);
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit" }).formatToParts(mid);
  const y = Number(parts.find((p) => p.type === "year")!.value);
  const m = Number(parts.find((p) => p.type === "month")!.value);
  return { from, to, prevFrom, key: `${y}-${String(m).padStart(2, "0")}`, label: `${MONTHS[m - 1]} ${y}` };
}

export type ReportNumbers = { orders: number; sales: number; visitors: number };
export type ReportInput = {
  storeName: string;
  monthLabel: string;
  cur: ReportNumbers;
  prev: ReportNumbers | null;
  delivered: number;
  returned: number;
  topProducts: { name: string; qty: number }[];
  bestCampaign: { name: string; orders: number } | null;
  recoveredCarts: number;
  requestsLeft: number | null;
  renewBy: string | null;
};

const fmt = (n: number) => new Intl.NumberFormat("en-US").format(n);
function change(cur: number, prev: number | undefined): string {
  if (prev === undefined) return "";
  if (prev === 0) return cur > 0 ? " (أول مرة)" : "";
  const p = Math.round(((cur - prev) / prev) * 100);
  return p === 0 ? " (مثل الشهر السابق)" : p > 0 ? ` (+${p}% عن الشهر السابق)` : ` (${p}% عن الشهر السابق)`;
}

export function reportParagraphs(i: ReportInput): string[] {
  const out: string[] = [];
  const c = i.cur;
  if (c.orders === 0 && c.visitors === 0) {
    out.push(`لم تصل متجرك زيارات ولا طلبات في ${i.monthLabel}. رابط متجرك في البايو وفي إعلان صغير يصنع الفرق؛ ستجد صوراً ونصوصاً جاهزة في «التسويق» بلوحتك.`);
  } else {
    out.push(
      `في ${i.monthLabel}: ${arCount(c.orders, NOUN.order)}${change(c.orders, i.prev?.orders)}، بمبيعات ${formatEgp(c.sales)}${change(c.sales, i.prev?.sales)}، من ${arCount(c.visitors, NOUN.visitor)}${change(c.visitors, i.prev?.visitors)}.`
    );
    if (c.visitors > 0 && c.orders > 0) out.push(`من كل 100 زائر طلب ${((c.orders / c.visitors) * 100).toFixed(1)}.`);
  }
  if (i.delivered || i.returned) out.push(`سُلِّم ${arCount(i.delivered, NOUN.order)}${i.returned ? `، ورُفض أو أُرجع ${arCount(i.returned, NOUN.order)}` : ""}.`);
  if (i.topProducts.length) out.push(`الأكثر طلباً: ${i.topProducts.map((p) => `${p.name} (${fmt(p.qty)})`).join("، ")}.`);
  if (i.bestCampaign && i.bestCampaign.orders > 0) out.push(`أفضل حملة: «${i.bestCampaign.name}» بـ ${arCount(i.bestCampaign.orders, NOUN.order)}.`);
  if (i.recoveredCarts > 0) out.push(`استرجعت ${arCount(i.recoveredCarts, NOUN.cart)} متروكة تحولت لطلبات.`);
  if (i.requestsLeft !== null) out.push(`رصيدك هذا الشهر من طلبات التعديل: ${fmt(i.requestsLeft)} (من «اطلب تعديل» في لوحتك).`);
  if (i.renewBy) out.push(`اشتراك الاستضافة يُجدَّد قبل ${i.renewBy}.`);
  return out;
}
