// briefs/render.ts — نصوص الاستمارة العقارية الجاهزة للنسخ من لوحة المالك: البريف (Markdown)، وبرومبت البناء الكامل لمشروع
// العميل (ريبو ulghx)، ورسالة واتساب للعميل، وأسطر الملخص للبريد والقائمة. خالص ومختبَر.
import {
  AREAS,
  AUDIENCES,
  BUSINESS_TYPES,
  CHANNELS,
  DEAL_TYPES,
  DOMAIN_STATES,
  FEATURES,
  GOALS,
  LANGUAGES,
  LOGO_IDEAS,
  LOGO_STYLES,
  MEDIA_STATES,
  PALETTES,
  PROPERTY_TYPES,
  SERVICES,
  STYLES,
  TEAM_SIZES,
  TIMELINES,
  labelOf,
  labelsOf,
  scaleQuestion,
  type BriefData,
} from "@/briefs/realestate";

export type BriefMeta = { id: string; ref: string; createdAt: string | Date; isTest?: boolean };

const join = (a: string[], fallback = "—") => (a.length ? a.join("، ") : fallback);
const quote = (s: string) => s.trim().split("\n").map((l) => `> ${l}`).join("\n");
const cairoDate = (d: string | Date) =>
  new Date(d).toLocaleString("ar-EG", { timeZone: "Africa/Cairo", dateStyle: "long", timeStyle: "short", numberingSystem: "latn" });

export function businessTypeLabel(d: Pick<BriefData, "businessType" | "businessTypeOther">): string {
  return d.businessType === "other" && d.businessTypeOther ? `${labelOf(BUSINESS_TYPES, "other")}: ${d.businessTypeOther}` : labelOf(BUSINESS_TYPES, d.businessType);
}

export function areasLabel(d: Pick<BriefData, "areas" | "areasOther">): string {
  return join([...labelsOf(AREAS, d.areas), ...(d.areasOther ? [d.areasOther] : [])]);
}

export function colorsLabel(d: Pick<BriefData, "palette" | "primaryColor" | "accentColor" | "colorsNote">): string {
  if (d.palette === "custom") {
    const hex = d.primaryColor && d.accentColor ? `الأساسي ${d.primaryColor} · التمييز ${d.accentColor}` : "";
    return `ألوان العميل: ${[hex, d.colorsNote && `كتبها بنفسه: «${d.colorsNote}»`].filter(Boolean).join(" · ")}`;
  }
  const p = PALETTES.find((x) => x.id === d.palette);
  if (!p) return "—";
  return "colors" in p ? `${p.label} (${p.colors.join(" / ")})` : p.label;
}

/** وصف الشعار للبريف: مرفوع (برابطه) أو مطلوب تصميمه (بإجابات العميل) أو سيُرسل لاحقاً. */
export function logoLines(d: BriefData): string[] {
  if (d.logoMode === "have") return [`- الشعار: **مرفوع من العميل** ${d.logoUrl}`, `  (استخدموه كما هو، واستخرجوا منه الألوان إن لم يحددها)`];
  if (d.logoMode === "later") return [`- الشعار: لدى العميل شعار وسيرسله لاحقاً (استخدموا اسم النشاط نصاً مؤقتاً)`];
  return [
    `- الشعار: **العميل يطلب تصميم شعار له**`,
    `  - الاسم داخل الشعار: ${d.logoName || d.businessName}`,
    `  - الشكل: ${labelOf(LOGO_STYLES, d.logoStyle)}`,
    `  - أفكار الرمز: ${join(labelsOf(LOGO_IDEAS, d.logoIdeas))}`,
    ...(d.logoNotes ? [`  - ملاحظاته: ${d.logoNotes}`] : []),
  ];
}

/** أسطر قصيرة للبريد وبطاقة القائمة. */
export function briefSummaryLines(d: BriefData): string[] {
  return [
    `النشاط: ${businessTypeLabel(d)} · الفريق: ${labelOf(TEAM_SIZES, d.teamSize)}`,
    `المناطق: ${areasLabel(d)}`,
    `الأهداف: ${join(labelsOf(GOALS, d.goals))}`,
    `اللغة: ${labelOf(LANGUAGES, d.languages)} · الإطلاق: ${labelOf(TIMELINES, d.timeline)}`,
    `التواصل: ${d.contactName} · ${d.whatsapp}${d.email ? ` · ${d.email}` : ""}`,
  ];
}

function featureLines(d: BriefData): string {
  const picked = new Set<string>(d.features);
  const groups = [
    ["الموقع", "site"],
    ["لوحة التحكم", "dashboard"],
  ] as const;
  return groups
    .map(([title, g]) => {
      const rows = FEATURES.filter((f) => f.group === g && picked.has(f.id)).map((f) => `- ${f.label}${"ai" in f && f.ai ? " (ذكاء اصطناعي)" : ""}`);
      return `### ${title}\n${rows.length ? rows.join("\n") : "- لم يُختر شيء بعينه (نقترح الأنسب)"}`;
    })
    .join("\n\n");
}

/** البريف كاملاً بإجابات العميل كما هي (Markdown). */
export function renderBriefMarkdown(d: BriefData, m: BriefMeta): string {
  const scale = scaleQuestion(d.businessType);
  const offer =
    d.businessType === "construction"
      ? `- الخدمات: ${join(labelsOf(SERVICES, d.services))}`
      : `- المعاملات: ${join(labelsOf(DEAL_TYPES, d.dealTypes))}`;
  return [
    `# بريف موقع عقاري: ${d.businessName}`,
    ``,
    `- رقم الاستمارة: ${m.ref}${m.isTest ? " (تجريبية)" : ""}`,
    `- التاريخ: ${cairoDate(m.createdAt)}`,
    ``,
    `## العميل`,
    `- الاسم: ${d.contactName}`,
    `- واتساب: ${d.whatsapp}`,
    `- البريد: ${d.email || "—"}`,
    `- موعد الإطلاق المطلوب: ${labelOf(TIMELINES, d.timeline)}`,
    ``,
    `## النشاط`,
    `- الاسم الظاهر في الموقع: ${d.businessName}`,
    `- النوع: ${businessTypeLabel(d)}`,
    `- حجم الفريق: ${labelOf(TEAM_SIZES, d.teamSize)}`,
    `- أنواع العقارات: ${join(labelsOf(PROPERTY_TYPES, d.propertyTypes))}`,
    offer,
    `- ${scale.title.replace(/؟$/, "")}: ${labelOf(scale.options, d.scale)}`,
    ``,
    `## السوق والجمهور`,
    `- المناطق: ${areasLabel(d)}`,
    `- العملاء: ${join(labelsOf(AUDIENCES, d.audience))}`,
    `- لغة الموقع: ${labelOf(LANGUAGES, d.languages)}`,
    `- مصادر العملاء الحالية: ${join(labelsOf(CHANNELS, d.channels))}`,
    ``,
    `## الأهداف (حتى 3)`,
    ...labelsOf(GOALS, d.goals).map((g, i) => `${i + 1}. ${g}`),
    ...(d.problem ? [``, `ما يرهقهم في العمل اليومي:`, quote(d.problem)] : []),
    ``,
    `## المميزات التي اختاروها`,
    featureLines(d),
    ``,
    `## الهوية والشكل`,
    ...logoLines(d),
    `- الألوان: ${colorsLabel(d)}`,
    `- الطابع: ${labelOf(STYLES, d.style)}`,
    `- مواقع تعجبهم أو صفحاتهم: ${d.inspiration || "—"}`,
    ``,
    `## الإطلاق`,
    `- النطاق: ${d.domain === "have" ? d.domainName : labelOf(DOMAIN_STATES, d.domain)}`,
    `- صور العقارات وفيديوهاتها: ${labelOf(MEDIA_STATES, d.media)}`,
    ...(d.notes ? [``, `ملاحظات العميل:`, quote(d.notes)] : []),
  ].join("\n");
}

/**
 * برومبت البناء: البريف + تعليمات مشروع العميل الثابتة (الموقع + الإعداد الأول + لوحة التحكم، والتقنيات، وقاعدتا البيانات).
 * يُلصق كما هو في جلسة Claude Code على ريبو ulghx.
 */
export function renderBuildPrompt(d: BriefData, m: BriefMeta): string {
  const bilingual = d.languages !== "ar";
  return [
    `ابنِ لهذا العميل مشروعه الكامل في ريبو ulghx (مشروع مستقل خاص به)، بأعلى جودة ممكنة، وفق البريف ثم التعليمات الثابتة أدناه.`,
    ``,
    renderBriefMarkdown(d, m),
    ``,
    `---`,
    ``,
    `# التعليمات الثابتة لمشاريع العقارات`,
    ``,
    `## ما يُسلَّم (ثلاثة أجزاء بجودة فائقة)`,
    `1. **الموقع العام**: سريع جداً (LCP أقل من 2 ثانية على الهاتف، Lighthouse 95+ في كل البنود)، عربي أولاً RTL${bilingual ? " مع الإنجليزية (مسارات /ar و/en، وhreflang، وتبديل لغة يحفظ الصفحة نفسها)" : ""}، متجاوب تماماً (375 / 768 / 1024 / 1440)، وفاتح وداكن.`,
    `2. **الإعداد الأول (Onboarding Setup)**: أول فتح للموقع بعد التسليم يقود صاحبه خطوة خطوة ليملأ كل بيانات التشغيل: الشعار (واستخراج الألوان منه عند الحاجة)، روابط التواصل، رقم واتساب الموقع، العنوان والفروع وساعات العمل، طريقة استقبال طلبات العملاء (زر واتساب برسالة جاهزة فيها العقار، أو نموذج يصل إلى لوحة التحكم، أو الاثنان)، إضافة أول العقارات (رفع صور + ملاحظات قصيرة ويكتب الذكاء الاصطناعي الوصف والعنوان والمواصفات، واستيراد Excel/CSV)، حساب المدير وكلمة المرور، ثم معاينة وإطلاق. يحفظ التقدم ويُستأنف، وكل خطوة لها «تخطَّ الآن».`,
    `3. **لوحة التحكم**: كل ما اختاره العميل في المميزات أعلاه كاملاً بواجهة وخلفية، إضافة إلى الأساسيات دائماً: العقارات (إضافة/تعديل/نسخ/أرشفة، حالة متاح ومحجوز ومباع، ترتيب الصور بالسحب، فيديو)، العملاء المحتملون وصندوق واحد للطلبات، الإعدادات، المستخدمون والصلاحيات، والإحصاءات. عربية أولاً، وأوضاع فاتح وداكن، وتعمل ممتاز على الهاتف.`,
    ``,
    `## التقنيات`,
    `- Next.js (App Router) للواجهة والخادم، TypeScript صارم، Tailwind.`,
    `- الرفع والتشغيل على Cloudflare Workers عبر OpenNext (\`wrangler.jsonc\`)، ولا اعتماد على Node APIs غير المدعومة هناك.`,
    `- Neon Postgres عبر Drizzle (migrations حقيقية قابلة لإعادة الإنتاج، لا push).`,
    `- الذكاء الاصطناعي عبر Groq (مفتاح في متغير بيئة، مهلة وإعادة محاولة وتسجيل الاستهلاك، ولا يتوقف الموقع إن تعذر).`,
    `- الصور عبر UploadThing مع ضغط في المتصفح قبل الرفع وصيغ حديثة (AVIF/WebP) وأحجام متجاوبة.`,
    `- الفيديو: ملف MP4 مضغوط (H.264 + faststart، ونسخة أخف للهاتف) مع صورة غلاف تظهر فوراً، وتحميل متأخر بعد ظهور الصفحة، ولا يُحمَّل مع توفير البيانات أو الاتصال البطيء أو تقليل الحركة.`,
    ``,
    `## الشعار`,
    d.logoMode === "have"
      ? `- العميل رفع شعاره (الرابط في البريف). ضعه في الهيدر والفوتر وصورة المشاركة والأيقونة، واستخرج منه لوناً أساسياً ولون تمييز إن لم يحدد ألواناً، وأتح استبداله من الإعداد الأول.`
      : d.logoMode === "design"
        ? `- صمم شعاراً احترافياً بصيغة SVG نظيفة (نسخة فاتحة وداكنة) وفق إجابات العميل في البريف، واجعله جزءاً من الهوية في الموقع، وأتح رفع شعار بديل من الإعداد الأول. قدّم للعميل في اجتماع التسليم خيارين على الأقل.`
        : `- لدى العميل شعار سيرسله لاحقاً: استخدم اسم النشاط نصاً مصمماً مؤقتاً، وضع خطوة «رفع الشعار» بارزة في الإعداد الأول.`,
    ``,
    `## قاعدتا البيانات (إلزامي، بلا أي خطأ عند حذف التجريبية)`,
    `- متغيران: \`DATABASE_URL\` (قاعدتنا التجريبية قبل التسليم) و\`CLIENT_DATABASE_URL\` (قاعدة العميل، يضيفها في Cloudflare أثناء اجتماع التسليم).`,
    `- قبل وجود \`CLIENT_DATABASE_URL\`: كل القراءة والكتابة في التجريبية.`,
    `- عند إضافته: صفحة «نقل البيانات» في لوحة التحكم بزر واحد: تطبّق الـ migrations على قاعدة العميل، وتنسخ كل الجداول بالترتيب (مع الصور كروابط كما هي)، وتطابق الأعداد جدولاً جدولاً، ثم تكتب علامة «القاعدة النشطة» داخل قاعدة العميل نفسها. النقل قابل للاستئناف ولا يكتب نصف بيانات.`,
    `- بعد النقل: كل قراءة وكتابة من قاعدة العميل وحدها. اختيار القاعدة لا يحتاج قراءة التجريبية أبداً (يُقرر من وجود \`CLIENT_DATABASE_URL\` وعلامة النقل داخل قاعدة العميل)، فحذف القاعدة التجريبية أو حذف \`DATABASE_URL\` بعدها لا يسبب أي خطأ. اختبر هذا السيناريو صراحة.`,
    ``,
    `## الجودة`,
    `- تصميم فاخر يليق بالعقارات: صور كبيرة وواضحة، طباعة عربية ممتازة (Cairo/IBM Plex Sans Arabic أو ما يناسب الطابع)، حركة هادئة تحترم تقليل الحركة.`,
    `- SEO كامل: عنوان ووصف لكل عقار ومشروع ومنطقة، JSON-LD (RealEstateAgent/Organization وRealEstateListing/Offer وBreadcrumb)، خريطة موقع، Open Graph بصورة العقار، روابط مقروءة.`,
    `- إمكانية وصول WCAG 2.1 AA، ولا تمرير أفقي على أي شاشة.`,
    `- كل نص يخاطب الجميع (بصيغة الجمع)، ولا يُعرض في الموقع ادعاء أو رقم غير حقيقي.`,
    `- لا مفاتيح حقيقية في أي ملف مرفوع؛ \`.env.example\` بقيم وهمية وشرح لكل متغير.`,
    `- بيانات عرض واقعية في القاعدة التجريبية حتى يرى العميل الموقع حياً في الاجتماع، تُستبدل ببياناته في الإعداد الأول.`,
  ].join("\n");
}

/** رسالة أولى للعميل على واتساب بعد وصول الاستمارة. */
export function clientWhatsappMessage(d: Pick<BriefData, "contactName" | "businessName">, ref: string): string {
  return [
    `أهلاً ${d.contactName}،`,
    `معكم فريق Colapia. وصلتنا استمارة موقع «${d.businessName}» (رقم ${ref})، وشكراً لوقتكم.`,
    `بدأنا التجهيز، ونحدد معكم موعد اجتماع قصير لتسليم الموقع وتشغيله خلال 48 ساعة. أي وقت يناسبكم؟`,
  ].join("\n");
}
