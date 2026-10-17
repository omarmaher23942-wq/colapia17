// courier-export.ts — تصدير طلبات الشحن بصيغة الرفع الجماعي لكل شركة، وروابط تتبع الشحنات (منطق خالص مختبَر).
//
// افتراضات موثّقة: لكل شركة قالب رفع جماعي (Excel/CSV) تتغير أسماء أعمدته أحياناً بين حساب وآخر. الأعمدة هنا
// هي الأسماء الشائعة في قوالب الرفع المنشورة لكل شركة، وترتيبها كما في القالب، وقد يلزم مطابقة اسم عمود عند الرفع
// (شاشة الرفع في كل شركة تعرض خطوة مطابقة الأعمدة). مبلغ التحصيل (COD) = الإجمالي ناقص ما دُفع فعلاً (paid_piasters)
// لطلب الدفع عند الاستلام، وصفر لغيره، بالجنيه.
import { governorateName } from "@/lib/egypt";

export const COURIERS = ["bosta", "mylerz", "jt", "aramex", "private"] as const;
export type CourierKey = (typeof COURIERS)[number];

export type ShipOrder = {
  code: string;
  customerName: string;
  customerPhone: string;
  customerAltPhone?: string | null;
  governorate: string;
  city?: string | null;
  address: string;
  landmark?: string | null;
  customerNotes?: string | null;
  paymentMethod: string;
  paymentStatus: string;
  totalPiasters: number;
  paidPiasters: number;
  items: { name: string; variant?: string | null; qty: number }[];
};

export type CourierInfo = {
  key: CourierKey;
  label: string;
  /** قالب رابط التتبع؛ {n} رقم الشحنة. null = لا رابط عام. */
  trackingTemplate: string | null;
  headers: string[];
  row: (o: ShipOrder) => (string | number)[];
};

/** المبلغ الذي يحصّله المندوب بالجنيه: الإجمالي ناقص المدفوع، لطلب الدفع عند الاستلام غير المسدّد بالتحويل. */
export function codAmountEgp(o: Pick<ShipOrder, "paymentMethod" | "paymentStatus" | "totalPiasters" | "paidPiasters">): number {
  if (o.paymentMethod !== "cod" || o.paymentStatus === "confirmed") return 0;
  return Math.max(0, o.totalPiasters - Math.max(0, o.paidPiasters)) / 100;
}

const itemsText = (o: ShipOrder) => o.items.map((i) => `${i.name}${i.variant ? ` (${i.variant})` : ""} × ${i.qty}`).join("، ");
const pieces = (o: ShipOrder) => o.items.reduce((n, i) => n + i.qty, 0) || 1;
const fullAddress = (o: ShipOrder) => [o.address, o.landmark ? `علامة مميزة: ${o.landmark}` : ""].filter(Boolean).join(" - ");
const area = (o: ShipOrder) => o.city || governorateName(o.governorate);

export const COURIER_INFO: Record<CourierKey, CourierInfo> = {
  bosta: {
    key: "bosta",
    label: "بوسطة",
    trackingTemplate: "https://bosta.co/tracking-shipments?shipment-number={n}",
    headers: ["Full Name", "Phone", "Second Phone", "City", "Zone / District", "Address", "Package Type", "Description", "Number of Items", "COD", "Notes", "Reference"],
    row: (o) => [o.customerName, o.customerPhone, o.customerAltPhone ?? "", governorateName(o.governorate), o.city ?? "", fullAddress(o), "Parcel", itemsText(o), pieces(o), codAmountEgp(o), o.customerNotes ?? "", o.code],
  },
  mylerz: {
    key: "mylerz",
    label: "مايلرز",
    trackingTemplate: "https://mylerz.net/track-shipment?barcode={n}",
    headers: ["Consignee Name", "Mobile", "Alternate Mobile", "City", "Neighborhood", "Address", "Description", "Pieces", "COD Amount", "Reference", "Notes"],
    row: (o) => [o.customerName, o.customerPhone, o.customerAltPhone ?? "", governorateName(o.governorate), o.city ?? "", fullAddress(o), itemsText(o), pieces(o), codAmountEgp(o), o.code, o.customerNotes ?? ""],
  },
  jt: {
    key: "jt",
    label: "J&T",
    trackingTemplate: "https://www.jtexpress.eg/trajectoryQuery?waybillNo={n}",
    headers: ["Receiver Name", "Receiver Phone", "Receiver Province", "Receiver City", "Receiver Address", "Item Name", "Quantity", "Weight (kg)", "COD Amount", "Remarks", "Customer Order No"],
    row: (o) => [o.customerName, o.customerPhone, governorateName(o.governorate), area(o), fullAddress(o), itemsText(o), pieces(o), 1, codAmountEgp(o), o.customerNotes ?? "", o.code],
  },
  aramex: {
    key: "aramex",
    label: "أرامكس",
    trackingTemplate: "https://www.aramex.com/track/results?ShipmentNumber={n}",
    headers: ["Consignee Name", "Consignee Phone", "Consignee City", "Consignee Address", "Description", "Pieces", "Weight", "COD Amount", "Reference 1", "Notes"],
    row: (o) => [o.customerName, o.customerPhone, governorateName(o.governorate), fullAddress(o), itemsText(o), pieces(o), 1, codAmountEgp(o), o.code, o.customerNotes ?? ""],
  },
  private: {
    key: "private",
    label: "مندوب خاص",
    trackingTemplate: null,
    headers: ["رقم الطلب", "الاسم", "الموبايل", "المحافظة", "المنطقة", "العنوان", "المحتوى", "المطلوب تحصيله (ج)", "ملاحظات"],
    row: (o) => [o.code, o.customerName, o.customerPhone, governorateName(o.governorate), o.city ?? "", fullAddress(o), itemsText(o), codAmountEgp(o), o.customerNotes ?? ""],
  },
};

export const isCourierKey = (v: unknown): v is CourierKey => typeof v === "string" && (COURIERS as readonly string[]).includes(v);

export function courierTable(key: CourierKey, orders: ShipOrder[]): { headers: string[]; rows: (string | number)[][] } {
  const c = COURIER_INFO[key];
  return { headers: c.headers, rows: orders.map((o) => c.row(o)) };
}

/** يتعرف على الشركة من اسم محفوظ في الطلب (عربي أو لاتيني). */
export function courierFromName(name: string | null | undefined): CourierKey | null {
  const n = (name ?? "").trim().toLowerCase();
  if (!n) return null;
  if (/bosta|بوسطة|بوسطه/.test(n)) return "bosta";
  if (/mylerz|مايلرز|ميلرز/.test(n)) return "mylerz";
  if (/j\s*&\s*t|\bjt\b|جي\s*اند\s*تي/.test(n)) return "jt";
  if (/aramex|ارامكس|أرامكس/.test(n)) return "aramex";
  if (/خاص|private|مندوب/.test(n)) return "private";
  return null;
}

/** رابط تتبع الشحنة للعميل، أو null إن لم تُعرف الشركة أو لم يُسجَّل رقم. */
export function trackingUrl(courierName: string | null | undefined, trackingNumber: string | null | undefined): string | null {
  const key = courierFromName(courierName);
  const n = (trackingNumber ?? "").trim();
  if (!key || !n) return null;
  const t = COURIER_INFO[key].trackingTemplate;
  return t ? t.replace("{n}", encodeURIComponent(n)) : null;
}

/** رسالة واتساب للعميل عند الشحن برقم التتبع ورابطه إن وُجد. */
export function shippedMessage(o: { customerName: string; code: string; courierName?: string | null; trackingNumber?: string | null }, storeName: string): string {
  const url = trackingUrl(o.courierName, o.trackingNumber);
  const lines = [`مرحباً ${o.customerName.trim().split(/\s+/)[0] ?? ""}، طلبكم ${o.code} من ${storeName} خرج للشحن.`];
  if (o.courierName) lines.push(`شركة الشحن: ${o.courierName}`);
  if (o.trackingNumber) lines.push(`رقم الشحنة: ${o.trackingNumber}`);
  if (url) lines.push(`تتبع الشحنة: ${url}`);
  lines.push("سنتواصل معكم عند وصول المندوب.");
  return lines.join("\n");
}
