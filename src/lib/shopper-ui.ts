// shopper-ui.ts — منطق خالص لواجهة الزائر: مشاركة السلة والمفضلة، مسودة الدفع، تنسيق الهاتف، تقويم التوصيل،
// وكشف تغيّر حالات الطلبات. بلا DOM ليُختبر ويعمل في المتجر المستضاف ومشروع العميل بالقواعد نفسها.
import { formatEgp } from "@/lib/money";

/* ───────── السلة ───────── */
export type CartLineLite = { name: string; qty: number; unitPiasters: number; variantLabel?: string; slug?: string };

const lineText = (l: CartLineLite) => `• ${l.name}${l.variantLabel ? ` (${l.variantLabel})` : ""} × ${l.qty} — ${formatEgp(l.unitPiasters * l.qty)}`;

/** رسالة «اطلب عبر واتساب» من السلة: الأصناف والإجمالي التقديري ورابط المتجر. */
export function cartWhatsappMessage(lines: CartLineLite[], opts: { storeName: string; totalPiasters: number; url?: string }): string {
  const body = lines.slice(0, 30).map(lineText).join("\n");
  const more = lines.length > 30 ? `\n… و${lines.length - 30} أصناف أخرى` : "";
  return `أهلاً ${opts.storeName}، أريد طلب:\n${body}${more}\nالإجمالي التقديري: ${formatEgp(opts.totalPiasters)}${opts.url ? `\n${opts.url}` : ""}\nأرجو تأكيد التوفر وطريقة الدفع والتوصيل.`;
}

/** نص مشاركة السلة مع شخص آخر (استشارة): أسماء وروابط المنتجات بلا بيانات شخصية. */
export function cartShareText(lines: CartLineLite[], origin: string, storeName: string): string {
  const body = lines
    .slice(0, 20)
    .map((l) => `• ${l.name}${l.variantLabel ? ` (${l.variantLabel})` : ""} — ${formatEgp(l.unitPiasters)}${l.slug ? `\n${origin}/p/${encodeURIComponent(l.slug)}` : ""}`)
    .join("\n");
  return `رأيكم في اختياراتي من ${storeName}؟\n${body}`;
}

/* ───────── المفضلة ───────── */
export const WISH_SHARE_MAX = 40;

export function wishlistShareUrl(origin: string, slugs: string[]): string {
  const list = slugs.filter((s) => s && s.length <= 120).slice(0, WISH_SHARE_MAX);
  return `${origin}/wishlist?items=${encodeURIComponent(list.join(","))}`;
}

export function parseSharedWishlist(param: string | null | undefined): string[] {
  if (!param) return [];
  return [...new Set(param.split(",").map((s) => s.trim()).filter((s) => s.length > 0 && s.length <= 120))].slice(0, WISH_SHARE_MAX);
}

/** انخفاض سعر منتج منذ إضافته للمفضلة: يُعرض فقط إن كان السعر الحالي أقل فعلاً (انخفاض ≥ 1%). */
export function priceDrop(addedPiasters: number | undefined, nowPiasters: number): { fromPiasters: number; percent: number } | null {
  if (!addedPiasters || addedPiasters <= 0 || nowPiasters >= addedPiasters) return null;
  const percent = Math.round(((addedPiasters - nowPiasters) / addedPiasters) * 100);
  return percent >= 1 ? { fromPiasters: addedPiasters, percent } : null;
}

/* ───────── الدفع ───────── */
/** رقم موبايل مصري كما يُكتب: يحوّل الأرقام الهندية ويضيف مسافات (010 1234 5678) ويقص الزائد. */
export function formatPhoneLive(raw: string): string {
  let d = raw.replace(/[٠-٩]/g, (c) => String("٠١٢٣٤٥٦٧٨٩".indexOf(c))).replace(/[^\d+]/g, "");
  const plus = d.startsWith("+");
  d = d.replace(/\+/g, "");
  if (plus && d.startsWith("20")) d = "0" + d.slice(2);
  d = d.slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 7) return `${d.slice(0, 3)} ${d.slice(3)}`;
  return `${d.slice(0, 3)} ${d.slice(3, 7)} ${d.slice(7)}`;
}

export const DRAFT_FIELDS = ["name", "phone", "altPhone", "governorate", "city", "address", "landmark", "notes"] as const;
export type CheckoutDraft = Partial<Record<(typeof DRAFT_FIELDS)[number], string>>;

/** يقرأ مسودة الدفع المحفوظة بتسامح: حقول معروفة فقط، نصوص مقصوصة. لا يحفظ بيانات الدفع ولا الإيصال. */
export function sanitizeDraft(raw: unknown): CheckoutDraft {
  if (!raw || typeof raw !== "object") return {};
  const r = raw as Record<string, unknown>;
  const out: CheckoutDraft = {};
  for (const k of DRAFT_FIELDS) {
    const v = r[k];
    if (typeof v === "string" && v.trim()) out[k] = v.slice(0, k === "address" || k === "notes" ? 400 : 80);
  }
  return out;
}

/* ───────── الطلبات ───────── */
export type OrderLite = { code: string; status: string };
const STATUS_AR: Record<string, string> = {
  confirmed: "تم تأكيد طلبكم",
  preparing: "طلبكم قيد التجهيز",
  shipped: "طلبكم مع شركة الشحن",
  delivered: "تم توصيل طلبكم",
  cancelled: "تم إلغاء الطلب",
  returned: "تم تسجيل الطلب كمرتجع",
};

/** الفروق بين آخر حالات شوهدت وحالات اليوم (طلب جديد لم يُرَ سابقاً لا يُنبَّه إليه). */
export function statusChanges(seen: Record<string, string>, now: OrderLite[]): { code: string; status: string; text: string }[] {
  const out: { code: string; status: string; text: string }[] = [];
  for (const o of now) {
    const prev = seen[o.code];
    if (prev && prev !== o.status && STATUS_AR[o.status]) out.push({ code: o.code, status: o.status, text: STATUS_AR[o.status]! });
  }
  return out;
}

const icsDate = (d: Date) => `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
const icsEsc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** ملف تقويم (ICS) ليوم توصيل متوقع (يوم كامل من..إلى) برقم الطلب. */
export function deliveryIcs(opts: { code: string; storeName: string; from: Date; to: Date; stamp?: Date }): string {
  const end = new Date(opts.to.getTime() + 86_400_000);
  const stamp = opts.stamp ?? new Date();
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Storefront//AR",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:order-${opts.code}@storefront`,
    `DTSTAMP:${icsDate(stamp)}T000000Z`,
    `DTSTART;VALUE=DATE:${icsDate(opts.from)}`,
    `DTEND;VALUE=DATE:${icsDate(end)}`,
    `SUMMARY:${icsEsc(`وصول طلبكم ${opts.code} من ${opts.storeName}`)}`,
    `DESCRIPTION:${icsEsc("موعد تقديري، سيتصل بكم المندوب قبل الوصول.")}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

/* ───────── التقييمات ───────── */
export type ReviewLite = { rating: number; body: string | null; imageUrls: string[] | null; createdAt: string };
export type ReviewSort = "newest" | "highest" | "lowest";
export type ReviewFilter = { stars: number | null; withPhotos: boolean };

export function arrangeReviews<T extends ReviewLite>(rows: T[], sort: ReviewSort, f: ReviewFilter): T[] {
  const list = rows.filter((r) => (f.stars ? r.rating === f.stars : true) && (f.withPhotos ? (r.imageUrls?.length ?? 0) > 0 : true));
  const t = (r: T) => new Date(r.createdAt).getTime();
  return [...list].sort((a, b) => (sort === "highest" ? b.rating - a.rating || t(b) - t(a) : sort === "lowest" ? a.rating - b.rating || t(b) - t(a) : t(b) - t(a)));
}

/** نسبة من قيّموا بـ 4 نجوم فأكثر، تُعرض فقط مع 5 تقييمات فأكثر. */
export function recommendPercent(dist: Record<number, number>): number | null {
  const total = [1, 2, 3, 4, 5].reduce((s, n) => s + (dist[n] ?? 0), 0);
  if (total < 5) return null;
  return Math.round((((dist[4] ?? 0) + (dist[5] ?? 0)) / total) * 100);
}

export function reviewPhotos<T extends ReviewLite>(rows: T[], max = 8): string[] {
  const out: string[] = [];
  for (const r of rows) for (const u of r.imageUrls ?? []) if (!out.includes(u) && out.length < max) out.push(u);
  return out;
}
