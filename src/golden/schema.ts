// schema.ts — بيانات صفحة الحجز /golden: التطبيع والتحقق (خالص مختبَر، يستخدمه المتصفح والخادم بالقواعد نفسها).
// البريد إلزامي: منه يدخل العميل بوابته لاحقاً. الموافقة على التعاون (Collab أو شهادة) إلزامية للدائرة الذهبية فقط.
import { normalizeEmail, normalizeEgyptianPhone } from "@/lib/contact";
import type { PaymentPlan } from "@/lib/platform-pricing";

export type BookingMethod = "vodafone_cash" | "instapay";
export const BOOKING_METHODS: readonly BookingMethod[] = ["vodafone_cash", "instapay"];
export const METHOD_LABEL: Record<BookingMethod, string> = { vodafone_cash: "فودافون كاش", instapay: "إنستاباي" };

/** ما يملؤه الوكيل أو العميل قبل الإرسال (كله اختياري في المسودة). */
export type BookingFields = {
  storeName: string;
  niche: string;
  instagram: string;
  whatsapp: string;
  email: string;
  styleNotes: string;
  consent: boolean;
};

export const EMPTY_FIELDS: BookingFields = { storeName: "", niche: "", instagram: "", whatsapp: "", email: "", styleNotes: "", consent: false };

export const LIMITS = { storeName: 80, niche: 120, instagram: 120, styleNotes: 2000 } as const;

/** اسم حساب إنستجرام من @اسم أو الاسم وحده أو رابط الحساب. null إن لم يكن اسماً صالحاً. */
export function normalizeInstagram(raw: unknown): { handle: string; url: string } | null {
  let s = typeof raw === "string" ? raw.trim() : "";
  if (!s) return null;
  if (/^(https?:\/\/)?([a-z0-9-]+\.)?instagram\.com\//i.test(s)) {
    try {
      const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
      s = u.pathname.split("/").filter(Boolean)[0] ?? "";
    } catch {
      return null;
    }
  }
  const handle = s.replace(/^@+/, "").toLowerCase();
  if (!/^[a-z0-9._]{1,30}$/.test(handle) || /^\.|\.$|\.\./.test(handle)) return null;
  if (["p", "reel", "reels", "stories", "explore", "accounts"].includes(handle)) return null;
  return { handle, url: `https://www.instagram.com/${handle}/` };
}

const clean = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, max) : "");
const oneLine = (v: unknown, max: number) => clean(v, max).replace(/\s+/g, " ");

/** يقرأ حقول المسودة بتسامح (لا يرفض شيئاً): للحفظ التدريجي والملء المسبق. */
export function readFields(raw: unknown): BookingFields {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    storeName: oneLine(r.storeName, LIMITS.storeName),
    niche: oneLine(r.niche, LIMITS.niche),
    instagram: oneLine(r.instagram, LIMITS.instagram),
    whatsapp: oneLine(r.whatsapp, 30),
    email: oneLine(r.email, 120),
    styleNotes: clean(r.styleNotes, LIMITS.styleNotes),
    consent: r.consent === true,
  };
}

/** يملأ الفارغ فقط من الملء المسبق (ما كتبه العميل لا يُستبدل أبداً). */
export function applyPrefill(current: BookingFields, prefill: Partial<BookingFields> | undefined): BookingFields {
  if (!prefill) return current;
  const p = readFields(prefill);
  const out = { ...current };
  for (const k of ["storeName", "niche", "instagram", "whatsapp", "email", "styleNotes"] as const) if (!out[k] && p[k]) out[k] = p[k];
  return out;
}

export type BookingData = {
  v: 2;
  store: { name: string; niche: string; instagram: { handle: string; url: string } };
  contact: { whatsapp: string; email: string };
  styleNotes: string;
  consent: { collab: boolean };
  payment: { method: BookingMethod; senderPhone: string };
};

export type BookingCheck =
  | { ok: true; data: BookingData }
  | { ok: false; error: string; field: keyof BookingFields | "method" | "senderPhone" | "receipt" };

/**
 * التحقق النهائي عند الإرسال. offer = العرض الذي حُسب عليه السعر الآن (الموافقة على التعاون تُطلب للذهبية فقط).
 * يرد الخطأ الأول بحقله ليبرزه المتصفح.
 */
export function validateBooking(raw: unknown, ctx: { offer: PaymentPlan; hasReceipt: boolean }): BookingCheck {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const f = readFields(r);
  if (f.storeName.length < 2) return { ok: false, field: "storeName", error: "اكتبوا اسم المتجر (حرفان على الأقل)." };
  if (f.niche.length < 2) return { ok: false, field: "niche", error: "اكتبوا نشاط المتجر باختصار، مثل: ملابس رجالية." };
  const ig = normalizeInstagram(f.instagram);
  if (!ig) return { ok: false, field: "instagram", error: "اكتبوا حساب إنستجرام صحيحاً، مثل: @yourbrand أو رابط الحساب." };
  const whatsapp = normalizeEgyptianPhone(f.whatsapp);
  if (!whatsapp) return { ok: false, field: "whatsapp", error: "رقم واتساب غير صحيح (11 رقماً يبدأ بـ 01)." };
  const email = normalizeEmail(f.email);
  if (!email) return { ok: false, field: "email", error: "البريد الإلكتروني مطلوب وبصيغة صحيحة: منه تدخلون إلى حسابكم لمتابعة المشروع." };
  if (ctx.offer === "golden" && !f.consent) return { ok: false, field: "consent", error: "الدائرة الذهبية تتطلب الموافقة على التعاون (Collab أو شهادة) كما في الشروط." };
  const method = r.method;
  if (method !== "vodafone_cash" && method !== "instapay") return { ok: false, field: "method", error: "اختاروا وسيلة التحويل." };
  const senderPhone = normalizeEgyptianPhone(typeof r.senderPhone === "string" ? r.senderPhone : "");
  if (!senderPhone) return { ok: false, field: "senderPhone", error: "الرقم الذي تم التحويل منه غير صحيح (11 رقماً يبدأ بـ 01)." };
  if (!ctx.hasReceipt) return { ok: false, field: "receipt", error: "ارفعوا صورة إيصال التحويل." };
  return {
    ok: true,
    data: {
      v: 2,
      store: { name: f.storeName, niche: f.niche, instagram: ig },
      contact: { whatsapp, email },
      styleNotes: f.styleNotes,
      consent: { collab: f.consent },
      payment: { method, senderPhone },
    },
  };
}

/** مفتاح إيصال مقبول: ملف من ملفات هذا الحجز نفسه فقط (لا روابط). */
export const isReceiptKey = (v: unknown): v is string => typeof v === "string" && v.length >= 8 && v.length <= 300 && !/\s/.test(v);

/** حقول النموذج من بيانات حجز محفوظة (لإعادة فتح الحجز بعد رفض الإيصال دون أن يعيد العميل الكتابة). */
export function fieldsOf(raw: unknown): BookingFields {
  const d = (raw && typeof raw === "object" ? raw : {}) as Partial<BookingData>;
  return readFields({
    storeName: d.store?.name,
    niche: d.store?.niche,
    instagram: d.store?.instagram?.handle ? `@${d.store.instagram.handle}` : "",
    whatsapp: d.contact?.whatsapp,
    email: d.contact?.email,
    styleNotes: d.styleNotes,
    consent: d.consent?.collab === true,
  });
}
