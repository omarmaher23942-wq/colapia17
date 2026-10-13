// store-readiness.ts — «جاهزية متجرك» بعد التسليم (الجولة 3.3): خطوات مجمّعة بما يمنع الطلب أو يضيّعه أولاً، ثم ما
// يقنع الزائر، ثم ما يكبّر المبيعات. كل خطوة تُقاس من بيانات المتجر الفعلية (لا علامة «تم» يضعها التاجر بيده)،
// ولها سبب قصير ورابط للمكان الذي تُنجز فيه. الاختيارية تظهر ولا تدخل في النسبة. منطق خالص مختبَر.
import { arCount, fmtNum, NOUN } from "@/lib/format";

export type ReadinessInput = {
  activeProducts: number;
  activeWithoutImages: number;
  activeWithCost: number;
  activeShippingZones: number;
  /** سعر شحن موحد مضبوط (يغني عن جدول المحافظات). */
  flatShipping: boolean;
  hasOrders: boolean;
  /** طلب تجريبي من صاحب المتجر (جرّب الشراء بنفسه). */
  hasTestOrder: boolean;
  /** منتجات منشورة لها خيار مقاس. */
  sizeProducts: number;
  hasSizeChart: boolean;
  hasLogo: boolean;
  hasWhatsapp: boolean;
  payments: { cod: boolean; vodafoneCash: { enabled: boolean; ready: boolean }; instapay: { enabled: boolean; ready: boolean } };
  /** سياسة استبدال أو استرجاع أو ضمان مضبوطة (المسودة تطفئها كلها حتى يؤكدها التاجر). */
  policySet: boolean;
  hasPixel: boolean;
  /** النطاق الخاص (null = غير متاح في هذه النسخة). */
  customDomain: boolean | null;
};

export type ReadyGroup = "orders" | "trust" | "growth";
export const GROUP_LABEL: Record<ReadyGroup, string> = { orders: "يستقبل الطلبات", trust: "يقنع الزائر", growth: "يكبّر مبيعاتك" };

export type ReadyStep = { key: string; group: ReadyGroup; label: string; why: string; ok: boolean; optional?: boolean; detail?: string; href: string };

export function readinessSteps(i: ReadinessInput, shareHref: string): ReadyStep[] {
  const p = i.payments;
  const transferBroken = (p.vodafoneCash.enabled && !p.vodafoneCash.ready) || (p.instapay.enabled && !p.instapay.ready);
  const anyPayment = p.cod || (p.vodafoneCash.enabled && p.vodafoneCash.ready) || (p.instapay.enabled && p.instapay.ready);
  const steps: ReadyStep[] = [
    {
      key: "payments",
      group: "orders",
      label: "وسائل الدفع مكتملة",
      why: transferBroken ? "وسيلة تحويل مفعّلة بلا رقم أو عنوان: العميل لن يعرف أين يحوّل." : "طريقة دفع واحدة على الأقل يراها العميل في صفحة الدفع.",
      ok: anyPayment && !transferBroken,
      href: "/dashboard/settings",
    },
    { key: "contact", group: "orders", label: "رقم واتساب للمتجر", why: "زر واتساب في المتجر، ورسالة العميل برقم طلبه بعد الشراء.", ok: i.hasWhatsapp, href: "/dashboard/settings" },
    {
      key: "shipping",
      group: "orders",
      label: "أسعار الشحن",
      why: "بدونها لا يكتمل أي طلب.",
      ok: i.activeShippingZones > 0 || i.flatShipping,
      detail: i.activeShippingZones > 0 ? arCount(i.activeShippingZones, NOUN.governorate) : undefined,
      href: "/dashboard/shipping",
    },
    { key: "policy", group: "orders", label: "سياسة الاستبدال والضمان", why: "أول سؤال يسأله العميل قبل الشراء، وتظهر شارتها في صفحة المنتج.", ok: i.policySet, href: "/dashboard/policies" },
    { key: "test", group: "orders", label: "تجربة الشراء من متجرك", why: "طلب تجريبي لا يخصم مخزوناً ولا يُحسب في المبيعات، ويريك ما يراه عميلك.", ok: i.hasTestOrder || i.hasOrders, href: shareHref },
    {
      key: "products",
      group: "trust",
      label: "5 منتجات منشورة على الأقل",
      why: "اختيار أكبر = زيارة أطول وطلب أكثر.",
      ok: i.activeProducts >= 5,
      detail: `${fmtNum(Math.min(i.activeProducts, 5))}/5`,
      href: "/dashboard/products",
    },
    {
      key: "images",
      group: "trust",
      label: "صورة لكل منتج منشور",
      why: "المنتج بلا صورة لا يُشترى تقريباً، ولا يدخل كتالوج الإعلانات.",
      ok: i.activeProducts > 0 && i.activeWithoutImages === 0,
      detail: i.activeWithoutImages > 0 ? `${arCount(i.activeWithoutImages, NOUN.product)} بلا صورة` : undefined,
      href: i.activeWithoutImages > 0 ? "/dashboard/products?status=active&need=image" : "/dashboard/products",
    },
    { key: "logo", group: "trust", label: "شعار المتجر", why: "في الرأس والفاتورة وصورة المشاركة.", ok: i.hasLogo, href: "/dashboard/content" },
  ];
  if (i.sizeProducts > 0)
    steps.push({
      key: "sizes",
      group: "trust",
      label: "دليل المقاسات",
      why: "المقاس الخطأ أول سبب للمرتجع. الجدول ومساعد المقاس يظهران بجانب اختيار المقاس.",
      ok: i.hasSizeChart,
      detail: arCount(i.sizeProducts, NOUN.product),
      href: "/dashboard/size-guide",
    });
  steps.push(
    { key: "first", group: "growth", label: "أول طلب حقيقي", why: "شارك رابط متجرك في البايو والستوري، وصورة جاهزة في «التسويق».", ok: i.hasOrders, href: "/dashboard/marketing" },
    {
      key: "cost",
      group: "growth",
      label: "سعر التكلفة لكل منتج",
      why: "لترى ربحك الحقيقي لا المبيعات فقط.",
      ok: i.activeProducts > 0 && i.activeWithCost === i.activeProducts,
      detail: i.activeProducts > 0 ? `${fmtNum(i.activeWithCost)}/${fmtNum(i.activeProducts)}` : undefined,
      href: i.activeProducts > i.activeWithCost ? "/dashboard/products?status=active&need=cost" : "/dashboard/products",
    },
    { key: "pixel", group: "growth", label: "بكسل الإعلانات", why: "لو تعلن على فيسبوك أو تيك توك: يقيس الطلبات من كل إعلان.", ok: i.hasPixel, optional: true, href: "/dashboard/marketing" }
  );
  if (i.customDomain !== null)
    steps.push({ key: "domain", group: "growth", label: "نطاقك الخاص", why: "رابط باسم براندك مثل mystore.com.", ok: i.customDomain, optional: true, href: "/dashboard/domain" });
  return steps;
}

/** النسبة من الخطوات الأساسية فقط. */
export function readinessScore(steps: ReadyStep[]): { done: number; total: number; pct: number } {
  const req = steps.filter((s) => !s.optional);
  const done = req.filter((s) => s.ok).length;
  return { done, total: req.length, pct: req.length ? Math.round((done / req.length) * 100) : 100 };
}
