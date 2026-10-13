// schema.ts — بيانات استمارة طلب المتجر (نموذج الوكالة). منطق خالص يستخدمه المتصفح والخادم معاً.
//
// المبدأ: الاستمارة تجمع معلومات فقط (لا «إعداد متجر»). لا إلزامي إلا اسم المتجر ووسيلة تواصل واحدة (واتساب أو
// بريد)، وكل سؤال تصميم فيه «سيبها للفريق». الصور والرسالة الصوتية تُرسل كمفاتيح UploadThing فقط، والخادم يقرأ
// روابطها من جدول ملفات الطلب (لا يُقبل رابط من المتصفح).
import { z } from "zod";
import { normalizeEgyptianPhone } from "@/lib/phone";

export const INTAKE_VERSION = 1 as const;
export const MAX_PRODUCTS = 40;

export const PAYMENT_OPTIONS = [
  { id: "cod", label: "الدفع عند الاستلام" },
  { id: "wallet", label: "فودافون كاش / محافظ" },
  { id: "instapay", label: "إنستاباي" },
] as const;
export type PaymentId = (typeof PAYMENT_OPTIONS)[number]["id"];
const PAYMENT_IDS = PAYMENT_OPTIONS.map((p) => p.id) as [PaymentId, ...PaymentId[]];

export const DELIVERY_OPTIONS = [
  { id: "all", label: "كل المحافظات" },
  { id: "cairo_giza", label: "القاهرة والجيزة" },
  { id: "custom", label: "محافظات معينة" },
  { id: "unsure", label: "لسه مش محدد" },
] as const;
export type DeliveryScope = (typeof DELIVERY_OPTIONS)[number]["id"];
const DELIVERY_IDS = DELIVERY_OPTIONS.map((d) => d.id) as [DeliveryScope, ...DeliveryScope[]];

export const COLOR_MODES = ["preset", "logo", "custom", "team"] as const;
export type ColorMode = (typeof COLOR_MODES)[number];
export const PRODUCT_MODES = ["list", "team", "later"] as const;
export type ProductMode = (typeof PRODUCT_MODES)[number];

const HEX_RE = /^#[0-9a-f]{6}$/i;
// مفتاح ملف: UploadThing (حروف وأرقام) أو R2 (مسار مثل requests/<id>/<uuid>.jpg)، بلا «..».
export const FILE_KEY_RE = /^(?!.*\.\.)[A-Za-z0-9_][A-Za-z0-9_./-]{7,199}$/;
const KEY_RE = FILE_KEY_RE;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const text = (max: number) => z.string().max(max).optional();
const key = z.string().regex(KEY_RE).optional();

/** مسودة: كل شيء اختياري بحدود طول (الحفظ التلقائي يقبل أي مرحلة من الملء). */
export const intakeDataSchema = z.object({
  v: z.literal(INTAKE_VERSION).default(INTAKE_VERSION),
  store: z.object({ name: text(60), oneLine: text(200) }).default({}),
  contact: z.object({ email: text(120), whatsapp: text(30) }).default({}),
  social: z.object({ url: text(300), teamCollects: z.boolean().default(false) }).default({}),
  colors: z
    .object({ mode: z.enum(COLOR_MODES).optional(), preset: text(40), custom: z.string().regex(HEX_RE).optional() })
    .default({}),
  logo: z.object({ key, team: z.boolean().default(false) }).default({}),
  products: z
    .object({
      mode: z.enum(PRODUCT_MODES).optional(),
      items: z.array(z.object({ id: z.string().min(1).max(40), key, line: text(200) })).max(MAX_PRODUCTS).default([]),
    })
    .default({}),
  payment: z.object({ methods: z.array(z.enum(PAYMENT_IDS)).max(PAYMENT_IDS.length).default([]), unsure: z.boolean().default(false) }).default({}),
  delivery: z.object({ scope: z.enum(DELIVERY_IDS).optional(), note: text(200) }).default({}),
  inspiration: z.object({ url: text(300), team: z.boolean().default(false) }).default({}),
  voice: z.object({ key, transcript: text(4000) }).default({}),
  notes: text(2000),
  /** «الدائرة الذهبية» (PLAN 14): استمارة مصغّرة (البراند، التواصل، 5–6 منتجات، والموافقة على فيديو الإطلاق). */
  offer: z.enum(["golden"]).optional(),
  golden: z.object({ videoConsent: z.boolean().default(false) }).default({}),
});

/** أقل وأنسب عدد منتجات في استمارة الدائرة الذهبية. */
export const GOLDEN_MIN_PRODUCTS = 3;
export const GOLDEN_SUGGESTED_PRODUCTS = 6;

export type IntakeData = z.infer<typeof intakeDataSchema>;
export type IntakeProductLine = IntakeData["products"]["items"][number];

export const emptyIntake = (): IntakeData => intakeDataSchema.parse({});

// ─── التطبيع ────────────────────────────────────────────────────────────────

/**
 * اسم مضيف عام فقط: بنقطة وامتداد حرفي، لا عنوان IP (يشمل 127.0.0.1 و10.x و169.254.169.254 و[::1] وأي صيغة مختصرة
 * يحوّلها URL إلى رقم)، ولا .local/.internal/.localhost. الروابط تُفتح لاحقاً من أدوات الفريق والوكلاء، فلا نقبل
 * ما يشير إلى شبكة داخلية.
 */
export function publicHostname(host: string): boolean {
  const h = host.toLowerCase().replace(/\.$/, "");
  if (h.length > 253 || !h.includes(".")) return false;
  const tld = h.slice(h.lastIndexOf(".") + 1);
  if (!/^[a-z][a-z0-9-]+$/.test(tld)) return false;
  return !/\.(local|localhost|internal|lan|home|corp|intranet)$/.test(h);
}

/** رابط ويب آمن للعرض: https فقط، ويُضاف https:// لرابط مكتوب بلا بروتوكول، ومضيفه عام. غير ذلك = null. */
export function safeUrl(raw: string | undefined | null): string | null {
  const s = (raw ?? "").trim();
  if (!s) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(s) ? s : `https://${s.replace(/^\/+/, "")}`;
  try {
    const u = new URL(withScheme);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    if (u.username || u.password || !publicHostname(u.hostname)) return null;
    u.protocol = "https:";
    return u.toString().slice(0, 300);
  } catch {
    return null;
  }
}

const HANDLE_RE = /^[A-Za-z0-9._]{2,30}$/;

/** صفحة التاجر: رابط، أو @اسم أو اسم حساب بلا نقطة (يُفهم كإنستجرام). */
export function socialUrl(raw: string | undefined | null): string | null {
  const s = (raw ?? "").trim();
  if (s.startsWith("@")) return HANDLE_RE.test(s.slice(1)) ? `https://www.instagram.com/${s.slice(1)}/` : null;
  if (!s.includes(".") && !s.includes("/") && HANDLE_RE.test(s)) return `https://www.instagram.com/${s}/`;
  return safeUrl(s);
}

export const normalizeEmail = (raw: string | undefined | null): string | null => {
  const s = (raw ?? "").trim().toLowerCase();
  return EMAIL_RE.test(s) && s.length <= 120 ? s : null;
};

/**
 * صيغة موحّدة للبريد لحدود المعدل فقط (لا تُخزَّن ولا تُرسل إليها): تُسقط وسم `+x`، ونقاط وأسماء gmail البديلة، حتى
 * لا تتحول الاستمارة إلى طريقة لإغراق صندوق بريد واحد بعناوين مختلفة الشكل (a.b+1@gmail.com = ab@gmail.com).
 */
export function canonicalEmail(email: string): string {
  const [local = "", domain = ""] = email.trim().toLowerCase().split("@");
  const d = domain === "googlemail.com" ? "gmail.com" : domain;
  const base = local.split("+")[0] ?? local;
  return `${d === "gmail.com" ? base.replace(/\./g, "") : base}@${d}`;
}

const clean = (s: string | undefined) => {
  const t = (s ?? "").replace(/\s+/g, " ").trim();
  return t || undefined;
};

/** نسخة نظيفة للحفظ: نصوص بلا مسافات زائدة، بريد بحروف صغيرة، واتساب بالصيغة القياسية إن صح، وأسطر منتجات فارغة تُحذف. */
export function normalizeIntake(d: IntakeData): IntakeData {
  const whatsapp = clean(d.contact.whatsapp);
  return {
    ...d,
    store: { name: clean(d.store.name), oneLine: clean(d.store.oneLine) },
    contact: {
      email: clean(d.contact.email)?.toLowerCase(),
      whatsapp: whatsapp ? (normalizeEgyptianPhone(whatsapp) ?? whatsapp) : undefined,
    },
    social: { url: clean(d.social.url), teamCollects: d.social.teamCollects },
    products: {
      ...d.products,
      items: d.products.items.map((p) => ({ ...p, line: clean(p.line) })).filter((p) => p.key || p.line),
    },
    delivery: { ...d.delivery, note: clean(d.delivery.note) },
    inspiration: { url: clean(d.inspiration.url), team: d.inspiration.team },
    voice: { key: d.voice.key, transcript: d.voice.transcript?.trim() || undefined },
    notes: d.notes?.trim() || undefined,
  };
}

// ─── التحقق عند الإرسال ─────────────────────────────────────────────────────

export type IntakeErrors = Partial<Record<"store.name" | "contact.whatsapp" | "contact.email" | "social.url" | "inspiration.url" | "colors.mode" | "products" | "golden.video", string>>;

/** شروط الإرسال (نفسها في المتصفح والخادم). */
export function validateSubmission(d: IntakeData): IntakeErrors {
  const e: IntakeErrors = {};
  const name = clean(d.store.name);
  if (!name || name.length < 2) e["store.name"] = "اكتب اسم متجرك، حتى لو مبدئي.";

  const wa = clean(d.contact.whatsapp);
  const mail = clean(d.contact.email);
  if (wa && !normalizeEgyptianPhone(wa)) e["contact.whatsapp"] = "رقم واتساب مصري غير صحيح (مثال: 01012345678).";
  if (mail && !normalizeEmail(mail)) e["contact.email"] = "البريد غير صحيح.";
  if (!wa && !mail) e["contact.whatsapp"] = "رقم واتساب أو بريد مطلوب عشان نقدر نتواصل.";

  const social = clean(d.social.url);
  if (social && !socialUrl(social)) e["social.url"] = "اكتب رابط الصفحة كاملاً أو اسم الحساب مثل @mystore.";
  if (d.social.teamCollects && !social) e["social.url"] = "اكتب رابط صفحتك عشان الفريق يجمع منتجاتك منها.";

  const insp = clean(d.inspiration.url);
  if (insp && !safeUrl(insp)) e["inspiration.url"] = "اكتب رابط الموقع كاملاً (مثال: example.com).";

  if (d.colors.mode === "logo" && !d.logo.key && !d.logo.team) e["colors.mode"] = "ارفع الشعار عشان ناخد الألوان منه، أو اختر طريقة تانية.";

  // الدائرة الذهبية: منتجات حقيقية بصورها وأسطرها (لا بيانات وهمية)، والموافقة على فيديو الإطلاق جزء من العرض.
  if (d.offer === "golden") {
    const real = d.products.items.filter((p) => p.key && clean(p.line)).length;
    if (real < GOLDEN_MIN_PRODUCTS) e.products = `ابعت ${GOLDEN_MIN_PRODUCTS} منتجات على الأقل، كل منتج بصورته واسمه وسعره (الأفضل ${GOLDEN_SUGGESTED_PRODUCTS}).`;
    if (!d.golden.videoConsent) e["golden.video"] = "وافق على فيديو الإطلاق القصير، هو جزء من عرض الدائرة الذهبية.";
  }
  return e;
}

/** مفاتيح كل الملفات المذكورة في الاستمارة (للتحقق من ملكيتها عند الإرسال). */
export function referencedKeys(d: IntakeData): { images: string[]; logo: string | null; voice: string | null } {
  return {
    images: d.products.items.map((p) => p.key).filter((k): k is string => Boolean(k)),
    logo: d.logo.key ?? null,
    voice: d.voice.key ?? null,
  };
}

// ─── مؤشر الاكتمال (شريط التقدم) ────────────────────────────────────────────

/** نسبة الأسئلة المُجابة أو المتروكة للفريق (0..1). لا تمنع الإرسال: المطلوب الاسم ووسيلة التواصل فقط. */
export function completion(d: IntakeData): number {
  if (d.offer === "golden") {
    const real = d.products.items.filter((p) => p.key && clean(p.line)).length;
    const steps = [
      Boolean(clean(d.store.name)),
      Boolean(clean(d.contact.whatsapp) || clean(d.contact.email)),
      Boolean(clean(d.social.url)),
      Math.min(1, real / GOLDEN_SUGGESTED_PRODUCTS),
      d.golden.videoConsent,
    ].map(Number);
    return steps.reduce((a, b) => a + b, 0) / steps.length;
  }
  const answered = [
    Boolean(clean(d.store.name)),
    Boolean(clean(d.contact.whatsapp) || clean(d.contact.email)),
    Boolean(clean(d.social.url)),
    Boolean(d.colors.mode),
    Boolean(d.logo.key || d.logo.team),
    Boolean(d.products.mode === "team" || d.products.mode === "later" || d.products.items.length > 0),
    Boolean(d.payment.methods.length || d.payment.unsure),
    Boolean(d.delivery.scope),
    Boolean(clean(d.inspiration.url) || d.inspiration.team),
    Boolean(d.voice.key || d.notes?.trim()),
  ];
  return answered.filter(Boolean).length / answered.length;
}
