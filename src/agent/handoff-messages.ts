// handoff-messages.ts — رسائل التسليم الجاهزة للنسخ التي يرسلها المالك بنفسه للتاجر بعد أن يغلق الوكيل المحادثة (V3 A5، وعُدّلت لـ V5: كلمة مرور بدل Google ومعاينة 24 ساعة).
// خالص ومختبَر. عربية مهنية بالجمع، بلا ذكر لأدوات داخلية. الروابط تأتي من الخادم (رابط الإعداد موقّع، ورابط المتجر الحقيقي).

export type HandoffKind = "setup" | "login" | "ready" | "activate" | "paid";

export const HANDOFF_KINDS: readonly HandoffKind[] = ["setup", "login", "ready", "activate", "paid"];

export const HANDOFF_TITLE: Record<HandoffKind, string> = {
  setup: "رابط الإعداد جاهز",
  login: "الدخول إلى لوحة التحكم",
  ready: "المتجر جاهز ورابطه",
  activate: "تفعيل الموقع والدفع",
  paid: "تم تأكيد الدفع وبدء التسليم",
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
  /** البريد المسجّل للتاجر (بريد دخول اللوحة)، إن وُجد. */
  email: string | null;
};

const emailLine = (email: string | null) =>
  email ? `الدخول ببريدكم ${email} وكلمة المرور التي تضعونها عند أول فتح للرابط.` : "الدخول بالبريد الذي أعطيتمونا إياه وكلمة المرور التي تضعونها عند أول فتح للرابط.";

export function handoffMessage(kind: HandoffKind, i: HandoffInput): string {
  const name = i.storeName.trim() || "متجركم";
  if (kind === "setup") {
    return [
      `أهلاً بكم، متجر «${name}» جاهز للإعداد.`,
      `افتحوا هذا الرابط: ${i.setupUrl}`,
      `عند الفتح تضعون كلمة مرور للوحة التحكم، ويعرفها أنتم وفريقكم فقط. ${emailLine(i.email)}`,
      "ثم تكملون الإعداد في دقائق (المنتجات ووسائل الدفع والشحن)، وكل شيء قابل للتعديل لاحقاً.",
      "تنبيه مهم: مدة المعاينة المجانية 24 ساعة، وتبدأ من أول مرة تفتحون فيها الرابط، فافتحوه حين تكونون جاهزين لتجربة المتجر. لا دفع قبل أن يعجبكم.",
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
  if (kind === "activate") {
    return [
      `تذكير بخصوص متجر «${name}»: المعاينة المجانية مدتها 24 ساعة من أول فتح للرابط، وبعدها يتوقف المتجر مؤقتاً حتى يُفعَّل.`,
      `لتفعيل الموقع ادخلوا لوحة التحكم: ${i.loginUrl} ثم افتحوا قسم «تفعيل الموقع» وارفعوا إيصال الدفع.`,
      "بعد أن نؤكد الدفع نبدأ التسليم مباشرة. وأي استفسار، اكتبوا لنا هنا.",
    ].join("\n\n");
  }
  if (kind === "paid") {
    return [
      `تم تأكيد الدفع لمتجر «${name}»، وشكراً لثقتكم.`,
      "بدأنا التسليم: نسلّمكم كود المتجر ثم نحدد معكم موعداً قصيراً لربط حساباتكم الخاصة بالمتجر. سنراسلكم هنا بالموعد.",
      `متجركم يعمل الآن على هذا الرابط: ${i.storeUrl}`,
    ].join("\n\n");
  }
  return [
    `متجر «${name}» جاهز ويستقبل الطلبات على هذا الرابط: ${i.storeUrl}`,
    "ننصح بوضعه في بايو إنستجرام الآن: الملف الشخصي ← تعديل الملف الشخصي ← الروابط ← إضافة رابط خارجي، ثم الصقوا الرابط واحفظوا.",
    "وشاركوه في الستوري مع ملصق الرابط، وفي رسالة الترحيب على واتساب، ليصل عملاؤكم إلى المتجر مباشرة بدل الدايركت.",
  ].join("\n\n");
}


// ─── رسائل مشروع V4 ──────────────────────────────────────────────────────────
// عربية مهنية بالجمع، بلا أي ذكر لأدوات داخلية. تُبنى على الخادم من بيانات الطلب الحقيقية، وتصل العميل بالبريد
// (وبرسالة ميتا إن عُرفت المحادثة). ما لم يُعرف بعد من روابط وموعد يظهر مكانه بين أقواس ليملأه المالك قبل الإرسال.

const dayAr = (d: Date) =>
  new Intl.DateTimeFormat("ar-EG-u-nu-latn", { weekday: "long", day: "numeric", month: "long", timeZone: "Africa/Cairo" }).format(d);

/** تأكيد الدفع وحجز المقعد: آخر رسالة للوكيل مع العميل، ثم يتولى الفريق. */
export function paymentConfirmedMessage(i: { storeName: string; offer: "golden" | "standard"; accountUrl: string }): string {
  const name = i.storeName.trim() || "متجركم";
  const head =
    i.offer === "golden"
      ? `تم تأكيد طلبكم وحجز مقعدكم في الدائرة الذهبية لمتجر «${name}». الفريق يبدأ تجهيز متجركم خلال 48 ساعة.`
      : `تم تأكيد طلبكم وحجز مشروع «${name}». الفريق يبدأ تجهيز مشروعكم خلال 48 ساعة.`;
  return [
    head,
    `تتابعون حالة المشروع في أي وقت من حسابكم: ${i.accountUrl}\nادخلوا بالبريد الذي سجلتموه في الحجز (بحساب Google أو برمز يصل على بريدكم).`,
    "سنراسلكم عند الجاهزية لنحدد معكم موعد جلسة التسليم.",
  ].join("\n\n");
}

export type DeliveryInput = {
  storeName: string;
  repoUrl: string | null;
  storeUrl: string | null;
  accountUrl: string;
  /** نهاية نافذة التعديل المجاني. */
  freeEditUntil: Date;
  freeDays: number;
};

/**
 * رسالة التسليم الجاهزة للنسخ (المالك يرسلها بنفسه بعد زر «سلّم للعميل»): دعوة جلسة التسليم المباشرة، ورابطا المستودع والمتجر.
 * ما لم يُعرف بعد يبقى بين أقواس مربعة ليملأه المالك.
 */
export function deliveryMessage(i: DeliveryInput): string {
  const name = i.storeName.trim() || "متجركم";
  return [
    `أهلاً بكم، مشروع «${name}» جاهز للتسليم.`,
    "ندعوكم لجلسة قصيرة مباشرة نجلس فيها معكم خطوة بخطوة حتى يفتح متجركم ويعمل بحساباتكم أنتم:",
    "الموعد: [اكتبوا الموعد المتفق عليه]\nالرابط: [رابط الاجتماع]",
    "جهّزوا قبل الجلسة بريدكم وهاتفكم لتأكيد إنشاء الحسابات التي سنحتاجها، وسنرشدكم إلى كل خطوة.",
    `مستودع مشروعكم: ${i.repoUrl || "[رابط المستودع بعد إنشائه معكم]"}\nرابط المتجر: ${i.storeUrl || "[رابط المتجر بعد نشره]"}`,
    `بعد التسليم: تعديل واحد مجاني خلال ${i.freeDays} أيام (حتى ${dayAr(i.freeEditUntil)})، وتطلبونه من حسابكم: ${i.accountUrl}`,
  ].join("\n\n");
}

/** استلام طلب تعديل: مجاني أو بانتظار تأكيد الرسوم. */
export function editReceivedMessage(i: { code: string; free: boolean; feeEgp: number; accountUrl: string }): string {
  if (i.free) {
    return [`استلمنا طلب التعديل ${i.code}، وهو التعديل المجاني ضمن نافذة ما بعد التسليم.`, `سنبدأ تنفيذه ونراسلكم عند الانتهاء. تتابعونه من حسابكم: ${i.accountUrl}`].join("\n\n");
  }
  return [
    `استلمنا طلب التعديل ${i.code} وإيصال التحويل بقيمة ${i.feeEgp.toLocaleString("en-US")} ج.`,
    `نؤكد التحويل أولاً ثم نبدأ التنفيذ، وسنراسلكم عند كل خطوة. تتابعونه من حسابكم: ${i.accountUrl}`,
  ].join("\n\n");
}

/** تأكيد دفع رسوم التعديل وبدء التنفيذ. */
export function editPaidMessage(i: { code: string; accountUrl: string }): string {
  return [`تم تأكيد تحويل رسوم التعديل ${i.code}، ونبدأ التنفيذ الآن.`, `سنراسلكم فور الانتهاء. تتابعونه من حسابكم: ${i.accountUrl}`].join("\n\n");
}

/** اكتمال التعديل (أو الاعتذار عنه بسبب). */
export function editDoneMessage(i: { code: string; note: string | null; storeUrl: string | null; accountUrl: string }): string {
  return [
    `تم تنفيذ طلب التعديل ${i.code}.`,
    i.note?.trim() ? i.note.trim() : "",
    i.storeUrl ? `تجدونه مباشرة على متجركم: ${i.storeUrl}` : "تظهر التعديلات على متجركم بعد نشرها خلال دقائق.",
    `لطلب تعديل جديد أو متابعة المشروع: ${i.accountUrl}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function editDeclinedMessage(i: { code: string; note: string | null; accountUrl: string }): string {
  return [`بخصوص طلب التعديل ${i.code}: لم نتمكن من تنفيذه كما ورد.`, i.note?.trim() ? i.note.trim() : "", `يمكنكم مراسلتنا أو تقديم طلب جديد من حسابكم: ${i.accountUrl}`].filter(Boolean).join("\n\n");
}

/** استلام حجز جديد (بانتظار التأكيد) للعميل نفسه. */
export function bookingReceivedMessage(i: { storeName: string; code: string; trackUrl: string }): string {
  return [
    `استلمنا طلب حجز «${i.storeName.trim() || "متجركم"}» (${i.code}) وإيصال التحويل.`,
    "نراجع التحويل ونؤكد لكم الحجز بالبريد، وغالباً يتم ذلك خلال ساعات.",
    `تتابعون حالة الطلب من هنا: ${i.trackUrl}`,
  ].join("\n\n");
}

/** رفض إيصال (حجز أو تعديل) بسبب يصل للعميل، مع دعوة لإرسال إيصال صحيح. */
export function bookingRejectedMessage(i: { storeName: string; reason: string }): string {
  return [
    `بخصوص «${i.storeName.trim() || "طلبكم"}»: لم نتمكن من اعتماد إيصال التحويل.`,
    `السبب: ${i.reason.trim()}`,
    "أرسلوا إيصالاً واضحاً بالمبلغ الصحيح من الزر في هذه الرسالة، أو راسلونا إن كان لديكم أي استفسار.",
  ].join("\n\n");
}

/** تأكيد دفع «تفعيل الموقع» من لوحة المتجر المعاينة: المتجر باقٍ كما هو، والتسليم والميتنج بعده. */
export function activationConfirmedMessage(i: { storeName: string; offer: "golden" | "standard"; accountUrl: string }): string {
  const name = i.storeName.trim() || "متجركم";
  return [
    `تم تأكيد دفعكم وتفعيل موقع «${name}»${i.offer === "golden" ? " ضمن الدائرة الذهبية" : ""}. شكراً لثقتكم.`,
    "الخطوة القادمة: جلسة تسليم مباشرة نجلس فيها معكم لربط حساباتكم وتسليم الكود كاملاً ملكاً لكم، وسنراسلكم لتحديد موعدها.",
    `تواصلون معنا وتتابعون كل شيء من هنا: ${i.accountUrl}`,
  ].join("\n\n");
}
