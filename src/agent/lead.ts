// lead.ts — بيانات العميل المحتمل التي يجمعها الوكيل في المحادثة، والتحقق منها بالكود لا بالنموذج (خالص ومختبَر).
// القاعدة: النموذج يقترح، والكود يتحقق من الصيغة. قيمة صالحة تُحفظ، وقيمة خاطئة لا تُحفظ وتُسجَّل «غير صالحة» ليصحّحها الوكيل
// بلطف، وقيمة محفوظة لا تُمحى أبداً بقيمة فارغة أو خاطئة. V4: الوكيل لا ينشئ متجراً؛ يمرّر هذه البيانات تعبئةً مسبقة لصفحة الحجز.
import { stripEmoji } from "@/lib/emoji";
import { canonicalEmail, normalizeEgyptianPhone, normalizeEmail } from "@/lib/contact";
import { normalizeDigits } from "@/lib/phone";

export type LeadKey = "niche" | "storeName" | "email" | "whatsapp" | "instagram" | "styleNotes" | "products" | "selling";

export type Lead = {
  niche?: string;
  storeName?: string;
  email?: string;
  /** الصيغة القانونية للبريد (للمطابقة ومنع التكرار فقط). */
  emailCanonical?: string;
  whatsapp?: string;
  /** اسم حساب إنستجرام بلا @ وبحروف صغيرة. */
  instagram?: string;
  /** ميوله في التصميم (ألوان، طابع، أمثلة يحبها) كما قالها. */
  styleNotes?: string;
  /** أين منتجاتهم وكيف يصلنا محتواها (صور على الموبايل، صفحة جاهزة، ملف) كما قالوه. */
  products?: string;
  /** الدفع والتوصيل: وسائل الدفع، المحافظات، الشحن، المعاينة، كما قالوها. */
  selling?: string;
};

/** ما اقترحه النموذج في هذا الدور (غير موثوق). */
export type LeadInput = Partial<Record<LeadKey, unknown>>;

/** قيم خاطئة أُرسلت ولم تُقبل (مختصرة) لتصحيحها مع العميل. */
export type LeadInvalid = Partial<Record<LeadKey, string>>;

/** الحقول بترتيب العرض في «حالة المحادثة». */
export const LEAD_KEYS: readonly LeadKey[] = ["storeName", "niche", "instagram", "products", "styleNotes", "selling", "whatsapp", "email"];

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

/** نص حر بإجابة (منتجات، بيع وتوصيل): من 3 إلى 500 حرف وفيه حرف. */
export function validateAnswerText(raw: unknown): string | null {
  const s = squeeze(raw);
  return s.length >= 3 && s.length <= 500 && /\p{L}/u.test(s) ? s : null;
}

/** ميول التصميم: من 3 إلى 300 حرف وفيها حرف. */
export function validateStyleNotes(raw: unknown): string | null {
  const s = squeeze(raw);
  return s.length >= 3 && s.length <= 300 && /\p{L}/u.test(s) ? s : null;
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
 * يُسقط من اقتراح النموذج أي بريد أو رقم لا يظهر فعلاً في كلام العميل (يمنع اختلاق بيانات تواصل). الاسم والنشاط وميول التصميم
 * يُترك فهمها للنموذج لأنها قد تُعاد صياغتها.
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

  const text = (key: "niche" | "storeName" | "styleNotes" | "products" | "selling", check: (raw: unknown) => string | null) => {
    if (!has(inc[key])) return;
    const v = check(inc[key]);
    if (v) {
      lead[key] = v;
      delete invalid[key];
    } else invalid[key] = brief(inc[key]);
  };
  text("niche", validateNiche);
  text("storeName", validateStoreName);
  text("styleNotes", validateStyleNotes);
  text("products", validateAnswerText);
  text("selling", validateAnswerText);

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

/** الحقول المجموعة والناقصة والخاطئة بترتيب العرض. */
export function leadStatus(lead: Lead, invalid: LeadInvalid = {}): { collected: LeadKey[]; missing: LeadKey[]; invalid: LeadKey[] } {
  return {
    collected: LEAD_KEYS.filter((k) => Boolean(lead[k])),
    missing: LEAD_KEYS.filter((k) => !lead[k]),
    invalid: LEAD_KEYS.filter((k) => Boolean(invalid[k]) && !lead[k]),
  };
}
