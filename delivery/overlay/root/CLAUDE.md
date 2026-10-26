# CLAUDE.md — دليل التعديل على مشروع «{{STORE_NAME}}»

> هذا الملف تقرؤه أداة Claude Code قبل أي تعديل. اقرؤوه كاملاً. المشروع متجر إلكتروني + لوحة تحكم لعميل واحد، على Next.js 15 (App Router) ويُنشر على Cloudflare Workers عبر OpenNext. اللغة: عربية RTL.

## 1) المعمارية في دقيقة
- **مشروع واحد لمتجر واحد.** المعرّف الداخلي `STORE.slug` (في `src/store.config.ts`) لا يتغير أبداً: يربط الصفوف في القاعدة.
- **الزوار:** كل الطلبات غير المحجوزة يعيد `src/middleware.ts` كتابتها داخلياً إلى `src/app/s/[store]/…` (الرئيسية، المنتج، القسم، السلة، الدفع، تتبع الطلب…). لا تفتحوا `/s/…` مباشرة.
- **المالك:** `/login` (بريد + كلمة مرور) ← `/dashboard/*` (اللوحة) ← `/onboarding` (الإعداد الأول) ← `/setup` (مرة واحدة: ربط وقاعدة وحساب). كل صفحة لوحة تبدأ بـ `requireStoreArea(...)` وكل إجراء خادم يبدأ بـ `storeFor(...)` أو `ownerStore()` من `src/server/merchant-guard.ts`.
- **التصميم بيانات لا كود:** شكل المتجر كله مخزَّن كـ **Blueprint** (JSON موثَّق بـ Zod في `src/blueprint/schema.ts`) في جدول `store_blueprints`، ويُعرض عبر `src/blueprint/registry.tsx` (أقسام الصفحة الرئيسية) و`src/blueprint/design.ts` (CSS على خطافات ثابتة `.s-card .s-btn .s-title …`). البذرة الأولى في `store/blueprint.json`.
- **القاعدة:** Neon عبر `drizzle-orm/neon-http` (`src/db/client.ts`)، المخطط في `src/db/schema/*`. لا معاملات تفاعلية: التجميع الذري بـ `db.batch([...])`.
- **الصور:** تُرفع عبر `/api/upload` إلى ImageKit (`src/server/imagekit.ts`) وتُعرض بتحويلات الرابط (`src/lib/image-loader.ts`). **الفيديو:** MP4 واحد لواجهة المتجر في حاوية R2 بربط `MEDIA` ويُخدم من `/media/…`.
- **الذكاء الاصطناعي:** Groq بمفتاح العميل فقط (`src/ai/providers.ts`): قراءة صور المنتجات، الأوصاف، مساعد التصميم، البحث بالصورة. بلا مفتاح تتعطل هذه الميزات برسالة واضحة ويعمل الباقي.
- **بلا Redis ولا طوابير:** `src/lib/redis.ts` ذاكرة داخل العملية، و`src/lib/ratelimit.ts` حدود تقريبية. البريد (Resend) اختياري.
- **مجلد المتجر المخصص** `stores/{{SLUG}}/` (إن وُجد): أقسام/مكوّنات/ثيم خاصة بهذا المتجر، يسجَّل في `src/stores/registry.generated.ts` ويُقرأ عبر `@/stores-kit` فقط (لا تستوردوا من النواة داخله).

## 2) أين أغيّر ماذا
| المطلوب | الموضع |
|---|---|
| لون/خط/شكل البطاقات والأزرار | من اللوحة ← «شكل المتجر»، أو `bp.design`/`bp.theme` في `store/blueprint.json` للبذرة. CSS إضافي: `stores/{{SLUG}}/theme.css` (كل المحددات داخل `.storefront`) |
| نص أو ترتيب أقسام الرئيسية | اللوحة ← «المحتوى والصفحات»، أو `home[]` في البذرة |
| قسم جديد بتصميم خاص | `stores/{{SLUG}}/blocks/<name>.tsx` (مكوّن خادم، يستورد من `@/stores-kit` فقط) ثم قسم `store_block` في الـ Blueprint، وأعيدوا توليد السجل بتعديل `src/stores/registry.generated.ts` على نمط الموجود |
| استبدال قسم نواة (مثل `categories`) | `stores/{{SLUG}}/sections/<type>.tsx` |
| حقل جديد للمنتج | عمود في `src/db/schema/catalog.ts` ← `npm run db:generate` ← حقل في `src/server/actions/products.ts` (مخطط Zod) و`src/components/dashboard/product/ProductEditor.tsx` ← عرضه في `src/components/storefront/product/*` |
| سعر الشحن/المحافظات | اللوحة ← «أسعار الشحن» (جدول `shipping_zones`) |
| وسائل الدفع/التواصل/السياسات | اللوحة ← «إعدادات المتجر» و«السياسات والضمان» |
| نص زر أو رسالة | `src/blueprint/copy.ts` (`COPY_FALLBACK`) |
| قائمة اللوحة | `src/components/dashboard/nav.ts` (مصدر واحد للقائمة ولوحة الأوامر) |
| صفحة جديدة للوحة | `src/app/(platform)/dashboard/<name>/page.tsx` وتبدأ بـ `requireStoreArea("<مجال>")` |

## 3) رموز التصميم
ألوان وخطوط المتجر **متغيرات CSS** يكتبها `src/blueprint/design.ts` و`tokens.ts` من الـ Blueprint (`--background --foreground --primary --accent …`). لا ألوان ثابتة (hex) في المكوّنات: استخدموا الأصناف الدلالية (`bg-background text-foreground bg-primary`). اللوحة لها رموزها (`.dash`: `text-ink bg-space border-edge text-nova …`) وتدعم الفاتح والداكن. الخطوط في `src/lib/fonts.ts` (ثمانية خطوط عربية، التحميل لما يُستخدم فقط).

## 4) النشر على Cloudflare
- `npm run cf:build` يبني بـ OpenNext، و`npm run cf:deploy` يبني وينشر، و`npm run cf:preview` معاينة محلية في workerd. النشر التلقائي: كل دفع إلى `main` عبر Workers Builds (أو `.github/workflows/deploy.yml`).
- الأسرار والمتغيرات من Cloudflare (Variables and Secrets) لا من الملفات: انظروا `.env.example`. **لا ترفعوا مفتاحاً حقيقياً إلى Git أبداً.**
- ملف `wrangler.jsonc`: `keep_names: false` ضروري (يمنع `__name is not defined` في المتصفح). حاوية R2 اسمها `{{SLUG}}-media`.
- قاعدة البيانات: جدول جديد/عمود = `npm run db:generate` (يولّد SQL ويضمّنه تلقائياً) ثم افتحوا `/setup`… أو نفّذوا `npm run db:migrate` بـ `DATABASE_URL` محلياً. لا `db:push` على الإنتاج.

## 5) ما لا تلمسوه
`src/store.config.ts` (المعرّف `slug`)، `src/db/migrations.generated.ts` (مولَّد)، `drizzle/` يدوياً (تُولَّد بالأمر)، `src/middleware.ts` وبنية `src/app/s/[store]` (التوجيه)، `src/server/merchant-guard.ts` و`auth.ts` (الصلاحيات)، `keep_names` في wrangler. ولا تضيفوا مكتبات ثقيلة بلا سبب: حجم الحزمة على Workers محدود.

## 6) التحقق قبل أي دفع
```
npm run typecheck     # أنواع TypeScript، يجب 0 أخطاء
npm run build         # بناء Next بلا قاعدة بيانات
npm run cf:build      # بناء OpenNext (قبل النشر الكبير)
```
افتحوا الصفحات المتأثرة على 375px (موبايل) وسطح المكتب، فاتح وداكن.

## 7) قواعد الصدق واللغة
- كل نص للزائر أو المالك بعربية مهنية **تشمل الجميع**: بلا صيغة مؤنث أو مذكر حصرية («اختاروا/جرّبوا» بالجمع)، والأزرار مصادر («إضافة للسلة»، «تأكيد الطلب»)، وبلا عامية.
- لا تدّعوا في أي نص ما ليس موجوداً: لا أرقام مبيعات مخترعة، ولا آراء عملاء مصطنعة، ولا ضمانات لم يحددها المالك. لا تذكروا أسماء تقنيات للزائر.
- صور المنتجات والتقييمات والبيانات حقيقية فقط؛ البذور الافتراضية بلا محتوى وهمي.
- الوصول: تباين كافٍ، `aria-label` للأيقونات، أهداف لمس 44px، ولا اعتماد على اللون وحده.
- طلب تعديل من فريق التنفيذ: الرابط في أسفل اللوحة ({{AGENCY_URL}}) — رابط فقط، لا منطق.
