// handoff-messages.ts — رسائل التسليم الجاهزة للنسخ التي يرسلها المالك بنفسه للتاجر بعد أن يغلق الوكيل المحادثة (V3 A5).
// خالص ومختبَر. عربية مهنية بالجمع، بلا ذكر لأدوات داخلية. الروابط تأتي من الخادم (رابط الإعداد موقّع، ورابط المتجر الحقيقي).

export type HandoffKind = "setup" | "login" | "ready";

export const HANDOFF_KINDS: readonly HandoffKind[] = ["setup", "login", "ready"];

export const HANDOFF_TITLE: Record<HandoffKind, string> = {
  setup: "رابط الإعداد وطريقة الدخول",
  login: "الدخول إلى لوحة التحكم",
  ready: "المتجر جاهز ورابطه",
};

export const isHandoffKind = (v: unknown): v is HandoffKind => typeof v === "string" && (HANDOFF_KINDS as readonly string[]).includes(v);

export type HandoffInput = {
  storeName: string;
  /** رابط الإعداد الموقّع (/setup?t=…). */
  setupUrl: string;
  /** صفحة الدخول على النطاق الرئيسي. */
  loginUrl: string;
  /** رابط المتجر العام (نطاقه الخاص إن فُعّل، وإلا الفرعي). */
  storeUrl: string;
  /** البريد المسجّل للتاجر (حساب Google الذي يدخل به)، إن وُجد. */
  email: string | null;
};

const emailLine = (email: string | null) =>
  email
    ? `ادخلوا بحساب Google المرتبط بالبريد ${email}. إن لم يكن هذا البريد حساب Google، اختاروا «الدخول برمز على البريد» في الصفحة نفسها وسيصلكم رمز عليه.`
    : "ادخلوا بحساب Google بالبريد الذي أعطيتمونا إياه، أو اختاروا «الدخول برمز على البريد» في الصفحة نفسها.";

export function handoffMessage(kind: HandoffKind, i: HandoffInput): string {
  const name = i.storeName.trim() || "متجركم";
  if (kind === "setup") {
    return [
      `أهلاً بكم، متجر «${name}» جاهز للإعداد.`,
      `افتحوا هذا الرابط: ${i.setupUrl}`,
      emailLine(i.email),
      "بعد الدخول تضيفون منتجاتكم بالصور، وتختارون وسائل الدفع والشحن، في دقائق، وكل شيء قابل للتعديل لاحقاً. ثم تبدأ التجربة المجانية قبل أي دفع.",
      "وأي سؤال، اكتبوا لنا هنا.",
    ].join("\n\n");
  }
  if (kind === "login") {
    return [
      `للدخول إلى لوحة تحكم «${name}» في أي وقت: ${i.loginUrl}`,
      emailLine(i.email),
      "من اللوحة تديرون الطلبات والمنتجات والتصميم والإعدادات من الموبايل أو الكمبيوتر.",
    ].join("\n\n");
  }
  return [
    `متجر «${name}» جاهز ويستقبل الطلبات على هذا الرابط: ${i.storeUrl}`,
    "ننصح بوضعه في بايو إنستجرام الآن: الملف الشخصي ← تعديل الملف الشخصي ← الروابط ← إضافة رابط خارجي، ثم الصقوا الرابط واحفظوا.",
    "وشاركوه في الستوري مع ملصق الرابط، وفي رسالة الترحيب على واتساب، ليصل عملاؤكم إلى المتجر مباشرة بدل الدايركت.",
  ].join("\n\n");
}
