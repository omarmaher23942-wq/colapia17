# 🌌 Colapia | The Master Architecture & Operations Codex
**الإصدار:** 1.0.0 (Production Ready)
**تاريخ التوثيق:** الإصدار النهائي المستقر.
**الهدف:** توثيق شامل، عميق، ومفصل لكل ذرة في منصة Colapia لضمان استمرارية العمل، الصيانة، والتطوير المستقبلي حتى في حال غياب الفريق المؤسس.

---

## 📑 الفهرس الشامل
1. [الفلسفة ونموذج العمل (Business Logic & Philosophy)](#1-الفلسفة-ونموذج-العمل)
2. [المعمارية التقنية العليا (High-Level Architecture)](#2-المعمارية-التقنية-العليا)
3. [هيكلة قواعد البيانات (Database Schema Deep Dive)](#3-هيكلة-قواعد-البيانات)
4. [دورة حياة التاجر والذكاء الاصطناعي (AI & Merchant Lifecycle)](#4-دورة-حياة-التاجر-والذكاء-الاصطناعي)
5. [محرك التجارة الإلكترونية (The E-Commerce Engine)](#5-محرك-التجارة-الإلكترونية)
6. [لوحة تحكم التاجر (Merchant Dashboard - Cosmic UI)](#6-لوحة-تحكم-التاجر)
7. [مركز قيادة المنصة (Platform Admin Command Center)](#7-مركز-قيادة-المنصة)
8. [البنية التحتية للوقت الفعلي (Real-time Infrastructure - Pusher)](#8-البنية-التحتية-للوقت-الفعلي)
9. [الأمان، الحماية، والعمليات المالية (Security & FinOps)](#9-الأمان-والحماية)
10. [دليل الملفات الشامل (Directory Structure Reference)](#10-دليل-الملفات-الشامل)
11. [دليل التشغيل والطوارئ (Runbook & Disaster Recovery)](#11-دليل-التشغيل-والطوارئ)

---

## 1. الفلسفة ونموذج العمل (Business Logic & Philosophy)

### 1.1. المشكلة والحل
يعاني التاجر المصري والعربي من تعقيد منصات التجارة الإلكترونية (مثل Shopify) التي تتطلب اشتراكات شهرية بالدولار، عمولات على المبيعات، وخبرة تقنية لضبط بوابات الدفع والشحن.
**الحل (Colapia):** منصة تبني المتجر بالكامل باستخدام الذكاء الاصطناعي في 5 دقائق، مجهزة مسبقاً للسوق المصري (الدفع عند الاستلام، فودافون كاش، إنستاباي)، وتُباع كـ **منتج يُدفع لمرة واحدة (Lifetime Deal)**.

### 1.2. استراتيجية التسعير (The 899 EGP Offer)
- **السعر المرجعي (Anchor):** 8,999 ج.م.
- **سعر الإطلاق:** 899 ج.م (خصم 90% لأول 30 تاجراً).
- **الشرط (Viral Loop):** لا يحصل التاجر على الخصم إلا بعد تجربة المتجر (180 دقيقة) وتسجيل تقييم صوتي/نصي للمنصة. هذا يولد Social Proof هائل يُستخدم في الإعلانات لجلب تجار جدد.
- **الاستدامة (FinOps):** لضمان ربحية المنصة من دفعة الـ 899 ج.م، **تم إزالة أي استهلاك مستمر للذكاء الاصطناعي (AI) من واجهات المتاجر (Storefronts)**. الـ AI يُستخدم فقط *مرة واحدة* أثناء بناء المتجر (Onboarding) وفي لوحة تحكم التاجر (توليد أوصاف، تحسين SEO)، ولا يُسمح للمشترين النهائيين باستهلاك توكنز المنصة.

---

## 2. المعمارية التقنية العليا (High-Level Architecture)

تم بناء Colapia لتكون منصة Serverless بالكامل، قادرة على التوسع اللانهائي (Infinite Scale) بأقل تكلفة تشغيلية ممكنة.

### 2.1. التقنيات الأساسية (Tech Stack)
- **الإطار (Framework):** Next.js 15 (App Router) مع React 19.
- **قاعدة البيانات:** Neon Serverless Postgres (تتوسع تلقائياً وتنام عند عدم الاستخدام).
- **الـ ORM:** Drizzle ORM (أسرع وأخف من Prisma، ويدعم الـ Edge).
- **الـ Caching & Rate Limiting:** Upstash Redis.
- **إدارة المهام الخلفية (Background Jobs):** Upstash QStash & Upstash Workflow.
- **الوقت الفعلي (Real-time):** Pusher (WebSockets).
- **تخزين الملفات:** UploadThing.
- **البريد الإلكتروني:** Resend.
- **الذكاء الاصطناعي:** Vercel AI SDK (يدعم Gemini 2.0 Flash, Groq Llama 3, Claude 3.5).
- **التصميم والواجهات:** Tailwind CSS v4, Framer Motion, Radix UI, Lucide Icons.

### 2.2. معمارية الـ Multi-tenancy (عزل المتاجر)
تستخدم المنصة تطبيق Next.js واحداً يخدم آلاف المتاجر عبر الـ Subdomains.
- **الـ Middleware (`src/middleware.ts`):** يعترض كل طلب، يقرأ الـ `Host` header، يستخرج الـ subdomain، ويعيد كتابة المسار (Rewrite) إلى `/s/[store]/...`. كما يقوم بحقن `x-req-id` لتتبع الأخطاء.
- **الـ Tenant Resolver (`src/lib/tenant.ts`):** يقرأ الـ subdomain، يجلب بيانات المتجر من Redis (كاش 60 ثانية) أو من Postgres، ويتأكد من حالة المتجر (نشط، مجمد، قيد المراجعة).
- **الـ Config-as-Data (Blueprint):** كل متجر لا يمتلك كوداً خاصاً به. بدلاً من ذلك، يمتلك كائن JSON ضخم يسمى `StoreBlueprint` يحتوي على الألوان، الخطوط، الأقسام، والسياسات. يقوم `src/blueprint/registry.tsx` بتحويل هذا الـ JSON إلى مكونات React حية.

---

## 3. هيكلة قواعد البيانات (Database Schema Deep Dive)

تم تصميم الجداول في `src/db/schema/` لتكون Relational و JSONB Hybrid، مما يجمع بين صرامة الـ SQL ومرونة الـ NoSQL.

### 3.1. جداول المنصة (Platform) - `platform.ts`
- **`platform_users`**: مديري المنصة (الأونر والمراجعين).
- **`merchants`**: التجار. يتم تسجيلهم عبر Google OAuth. يحتوي على `is_activated` و `last_login_at`.
- **`sessions`**: إدارة الجلسات (بديل لـ NextAuth). يربط `tokenHash` بـ `subjectType` (تاجر، عميل، منصة).
- **`platform_reviews`**: التقييمات التي يتركها التجار للمنصة للحصول على الخصم.

### 3.2. جداول المتاجر (Stores) - `stores.ts`
- **`stores`**: الجدول المركزي. يربط التاجر بالـ subdomain. يحتوي على تواريخ دورة الحياة: `demo_started_at`, `demo_expires_at`, `trial_ends_at`, `doom_at`.
- **`store_blueprints`**: يحتوي على حقل `data` (JSONB) الذي يمثل تصميم وإعدادات المتجر بالكامل.
- **`store_snapshots`**: نسخ احتياطية من الـ Blueprint تُؤخذ عند كل تعديل كبير، مما يسمح بالـ Rollback الفوري.

### 3.3. جداول الكتالوج (Catalog) - `catalog.ts`
- **`categories`**: أقسام المتجر.
- **`products`**: المنتجات. يحتوي على `price_piasters` (الأسعار دائماً بالقروش لتجنب أخطاء الفاصلة العائمة)، `stock`، و `images` (JSONB).
- **`product_variants`**: خيارات المنتج (ألوان، مقاسات). يرتبط بـ `option_names` في جدول المنتجات.

### 3.4. جداول التجارة (Commerce) - `commerce.ts`
- **`customers`**: المشترين النهائيين. يتم تتبع `orders_count` و `total_spent_piasters` لحساب الـ LTV.
- **`orders`**: الطلبات. يحتوي على `idempotency_key` لمنع تكرار الطلب، وحقول دمج إيصال الدفع `transfer_screenshot_url`.
- **`order_items`**: تفاصيل المنتجات داخل الطلب.
- **`payments`**: إيصالات الدفع المرفوعة من العملاء للتاجر (فودافون كاش/إنستاباي).
- **`platform_payments`**: إيصالات الدفع المرفوعة من التاجر للمنصة (الـ 899 ج.م).
- **`abandoned_carts`**: السلات المتروكة. تُسجل تلقائياً بمجرد إدخال العميل لرقم هاتفه.
- **`discounts` & `shipping_zones`**: أكواد الخصم ومناطق الشحن (27 محافظة مصرية).

### 3.5. جداول الذكاء الاصطناعي ودورة الحياة (AI & Lifecycle) - `ai.ts`, `lifecycle.ts`, `ops.ts`
- **`conversations` & `messages`**: سجل محادثات التاجر مع بوت الاستقبال (Closer Agent).
- **`intakes`**: البيانات المستخرجة من المحادثة (Brief, Products, Policies).
- **`build_jobs`**: مهام بناء المتجر عبر Upstash Workflow.
- **`scheduled_jobs`**: المهام المجدولة (تذكيرات، تجميد، حذف) تُدار عبر QStash.
- **`system_events`**: سجل الـ Audit Trail لكل حركة في المنصة (للمراقبة واكتشاف الأخطاء).

---

## 4. دورة حياة التاجر والذكاء الاصطناعي (AI & Merchant Lifecycle)

رحلة التاجر مؤتمتة بالكامل من أول رسالة حتى استلام المتجر.

### 4.1. الاستقبال (The Closer Agent)
1. يرسل التاجر رسالة لصفحة فيسبوك/إنستجرام.
2. يستقبل `api/webhooks/meta/route.ts` الرسالة، يتحقق من التوقيع، ويرسلها لـ QStash لمنع الـ Timeout.
3. يقوم `agents/inbound/route.ts` بتجميع الرسائل (Debounce 4 ثوانٍ) لمنع تداخل الردود.
4. يرد الـ `Closer Agent` (باستخدام Gemini/Groq) بأسلوب مصري ودود، ويقنعه ببدء الاستمارة، ثم يرسل له `Magic Link`.

### 4.2. الاستمارة الذكية (Onboarding Revolution)
1. يفتح التاجر الرابط `onboarding/[token]`.
2. يمر بـ 5 خطوات: بيانات المتجر، الجمهور والمنافسين، المنتجات (مع إمكانية الاستيراد من مكتبة جاهزة `products-library.ts`)، الشحن والدفع، والمراجعة.
3. يتم حفظ التقدم تلقائياً (Autosave) كل 800ms في `onboarding_sessions`.
4. عند الإرسال، يتم حساب درجة "ثراء البيانات" (Richness Score).

### 4.3. خط إنتاج الذكاء الاصطناعي (The Build Workflow)
يعمل عبر `api/workflows/build/route.ts` (Upstash Workflow) لضمان عدم فشل العملية حتى لو استغرقت دقائق:
1. **Architect:** يضع خطة المتجر (الأقسام، الـ SEO، الـ Tone of voice).
2. **Products Copy:** يكتب أوصافاً تسويقية جذابة لكل منتج ويستخرج المواصفات الفنية.
3. **Catalog Write:** يحفظ المنتجات والأقسام في قاعدة البيانات.
4. **Theme Composer:** يولد لوحة ألوان (Palette) متناسقة تضمن تباين WCAG AAA، ويختار الخطوط.
5. **Home & Pages Composer:** يبني أقسام الصفحة الرئيسية وصفحات السياسات (الشحن، الاسترجاع، الخصوصية).
6. **Assemble & QA:** يجمع الـ Blueprint، ويفحصه برمجياً (Local QA) للتأكد من عدم وجود تكرار أو أخطاء.
7. **Deliver:** يحول حالة المتجر إلى `review` أو `trial` ويرسل إيميل للتاجر.

---

## 5. محرك التجارة الإلكترونية (The E-Commerce Engine)

تم تصميم واجهة المتجر (`src/app/s/[store]`) لتكون فائقة السرعة ومحسنة للتحويل (CRO).

### 5.1. إدارة السلة (Zustand Cart)
- `src/store/cart.ts`: يستخدم Zustand مع `localStorage`.
- **العزل (Isolation):** يتم حفظ السلة بمفتاح `clp-cart:{storeId}` لضمان عدم ظهور منتجات متجر "أ" للعميل إذا زار متجر "ب".

### 5.2. إتمام الطلب (Checkout Flow)
- صفحة واحدة (One-page checkout) مقسمة لـ 3 خطوات مرئية.
- **حساب الشحن والخصم:** يتم عبر Server Action `quoteAction` مع Debouncing لتجنب إرهاق السيرفر.
- **منع الشراء بالسالب:** يتم خصم المخزون باستخدام استعلام SQL ذري (Atomic Update) مع شرط `WHERE stock >= quantity`.
- **الـ Idempotency:** يتم توليد `idempotency_key` لكل جلسة دفع وحفظه في Redis و Postgres لمنع العميل من عمل نفس الطلب مرتين إذا ضغط الزر مرتين.

### 5.3. الدفع الإلكتروني (Vodafone Cash & InstaPay)
- يختار العميل وسيلة الدفع، ويُطلب منه رفع صورة الإيصال (Screenshot).
- يتم دمج رابط الصورة مع الطلب في قاعدة البيانات.
- يظهر الطلب للتاجر في لوحة التحكم بحالة `under_review` ليقوم بتأكيده أو رفضه.

### 5.4. أدوات رفع التحويل (Conversion Boosters)
- **صائد السلات (Abandoned Cart):** بمجرد كتابة العميل لرقم هاتفه، يُحفظ في `abandoned_carts`. يمكن للتاجر مراسلته بضغطة زر عبر `wa.me`.
- **إشعارات الشراء الحية (Social Proof Toasts):** تظهر للزوار إشعارات "أوردر جديد من الإسكندرية" بناءً على طلبات حقيقية من `api/proof`.
- **نافذة الخروج (Exit Intent):** تظهر عند محاولة العميل مغادرة الموقع لتعطيه كود خصم.
- **الشراء السريع (Direct Express Buy):** زر يفتح نافذة منبثقة لإتمام الطلب فوراً (لطلبات الدفع عند الاستلام).

---

## 6. لوحة تحكم التاجر (Merchant Dashboard - Cosmic UI)

لوحة تحكم حديثة (Dark Mode) مبنية بـ Tailwind v4 و Framer Motion.

### 6.1. الميزات الأساسية
- **نظرة عامة (Overview):** تعرض صافي الأرباح الحقيقية (المبيعات ناقص التكلفة)، والـ KPIs.
- **إدارة الطلبات (Orders):** عرض القائمة (List) أو الكانبان (Kanban). دعم الإجراءات الجماعية (تأكيد، شحن، طباعة فواتير PDF).
- **المنتجات (Products):** إدارة المخزون، المتغيرات (Variants)، استيراد من CSV، وتحسين الـ SEO جماعياً بالذكاء الاصطناعي.
- **العملاء (Customers):** تقسيم تلقائي (VIP، جديد، معرض للفقدان، مفقود).
- **التحليلات (Analytics):** قمع التحويل (Funnel)، الخريطة الحرارية (GeoHeatmap)، ومصفوفة الاحتفاظ (Cohort Matrix).
- **محرر التصميم (Studio Editor):** محرر مرئي يعدل الـ Blueprint مباشرة مع معاينة حية (Live Preview iframe).

### 6.2. تجربة المستخدم (UX)
- **Command Palette (⌘K):** للتنقل السريع بين الصفحات وتنفيذ الإجراءات.
- **Sticky Save Bar:** يظهر أسفل الشاشة عند وجود تغييرات غير محفوظة (يدعم ⌘S).
- **Real-time Notifications:** إشعارات حية بالطلبات الجديدة مع تنبيه صوتي (Web Audio API).

---

## 7. مركز قيادة المنصة (Platform Admin Command Center)

لوحة تحكم خاصة بمالك المنصة (`/admin`) لإدارة آلاف المتاجر.

### 7.1. الصلاحيات والأمان
- الدخول حصري عبر Google OAuth للمستخدمين المسجلين مسبقاً في جدول `platform_users` بحالة `is_active = true`.
- لا توجد كلمات مرور قابلة للاختراق.

### 7.2. أدوات الحوكمة (Governance)
- **خط الإنتاج (Pipeline):** لوحة كانبان لمتابعة المتاجر (قيد المراجعة، قيد البناء، تجربة، مفعّل).
- **تدقيق التحويلات (Payments Review):** مراجعة إيصالات الـ 899 ج.م المرفوعة من التجار. يقوم الـ AI (Gemini Vision) بقراءة الإيصال ومطابقة الرقم والمبلغ وإعطاء نسبة ثقة (Confidence Score).
- **فاحص النسخ (Snapshot Deep-Diff):** مقارنة التعديلات التي أجراها التاجر على المتجر مع النسخ السابقة، مع إمكانية التراجع (Rollback) بضغطة زر.
- **إدارة المزايا (Feature Flags):** تفعيل/تعطيل ميزات المنصة (مثل البوت، التجربة المجانية) لحظياً بدون إعادة نشر (No Deploy).

---

## 8. البنية التحتية للوقت الفعلي (Real-time Infrastructure - Pusher)

تم استبدال الـ Polling المزعج بـ WebSockets عبر Pusher.

- **الخوادم (`src/lib/pusher-server.ts`):** دالة `publishEvent` تنشر الأحداث بأمان (Fire-and-forget).
- **العملاء (`src/lib/pusher-client.ts`):** Singleton يدير الاتصالات ويمنع تسرب الذاكرة.
- **الأحداث (`src/server/realtime/events.ts`):** عقد (Contract) صارم يحدد 15 حدثاً (مثل `order:created`, `payment:submitted`, `build:progress`) مع الـ Payloads الخاصة بها.
- **المصادقة (`api/pusher/auth/route.ts`):** يضمن أن التاجر لا يستمع إلا لأحداث متجره، والمشتري لا يستمع إلا لأحداث طلبه.

---

## 9. الأمان، الحماية، والعمليات المالية (Security & FinOps)

### 9.1. الأمان (Security)
- **Rate Limiting:** مطبق عبر Upstash Redis على مسارات الـ Checkout، البحث، تسجيل الدخول، والـ Webhooks لمنع هجمات الـ DDoS والـ Brute-force.
- **Content Security Policy (CSP):** مطبق في `next.config.ts` لمنع الـ XSS والسماح فقط بالنطاقات الموثوقة (UploadThing, Google, Meta).
- **Zero Emojis:** منع استخدام الإيموجي في الواجهات ومخرجات الـ AI لتجنب مشاكل الترميز في قواعد البيانات والـ PDF، واستبدالها بأيقونات `lucide-react`.

### 9.2. العمليات المالية (FinOps)
- **الأسعار بالقروش:** كل المبالغ المالية في قاعدة البيانات تُخزن كـ Integer (قروش) وتُحول للعرض فقط عبر `lib/money.ts` لمنع أخطاء التقريب.
- **مراقبة التكاليف:** صفحة `/admin/costs` تعرض استهلاك التوكنز لكل مزود AI (Morpheus, Groq, Gemini) والتكلفة التقديرية بالدولار.

---

## 10. دليل الملفات الشامل (Directory Structure Reference)

إليك خريطة تفصيلية لكل ملف في المشروع ووظيفته:

### 📁 `docs/`
ملفات التوثيق وأدلة التشغيل.
- `00-overview.md` إلى `10-master-runbook.md`: أدلة إعداد المنصة، النشر، المعمارية، ومراجعة ميتا.
- `PRODUCTION-CHECKLIST.md`: قائمة الفحص قبل الإطلاق.

### 📁 `drizzle/`
ملفات التهجير (Migrations) لقاعدة بيانات Postgres.

### 📁 `public/`
- `sounds/order.mp3`: صوت التنبيه للطلبات الجديدة.
- `logo.png`: شعار المنصة.

### 📁 `scripts/`
- `backup-db.ts`: سكربت أخذ نسخة احتياطية من قاعدة البيانات.
- `clean-db.ts`: سكربت تصفير الجداول (مسح البيانات الوهمية) قبل الإطلاق.
- `seed.ts`: حقن بيانات تجريبية.

### 📁 `src/ai/`
عقل المنصة.
- `agents/`: وكلاء المحادثة (Closer Agent لاستقبال التجار).
- `build/`: خط إنتاج المتاجر (`composer.ts` يحتوي على دوال الـ Architect والـ Theme والـ QA).
- `lifecycle/`: دوال تسليم المتجر وإرسال الإشعارات.
- `prompts.ts` & `prompts.defaults.ts`: الأوامر الموجهة للنماذج اللغوية.
- `providers.ts`: إعداد مزودي الـ AI (Groq, Gemini, Morpheus) مع نظام Fallback.
- `verify-payment.ts`: فحص إيصالات الدفع باستخدام Gemini Vision.

### 📁 `src/app/`
مسارات Next.js (App Router).
- **`(platform)/`**: النطاق الجذري (`colapia.com`).
  - `admin/`: مركز قيادة المنصة.
  - `dashboard/`: لوحة تحكم التاجر.
  - `onboarding/`: استمارة بناء المتجر.
  - `login/` & `signup/`: المصادقة.
  - `privacy/` & `terms/`: الصفحات القانونية.
- **`api/`**: مسارات الـ API (Webhooks, Track, UploadThing, Workflows).
- **`s/[store]/`**: واجهات المتاجر الفرعية (`*.colapia.com`).
  - `account/`: حساب المشتري.
  - `admin/`: إعادة توجيه للوحة التحكم.
  - `cart/` & `checkout/`: السلة والدفع.
  - `p/[slug]/` & `c/[slug]/`: صفحات المنتجات والأقسام.
  - `track/`: تتبع الطلبات.
- `middleware.ts`: توجيه النطاقات الفرعية وحماية المسارات.

### 📁 `src/blueprint/`
تعريف الـ Config-as-Data.
- `schema.ts`: تعريف Zod Schema الصارم للـ StoreBlueprint.
- `defaults.ts`: القيم الافتراضية للمتجر.
- `palette.ts`: محرك الألوان (يولد ألوان متناسقة بناءً على النص أو الصورة).
- `registry.tsx`: يربط بيانات الـ JSON بمكونات React الفعلية.

### 📁 `src/components/`
مكونات الواجهة (UI Components).
- `analytics/`: رسوم بيانية (Funnel, Heatmap, Cohort).
- `blocks/`: أقسام واجهة المتجر (Hero, ProductGrid, FAQ, etc.).
- `dashboard/`: مكونات لوحة تحكم التاجر (Tables, Forms, Charts).
- `growth/`: أدوات التسويق (Referral, Social Cards).
- `landing/`: مكونات صفحة هبوط المنصة.
- `platform/`: مكونات لوحة تحكم الأونر.
- `storefront/`: مكونات المتجر (Cart, Checkout, Product3DViewer, etc.).
- `support/`: صندوق الوارد الموحد.
- `ui/`: مكونات Radix UI الأساسية (Buttons, Dialogs, Inputs).

### 📁 `src/db/`
- `schema/`: تعريف جداول قاعدة البيانات (Drizzle ORM).
- `client.ts`: إعداد الاتصال بقاعدة Neon.

### 📁 `src/editor/`
محرر التصميم الحي.
- `Editable.tsx`: مكونات تسمح بتعديل النص والصور مباشرة في الـ iframe.
- `bridge.ts`: التواصل بين الداشبورد والـ iframe عبر `postMessage`.

### 📁 `src/lib/`
دوال مساعدة.
- `email-templates/`: قوالب البريد الإلكتروني (React Email).
- `arabic.ts`: تطبيع النصوص العربية والفرانكو للبحث.
- `egypt.ts`: بيانات المحافظات وأسعار الشحن الافتراضية.
- `money.ts`: تحويل القروش إلى جنيهات.
- `ratelimit.ts`: حماية المسارات.
- `redis.ts`: إعداد Upstash Redis.

### 📁 `src/lifecycle/`
إدارة المهام المجدولة (QStash).
- `machine.ts`: آلة الحالة (State Machine) لانتقالات المتجر (Trial -> Frozen -> Active).
- `scheduler.ts`: جدولة وإلغاء المهام.

### 📁 `src/onboarding/`
منطق استمارة البناء.
- `adaptive-questions.ts`: أسئلة متغيرة حسب مجال التاجر.
- `products-library.ts`: مكتبة المنتجات الجاهزة للاستيراد.

### 📁 `src/server/`
الـ Server Actions.
- `actions/`: يحتوي على كل العمليات (checkout, orders, products, auth, etc.).
- `repos/`: استعلامات قاعدة البيانات المعقدة (Analytics, Catalog).
- `auth.ts`: إدارة الجلسات والكوكيز.

---

## 11. دليل التشغيل والطوارئ (Runbook & Disaster Recovery)

### 11.1. النشر (Deployment)
- يتم النشر على Vercel.
- يجب التأكد من إضافة جميع متغيرات البيئة الموجودة في `.env.example`.
- يجب تفعيل Wildcard Domain `*.colapia.com` في إعدادات Vercel DNS.

### 11.2. أوامر التشغيل اليومية
```bash
# تشغيل بيئة التطوير
npm run dev

# تحديث قاعدة البيانات بعد أي تعديل في schema.ts
npm run db:generate
npm run db:push

# فحص الأخطاء البرمجية (يجب أن يمر بصفر أخطاء قبل النشر)
npm run typecheck
npm run build