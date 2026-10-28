// offer.ts — وضع العرض الحالي كما يراه الوكيل (خالص ومختبَر): هل عرض الإطلاق متاحة وكم مقعداً باقياً وبأي سعر. الإتاحة لا تُفترض
// إلا بمقاعد باقية فعلاً، والقراءة دفاعية لأن شكل حالة الأسعار يملكه مسار الأسعار.
export type Offer = {
  /** عرض الإطلاق متاحة (مفعّلة وفيها مقاعد). */
  golden: boolean;
  seatsLeft: number;
  seatsTotal: number;
  /** سعر عرض الإطلاق والسعر العادي (null إن لم يُقرأ). */
  price: number | null;
  regular: number | null;
};

export type GoldenLike = { available?: unknown; seatsLeft?: unknown; seats?: unknown; buildPrice?: unknown; regularBuildPrice?: unknown } | null | undefined;

const count = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
const money = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.round(v) : null);

const egp = (n: number) => Math.round(n).toLocaleString("en-US");

/**
 * حقائق V5 التي يراها الوكيل (خالصة): ما يقدمه الفريق، المعاينة المجانية، والسعر بعد الإعجاب فقط (بعدّاد عرض الإطلاق الحقيقي).
 * لا باقات شهرية ولا استضافة ولا اشتراك: لا يملك الوكيل حقيقة عنها فلا يذكرها.
 */
export function agentFactsText(o: Offer): string {
  const lines = [
    "- Colapia وكالة برمجيات تبني أي نظام: متاجر إلكترونية، مواقع تعريفية، أنظمة حجز، لوحات تحكم، تطبيقات ويب، ووكلاء ذكاء اصطناعي. لا نرفض أي خدمة.",
    "- المشروع يُسلَّم كوداً كاملاً يملكه العميل على حساباته، والفريق يرافقه ويدعمه حتى يُرفع النظام على حساباته الشخصية ويعمل.",
    "- لا اشتراك شهري إلزامي ولا رسوم استضافة: نعتمد حلولاً تُنهي مشكلة الاشتراكات، والتكلفة الدورية الوحيدة المحتملة هي النطاق (الدومين) وقد لا يلزم.",
    "- من أعمالنا موقع Qima لوكالة إنتاج محتوى، وعميلها راضٍ جداً عن النتيجة.",
    "- متجر الديمو demo.colapia.com متجر كامل يعمل (تصفح وسلة وطلب ولوحة تحكم) نموذج لما نبنيه.",
  ];
  if (o.golden && o.price) {
    lines.push(`- عرض الإطلاق: ${egp(o.price)} ج${o.regular && o.regular > o.price ? ` بدلاً من ${egp(o.regular)} ج` : ""} لأول ${o.seatsTotal} عملاء فقط ولجميع الخدمات، والمتبقي فعلاً ${o.seatsLeft} (العدد حقيقي من النظام).`);
  } else if (o.regular) {
    lines.push(`- سعر المتجر الجاهز: ${egp(o.regular)} ج. أسعار المشاريع الأخرى يحددها الفريق بعد فهم المتطلبات.`);
  }
  return lines.join("\n");
}

export function offerFrom(g: GoldenLike): Offer {
  const seatsLeft = count(g?.seatsLeft);
  const seatsTotal = Math.max(seatsLeft, count(g?.seats));
  return { golden: g?.available === true && seatsLeft > 0, seatsLeft, seatsTotal, price: money(g?.buildPrice), regular: money(g?.regularBuildPrice) };
}
