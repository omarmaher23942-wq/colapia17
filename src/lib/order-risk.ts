// order-risk.ts — تقدير مخاطرة طلب الدفع عند الاستلام من إشارات صادقة داخل متجر التاجر وحده (لا بيانات متاجر أخرى).
// منطق خالص مختبَر: يعيد مستوى وأسباباً عربية يفهمها التاجر، ولا يرفض طلباً بنفسه؛ القرار للتاجر (اتصل/اطلب عربوناً/أكّد).
export type RiskLevel = "trusted" | "none" | "low" | "medium" | "high";

export type RiskInput = {
  paymentMethod: string;
  totalPiasters: number;
  customerName: string;
  customerPhone: string;
  address: string;
  /** طلبات هذا الرقم الأخرى في المتجر (بلا الطلب نفسه ولا الطلبات التجريبية). */
  history: { total: number; delivered: number; returned: number; cancelled: number };
  /** طلبات أخرى مفتوحة لنفس الرقم خلال آخر 24 ساعة. */
  recentOpen: number;
  /** متوسط قيمة الطلب المُسلَّم في المتجر (قروش)، أو null إن لم توجد طلبات كافية. */
  avgDeliveredPiasters: number | null;
};

export type RiskResult = { level: RiskLevel; score: number; reasons: string[] };

const LETTERS = /[\p{L}]/gu;

/** رقم مصري شكلاً لكنه وهمي غالباً: أقل من 10 أرقام، أو رقم واحد مكرر 7 مرات متتالية (01099999999). */
export function looksFakePhone(phone: string): boolean {
  const d = phone.replace(/\D/g, "");
  return d.length < 10 || /(\d)\1{6,}/.test(d);
}

/** اسم لا يشبه اسماً حقيقياً: أقل من 3 حروف، أو فيه أرقام، أو حرف مكرر كثيراً. */
export function looksFakeName(name: string): boolean {
  const n = name.trim();
  const letters = n.match(LETTERS)?.length ?? 0;
  if (letters < 3) return true;
  if (/\d/.test(n)) return true;
  return /(.)\1{3,}/u.test(n.replace(/\s/g, ""));
}

/** عنوان أقصر من أن يصل به مندوب (بلا شارع/رقم/علامة). */
export function looksVagueAddress(address: string): boolean {
  const a = address.replace(/\s+/g, " ").trim();
  if (a.length < 12) return true;
  return a.split(" ").length < 3 && !/\d/.test(a);
}

export function orderRisk(i: RiskInput): RiskResult {
  const reasons: string[] = [];
  let score = 0;
  const add = (pts: number, why: string) => {
    score += pts;
    reasons.push(why);
  };
  const h = i.history;
  const cod = i.paymentMethod === "cod";

  if (looksFakePhone(i.customerPhone)) add(3, "رقم الموبايل يبدو غير حقيقي");
  if (h.returned >= 2 || (h.returned >= 1 && h.returned >= h.delivered)) add(3, `رفض الاستلام أو أرجع ${h.returned === 1 ? "طلباً سابقاً" : `${h.returned} طلبات سابقة`}`);
  else if (h.returned === 1) add(2, "رفض الاستلام أو أرجع طلباً سابقاً مرة");
  if (h.cancelled >= 2 && h.delivered === 0) add(2, `ألغى ${h.cancelled} طلبات سابقة ولم يستلم أي طلب`);
  if (i.recentOpen >= 1) add(2, i.recentOpen === 1 ? "طلب آخر مفتوح لنفس الرقم خلال 24 ساعة (قد يكون مكرراً)" : `${i.recentOpen} طلبات مفتوحة لنفس الرقم خلال 24 ساعة`);
  if (looksVagueAddress(i.address)) add(1, "العنوان مختصر جداً: اطلب تفاصيل أكثر قبل الشحن");
  if (looksFakeName(i.customerName)) add(1, "الاسم لا يبدو اسماً حقيقياً");
  if (cod && h.total === 0 && i.avgDeliveredPiasters && i.totalPiasters >= i.avgDeliveredPiasters * 3 && i.totalPiasters >= 150000)
    add(2, "قيمة كبيرة (3 أضعاف متوسط طلباتك) من عميل جديد بالدفع عند الاستلام");

  // التحويل المسبق يزيل خطر رفض الاستلام: نبقي الإشارات للعلم فقط بوزن أقل.
  if (!cod) score = Math.floor(score / 2);

  if (score === 0 && h.delivered >= 2 && h.returned === 0) return { level: "trusted", score: 0, reasons: [`استلم ${h.delivered} طلبات سابقة دون رفض`] };
  const level: RiskLevel = score >= 4 ? "high" : score >= 2 ? "medium" : score >= 1 ? "low" : "none";
  return { level, score, reasons };
}

export const RISK_LABEL: Record<RiskLevel, string> = {
  trusted: "عميل موثوق",
  none: "لا إشارات مقلقة",
  low: "انتبه",
  medium: "يحتاج تأكيداً",
  high: "مخاطرة عالية",
};

/** نصيحة عملية لكل مستوى (تظهر في صفحة الطلب). */
export const RISK_ADVICE: Record<RiskLevel, string> = {
  trusted: "يمكنك التجهيز مباشرة.",
  none: "أرسل رابط التأكيد على واتساب كالمعتاد.",
  low: "أرسل رابط التأكيد وراجع البيانات قبل الشحن.",
  medium: "لا تشحن قبل أن يؤكد العميل من الرابط أو بمكالمة.",
  high: "اتصل بالعميل قبل التجهيز، وفكّر في طلب عربون أو الدفع المسبق.",
};
