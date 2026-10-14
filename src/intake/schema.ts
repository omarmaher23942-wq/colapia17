// schema.ts — بيانات استمارة طلب المتجر (نموذج الوكالة). منطق خالص يستخدمه المتصفح والخادم معاً.
//
// المبدأ: الاستمارة تجمع معلومات فقط (لا «إعداد متجر»). الإلزامي: اسم المتجر ووسيلة تواصل، ومنتج واحد على الأقل
// (نص حر عنه، وصوره اختيارية حتى 10)، وطريقة دفع واحدة على الأقل بتفاصيلها (رقم المحفظة، إنستاباي، المعاينة عند
// الاستلام)، ونطاق التوصيل وسعر الشحن. أسئلة التصميم فيها «يختارها الفريق». الصور تُرسل كمفاتيح ملفات فقط، والخادم
// يقرأ روابطها من جدول ملفات الطلب (لا يُقبل رابط من المتصفح).
import { z } from "zod";
import { normalizeEgyptianPhone } from "@/lib/phone";

export const INTAKE_VERSION = 1 as const;
/** عدد المنتجات في الاستمارة (الباقي يضيفه التاجر بنفسه من لوحته بعد التسليم). */
export const MAX_PRODUCTS = 6;
export const MAX_PRODUCT_IMAGES = 10;
export const PRODUCT_TEXT_MAX = 1000;
/** عدد المنتجات الذي نوصي به. */
export const SUGGESTED_PRODUCTS = 3;

export const PAYMENT_OPTIONS = [
  { id: "cod", label: "الدفع عند الاستلام" },
  { id: "wallet", label: "فودافون كاش / محافظ" },
  { id: "instapay", label: "إنستاباي" },
] as const;
export type PaymentId = (typeof PAYMENT_OPTIONS)[number]["id"];
const PAYMENT_IDS = PAYMENT_OPTIONS.map((p) => p.id) as [PaymentId, ...PaymentId[]];

export const DELIVERY_OPTIONS = [
  { id: "all", label: "كل المحافظات" },
  { id: "cairo_giza", label: "القاهرة والجيزة فقط" },
  { id: "custom", label: "محافظات معينة" },
] as const;
export type DeliveryScope = (typeof DELIVERY_OPTIONS)[number]["id"] | "unsure";
// «unsure» قيمة قديمة في طلبات سابقة: تُقرأ ولا تُعرض خياراً جديداً.
const DELIVERY_IDS = ["all", "cairo_giza", "custom", "unsure"] as [DeliveryScope, ...DeliveryScope[]];

export const FEE_OPTIONS = [
  { id: "flat", label: "سعر شحن موحّد" },
  { id: "free", label: "الشحن مجاني" },
  { id: "varies", label: "يختلف حسب المحافظة" },
] as const;
export type FeeMode = (typeof FEE_OPTIONS)[number]["id"];

export const RETURN_OPTIONS = [
  { id: "full", label: "استبدال واسترجاع" },
  { id: "exchange", label: "استبدال فقط" },
  { id: "none", label: "لا استبدال ولا استرجاع" },
] as const;
export type ReturnMode = (typeof RETURN_OPTIONS)[number]["id"];

export const INSPECTION_OPTIONS = [
  { id: "yes", label: "نعم، متاحة" },
  { id: "no", label: "لا، غير متاحة" },
] as const;
export type InspectionAnswer = (typeof INSPECTION_OPTIONS)[number]["id"];

export const COLOR_MODES = ["preset", "logo", "custom", "team"] as const;
export type ColorMode = (typeof COLOR_MODES)[number];

const HEX_RE = /^#[0-9a-f]{6}$/i;
// مفتاح ملف: UploadThing (حروف وأرقام) أو R2 (مسار مثل requests/<id>/<uuid>.jpg)، بلا «..».
export const FILE_KEY_RE = /^(?!.*\.\.)[A-Za-z0-9_][A-Za-z0-9_./-]{7,199}$/;
const KEY_RE = FILE_KEY_RE;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const text = (max: number) => z.string().max(max).optional();
const key = z.string().regex(KEY_RE).optional();

/**
 * منتج واحد: نص حر إلزامي (لون، مقاس، سعر، تفاصيل، أي كلام) وصور اختيارية خاصة به. الطلبات القديمة ({key, line}) تُقرأ
 * كما هي: السطر نص والمفتاح صورة وحيدة.
 */
const productItemSchema = z.preprocess(
  (raw) => {
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      const r = raw as Record<string, unknown>;
      if (r.text === undefined && r.images === undefined && (r.line !== undefined || r.key !== undefined)) {
        return { id: r.id, text: r.line, images: typeof r.key === "string" ? [r.key] : [] };
      }
    }
    return raw;
  },
  z.object({
    id: z.string().min(1).max(40),
    text: text(PRODUCT_TEXT_MAX),
    images: z.array(z.string().regex(KEY_RE)).max(MAX_PRODUCT_IMAGES).default([]),
  })
);

/** مسودة: كل شيء اختياري بحدود طول (الحفظ التلقائي يقبل أي مرحلة من الملء). */
export const intakeDataSchema = z.object({
  v: z.literal(INTAKE_VERSION).default(INTAKE_VERSION),
  store: z.object({ name: text(60), oneLine: text(200) }).default({}),
  contact: z.object({ email: text(120), whatsapp: text(30) }).default({}),
  social: z.object({ url: text(300) }).default({}),
  colors: z
    .object({ mode: z.enum(COLOR_MODES).optional(), preset: text(40), custom: z.string().regex(HEX_RE).optional() })
    .default({}),
  logo: z.object({ key, team: z.boolean().default(false) }).default({}),
  products: z
    .object({
      // طلبات قديمة فيها أكثر من الحد الحالي: تُقصّ بدل أن يفشل قراءة الطلب كله.
      items: z.preprocess((v) => (Array.isArray(v) ? v.slice(0, MAX_PRODUCTS) : v), z.array(productItemSchema).max(MAX_PRODUCTS).default([])),
    })
    .default({}),
  payment: z
    .object({
      methods: z.array(z.enum(PAYMENT_IDS)).max(PAYMENT_IDS.length).default([]),
      /** رقم المحفظة (فودافون كاش وغيرها) الذي يحوّل عليه العملاء. */
      walletNumber: text(30),
      /** إنستاباي: العنوان أو الرقم أو اسم الحساب الذي يحوّل عليه العملاء. */
      instapayAddress: text(80),
      /** الدفع عند الاستلام: هل المعاينة وفتح الشحنة متاحان؟ */
      inspection: z.enum(["yes", "no"]).optional(),
    })
    .default({}),
  delivery: z
    .object({
      scope: z.enum(DELIVERY_IDS).optional(),
      /** المحافظات حين يكون النطاق «محافظات معينة». */
      note: text(200),
      fee: z.enum(["flat", "free", "varies"]).optional(),
      /** سعر الشحن الموحّد بالجنيه. */
      feeAmount: z.number().int().min(1).max(10_000).optional(),
      /** تفاصيل السعر حين يختلف حسب المحافظة (اختياري). */
      feeNote: text(300),
      /** مدة التوصيل بكلام التاجر، مثل «من 2 إلى 4 أيام». */
      eta: text(60),
    })
    .default({}),
  returns: z.object({ mode: z.enum(["full", "exchange", "none"]).optional(), days: z.number().int().min(1).max(60).optional() }).default({}),
  inspiration: z.object({ url: text(300), team: z.boolean().default(false) }).default({}),
  /** «طلبك بحرية»: وصف مفتوح بلا سقف عملي لكل ما يريده العميل (متجراً ولوحة تحكم)؛ نفس مفتاح notes للتوافق مع الطلبات القديمة. */
  notes: text(8000),
  /** «الدائرة الذهبية» (PLAN 14): استمارة مصغّرة (البراند، التواصل، 3–6 منتجات، والموافقة على فيديو الإطلاق). */
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

/** منتجات لها نص (الإلزامي في كل منتج). */
export const realProducts = (d: IntakeData) => d.products.items.filter((p) => clean(p.text));

/** نسخة نظيفة للحفظ: نصوص بلا مسافات زائدة، بريد بحروف صغيرة، واتساب بالصيغة القياسية إن صح، ومنتجات فارغة تُحذف. */
export function normalizeIntake(d: IntakeData): IntakeData {
  const whatsapp = clean(d.contact.whatsapp);
  const wallet = clean(d.payment.walletNumber);
  const has = (m: PaymentId) => d.payment.methods.includes(m);
  return {
    ...d,
    store: { name: clean(d.store.name), oneLine: clean(d.store.oneLine) },
    contact: {
      email: clean(d.contact.email)?.toLowerCase(),
      whatsapp: whatsapp ? (normalizeEgyptianPhone(whatsapp) ?? whatsapp) : undefined,
    },
    social: { url: clean(d.social.url) },
    products: {
      // المنتج بنص أو بصور يبقى؛ الفارغ تماماً يُحذف. النص يحتفظ بأسطره (الفريق يقرؤه كما كتبه العميل).
      items: d.products.items
        .map((p) => ({ ...p, text: p.text?.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim() || undefined, images: [...new Set(p.images)].slice(0, MAX_PRODUCT_IMAGES) }))
        .filter((p) => p.text || p.images.length),
    },
    // تفاصيل كل وسيلة تُحفظ مع الوسيلة المختارة فقط (إلغاء الوسيلة يمسح تفاصيلها).
    payment: {
      methods: d.payment.methods,
      walletNumber: has("wallet") ? (wallet ? (normalizeEgyptianPhone(wallet) ?? wallet) : undefined) : undefined,
      instapayAddress: has("instapay") ? clean(d.payment.instapayAddress) : undefined,
      inspection: has("cod") ? d.payment.inspection : undefined,
    },
    delivery: {
      scope: d.delivery.scope,
      note: d.delivery.scope === "custom" ? clean(d.delivery.note) : undefined,
      fee: d.delivery.fee,
      feeAmount: d.delivery.fee === "flat" ? d.delivery.feeAmount : undefined,
      feeNote: d.delivery.fee === "varies" ? clean(d.delivery.feeNote) : undefined,
      eta: clean(d.delivery.eta),
    },
    returns: { mode: d.returns.mode, days: d.returns.mode && d.returns.mode !== "none" ? d.returns.days : undefined },
    inspiration: { url: clean(d.inspiration.url), team: d.inspiration.team },
    notes: d.notes?.trim() || undefined,
  };
}

// ─── التحقق عند الإرسال ─────────────────────────────────────────────────────

export type IntakeErrors = Partial<
  Record<
    | "store.name"
    | "contact.whatsapp"
    | "contact.email"
    | "social.url"
    | "inspiration.url"
    | "colors.mode"
    | "products"
    | `products.${string}`
    | "payment.methods"
    | "payment.walletNumber"
    | "payment.instapayAddress"
    | "payment.inspection"
    | "delivery.scope"
    | "delivery.note"
    | "delivery.fee"
    | "delivery.feeAmount"
    | "returns.days"
    | "golden.video",
    string
  >
>;

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

  if (d.colors.mode === "logo" && !d.logo.key && !d.logo.team) e["colors.mode"] = "ارفع الشعار عشان ناخد الألوان منه، أو اختر طريقة تانية.";

  // المنتجات: كل منتج يضيفه العميل يلزمه نص (لون، مقاس، سعر، أي تفصيلة). الصور اختيارية. بطاقة فارغة تماماً تُتجاهل.
  for (const p of d.products.items) if (!clean(p.text) && p.images.length) e[`products.${p.id}`] = "اكتب أي كلام عن المنتج دا (اسمه، لونه، مقاسه، سعره…).";

  if (d.offer === "golden") {
    // الدائرة الذهبية: منتجات حقيقية، والموافقة على فيديو الإطلاق جزء من العرض. لا دفع ولا شحن هنا: الفريق يكمّلهما.
    if (realProducts(d).length < GOLDEN_MIN_PRODUCTS) e.products = `ضيف ${GOLDEN_MIN_PRODUCTS} منتجات على الأقل، لكل منتج كلام عنه (الأفضل ${GOLDEN_SUGGESTED_PRODUCTS}).`;
    if (!d.golden.videoConsent) e["golden.video"] = "وافق على فيديو الإطلاق القصير، هو جزء من عرض الدائرة الذهبية.";
    return e;
  }

  const insp = clean(d.inspiration.url);
  if (insp && !safeUrl(insp)) e["inspiration.url"] = "اكتب رابط الموقع كاملاً (مثال: example.com).";

  if (!realProducts(d).length) e.products = `ضيف منتجاً واحداً على الأقل (الأفضل ${SUGGESTED_PRODUCTS} إلى ${MAX_PRODUCTS})، ولو بكلمتين عنه.`;

  // الدفع: طريقة واحدة على الأقل، ولكل طريقة تفاصيلها (لا نكتب في المتجر رقماً لم يقله التاجر).
  const m = d.payment.methods;
  if (!m.length) e["payment.methods"] = "اختر طريقة دفع واحدة على الأقل.";
  if (m.includes("wallet")) {
    const w = clean(d.payment.walletNumber);
    if (!w) e["payment.walletNumber"] = "اكتب رقم المحفظة اللي العملاء هيحوّلوا عليه.";
    else if (!normalizeEgyptianPhone(w)) e["payment.walletNumber"] = "رقم المحفظة غير صحيح (11 رقماً يبدأ بـ 010 أو 011 أو 012 أو 015).";
  }
  if (m.includes("instapay")) {
    const a = clean(d.payment.instapayAddress);
    if (!a || a.length < 3) e["payment.instapayAddress"] = "اكتب رقم إنستاباي أو عنوانه أو اسم الحساب اللي العملاء هيحوّلوا عليه.";
  }
  if (m.includes("cod") && !d.payment.inspection) e["payment.inspection"] = "اختر: هل المعاينة وفتح الشحنة متاحين؟";

  // التوصيل: النطاق وسعر الشحن.
  const scope = d.delivery.scope === "unsure" ? undefined : d.delivery.scope;
  if (!scope) e["delivery.scope"] = "اختر التوصيل لفين.";
  if (scope === "custom" && !clean(d.delivery.note)) e["delivery.note"] = "اكتب المحافظات اللي بتوصّلوا لها.";
  if (!d.delivery.fee) e["delivery.fee"] = "اختر سعر الشحن.";
  if (d.delivery.fee === "flat" && !d.delivery.feeAmount) e["delivery.feeAmount"] = "اكتب سعر الشحن بالجنيه.";

  if ((d.returns.mode === "full" || d.returns.mode === "exchange") && !d.returns.days) e["returns.days"] = "اكتب عدد الأيام المتاحة للاستبدال.";
  return e;
}

/** مفاتيح كل الملفات المذكورة في الاستمارة (للتحقق من ملكيتها عند الإرسال). */
export function referencedKeys(d: IntakeData): { images: string[]; logo: string | null } {
  return {
    images: [...new Set(d.products.items.flatMap((p) => p.images))],
    logo: d.logo.key ?? null,
  };
}

// ─── مؤشر الاكتمال (شريط التقدم) ────────────────────────────────────────────

/** عدد خطوات الشريط في الاستمارة العادية. */
export const COMPLETION_STEPS = 10;

/** نسبة الأسئلة المُجابة أو المتروكة للفريق (0..1). لا تمنع الإرسال بذاتها: الشروط في validateSubmission. */
export function completion(d: IntakeData): number {
  if (d.offer === "golden") {
    const steps = [
      Boolean(clean(d.store.name)),
      Boolean(clean(d.contact.whatsapp) || clean(d.contact.email)),
      Boolean(clean(d.social.url)),
      Math.min(1, realProducts(d).length / GOLDEN_SUGGESTED_PRODUCTS),
      d.golden.videoConsent,
    ].map(Number);
    return steps.reduce((a, b) => a + b, 0) / steps.length;
  }
  const e = validateSubmission(d);
  const paymentDone = !e["payment.methods"] && !e["payment.walletNumber"] && !e["payment.instapayAddress"] && !e["payment.inspection"];
  const deliveryDone = !e["delivery.scope"] && !e["delivery.note"] && !e["delivery.fee"] && !e["delivery.feeAmount"];
  const answered = [
    Boolean(clean(d.store.name)),
    Boolean(clean(d.contact.whatsapp) || clean(d.contact.email)),
    Boolean(clean(d.social.url)),
    Boolean(d.colors.mode),
    Boolean(d.logo.key || d.logo.team),
    realProducts(d).length > 0 && !Object.keys(e).some((k) => k === "products" || k.startsWith("products.")),
    paymentDone,
    deliveryDone,
    Boolean(d.returns.mode && !e["returns.days"]),
    Boolean(clean(d.inspiration.url) || d.inspiration.team),
  ];
  return answered.filter(Boolean).length / COMPLETION_STEPS;
}
