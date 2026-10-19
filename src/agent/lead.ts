// lead.ts — بيانات العميل المحتمل التي يجمعها الوكيل في المحادثة، والتحقق منها بالكود لا بالنموذج (خالص ومختبَر).
// القاعدة: النموذج يقترح، والكود يقرر. قيمة صالحة تُحفظ، وقيمة خاطئة لا تُحفظ وتُسجَّل «غير صالحة» ليصحّحها الوكيل بلطف،
// وقيمة محفوظة لا تُمحى أبداً بقيمة فارغة أو خاطئة.
import { stripEmoji } from "@/lib/emoji";
import { canonicalEmail, normalizeEgyptianPhone, normalizeEmail } from "@/lib/contact";
import { normalizeDigits } from "@/lib/phone";

/** ترتيب جمع الحقول الثابت (الإنستجرام يُلتقط تلقائياً). */
export const LEAD_FIELDS = ["niche", "storeName", "email", "whatsapp"] as const;
export type LeadField = (typeof LEAD_FIELDS)[number];
export type LeadKey = LeadField | "instagram";

export type Lead = {
  niche?: string;
  storeName?: string;
  email?: string;
  /** الصيغة القانونية للبريد (تُستخدم للمطابقة ومنع التكرار فقط). */
  emailCanonical?: string;
  whatsapp?: string;
  /** اسم حساب إنستجرام بلا @ وبحروف صغيرة. */
  instagram?: string;
  /** روابط صور أرسلها التاجر في المحادثة (بعد إعادة استضافتها). */
  assets?: string[];
};

/** ما اقترحه النموذج في هذا الدور (غير موثوق). */
export type LeadInput = Partial<Record<LeadKey, unknown>>;

/** قيم خاطئة أُرسلت ولم تُقبل (مختصرة) لتصحيحها مع العميل. */
export type LeadInvalid = Partial<Record<LeadKey, string>>;

const squeeze = (v: unknown): string => stripEmoji(typeof v === "string" ? v : "").replace(/\s+/g, " ").trim();

/** اسم المتجر: من 2 إلى 60 حرفاً وفيه حرف أو رقم على الأقل. */
export function validateStoreName(raw: unknown): string | null {
  const s = squeeze(raw);
  return s.length >= 2 && s.length <= 60 && /[\p{L}\p{N}]/u.test(s) ? s : null;
}

/** النشاط: من 3 إلى 120 حرفاً وفيه حرف. */
export function validateNiche(raw: unknown): string | null {
  const s = squeeze(raw);
  return s.length >= 3 && s.length <= 120 && /\p{L}/u.test(s) ? s : null;
}

export function validateEmail(raw: unknown): { email: string; canonical: string } | null {
  const email = normalizeEmail(typeof raw === "string" ? raw.replace(/\s+/g, "") : "");
  return email ? { email, canonical: canonicalEmail(email) } : null;
}

export function validateWhatsapp(raw: unknown): string | null {
  return typeof raw === "string" ? normalizeEgyptianPhone(raw) : null;
}

const IG_HANDLE_RE = /^(?!.*\.\.)[a-z0-9._]{1,30}$/;

/** اسم حساب إنستجرام من @اسم أو رابط instagram.com/اسم أو الاسم وحده. المسارات العامة (p/reel…) مرفوضة. */
export function parseInstagramHandle(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let s = raw.trim().toLowerCase();
  if (!s) return null;
  const url = /(?:^|\/\/)(?:www\.)?(?:instagram\.com|instagr\.am)\/([^/?#\s]+)/.exec(s);
  if (url) s = url[1]!;
  s = s.replace(/^@+/, "");
  if (["p", "reel", "reels", "stories", "explore", "accounts", "direct", "tv"].includes(s)) return null;
  return IG_HANDLE_RE.test(s) && !/^\.|\.$/.test(s) ? s : null;
}

const brief = (v: unknown) => squeeze(v).slice(0, 60);

const digitsOf = (v: string) => normalizeDigits(v).replace(/\D/g, "");

/**
 * يُسقط من اقتراح النموذج أي بريد أو رقم لا يظهر فعلاً في كلام العميل (يمنع اختلاق بيانات تواصل). الاسم والنشاط يُترك
 * فهمهما للنموذج لأنهما قد يُعاد صوغهما.
 */
export function groundLeadInput(input: LeadInput | null | undefined, userTexts: string[]): LeadInput {
  const out: LeadInput = { ...(input ?? {}) };
  const blob = userTexts.join(" \n ");
  const flat = blob.replace(/\s+/g, "").toLowerCase();
  const digits = digitsOf(blob);
  if (typeof out.email === "string" && out.email.trim() && !flat.includes(out.email.replace(/\s+/g, "").toLowerCase())) delete out.email;
  if (typeof out.whatsapp === "string" && out.whatsapp.trim()) {
    const d = digitsOf(out.whatsapp);
    if (d.length < 10 || !digits.includes(d.slice(-10))) delete out.whatsapp;
  }
  return out;
}

/**
 * يدمج ما اقترحه النموذج في بيانات العميل. قيمة صالحة جديدة تُحدّث القديمة (تصحيح العميل)، وفارغ أو خاطئ لا يمحو شيئاً.
 * `profileInstagram`: اسم الحساب من ملف المحادثة على إنستجرام (الأوثق، لا يُستبدل بكلام النموذج).
 */
export function mergeLead(
  current: Lead,
  incoming: LeadInput | null | undefined,
  opts: { profileInstagram?: string | null; prevInvalid?: LeadInvalid } = {}
): { lead: Lead; invalid: LeadInvalid } {
  const lead: Lead = { ...current };
  const invalid: LeadInvalid = { ...(opts.prevInvalid ?? {}) };
  const inc = incoming ?? {};
  const has = (v: unknown) => typeof v === "string" && v.trim() !== "";

  if (has(inc.niche)) {
    const v = validateNiche(inc.niche);
    if (v) {
      lead.niche = v;
      delete invalid.niche;
    } else invalid.niche = brief(inc.niche);
  }
  if (has(inc.storeName)) {
    const v = validateStoreName(inc.storeName);
    if (v) {
      lead.storeName = v;
      delete invalid.storeName;
    } else invalid.storeName = brief(inc.storeName);
  }
  if (has(inc.email)) {
    const v = validateEmail(inc.email);
    if (v) {
      lead.email = v.email;
      lead.emailCanonical = v.canonical;
      delete invalid.email;
    } else invalid.email = brief(inc.email);
  }
  if (has(inc.whatsapp)) {
    const v = validateWhatsapp(inc.whatsapp);
    if (v) {
      lead.whatsapp = v;
      delete invalid.whatsapp;
    } else invalid.whatsapp = brief(inc.whatsapp);
  }
  if (opts.profileInstagram) {
    const h = parseInstagramHandle(opts.profileInstagram);
    if (h) lead.instagram = h;
  } else if (has(inc.instagram)) {
    const h = parseInstagramHandle(inc.instagram);
    if (h) {
      lead.instagram = h;
      delete invalid.instagram;
    } else invalid.instagram = brief(inc.instagram);
  }
  return { lead, invalid };
}

/** الحقول المجموعة والناقصة والخاطئة بالترتيب الثابت. */
export function leadStatus(lead: Lead, invalid: LeadInvalid = {}): { collected: LeadField[]; missing: LeadField[]; invalid: LeadField[]; instagramKnown: boolean } {
  const collected = LEAD_FIELDS.filter((f) => Boolean(lead[f]));
  const missing = LEAD_FIELDS.filter((f) => !lead[f]);
  return { collected, missing, invalid: LEAD_FIELDS.filter((f) => Boolean(invalid[f]) && !lead[f]), instagramKnown: Boolean(lead.instagram) };
}

export const isLeadComplete = (lead: Lead): boolean => LEAD_FIELDS.every((f) => Boolean(lead[f]));

export type CreateDecision = "create" | "wait_complete" | "wait_confirm" | "exists";

/** قرار الإنشاء: بالكود فقط. البيانات كاملة وصالحة + موافقة صريحة (إشارة النموذج أو ضغطة زر البدء). */
export function decideCreate(input: { lead: Lead; confirmCreate: boolean; explicitStart: boolean; storeExists: boolean }): CreateDecision {
  if (input.storeExists) return "exists";
  if (!isLeadComplete(input.lead)) return "wait_complete";
  return input.confirmCreate || input.explicitStart ? "create" : "wait_confirm";
}

/** نص الزر السريع الذي يعني «ابدؤوا» (حمولته نصه نفسه). */
export const START_QUICK_REPLY = "ابدأوا تجهيز متجري";

/** رسالة التأكيد النهائية من الكود حرفياً (لا يكتبها النموذج)، وبعدها يغلق الوكيل نفسه في المحادثة ويتولاها الفريق. */
export const CREATE_ACK = "تمام، الفريق بدأ تجهيز متجركم الآن، وسيصلكم خلال يوم إلى 4 أيام عمل كحد أقصى، وغالباً أسرع. سنرسل لكم هنا رابط الإعداد وطريقة الدخول فور جاهزيته.";
