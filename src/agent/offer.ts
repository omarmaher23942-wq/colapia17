// offer.ts — وضع العرض الحالي كما يراه الوكيل (خالص ومختبَر): هل الدائرة الذهبية متاحة وكم مقعداً باقياً وبأي سعر. الإتاحة لا تُفترض
// إلا بمقاعد باقية فعلاً، والقراءة دفاعية لأن شكل حالة الأسعار يملكه مسار الأسعار.
export type Offer = {
  /** الدائرة الذهبية متاحة (مفعّلة وفيها مقاعد). */
  golden: boolean;
  seatsLeft: number;
  seatsTotal: number;
  /** سعر الدائرة الذهبية والسعر العادي (null إن لم يُقرأ). */
  price: number | null;
  regular: number | null;
};

export type GoldenLike = { available?: unknown; seatsLeft?: unknown; seats?: unknown; buildPrice?: unknown; regularBuildPrice?: unknown } | null | undefined;

const count = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
const money = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.round(v) : null);

const egp = (n: number) => Math.round(n).toLocaleString("en-US");

/**
 * حقائق V5 التي يراها الوكيل (خالصة): ما يقدمه الفريق، المعاينة المجانية، والسعر بعد الإعجاب فقط (بعدّاد الدائرة الذهبية الحقيقي).
 * لا باقات شهرية ولا استضافة ولا اشتراك: لا يملك الوكيل حقيقة عنها فلا يذكرها.
 */
export function agentFactsText(o: Offer): string {
  const lines = [
    "- Colapia وكالة يبني فريقها لكل عميل متجراً مخصصاً لبراندهم ويسلّمه لهم كوداً يملكونه بالكامل، مع لوحة تحكم لإدارة المنتجات والطلبات.",
    "- التجهيز والمعاينة مجانيان: يجهز الفريق المتجر أولاً ثم يصل العميل رابط إعداد يُكمل منه بياناته في دقائق ويعاين متجره 24 ساعة من أول فتح للرابط. لا دفع إلا إن أعجبه المتجر.",
    "- لا رسوم شهرية لدى Colapia ولا عمولة على المبيعات.",
    "- المتجر الجاهز يدعم: الدفع عند الاستلام والتحويل (فودافون كاش وإنستاباي)، مقاسات وألوان ومخزون، شحن حسب المحافظة، أكواد خصم، تتبع الطلب، وإرسال رقم الطلب على واتساب.",
  ];
  if (o.golden && o.price) {
    lines.push(`- سعر التفعيل بعد الإعجاب: ${egp(o.price)} ج${o.regular && o.regular > o.price ? ` بدلاً من ${egp(o.regular)} ج` : ""} ضمن «الدائرة الذهبية» لأول ${o.seatsTotal} متاجر، والمتبقي ${o.seatsLeft} من ${o.seatsTotal} (عدد حقيقي).`);
  } else if (o.regular) {
    lines.push(`- سعر التفعيل بعد الإعجاب: ${egp(o.regular)} ج.`);
  }
  return lines.join("\n");
}

export function offerFrom(g: GoldenLike): Offer {
  const seatsLeft = count(g?.seatsLeft);
  const seatsTotal = Math.max(seatsLeft, count(g?.seats));
  return { golden: g?.available === true && seatsLeft > 0, seatsLeft, seatsTotal, price: money(g?.buildPrice), regular: money(g?.regularBuildPrice) };
}
