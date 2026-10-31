// briefs/realestate.ts — استمارة «موقعكم العقاري» (colapia.com/realestate): الأسئلة وخياراتها، ومخطط البيانات، وتحقق كل خطوة،
// والمميزات الموصى بها لكل نشاط. خالص ومختبَر (tests/unit/realestate-brief.test.ts)، يستورده المتصفح والخادم معاً.
//
// المبدأ (قرار المالك 2026-10-31): الاستمارة قصيرة جداً وتعرّفنا بالنشاط وما يريده من الموقع وهويته فقط. كل بيانات التشغيل
// (العقارات، الشعار، روابط التواصل، رقم واتساب الموقع، طريقة استقبال الطلبات…) تُدخل في «الإعداد الأول» داخل موقع العميل نفسه.
import { z } from "zod";
import { normalizeEgyptianPhone } from "@/lib/phone";

export const BRIEF_KIND = "realestate" as const;
export const BRIEF_VERSION = 1 as const;

export type Option<T extends string = string> = { id: T; label: string; hint?: string };

const ids = <T extends string>(list: readonly Option<T>[]) => list.map((o) => o.id) as [T, ...T[]];
export const labelOf = <T extends string>(list: readonly Option<T>[], id: T | string | undefined | null): string =>
  list.find((o) => o.id === id)?.label ?? (id ? String(id) : "");
export const labelsOf = <T extends string>(list: readonly Option<T>[], picked: readonly string[] | undefined): string[] =>
  (picked ?? []).map((p) => labelOf(list, p)).filter(Boolean);

// ─── 1) النشاط ────────────────────────────────────────────────────────────
export const BUSINESS_TYPES = [
  { id: "broker", label: "وسيط أو مستشار عقاري", hint: "تعملون بأسمائكم وتعرضون عقارات لعملائكم" },
  { id: "agency", label: "شركة تسويق ووساطة عقارية", hint: "مكتب وفريق مبيعات وعقارات كثيرة" },
  { id: "developer", label: "مطوّر عقاري", hint: "مشروعات وكمباوندات بوحدات وخطط سداد" },
  { id: "rentals", label: "إدارة وتأجير عقارات", hint: "وحدات للإيجار، وملاك ومستأجرون" },
  { id: "shortstay", label: "شقق فندقية وإيجار مفروش", hint: "حجز بالليلة أو بالأسبوع" },
  { id: "construction", label: "مقاولات وتشطيبات", hint: "تنفيذ وتشطيب وتصميم داخلي" },
  { id: "other", label: "نشاط عقاري آخر", hint: "اكتبوه بكلماتكم" },
] as const satisfies readonly Option[];
export type BusinessType = (typeof BUSINESS_TYPES)[number]["id"];

export const TEAM_SIZES = [
  { id: "solo", label: "شخص واحد" },
  { id: "small", label: "من 2 إلى 5" },
  { id: "mid", label: "من 6 إلى 20" },
  { id: "large", label: "أكثر من 20" },
] as const satisfies readonly Option[];
export type TeamSize = (typeof TEAM_SIZES)[number]["id"];

// ─── 2) العقارات ──────────────────────────────────────────────────────────
export const PROPERTY_TYPES = [
  { id: "residential", label: "شقق ودوبلكس وبنتهاوس" },
  { id: "villas", label: "فيلات وتاون هاوس" },
  { id: "coastal", label: "شاليهات وساحلي" },
  { id: "commercial", label: "محلات تجارية" },
  { id: "offices", label: "مكاتب إدارية" },
  { id: "medical", label: "عيادات وصيدليات" },
  { id: "land", label: "أراضٍ" },
  { id: "buildings", label: "مبانٍ كاملة وفنادق" },
] as const satisfies readonly Option[];
export type PropertyType = (typeof PROPERTY_TYPES)[number]["id"];

export const DEAL_TYPES = [
  { id: "primary", label: "بيع من المطوّر (جديد)" },
  { id: "resale", label: "إعادة بيع" },
  { id: "rent", label: "إيجار سنوي" },
  { id: "short_rent", label: "إيجار مفروش قصير المدة" },
  { id: "investment", label: "استثمار بعائد" },
] as const satisfies readonly Option[];
export type DealType = (typeof DEAL_TYPES)[number]["id"];

/** للمقاولات والتشطيبات بدل نوع المعاملة. */
export const SERVICES = [
  { id: "contracting", label: "مقاولات عامة" },
  { id: "finishing", label: "تشطيبات" },
  { id: "interior", label: "تصميم داخلي وديكور" },
  { id: "landscape", label: "لاندسكيب وحدائق" },
  { id: "renovation", label: "ترميم وصيانة" },
  { id: "kitchens", label: "مطابخ وأثاث" },
] as const satisfies readonly Option[];
export type ServiceType = (typeof SERVICES)[number]["id"];

export const SCALES = ["s", "m", "l", "xl"] as const;
export type Scale = (typeof SCALES)[number];

/** سؤال الحجم يتغير بنوع النشاط (المطوّر يُسأل عن المشروعات، والمقاول عن الأعمال المنفذة…). */
export function scaleQuestion(type: BusinessType | "" | undefined): { title: string; options: Option<Scale>[] } {
  switch (type) {
    case "developer":
      return { title: "كم مشروعاً تعرضون الآن؟", options: [{ id: "s", label: "مشروع واحد" }, { id: "m", label: "من 2 إلى 5" }, { id: "l", label: "من 6 إلى 15" }, { id: "xl", label: "أكثر من 15" }] };
    case "construction":
      return { title: "كم مشروعاً نفّذتم تقريباً؟", options: [{ id: "s", label: "أقل من 10" }, { id: "m", label: "من 10 إلى 50" }, { id: "l", label: "من 50 إلى 200" }, { id: "xl", label: "أكثر من 200" }] };
    case "shortstay":
    case "rentals":
      return { title: "كم وحدة تديرون؟", options: [{ id: "s", label: "من 1 إلى 5" }, { id: "m", label: "من 6 إلى 30" }, { id: "l", label: "من 31 إلى 150" }, { id: "xl", label: "أكثر من 150" }] };
    default:
      return { title: "كم عقاراً تعرضون عادةً في الوقت نفسه؟", options: [{ id: "s", label: "أقل من 20" }, { id: "m", label: "من 20 إلى 100" }, { id: "l", label: "من 100 إلى 500" }, { id: "xl", label: "أكثر من 500" }] };
  }
}

// ─── 3) السوق والجمهور ───────────────────────────────────────────────────
export const AREAS = [
  { id: "new_cairo", label: "القاهرة الجديدة والتجمع" },
  { id: "west_cairo", label: "الشيخ زايد و6 أكتوبر" },
  { id: "new_capital", label: "العاصمة الإدارية" },
  { id: "east_cairo", label: "مدينتي والشروق والمستقبل" },
  { id: "cairo", label: "مدينة نصر ومصر الجديدة والمعادي" },
  { id: "north_coast", label: "الساحل الشمالي والعلمين" },
  { id: "sokhna", label: "العين السخنة والجلالة" },
  { id: "red_sea", label: "الغردقة والجونة والبحر الأحمر" },
  { id: "alex", label: "الإسكندرية" },
  { id: "delta_upper", label: "الدلتا والصعيد" },
  { id: "gulf", label: "الخليج" },
] as const satisfies readonly Option[];
export type Area = (typeof AREAS)[number]["id"];

export const AUDIENCES = [
  { id: "local", label: "مشترون ومستأجرون داخل مصر" },
  { id: "expats", label: "مصريون بالخارج" },
  { id: "gulf", label: "عملاء من الخليج" },
  { id: "foreigners", label: "أجانب" },
  { id: "investors", label: "مستثمرون" },
  { id: "companies", label: "شركات (مقرات وفروع)" },
] as const satisfies readonly Option[];
export type Audience = (typeof AUDIENCES)[number]["id"];

export const LANGUAGES = [
  { id: "ar", label: "العربية فقط" },
  { id: "ar_en", label: "العربية والإنجليزية", hint: "العربية أولاً" },
  { id: "en_ar", label: "الإنجليزية والعربية", hint: "الإنجليزية أولاً" },
] as const satisfies readonly Option[];
export type Language = (typeof LANGUAGES)[number]["id"];

/** جمهور خارج مصر يرجّح موقعاً بلغتين (اقتراح يظهر في الاستمارة، والقرار للعميل). */
export const suggestedLanguage = (audience: readonly string[] | undefined): Language =>
  (audience ?? []).some((a) => a === "expats" || a === "gulf" || a === "foreigners") ? "ar_en" : "ar";

// ─── 4) الأهداف ───────────────────────────────────────────────────────────
export const GOALS = [
  { id: "leads", label: "عملاء جدد جادّون باستمرار" },
  { id: "showcase", label: "عرض العقارات بشكل يبهر العميل" },
  { id: "brand", label: "هوية قوية وثقة تميزكم عن المنافسين" },
  { id: "launch", label: "إطلاق مشروع جديد وبيع وحداته" },
  { id: "bookings", label: "حجوزات مباشرة بلا وسطاء" },
  { id: "crm", label: "تنظيم العملاء والمتابعة مع الفريق" },
  { id: "listings_in", label: "استقبال عقارات من الملاك" },
  { id: "time", label: "توفير وقت الرد على الأسئلة المتكررة" },
] as const satisfies readonly Option[];
export type Goal = (typeof GOALS)[number]["id"];
export const MAX_GOALS = 3;

export const CHANNELS = [
  { id: "social", label: "فيسبوك وإنستجرام" },
  { id: "ads", label: "إعلانات ممولة" },
  { id: "tiktok", label: "تيك توك" },
  { id: "whatsapp", label: "واتساب والترشيحات" },
  { id: "google", label: "جوجل" },
  { id: "portals", label: "بوابات العقارات", hint: "عقار ماب، Property Finder، Nawy، Bayut، OLX" },
  { id: "events", label: "معارض وفعاليات" },
  { id: "none", label: "لا مصدر ثابت بعد" },
] as const satisfies readonly Option[];
export type Channel = (typeof CHANNELS)[number]["id"];

// ─── 5) المميزات ──────────────────────────────────────────────────────────
export type FeatureGroup = "site" | "dashboard";
export type Feature = Option & {
  group: FeatureGroup;
  ai?: boolean;
  /** يظهر لهذه الأنشطة فقط (بلا قيمة = للجميع). */
  only?: readonly BusinessType[];
  /** مختار مسبقاً لهذه الأنشطة ("all" = للجميع). */
  rec?: readonly BusinessType[] | "all";
};

const SALES: readonly BusinessType[] = ["broker", "agency", "developer", "other"];

export const FEATURES = [
  // في الموقع
  { id: "ai_search", group: "site", ai: true, label: "بحث ذكي بالكلام العادي", hint: "«شقة 3 غرف في التجمع تحت 5 مليون»", rec: [...SALES, "rentals", "shortstay"], only: [...SALES, "rentals", "shortstay"] },
  { id: "ai_assistant", group: "site", ai: true, label: "مساعد ذكي يرد على الزوار ليلاً ونهاراً", hint: "يجيب ويقترح ويجمع بيانات المهتمين", rec: "all" },
  { id: "filters", group: "site", label: "فلاتر متقدمة", hint: "السعر، المساحة، الغرف، التشطيب، موعد الاستلام", rec: [...SALES, "rentals"], only: [...SALES, "rentals", "shortstay"] },
  { id: "map", group: "site", label: "خريطة تفاعلية للعقارات", rec: ["broker", "agency", "rentals", "shortstay"], only: [...SALES, "rentals", "shortstay"] },
  { id: "projects", group: "site", label: "صفحات المشروعات والكمباوندات", hint: "المخطط، الوحدات المتاحة، الموقع، المواصفات", rec: ["developer", "agency"], only: ["developer", "agency", "broker", "other"] },
  { id: "payment_plans", group: "site", label: "حاسبة التقسيط وخطط السداد", rec: ["developer", "agency", "broker"], only: [...SALES] },
  { id: "compare", group: "site", label: "مقارنة العقارات جنباً إلى جنب", rec: ["agency", "developer"], only: [...SALES, "rentals"] },
  { id: "tours", group: "site", label: "فيديو وجولات افتراضية 360°", rec: ["developer", "shortstay"] },
  { id: "viewing", group: "site", label: "حجز موعد معاينة", rec: ["broker", "agency", "rentals"], only: [...SALES, "rentals"] },
  { id: "availability", group: "site", label: "تقويم توفر وحجز بالليلة", rec: ["shortstay"], only: ["shortstay", "rentals"] },
  { id: "list_property", group: "site", label: "صفحة «اعرضوا عقاركم معنا» للملاك", rec: ["broker", "agency", "rentals"], only: ["broker", "agency", "rentals", "other"] },
  { id: "favorites", group: "site", label: "المفضلة وتنبيهات العقارات الجديدة", rec: ["agency"], only: [...SALES, "rentals", "shortstay"] },
  { id: "currency", group: "site", label: "الأسعار بأكثر من عملة", only: [...SALES, "shortstay", "rentals"] },
  { id: "portfolio", group: "site", label: "معرض أعمال قبل وبعد", rec: ["construction"], only: ["construction", "developer", "other"] },
  { id: "quote", group: "site", label: "طلب عرض سعر بالتفاصيل والمساحة", rec: ["construction"], only: ["construction", "other"] },
  { id: "area_guides", group: "site", label: "دليل المناطق ومقالات تجلب زيارات من جوجل" },
  { id: "team_pages", group: "site", label: "صفحات الفريق والمستشارين", only: ["agency", "developer", "construction", "other"] },
  { id: "reviews", group: "site", label: "آراء العملاء وقصص النجاح", rec: ["construction", "shortstay"] },
  // في لوحة التحكم
  { id: "crm", group: "dashboard", label: "إدارة العملاء ومراحل الصفقة", hint: "من أول رسالة حتى التعاقد", rec: "all" },
  { id: "lead_scoring", group: "dashboard", ai: true, label: "تقييم كل عميل آلياً: جادّ أم يستكشف", rec: [...SALES, "rentals", "construction"] },
  { id: "ai_writer", group: "dashboard", ai: true, label: "كتابة وصف العقار وترجمته بالذكاء الاصطناعي", hint: "من الصور وبضع ملاحظات", rec: "all" },
  { id: "matching", group: "dashboard", ai: true, label: "مطابقة العقارات للعملاء آلياً", hint: "عقار جديد ← قائمة بمن يناسبهم", rec: ["broker", "agency", "rentals"], only: [...SALES, "rentals"] },
  { id: "social_kit", group: "dashboard", ai: true, label: "منشور جاهز لكل عقار بضغطة", hint: "نص وصورة لإنستجرام وفيسبوك وواتساب", rec: ["broker", "agency"] },
  { id: "followups", group: "dashboard", label: "تذكيرات المتابعة ورسائل واتساب جاهزة", rec: "all" },
  { id: "team_roles", group: "dashboard", label: "حسابات للفريق وتوزيع العملاء بينهم", rec: ["agency", "developer"] },
  { id: "analytics", group: "dashboard", label: "تقارير: أكثر العقارات مشاهدة ومصادر العملاء", rec: "all" },
  { id: "owners", group: "dashboard", label: "الملاك والعقود والتحصيل الشهري", rec: ["rentals"], only: ["rentals", "agency", "shortstay"] },
  { id: "bookings_mgmt", group: "dashboard", label: "إدارة الحجوزات والإشغال والأسعار الموسمية", rec: ["shortstay"], only: ["shortstay", "rentals"] },
  { id: "inventory", group: "dashboard", label: "مخزون الوحدات: متاح ومحجوز ومباع", rec: ["developer"], only: ["developer", "agency"] },
] as const satisfies readonly Feature[];
export type FeatureId = (typeof FEATURES)[number]["id"];

const FEATURE_IDS = FEATURES.map((f) => f.id) as [FeatureId, ...FeatureId[]];
const featureById = new Map<string, Feature>(FEATURES.map((f) => [f.id, f as Feature]));
export const featureLabel = (id: string) => featureById.get(id)?.label ?? id;
export const isAiFeature = (id: string) => Boolean(featureById.get(id)?.ai);

/** المميزات التي تُعرض لهذا النشاط (لا نعرض «تقويم الحجز بالليلة» على مقاول). */
export function featuresFor(type: BusinessType | "" | undefined): Feature[] {
  return (FEATURES as readonly Feature[]).filter((f) => !f.only || !type || f.only.includes(type));
}

/** أهداف تضيف مميزات بعينها فوق اختيارات النشاط. */
const GOAL_FEATURES: Partial<Record<Goal, FeatureId[]>> = {
  leads: ["ai_assistant", "crm", "lead_scoring", "followups"],
  showcase: ["tours", "filters"],
  brand: ["reviews", "area_guides"],
  launch: ["projects", "payment_plans", "inventory"],
  bookings: ["availability", "bookings_mgmt"],
  crm: ["crm", "team_roles", "followups"],
  listings_in: ["list_property"],
  time: ["ai_assistant", "ai_search"],
};

/** الاختيار المبدئي في خطوة المميزات: ما يوصى به للنشاط + ما تستدعيه الأهداف + العملات لجمهور خارج مصر. */
export function recommendFeatures(input: { businessType?: string; goals?: readonly string[]; audience?: readonly string[]; teamSize?: string }): FeatureId[] {
  const type = isBusinessType(input.businessType) ? input.businessType : undefined;
  const shown = new Set(featuresFor(type).map((f) => f.id));
  const out = new Set<string>();
  for (const f of featuresFor(type)) if (f.rec === "all" || (type && f.rec?.includes(type))) out.add(f.id);
  for (const g of input.goals ?? []) for (const id of GOAL_FEATURES[g as Goal] ?? []) out.add(id);
  if ((input.audience ?? []).some((a) => a === "expats" || a === "gulf" || a === "foreigners")) out.add("currency");
  if (input.teamSize === "solo") out.delete("team_roles");
  else if (input.teamSize === "mid" || input.teamSize === "large") out.add("team_roles");
  return FEATURE_IDS.filter((id) => out.has(id) && shown.has(id));
}

// ─── 6) الهوية والشكل ────────────────────────────────────────────────────
/** الشعار: عنده (يرفعه) أو نصمم له، أو سيرسله لاحقاً إن تعذر الرفع الآن. */
export const LOGO_MODES = [
  { id: "have", label: "لدينا شعار", hint: "ارفعوه هنا (PNG أو JPG أو WEBP)" },
  { id: "design", label: "صمموا لنا شعاراً", hint: "أسئلة بسيطة ونقترح عليكم تصميماً" },
] as const satisfies readonly Option[];
export type LogoMode = (typeof LOGO_MODES)[number]["id"] | "later";

export const LOGO_STYLES = [
  { id: "symbol", label: "رمز مع الاسم", hint: "أيقونة بجانب اسم النشاط" },
  { id: "monogram", label: "حروف مختصرة", hint: "حرف أو حرفان داخل شكل" },
  { id: "wordmark", label: "الاسم فقط", hint: "خط مميز بلا رمز" },
] as const satisfies readonly Option[];
export type LogoStyle = (typeof LOGO_STYLES)[number]["id"];

export const LOGO_IDEAS = [
  { id: "building", label: "مبنى أو برج" },
  { id: "home", label: "منزل" },
  { id: "key", label: "مفتاح" },
  { id: "skyline", label: "أفق مدينة" },
  { id: "geometric", label: "أشكال هندسية" },
  { id: "letter", label: "حرف من الاسم" },
  { id: "suggest", label: "اقترحوا علينا" },
] as const satisfies readonly Option[];
export type LogoIdea = (typeof LOGO_IDEAS)[number]["id"];

/** صور الشعار تُقبل من مساحة ملفاتنا فقط (يتحقق الخادم من المضيف)، وhttps دائماً. */
const LOGO_URL_RE = /^https:\/\/[^\s]{4,480}$/i;
export const isLogoUrl = (v: unknown): v is string => typeof v === "string" && LOGO_URL_RE.test(v.trim());

export type Palette = Option & { colors?: readonly [string, string, string] };
/** [الخلفية الغالبة، اللون الأساسي، لون التمييز]. */
export const PALETTES = [
  { id: "royal", label: "كحلي وذهبي", hint: "ثقة وفخامة", colors: ["#0f1b33", "#1c2f57", "#c8a24a"] },
  { id: "noir", label: "أسود وذهبي", hint: "فاخر وجريء", colors: ["#0b0b0c", "#1d1d20", "#c9a86a"] },
  { id: "emerald", label: "زمردي ورملي", hint: "هدوء ورقي", colors: ["#0f3d33", "#1f5c4d", "#d8c3a5"] },
  { id: "azure", label: "أبيض وأزرق", hint: "عصري ونظيف", colors: ["#ffffff", "#1f5eff", "#0b1f4d"] },
  { id: "terra", label: "ترابي دافئ", hint: "دفء وطابع عائلي", colors: ["#f6efe7", "#8a4b2d", "#c97b4a"] },
  { id: "mono", label: "أبيض وأسود", hint: "بسيط وراقٍ", colors: ["#ffffff", "#111111", "#8a8a8a"] },
  { id: "custom", label: "ألوان هويتنا", hint: "اختاروا لونيكم" },
  { id: "suggest", label: "اقترحوا علينا", hint: "نختار ما يناسب نشاطكم" },
] as const satisfies readonly Palette[];
export type PaletteId = (typeof PALETTES)[number]["id"];

export const STYLES = [
  { id: "luxury", label: "فخم وراقٍ" },
  { id: "modern", label: "عصري ونظيف" },
  { id: "warm", label: "دافئ وقريب" },
  { id: "bold", label: "جريء ولافت" },
] as const satisfies readonly Option[];
export type StyleId = (typeof STYLES)[number]["id"];

// ─── 7) الإطلاق والتواصل ─────────────────────────────────────────────────
export const DOMAIN_STATES = [
  { id: "have", label: "لدينا نطاق (دومين)" },
  { id: "need", label: "لا، ساعدونا في اختياره" },
] as const satisfies readonly Option[];

export const MEDIA_STATES = [
  { id: "pro", label: "كثيرة واحترافية" },
  { id: "some", label: "بعضها جيد" },
  { id: "few", label: "قليلة أو بالهاتف" },
] as const satisfies readonly Option[];

export const TIMELINES = [
  { id: "asap", label: "في أسرع وقت" },
  { id: "month", label: "خلال شهر" },
  { id: "flex", label: "لا موعد محدد" },
] as const satisfies readonly Option[];

// ─── المخطط ───────────────────────────────────────────────────────────────
const HEX = /^#[0-9a-f]{6}$/i;
const DOMAIN_RE = /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.[a-z0-9-]{1,63})*\.[a-z؀-ۿ]{2,24}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** رقم واتساب مصري (يُحفظ 01xxxxxxxxx) أو دولي بمفتاح الدولة (يُحفظ +<أرقام>). */
export function normalizeContactPhone(raw: string | null | undefined): string | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const eg = normalizeEgyptianPhone(raw);
  if (eg) return eg;
  const digits = raw
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .trim();
  if (!/^(\+|00)/.test(digits)) return null;
  const n = digits.replace(/^00/, "").replace(/\D/g, "");
  return n.length >= 8 && n.length <= 15 && !n.startsWith("0") ? `+${n}` : null;
}

/** رابط wa.me لأي رقم محفوظ بالصيغتين. */
export const waMe = (phone: string) => `https://wa.me/${phone.startsWith("+") ? phone.slice(1) : phone.replace(/\D/g, "").replace(/^0/, "20")}`;

/** نطاق مكتوب بأي شكل (رابط كامل، www) إلى صيغته المجردة، أو "" إن لم يكن نطاقاً. */
export function cleanDomain(raw: string | undefined | null): string {
  const s = (raw ?? "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split(/[/?#\s]/)[0] ?? "";
  return DOMAIN_RE.test(s) ? s : "";
}

const text = (max: number) => z.string().trim().max(max).default("");
const list = <T extends string>(values: [T, ...T[]], max = values.length) => z.array(z.enum(values)).max(max).default([]).transform((a) => Array.from(new Set(a)));

export const briefDataSchema = z.object({
  v: z.literal(BRIEF_VERSION).default(BRIEF_VERSION),
  businessName: z.string().trim().min(2).max(80),
  businessType: z.enum(ids(BUSINESS_TYPES)),
  businessTypeOther: text(80),
  teamSize: z.enum(ids(TEAM_SIZES)),
  propertyTypes: list(ids(PROPERTY_TYPES)),
  dealTypes: list(ids(DEAL_TYPES)),
  services: list(ids(SERVICES)),
  scale: z.enum(SCALES),
  areas: list(ids(AREAS)),
  areasOther: text(200),
  audience: list(ids(AUDIENCES)),
  languages: z.enum(ids(LANGUAGES)),
  goals: list(ids(GOALS), MAX_GOALS),
  channels: list(ids(CHANNELS)),
  problem: text(600),
  features: list(FEATURE_IDS),
  logoMode: z.enum(["have", "design", "later"]),
  logoUrl: z.string().trim().max(500).refine((v) => v === "" || LOGO_URL_RE.test(v)).default(""),
  logoName: text(60),
  logoStyle: z.enum(ids(LOGO_STYLES)).optional().or(z.literal("")).default(""),
  logoIdeas: list(ids(LOGO_IDEAS)),
  logoNotes: text(400),
  palette: z.enum(ids(PALETTES)),
  primaryColor: z.string().trim().toLowerCase().refine((v) => v === "" || HEX.test(v)).default(""),
  accentColor: z.string().trim().toLowerCase().refine((v) => v === "" || HEX.test(v)).default(""),
  /** ألوان مكتوبة يدوياً (بالاسم أو الكود) بديلاً عن المنتقي. */
  colorsNote: text(200),
  style: z.enum(ids(STYLES)),
  inspiration: text(400),
  domain: z.enum(ids(DOMAIN_STATES)),
  domainName: text(120),
  media: z.enum(ids(MEDIA_STATES)),
  timeline: z.enum(ids(TIMELINES)),
  contactName: z.string().trim().min(2).max(60),
  whatsapp: z.string().trim().max(30),
  email: text(120),
  notes: text(2000),
});
export type BriefData = z.output<typeof briefDataSchema>;
/** ما تحمله الاستمارة أثناء التعبئة (كل حقل قد يكون فارغاً). */
export type BriefDraft = { [K in keyof BriefData]?: BriefData[K] extends readonly unknown[] ? string[] : string };

export const isBusinessType = (v: unknown): v is BusinessType => typeof v === "string" && BUSINESS_TYPES.some((t) => t.id === v);

// ─── الخطوات وتحقق كل خطوة ────────────────────────────────────────────────
export const STEPS = [
  { id: "business", title: "نشاطكم", lead: "نبدأ بالأساس: من أنتم؟" },
  { id: "properties", title: "عقاراتكم", lead: "ماذا تقدّمون لعملائكم؟" },
  { id: "market", title: "السوق", lead: "أين تعملون ومن عملاؤكم؟" },
  { id: "goals", title: "الأهداف", lead: "ماذا تنتظرون من الموقع؟" },
  { id: "features", title: "المميزات", lead: "اخترنا لكم ما يناسب نشاطكم" },
  { id: "look", title: "الهوية", lead: "كيف يبدو موقعكم؟" },
  { id: "contact", title: "الإطلاق", lead: "آخر خطوة: كيف نصل إليكم؟" },
] as const;
export type StepId = (typeof STEPS)[number]["id"];

export type FieldErrors = Partial<Record<keyof BriefData, string>>;

const has = (v: unknown) => (typeof v === "string" ? v.trim().length > 0 : Array.isArray(v) ? v.length > 0 : false);

/** أخطاء خطوة واحدة (نصوص عربية مختصرة لكل حقل). نفس القواعد تُطبَّق على الخادم لكل الخطوات. */
export function stepErrors(step: StepId, d: BriefDraft): FieldErrors {
  const e: FieldErrors = {};
  switch (step) {
    case "business":
      if ((d.businessName ?? "").trim().length < 2) e.businessName = "اكتبوا اسم النشاط كما سيظهر في الموقع.";
      if (!isBusinessType(d.businessType)) e.businessType = "اختاروا ما يصف نشاطكم.";
      else if (d.businessType === "other" && (d.businessTypeOther ?? "").trim().length < 2) e.businessTypeOther = "اكتبوا نشاطكم في كلمات قليلة.";
      if (!has(d.teamSize)) e.teamSize = "اختاروا حجم الفريق.";
      break;
    case "properties":
      if (!has(d.propertyTypes)) e.propertyTypes = "اختاروا نوعاً واحداً على الأقل.";
      if (d.businessType === "construction") {
        if (!has(d.services)) e.services = "اختاروا خدمة واحدة على الأقل.";
      } else if (!has(d.dealTypes)) e.dealTypes = "اختاروا نوع معاملة واحداً على الأقل.";
      if (!has(d.scale)) e.scale = "اختاروا الأقرب.";
      break;
    case "market":
      if (!has(d.areas) && (d.areasOther ?? "").trim().length < 2) e.areas = "اختاروا منطقة أو اكتبوها.";
      if (!has(d.audience)) e.audience = "اختاروا فئة واحدة على الأقل.";
      if (!has(d.languages)) e.languages = "اختاروا لغة الموقع.";
      break;
    case "goals":
      if (!has(d.goals)) e.goals = "اختاروا هدفاً واحداً على الأقل.";
      else if ((d.goals ?? []).length > MAX_GOALS) e.goals = `اختاروا ${MAX_GOALS} أهداف على الأكثر.`;
      break;
    case "features":
      break;
    case "look":
      if (!has(d.logoMode)) e.logoMode = "اختاروا: لديكم شعار أم نصممه لكم؟";
      else if (d.logoMode === "have" && !isLogoUrl(d.logoUrl)) e.logoUrl = "ارفعوا صورة الشعار، أو اضغطوا «سأرسله لاحقاً».";
      else if (d.logoMode === "design") {
        if (!has(d.logoStyle)) e.logoStyle = "اختاروا شكل الشعار الذي يعجبكم.";
      }
      if (!has(d.palette)) e.palette = "اختاروا ألواناً أو «اقترحوا علينا».";
      else if (d.palette === "custom") {
        const hexes = HEX.test(d.primaryColor ?? "") && HEX.test(d.accentColor ?? "");
        if (!hexes && (d.colorsNote ?? "").trim().length < 2) e.primaryColor = "اختاروا اللونين، أو اكتبوهما بالاسم أو الكود.";
      }
      if (!has(d.style)) e.style = "اختاروا الطابع.";
      break;
    case "contact":
      if ((d.contactName ?? "").trim().length < 2) e.contactName = "اكتبوا الاسم.";
      if (!normalizeContactPhone(d.whatsapp)) e.whatsapp = "رقم واتساب غير صحيح. مثال: 01012345678 أو ‎+971501234567";
      if (has(d.email) && !EMAIL_RE.test((d.email ?? "").trim())) e.email = "البريد غير صحيح (أو اتركوه فارغاً).";
      if (!has(d.domain)) e.domain = "اختاروا إجابة.";
      else if (d.domain === "have" && !cleanDomain(d.domainName)) e.domainName = "اكتبوا النطاق، مثل example.com";
      if (!has(d.media)) e.media = "اختاروا الأقرب.";
      if (!has(d.timeline)) e.timeline = "اختاروا موعداً.";
      break;
  }
  return e;
}

/** أول خطوة فيها نقص (للخادم والمتصفح)، أو -1 إن اكتملت كلها. */
export function firstIncompleteStep(d: BriefDraft): number {
  return STEPS.findIndex((s) => Object.keys(stepErrors(s.id, d)).length > 0);
}

export type ParsedBrief = { ok: true; data: BriefData } | { ok: false; step: number; errors: FieldErrors };

/** تحقق كامل قبل الحفظ: قواعد الخطوات ثم المخطط، مع تنظيف ما لا يخص النشاط (لا خدمات مقاولات لوسيط…). */
export function parseBrief(input: unknown): ParsedBrief {
  const d = (input && typeof input === "object" ? input : {}) as BriefDraft;
  const step = firstIncompleteStep(d);
  if (step !== -1) return { ok: false, step, errors: stepErrors(STEPS[step]!.id, d) };
  const r = briefDataSchema.safeParse(d);
  if (!r.success) {
    const field = String(r.error.issues[0]?.path[0] ?? "");
    const at = STEPS.findIndex((s) => STEP_FIELDS[s.id].includes(field as keyof BriefData));
    return { ok: false, step: at === -1 ? 0 : at, errors: { [field]: "قيمة غير صالحة، راجعوها من فضلكم." } as FieldErrors };
  }
  const data = { ...r.data };
  data.whatsapp = normalizeContactPhone(data.whatsapp)!;
  data.email = data.email.toLowerCase();
  data.domainName = data.domain === "have" ? cleanDomain(data.domainName) : "";
  if (data.businessType !== "other") data.businessTypeOther = "";
  if (data.businessType === "construction") data.dealTypes = [];
  else data.services = [];
  if (data.palette !== "custom") {
    data.primaryColor = "";
    data.accentColor = "";
    data.colorsNote = "";
  }
  if (data.logoMode !== "have") data.logoUrl = "";
  if (data.logoMode !== "design") {
    data.logoName = "";
    data.logoStyle = "";
    data.logoIdeas = [];
    data.logoNotes = "";
  } else if (!data.logoName) data.logoName = data.businessName;
  const shown = new Set(featuresFor(data.businessType).map((f) => f.id));
  data.features = data.features.filter((f) => shown.has(f));
  return { ok: true, data };
}

/** أي حقل في أي خطوة (لإرجاع العميل إلى مكان الخطأ). */
export const STEP_FIELDS: Record<StepId, (keyof BriefData)[]> = {
  business: ["businessName", "businessType", "businessTypeOther", "teamSize"],
  properties: ["propertyTypes", "dealTypes", "services", "scale"],
  market: ["areas", "areasOther", "audience", "languages"],
  goals: ["goals", "channels", "problem"],
  features: ["features"],
  look: ["logoMode", "logoUrl", "logoName", "logoStyle", "logoIdeas", "logoNotes", "palette", "primaryColor", "accentColor", "colorsNote", "style", "inspiration"],
  contact: ["contactName", "whatsapp", "email", "domain", "domainName", "media", "timeline", "notes"],
};

// ─── حالات الاستمارة في لوحة المالك ──────────────────────────────────────
export const BRIEF_STATUSES = ["new", "contacted", "building", "delivered", "archived"] as const;
export type BriefStatus = (typeof BRIEF_STATUSES)[number];
export const BRIEF_STATUS_LABEL: Record<BriefStatus, string> = {
  new: "جديدة",
  contacted: "تم التواصل",
  building: "قيد البناء",
  delivered: "سُلّمت",
  archived: "مؤرشفة",
};
export const isBriefStatus = (v: unknown): v is BriefStatus => typeof v === "string" && (BRIEF_STATUSES as readonly string[]).includes(v);
