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

export function offerFrom(g: GoldenLike): Offer {
  const seatsLeft = count(g?.seatsLeft);
  const seatsTotal = Math.max(seatsLeft, count(g?.seats));
  return { golden: g?.available === true && seatsLeft > 0, seatsLeft, seatsTotal, price: money(g?.buildPrice), regular: money(g?.regularBuildPrice) };
}
