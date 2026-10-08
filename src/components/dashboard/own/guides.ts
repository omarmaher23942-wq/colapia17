// guides.ts — أدلة "امتلك متجرك" خطوة بخطوة، مكتوبة للموبايل أولاً.
// videoUrl: رابط فيديو الشرح (YouTube embed) يُضاف عند تجهيزه؛ حتى ذلك تكفي الخطوات المكتوبة.
export type Guide = {
  id: "github" | "vercel" | "neon" | "zip" | "uploadthing" | "groq";
  title: string;
  minutes: number;
  videoUrl: string | null;
  link?: { href: string; label: string };
  steps: string[];
  tip?: string;
};

export const GUIDES: Record<Guide["id"], Guide> = {
  github: {
    id: "github",
    title: "إنشاء حساب GitHub (لو ليس عندك)",
    minutes: 2,
    videoUrl: null,
    link: { href: "https://github.com/signup", label: "افتح GitHub" },
    steps: [
      "افتح github.com/signup من متصفح الموبايل (Chrome أو Safari)، لا من التطبيق.",
      "اكتب بريدك، ثم كلمة مرور، ثم اسم مستخدم بالإنجليزي (مثل اسم متجرك)، واضغط Continue.",
      "أكمل التحقق البسيط، ثم اكتب الكود الذي وصلك على بريدك.",
      "تخطَّ أسئلة الترحيب (Skip personalization) وارجع لهذه الصفحة.",
    ],
    tip: "GitHub هو المكان الذي يُحفظ فيه كود متجرك بأمان، كنسخة خاصة بك لا يراها غيرك.",
  },
  vercel: {
    id: "vercel",
    title: "نشر متجرك على Vercel",
    minutes: 4,
    videoUrl: null,
    link: { href: "https://vercel.com/new", label: "افتح Vercel" },
    steps: [
      "افتح vercel.com/signup واختر Continue with GitHub (نفس حساب GitHub)، ثم اختر الخطة Hobby المجانية.",
      "افتح vercel.com/new: ستجد مستودع متجرك في القائمة، اضغط Import بجانبه.",
      "لو المستودع غير ظاهر: اضغط Adjust GitHub App Permissions، اختر المستودع، ثم Save وارجع.",
      "اضغط Deploy كما هو بلا أي تغيير، وانتظر دقيقتين حتى تظهر رسالة Congratulations.",
      "انسخ رابط موقعك الذي ينتهي بـ ‎.vercel.app (ستحتاجه في الخطوة التالية).",
    ],
    tip: "Vercel يستضيف متجرك مجاناً على سيرفرات سريعة. يمكنك ربط نطاقك الخاص (‎.com) لاحقاً من Settings ثم Domains.",
  },
  neon: {
    id: "neon",
    title: "ربط قاعدة البيانات المجانية (Neon)",
    minutes: 3,
    videoUrl: null,
    steps: [
      "داخل مشروع متجرك على Vercel افتح تبويب Storage من الأعلى.",
      "اضغط Create Database، واختر Neon (Serverless Postgres)، ثم Continue.",
      "في نافذة Install Integration: اختر المنطقة Frankfurt (eu-central-1) لأنها الأقرب لمصر، والخطة Free، ثم Continue، ثم Create.",
      "ستظهر نافذة Connect a Project. في خانة Project تأكد أن اسم مشروع متجرك هو المختار.",
      "Environments: اترك Production وPreview وDevelopment كلها مُعلَّمة كما هي.",
      "Create database branch for deployment: اتركها بلا علامة.",
      "Custom Prefix: لا تغيّر شيئاً واتركه كما هو (STORAGE). متجرك يتعرف على القاعدة تلقائياً بأي اسم.",
      "اضغط Connect، وانتظر حتى تظهر القاعدة متصلة.",
      "افتح تبويب Deployments، ثم ⋯ بجوار آخر نشر، ثم Redeploy، وانتظر دقيقة حتى يكتمل.",
    ],
    tip: "قاعدة البيانات مكان منتجاتك وطلباتك وعملائك. هي ملكك أنت، ولا نصل إليها. لو ظهرت لك صفحة الإعداد تقول «القاعدة غير مربوطة» بعد ذلك، فغالباً نسيت خطوة Redeploy.",
  },
  uploadthing: {
    id: "uploadthing",
    title: "مفتاح UploadThing لصور متجرك",
    minutes: 2,
    videoUrl: null,
    link: { href: "https://uploadthing.com/dashboard", label: "افتح UploadThing" },
    steps: [
      "افتح uploadthing.com واضغط Get started، وادخل بحساب GitHub نفسه.",
      "اضغط Create a new app، اكتب اسم متجرك، واختر أقرب منطقة.",
      "افتح API Keys من قائمة التطبيق.",
      "انسخ قيمة UPLOADTHING_TOKEN بزر النسخ، والصقها في صفحة الإعداد بموقعك الجديد.",
    ],
  },
  groq: {
    id: "groq",
    title: "مفتاح Groq للذكاء الاصطناعي (اختياري)",
    minutes: 1,
    videoUrl: null,
    link: { href: "https://console.groq.com/keys", label: "افتح Groq" },
    steps: [
      "افتح console.groq.com وادخل بحساب Google.",
      "اضغط Create API Key واكتب أي اسم.",
      "انسخ المفتاح (يبدأ بـ gsk_) والصقه في «الربط والمفاتيح» داخل لوحة تحكم موقعك الجديد.",
    ],
    tip: "يشغّل المساعد «نوفا» وكاتب أوصاف المنتجات في لوحتك بلا حدود، مجاناً.",
  },
  zip: {
    id: "zip",
    title: "من الكمبيوتر: ملف ZIP بدل ربط GitHub",
    minutes: 6,
    videoUrl: null,
    link: { href: "https://desktop.github.com", label: "GitHub Desktop" },
    steps: [
      "حمّل ملف ZIP من الزر بالأعلى وفك ضغطه.",
      "ثبّت GitHub Desktop وادخل بحسابك.",
      "File ثم Add Local Repository، واختر مجلد المتجر، ثم create a repository.",
      "Publish repository مع تفعيل Keep this code private.",
      "أكمل من خطوة النشر على Vercel كالمعتاد.",
    ],
    tip: "ربط GitHub بزر واحد أسرع وأسهل، ويعمل من الموبايل. ملف ZIP للمحترفين أو لمن يريد نسخة على جهازه.",
  },
};
