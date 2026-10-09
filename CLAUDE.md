# CLAUDE.md — السجل الحي لمشروع Colapia

> هذا الملف هو مصدر الحقيقة لاستئناف العمل من أي محادثة جديدة.
> يُحدَّث بعد كل وحدة عمل، ويُرفع مع كل commit.
> اقرأ "أ) حالة العمل الحية" أولاً.

> **ابدأ من هنا في أي محادثة جديدة:** اقرأ هذا الملف ثم **`docs/HANDOFF.md` كاملاً** (الذاكرة العميقة: الرؤية، وقرارات المالك، وكل ما طُلب وأُنجز، والمعمارية، والفخاخ، وخطة العمل بمعايير القبول). ملفات `docs/00-…` إلى `docs/11-…` و`PRODUCTION-CHECKLIST.md` قديمة وليست مصدراً للحقيقة.
> المعيار المطلوب من المالك: Production كامل بأعلى جودة ممكنة في كل جزء (المتجر، اللوحة، التسجيل، الهبوط، لوحة المالك، البوت، الـ AI)، والرد بالعربية الفصحى.

---

## أ) حالة العمل الحية

| البند | القيمة |
|---|---|
| المستودع | **https://github.com/omarmaher23942-wq/colapia17** (فرع `main`). بدأ بـ commit واحد نظيف بلا تاريخ بعد تسريب مفتاح في المستودع القديم (حُذف). لا يُرفع إليه التاريخ القديم أبداً. |
| الفرع | `main` في المستودع الجديد (الـ worktree القديم كان `claude/one-time-payment-model-3ef83a`) |
| المرحلة الحالية | المرحلة الثالثة: التنفيذ. W0 إلى W5 مكتملة، و"امتلك متجرك" مكتملة، والـ onboarding مكتمل، و**محرك المتجر الجديد (W6) مكتمل**، وW7 جزئي |
| آخر ما أُنجز | **W7.4أ قائمة المنتجات (2026-10-09):** صفحات حقيقية (40) بدل حد 200، وبحث بتطبيع بحث المتجر (عربي/فرانكو/كود)، وفلاتر المخزون (نفد، منخفض، نفد مقاس أو لون) وما ينقص (صورة، تكلفة، وصف) بأعداد حقيقية، وقسم وترتيب، وجدول/بطاقات بالهامش والمباع والمخزون، وعمليات جماعية بنوافذ تأكيد (نشر، إخفاء، نقل لقسم، حذف، تعديل السعر). **استيراد CSV حقيقي** (كانت نقطة `/api/products/import` غير موجودة) بمعاينة وأخطاء كل سطر، ثم **نقل الصور** من روابطها لمساحة الرفع (المتجر لا يعرض مضيفاً خارجياً) بحماية SSRF، وقابل للاستئناف من تنبيه «انقل الصور الآن». و«اكتب الأوصاف الناقصة» بالـ AI بتقدم حقيقي. **أخطاء إنتاج أُصلحت:** تعديل السعر الجماعي كان يفشل دائماً على Postgres (معامل `1.1` يُستنتج integer)، وصار يشمل السعر قبل الخصم ويقرّب لأقرب جنيه؛ والمنتج الجديد كان يُحفظ بكمية 20 افتراضية؛ والرابط (slug) كان يتغير مع كل تعديل للاسم. قبلها W7.3 الطلبات وW7.2 وW7.1. |
| الخطوة التالية بالضبط | (0) المالك: مشروع Vercel جديد من المستودع الجديد بكل المتغيرات (قائمتها في `docs/HANDOFF.md` القسم 4). (1) المالك: `npm run db:migrate` (0003 ثم 0004)، وتجربة حية: طلب من متجر «مياده» بعد إعادة النشر، وإضافة مفتاح Groq من «الربط والمفاتيح» في موقعها، وبناء متجر جديد باختيار الحركة. (2) W7.4ب: محرر المنتج (`ProductForm`: تتبع المخزون، ترتيب الصور والصورة الرئيسية، معاينة الهامش، «مميز»، حذف، «عرض في المتجر»، تنبيه التعديلات غير المحفوظة، البقاء في الصفحة بعد الحفظ) و`VariantMatrix`، ثم بقية الصفحات بالترتيب في `docs/HANDOFF.md` 9.1. (3) W8: البوت. (4) W9: ميزات مبتكرة تُقترح قبل البدء. |

### سجل الإنجاز
- [x] المرحلة الأولى: التحليل الشامل والتقرير.
- [x] المرحلة الثانية: القرارات والمعمارية وموجات التنفيذ (معتمدة من المالك).
- [x] W0: نظافة المستودع والأساس.
- [x] W1: الأمان والعزل.
- [x] W2: أساس البيانات و`getTenantDb`.
- [x] W3 (أُعيد تصميمها): "امتلك متجرك" بدل خزنة المفاتيح والنقل داخل المنصة. الخزنة والنقل القديمان حُذفا بالكامل (migration 0003).
- [x] W4: التفعيل بعد التحويل. صار بمراجعة المالك (`lifecycle/payment-policy.ts` يقيّم الإيصال فقط، و`lifecycle/owner-alerts.ts` يرسل التنبيه).
- [x] W5 (أُعيد تصميمها): مولّد مشروع التاجر `server/ownership/template.ts` + `template/` (المتجر واللوحة فقط، محقوناً ببياناته)، بلا Upstash ولا Google ولا Pusher.
- [x] W6: محرك المتجر (تصميم ونصوص بالـ AI، حقائق، مخرج فني، Hero بستة تخطيطات، بطاقة وشبكة تتكيفان مع العدد، checkout بمسار واحد، هيدر وفوتر بتصميم المتجر).
- [~] W7: الداشبورد (التوكنات والغلاف وKPI و«نوفا» وكاتب المنتجات و«تصميم المتجر» و«السياسات والضمان» وتصدير Excel للطلبات والعملاء والتحليلات وفواتير الطباعة/PDF منجزة؛ W7.1 إطار اللوحة منجز؛ مراجعة الصفحات الداخلية صفحةً صفحة متبقية).
- [~] W8: الـ onboarding منجز (5 خطوات)؛ البوت متبقٍ.
- [ ] W9: الميزات المبتكرة الإضافية.

### إطار اللوحة W7.1 (مرجع سريع)
- **النبض:** `components/dashboard/DashboardPulse.tsx` (مزوّد في `dashboard/layout.tsx`، الأعداد الأولى من الخادم عبر `attentionCounts`) ← `/api/dashboard/attention?since=` ← `server/repos/attention.ts` (استعلام واحد بثمانية أعداد + الطلبات الواصلة منذ since بهامش 10 ثوانٍ، والتكرار يُصفّى بمعرّف الطلب). أي مكوّن يغيّر ما يحتاج انتباه التاجر يستدعي `requestPulse()` بعد الإجراء. Pusher (إن وُجد على المنصة) يسرّع السؤال فقط.
- **الجرس:** `AttentionCenter.tsx` (`attentionItems`، و`urgentCount` = طلبات تحتاج إجراء + تقييمات). الشارات: الطلبات `ordersToHandle`، والتقييمات، والمنتجات (نفاد المخزون بلون warn).
- **النغمة:** `lib/order-chime.ts` (سياق صوت يُفتح عند أول تفاعل، وتفضيل الكتم في المتصفح).
- **الملاحة:** `components/dashboard/nav.ts` مصدر واحد للقائمة الجانبية والشريط السفلي ولوحة الأوامر (يستبعد `PLATFORM_ONLY_NAV` في مشروع التاجر).
- **لوحة الأوامر:** `CommandPalette.tsx` + `/api/dashboard/search` (`server/repos/dashboard-search.ts`). تُعرض داخل `.dash` (خاصية `container`) لترث التوكنات؛ أي نافذة منبثقة بـ Portal في اللوحة يجب أن تفعل الشيء نفسه.
- **التنسيق:** `fmtNum`/`arCount(n, NOUN.x)` من `lib/format.ts` (لا `toLocaleString("ar-EG")` بأرقام هندية في اللوحة)، وحالات الطلب والدفع من `lib/order-status.ts` (`TONE_CHIP`).
- **الإشعارات المنبثقة:** `components/AppToaster.tsx` في الجذرين (المنصة والقالب) يتبع ثيم `.dash`.
- **النظرة العامة (W7.2):** `app/(platform)/dashboard/page.tsx` ← `overviewData(storeId, 7|30|90)` (`?range=`)، والبطاقات في `components/dashboard/overview/` (`OverviewCards` خادم، و`AttentionStrip`/`AbandonedCarts` عميل). الربح التقديري = سعر البيع − سعر التكلفة **الحالي** − نصيب الخصومات، ويُعرض معه ما يغطيه من المبيعات. أي رقم لا يُحسب يظهر «—» بشرح، لا قيمة افتراضية.
- **الطلب (W7.3أ):** `dashboard/orders/[id]/page.tsx` + `components/dashboard/order/` (`OrderStatusPanel`، `OrderParts`: الإيصال وواتساب والشحن والنسخ). الرسائل الجاهزة ونص الشحن والتحصيل في `lib/order-messages.ts`. النوافذ: `components/dashboard/ui/DashDialog.tsx` (`DashDialog` و`ConfirmDialog` على `<dialog>` الأصلي؛ استخدمها لأي تأكيد بدل `window.confirm`).
- **قائمة الطلبات (W7.3ب):** `dashboard/orders/page.tsx` ← `server/repos/orders-list.ts` (`parseOrdersQuery`: `status`، `pay=all|review|cod|transfer`، `q`، `page`، و`view=board`)، والعرض في `components/dashboard/orders/` (`OrdersList` جدول/بطاقات وتحديد جماعي، `OrdersBoard` مراحل، `parts` شارات مشتركة).
- **قائمة المنتجات (W7.4أ):** `dashboard/products/page.tsx` ← `server/repos/products-list.ts` (`parseProductsQuery`: `status`، `stock=low|out|variants_out`، `need=image|cost|description`، `category`، `q`، `sort`، `page`؛ وروابط قديمة `status=low_stock` و`categoryId` مقبولة). العرض في `components/dashboard/products/` (`ProductsList`، `ProductsFilters` بـ `next/form`، `ImportProducts`، `AiFillDescriptions`، `ImageMover`). روابط الجرس وبنود الجاهزية تفتح الفلتر المطابق.
- **الاستيراد:** `lib/csv-parse.ts` + `lib/product-import.ts` (`planImport` نفسه في المعاينة وعلى الخادم) ← `server/actions/product-import.ts` (معاملة واحدة، أقسام بالاسم المطبّع). **الصور الخارجية:** `isHostedImage` (`lib/media-hosts.ts`) ومثيلها SQL `externalImagesSql`؛ النقل `rehostProductImagesAction` منتجاً منتجاً عبر `server/remote-image.ts` (https فقط، رفض العناوين الخاصة مع كل تحويل، 8MB، النوع من بايتات الملف، SVG مرفوض) و`server/media-host.ts` (`mediaApi()`: مفتاح المنصة، ونسخة القالب بمفتاح التاجر). خطأ نهائي (غير موجودة/ليست صورة) = تُحذف الصورة ويُذكر السبب؛ تعذر مؤقت أو فشل الرفع = تبقى برابطها ويظهر تنبيه «انقل الصور الآن».
- **المخزون:** أي حركة مخزون لطلب تمر بـ `server/inventory.ts` (`stockMovement` و`syncVariantTotals`)؛ قاعدة: مخزون المنتج ذي التركيبات = مجموع تركيباته.
- **واتساب:** `lib/whatsapp.ts` (`waLink`/`waNumber`) يقبل أي صيغة رقم مصري؛ استخدمه بدل `wa.me/2${...}` في أي كود جديد.

### جولة أكتوبر 2 (مرجع سريع)
- **الحركة:** `bp.design.motion = {level: calm|lively|cinematic, depth}`. كلها CSS في `blueprint/design.ts` (`motionRules`) على `data-motion`/`data-depth` بغلاف المتجر: عنوان يتكشف كلمة كلمة (`.s-kinetic .s-w`)، وKen Burns وطفو، وparallax وشريط تقدم بـ scroll-driven animations، وميل ثلاثي الأبعاد بلمعة عبر `DepthController` (مستمع واحد يكتب متغيرات CSS على `[data-tilt]`)، وواجهة `orbit` (حلقة ثلاثية الأبعاد، 4 صور فأكثر). التاجر يختار في التسجيل (`MotionPicker`، و«اختر لي» = المدير الفني) ويعدّل من «تصميم المتجر» (`server/actions/motion.ts`). معاينة: `/design-lab/store?d=0..3&m=calm|lively|cinematic&h=orbit`.
- **الزيارات:** `server/visitor.ts`: هوية جهاز من الخادم (كوكي `clp_v` httpOnly، وبصمة شبكة+متصفح إن رُفض الكوكي)، والزيارة = جهاز في يوم. البرامج الآلية وصاحب المتجر (كوكي `clp_m`) لا تُحسب. القمع بالزوار الفريدين، والمقارنات بالفترة السابقة الحقيقية.
- **«طلباتي»:** كل طلب يُحفظ بمعرّف جهاز العميل (`orders.visitor_id`) عبر `ensureDeviceId` في الـ checkout، و`hasOrderAccess` يقبل الجهاز نفسه. `/track` صار «طلباتي» (قائمة الجهاز بحالة حية + بحث بالرقم والموبايل)، وأيقونة في الهيدر بشارة الطلبات الجارية (`/api/storefront/my-orders`). بريد للعميل مع كل تغيير حالة (`server/order-notify.ts`) إن كتب بريده (حقل اختياري في الدفع).
- **الجمهور والبريد (المالك):** `/admin/audience`: كل التجار بشرائح (استلموا، دفعوا، تجربة، انتهت، سجّلوا فقط)، رسالة بـ `{name}`/`{store}` ومعاينة وتجربة، وإرسال على دفعات من المتصفح بتقدم حقيقي، وسجل الحملات، ورابط إيقاف موقّع (`/api/outreach/unsubscribe`).
- **المقاسات والألوان:** `components/dashboard/VariantMatrix.tsx` (خيارات بقيم جاهزة وتركيبات تلقائية ومصفوفة لون × مقاس للمخزون)، والحفظ يحتفظ بمعرّف كل تركيبة (upsert ذري في `saveProductAction`).
- **مفاتيح التاجر:** `readSecret` يقبل القيمة أو `NAME=value` أو بين تنصيص أو `export` أو ملف `.env` كامل، والقيمة النظيفة هي ما يُحفظ.
- **مشروع التاجر:** `AUTH_SECRET` مشتق من رابط القاعدة، والصور `unoptimized` (من شبكة UploadThing مباشرة)، وكاش الذاكرة لمفاتيح المتجر 15 ثانية فقط (كل نسخ الخادم ترى التعديل).
- **تحديث مشروع التاجر:** زر «حدّث مستودعك لآخر إصدار» (`/api/ownership/github/start?mode=update` ← `updateStoreRepo`): commit واحد على مستودع التاجر بآخر كود، وملفات الهوية (`STORE_IDENTITY_FILES`) تُحفظ من المستودع نفسه إن حُذفت بيانات المتجر من المنصة. Vercel يعيد النشر تلقائياً. متاح أيضاً في صفحة المتجر المستلَم.
- **صفحة الهبوط:** `components/landing/Landing.tsx` (خادم) + `StoreMorph`/`StoreMini` (متاجر مصغّرة بهويات مختلفة). كل جملة فيها صحيحة عن المنتج اليوم؛ مدة التجربة من `TRIAL_HOURS`.

### الفواتير والتصدير (مرجع سريع)
- **الفواتير:** `/print/invoices?ids=a,b` (و`&print=1` للطباعة التلقائية): فاتورة لكل صفحة بمقاس `bp.invoice.paperSize` (A5/A4/حرارية 80مم)، ورمز QR لتتبع الطلب. الإعدادات تُعدل من شريط الصفحة نفسها (`server/actions/invoice.ts`). المسار خارج تخطيط اللوحة حتى يُطبع نظيفاً، ومضاف لمشروع التاجر (`/print` ضمن مسارات المالك).
- **التصدير:** `/api/dashboard/{orders,customers,analytics}/export` (CSV بـ BOM يفتح في Excel، مع حماية من حقن الصيغ في `server/csv.ts`).

### محرك المتجر: كيف يعمل (مرجع سريع)
- **البيانات:** `bp.design` (الحمض النووي: layout/type/shape/surface/elevation/card/button/icon/heading/header) و`bp.customCss` (جلد يكتبه الـ AI) و`bp.copy` (نصوص أزرار الواجهة). كلها بقيم افتراضية، فأي Blueprint قديم صالح.
- **العرض:** `blueprint/design.ts` يكتب CSS المتجر على خطافات ثابتة (`.s-card` `.s-media` `.s-price` `.s-badge` `.s-btn` `.s-btn-ghost` `.s-title` `.s-display` `.s-eyebrow` `.s-sub` `.s-head` `.s-section[data-tone]` `.s-icon` `.s-chip` `.s-input` `.s-hero` `.s-hero-media` `.s-trust` `.s-faq` `.s-story` `.s-header` `.s-announce`). `blueprint/skin.ts` ينقّي CSS الـ AI (خصائص الشكل فقط، بلا url ولا تخطيط، ومحصور في `.storefront`). المكوّنات لا تحمل شكلاً ثابتاً، والنصوص عبر `useCopy()`.
- **الحقائق:** `blueprint/facts.ts` (`storeFacts` من السياسة + عدد المحافظات المفعّلة عبر `server/repos/facts.ts`). `groundedItems` يحذف أي ادعاء غير صحيح ويصحح الأرقام القديمة؛ يُطبَّق في `registry.tsx` على الإعلانات والشارات والأسئلة، وفي صفحة المنتج والفوتر.
- **البناء:** `ai/build/studio.ts` (`designStore` المدير الفني، و`writeStore` كاتب المحتوى؛ كل رد يُفحص، والبديل مشتق من بيانات المتجر لا نص عام) و`ai/build/art-director.ts` (`composeHome` بقواعد UX، و`redesignBlueprint`) و`ai/build/policy.ts` (سياسات الاستمارة بصيغة الـ Blueprint). خطوات الـ workflow: architect ← products ← catalog (+إحصاءات) ← design ← copy ← pages ← assemble ← save.
- **إعادة التصميم:** `/dashboard/design` ← `server/actions/redesign.ts` ← `/api/workflows/redesign` (حالة في Redis، نسخة سابقة في `store_snapshots` بعنوان «قبل إعادة التصميم»). على المنصة فقط.
- **معاينة بلا قاعدة:** `/design-lab/store?d=0..3&n=1..12` (أربعة أنظمة تصميم وأعداد منتجات مختلفة).

### "امتلك متجرك": كيف يعمل (مرجع سريع)
- **المنصة:** صفحة `/dashboard/own` (بعد التفعيل). GitHub OAuth (صلاحية `repo` لحظياً، بلا حفظ توكن) ينشئ مستودعاً خاصاً `<sub>-store` ويرفع المشروع، أو `/api/ownership/zip`. كود استلام لمرة واحدة (`store_transfers`، التجزئة فقط، 7 أيام). `/api/ownership/export` (manifest ثم صفحات 300 صف بالترتيب) و`/api/ownership/complete` (يطابق الأعداد، ويعيد 409 بالجداول التي وصلتها صفوف جديدة). بعد الاستلام: `stores.owned_url` فيحوّل النطاق الفرعي للموقع الجديد (`requireStore`)، واللوحة تصبح صفحة واحدة (روابط الموقع الجديد، وحالة الحذف، واسترجاع الدخول بكود الاسترجاع أو `OWNER_RESET_CODE` في Vercel التاجر). **الحذف فوري:** `completeTransfer` يحذف صفوف المتجر وصوره من المنصة بعد الرد مباشرة (`purgeStore`)، و`ops/sweep` احتياط فقط. لذلك لا يكتمل الاستلام وصورة حية لم تُنسخ لحساب التاجر (`copyMedia` يعيد المحاولة 3 جولات). التأكيد المكرر من نفس الموقع يُقبل (idempotent).
- **مشروع التاجر:** `template/src` ملفات تحل محل نظيراتها (env، db/client، auth بالبريد وكلمة المرور وكود استرجاع، redis وratelimit في الذاكرة، ai/merchant بمفتاح Groq من قاعدته، رفع UploadThing بمفتاحه، middleware المتجر الواحد، edition)، وملفات جديدة (`/setup`، `/login`، `/dashboard/integrations`، `server/setup/*`). `template/root` ملفات الجذر، و`template/drizzle` مخطط قاعدة التاجر (جداول المتجر فقط). الحقن: `src/store.config.ts`، و`src/lib/fonts.ts` (خطوط المتجر فقط)، و`src/app/store-theme.css`، و`store/blueprint.json`.
- **قاعدة ذهبية:** أي ملف منصة يتسرب لمشروع التاجر يُفشل التوليد (`FORBIDDEN_IN_TEMPLATE`). الفروق الصغيرة بين النسختين في `src/lib/edition.ts` فقط (`EDITION`، `INTEGRATIONS_NAV`، `NO_STORE_HREF`، `CUSTOMER_ACCOUNTS`...).
- **الفحص الإلزامي بعد أي تعديل يمس المتجر أو اللوحة:** `npx tsx scripts/store-template.ts --out ../store-check --check` (يولّد المشروع ويشغّل tsc). وللبناء الكامل: `next build` داخل المجلد المولّد (نجح بلا قاعدة بيانات). اختبار `tests/unit/store-template.test.ts` يفرض الحدود.
- **تغيير مخطط جداول المتجر:** بعد `db:generate` للمنصة شغّل `npx drizzle-kit generate --config scripts/template-drizzle.config.ts` ثم `node scripts/template-migrations-clean.mjs`.

### ديون مسجّلة (تُعالج في موجتها)
- **W0/W7:** نحو 220 تحذير ESLint، أغلبها `no-unused-vars`. لا أخطاء.
- **مشروع التاجر:** حسابات العملاء (Google/رابط البريد) معطلة فيه (`CUSTOMER_ACCOUNTS=false`)، والتتبع بالكود يعمل. إشعارات البريد تعمل فقط إن وُضع `RESEND_API_KEY` في متغيرات Vercel. الوقت الفعلي (Pusher) معطل ويعتمد على التحديث الدوري.
- **التشغيل:** Vercel Hobby يسمح بـ cron يومي فقط؛ لتشغيل `ops/sweep` (ومنه حذف بيانات المتاجر المستلَمة) كل 10 دقائق استخدم QStash Schedule مع `Upstash-Forward-Authorization: Bearer $CRON_SECRET`.
- **نظام الدعم الفني:** الجداول باقية فقط. يُعاد بناؤه كاملاً في W9.

### حالة الفحوص
- `tsc`: 0 أخطاء (المنصة ومشروع التاجر المولّد).
- `next build` لمشروع التاجر المولّد: ناجح بلا قاعدة بيانات.
- ESLint: 0 أخطاء (131 تحذيراً).
- vitest: 158/158 ناجحة (منها اختبارات الاستوديو بردود AI سليمة ومشوّهة وفاشلة، والتجميع الكامل، وتوافق إصدارات مشروع التاجر).

### طريقة عمل المالك (إلزامية)
- **الرفع:** كل تحديث يُرفع تلقائياً إلى GitHub فور إنجازه، مع تحديث هذا الملف.
- **المفاتيح:** موجودة على جهاز المالك وعلى Vercel فقط. أي تغيير في قاعدة البيانات يُسلَّم كأمر يشغّله المالك من جهازه.
- **تطبيق migrations:** `npm run db:migrate` فقط. و`db:push` ممنوع على الإنتاج.
- **ممنوع رفع أي ملف فيه مفاتيح حقيقية** (`.env*`). نسخة `.env.example` المحلية في الـ worktree تحتوي مفاتيح حقيقية ولا تُرفع.
- **سجل الـ migrations المطبّقة على الإنتاج:**
  - [x] `legacy/0008_intake_per_store.sql`، وتنظيف النسخ المكررة، واعتماد خط الأساس `0000_baseline`، وإعادة فهرسة البحث.
  - [x] `0001_store_data_plane`.
  - [x] `0002_merchant_vault`.
  - [ ] `0003_ownership` (`npm run db:migrate`): جدول `store_transfers` وأعمدة `stores.owned_*`، ويحذف جدولي الخزنة والنقل القديمين وعمودي `data_plane` و`write_locked_until`.
  - [ ] `0004_outreach` (`npm run db:migrate`، يُطبَّق مع 0003 بنفس الأمر): جدولا `outreach_campaigns` و`email_optouts` لصفحة «الجمهور والبريد».
- **البريد (Resend):** إن ظهر في السجلات `The colapia.com domain is not verified` فالنطاق فقد التحقق في Resend: افتح resend.com/domains وأعد التحقق (سجلات DNS). الكود لم يتغير.
- **Gemini:** إن كان `GEMINI_MODEL` في Vercel مضبوطاً على `gemini-2.0-flash` أو 1.5 فاحذفه أو اجعله `gemini-3.8-flash` (القديم أُوقف، والكود يتجاهله تلقائياً).
- **تنبيهات الدفع:** `OWNER_ALERT_EMAILS` في Vercel (اختياري؛ الافتراضي بريد المالك). تعتمد على Resend، فلا بد أن يكون نطاق colapia.com موثّقاً.
- **QStash:** مسارات `ops/tick` و`ops/sweep` تقبل الآن توقيع QStash مباشرة، فجداول QStash لا تحتاج هيدر Authorization.
- **شريط Vercel (vercel.live):** رسالة CSP عن سكربت محجوب تظهر لك وحدك وأنت مسجّل في Vercel (شريط أدوات Vercel)، ولا تظهر للعملاء.
- **إعداد GitHub لزر "اربط GitHub" (مرة واحدة):** github.com/settings/developers ثم New OAuth App: Homepage `https://colapia.com`، وCallback `https://colapia.com/api/ownership/github/callback`. ثم في Vercel: `GITHUB_CLIENT_ID` و`GITHUB_CLIENT_SECRET`. بدونهما يظهر خيار ZIP فقط.
- **المزامنة عند المالك (المستودع الجديد):** العمل يُرفع إلى `main` في colapia17 (أو فرع ثم PR)، وVercel ينشر من `main`. على جهاز المالك: `git pull origin main` قبل أي أمر قاعدة بيانات، ثم `npm run db:migrate`.

### المعاينة المحلية ببيانات حقيقية (Linux / الجلسات السحابية)
- `bash scripts/dev/preview.sh dev`: Postgres محلي + كل الـ migrations + متجر تجريبي «nova» (منتجات بمتغيرات، 46 طلباً على 60 يوماً، عملاء، تقييمات، سلات متروكة، زيارات) ثم خادم التطوير على 3100. الدخول للوحة بكوكي `clp_m=dev-merchant-session-token-0000000000000000`.
- `scripts/dev/local-services.cjs` يحاكي Neon HTTP وUpstash Redis دون أي تعديل في كود التطبيق، والبيئة معزولة (`env -i` + `scripts/dev/local.env` بقيم وهمية) فلا تصل لأي مفتاح حقيقي في بيئة الجلسة.
- لقطات: `bash scripts/dev/preview.sh shot /dashboard/orders orders both dark --full` (375px وسطح مكتب، ويطبع التمرير الأفقي وأخطاء المتصفح). `seed` يعيد البيانات من الصفر، و`run <cmd>` يشغّل أي أمر داخل البيئة المعزولة.

### المعاينة المحلية (للتطوير)
- `.env.local` في الـ worktree بقيم وهمية فقط، و`node_modules` رابط junction للمستودع الأصلي.
- `.claude/launch.json` (مستثنى من git): `web` يشغّل المنصة على 3100، و`store-template` يشغّل مشروع التاجر المولّد (`next start`) على 3200.
- `/design-lab` (`?view=shell|repo|transfer|owned|locked`) و`/design-lab/cards` و`/design-lab/onboarding`: معاينة بلا قاعدة (404 في الإنتاج).

### قواعد العمل (إلزامية)
1. **الرد:** بالعربية الفصحى، عدا أسماء التقنيات.
2. **الدقة:** لا افتراض عن المشروع. يُقرأ الكود الفعلي أولاً، وما لا يوجد يُقال إنه غير موجود.
3. **الجودة:** Production كامل لا MVP. كل ميزة كاملة (واجهة + خلفية + AI عند الحاجة). تجربة المستخدم أولاً. العربية أولاً في الواجهة.
4. **AI داشبورد التاجر:** يعمل بمفتاح التاجر حصراً بعد التفعيل، وبمفاتيح المنصة خلال التجربة فقط.
5. **الشكل ثابت:** لا يتغير شكل المتجر إطلاقاً بين ما قبل الشراء وما بعده.
6. **دورة كل وحدة عمل:**
   1. التنفيذ.
   2. `tsc --noEmit` والاختبارات.
   3. تحديث هذا القسم.
   4. commit.
   5. push.
7. **أداة فحص الأنواع:** `node_modules` غير موجود في الـ worktree، ويُستخدم الموجود في المستودع الأصلي:
   ```bash
   node "C:/Users/ahmed maher/Desktop/colapia/node_modules/typescript/bin/tsc" -p tsconfig.json --noEmit --incremental false
   ```

---

## ب) قرارات المالك والمعمارية المستهدفة وخطة التحول

### قرارات المالك (حُسمت بعد مراجعة التقرير)

1. **نظامان (عُدّل بقرار المالك في 2026-10-08).**
   - **أثناء التجربة (24 ساعة) وحتى الاستلام:** المتجر على المنصة بقاعدة المنصة ومفاتيحها.
   - **بعد الدفع: "امتلك متجرك".** المنصة **لا تستضيف** المتجر المدفوع **ولا تأخذ أي مفتاح** من التاجر (تجنباً لأي مسؤولية قانونية). يحصل التاجر على مشروعه الخاص (المتجر + لوحة التحكم فقط، لا كود المنصة) في مستودع GitHub خاص به (بزر واحد) أو ZIP، وينشره على Vercel الخاص به بقاعدة Neon من Vercel Storage، ويستلم كل بياناته بكود استلام، وتُنقل صوره إلى UploadThing الخاص به. مفاتيحه (UploadThing وGroq) يضعها في لوحته هو وتُحفظ في قاعدته هو. بعد الاستلام تُحذف بيانات التجربة من المنصة، ويُحوَّل رابطه القديم لموقعه الجديد.
   - **القالب:** الكود قالب موحّد واحد (لا يكتبه الـ AI من الصفر)، يُجمع من نفس مكونات المنصة ويُحقن ببيانات التاجر (هويته وخطوطه وألوانه وتصميمه).
   - **الشكل لا يتغير إطلاقاً بعد الشراء.**
   - **شرح مرئي:** كل خطوة لها دليل مكتوب للموبايل، ومكان لفيديو يضيفه المالك لاحقاً (`components/dashboard/own/guides.ts`).
2. **الدفع (عُدّل بقرار المالك في 2026-10-09):** تحويل يدوي (فودافون كاش / إنستاباي) **يراجعه المالك بنفسه**، لا قبول آلي. عند كل إيصال يصل بريد فوري لـ `OWNER_ALERT_EMAILS` (افتراضياً omarmaher23942@gmail.com) بخلاصة الفحص الآلي ورابط المراجعة؛ وبمجرد القبول يُفعَّل المتجر ويصل التاجر بريد التفعيل.
3. **بوت Messenger/Instagram:** يبقى أساسياً، ويُعاد تصميمه للنموذج الجديد.
4. **السوق:** مصر أولاً، مع بنية قابلة للتوسع إلى الخليج لاحقاً.
5. **النطاقات المخصصة:** تُحذف حالياً.
6. **مستوى الجودة:** Production كامل لا MVP. ميزات مبتكرة في كل جزء، وتجربة المستخدم أولاً. والـ AI داخل داشبورد التاجر في كل زر وحقل يعمل **بمفتاح التاجر لا المنصة**.
7. **ملف `CLAUDE.md` سجل حيّ:** يُحدَّث بعد كل تغيير، ويُرفع كل تغيير إلى المستودع (commit + push) أولاً بأول، بحيث يمكن الاستئناف من أي محادثة جديدة.

### المعمارية المستهدفة

#### 1. فصل مستوى التحكم عن مستوى البيانات
- **قاعدة المنصة (Control Plane):** التجار، والمتاجر، والجلسات، والمدفوعات، وأكواد الاستلام، والسجلات، والـ Blueprint.
- **بيانات المتجر (Data Plane):** الكتالوج، والطلبات، والعملاء، والتحليلات، والدعم. على المنصة حتى الاستلام، ثم في قاعدة التاجر وحدها.
- **المدخل الوحيد:** `getTenantDb(storeId)` (قاعدة المنصة دائماً على المنصة؛ يبقى نقطة العزل التي يفرضها اختبار الحارس).
- **مخطط قاعدة التاجر:** `template/drizzle` (جداول المتجر فقط)، يطبقه `/setup` في موقع التاجر.

#### 2. مفاتيح التاجر
- لا تُحفظ على المنصة إطلاقاً. في مشروع التاجر تُحفظ في جدول `store_settings` بقاعدته هو، بعد اختبار حي لكل مزوّد (`server/provider-check.ts`).

#### 3. الاستلام بعد الدفع ("امتلك متجرك")
- **المراحل:** مستودع خاص (GitHub OAuth أو ZIP) ← نشر على Vercel + Neon ← `/setup` في موقع التاجر: تجهيز الجداول ← كود الاستلام ← نسخ الصور إلى UploadThing التاجر ← سحب الصفوف بالترتيب ← مطابقة الأعداد ← تأكيد للمنصة ← تحويل النطاق القديم وحذف بيانات التجربة بعد 72 ساعة.
- **ثبات الشكل:** الـ Blueprint يُنقل كما هو، وروابط الصور تُستبدل بنسخها الجديدة في كل الصفوف.

#### 4. القالب الموحّد
- مشروع التاجر = تتبع الاستيراد من صفحات المتجر واللوحة + ملفات `template/src` البديلة + ملفات محقونة. لا يدخله أي ملف منصة (يفرضه حارس `FORBIDDEN_IN_TEMPLATE` واختبار).

#### 5. الذكاء الاصطناعي
- **على المنصة (التجربة وحتى الاستلام):** مفتاح المنصة بحصة يومية لكل متجر (40 في التجربة، 150 بعد الدفع).
- **في مشروع التاجر:** مفتاح Groq الخاص به حصراً، بلا حدود، يضعه من «الربط والمفاتيح».

#### 6. العزل
- **سياق مستأجر إلزامي:** ملكية مبنية على `stores.merchantId`، واختيار متجر نشط موقّع.
- **فرض في كل استعلام:** طبقة وصول تفرض `storeId`، ومخطط Zod صريح لكل Server Action (لا إسناد جماعي).
- **حماية مسارات المتجر:** حظر `/s/*` على نطاق المنصة، وmetadata وrobots وmanifest وsitemap لكل متجر.
- **اختبارات العزل:** تُشغَّل في كل تغيير.

### موجات التنفيذ (بالأولوية)

| الموجة | المحتوى |
|---|---|
| **W0** | نظافة المستودع، و`CLAUDE.md` الحي، وإزالة `ignoreBuildErrors`، وإعداد lint/typecheck/test، و`.env.example` |
| **W1** | الأمان والعزل: كل بنود القسمين 4 و5 من التقرير، مع اختبارات عزل |
| **W2** | أساس البيانات: خط أساس migrations قابل لإعادة الإنتاج، وتقسيم المخطط، و`getTenantDb` |
| **W3** | خزنة المفاتيح، وواجهة الربط مع الأدلة المرئية، والانتقال بعد الدفع |
| **W4** | التفعيل الفوري بعد التحويل: فحص آلي للإيصال، وقبول فوري، ومراجعة لاحقة قابلة للإلغاء |
| **W5** | القالب الموحّد وتحميل الكود |
| **W6** | إعادة تصميم المتجر: نظام تصميم وحركة، وإطارات سائلة متدفقة على بطاقات المنتجات، وصفحات منتج وcheckout عالمية المستوى، مع SEO وأداء |
| **W7** | الداشبورد الجديد: نظام tokens فاتح وداكن، وإدارة كاملة، وفواتير PDF وQR، وتصدير، ومساعد AI بمفتاح التاجر في كل حقل وزر |
| **W8** | تجربة تسجيل وبناء جديدة قصيرة بشرح مرئي، وإعادة تصميم البوت |
| **W9** | ميزات مبتكرة إضافية، كل منها كامل (واجهة + خلفية + AI)، تُقترح بالتفصيل قبل بدئها |

### التحقق

- **في كل وحدة:** `tsc --noEmit` واختبارات vitest (منها اختبارات العزل)، ثم مراجعة `git diff`.
- **بعد كل commit:** التأكد أن `git push` نجح.
- **عند نهاية كل موجة:** تشغيل التطبيق ومعاينة الصفحات المتأثرة متى توفرت متغيرات البيئة.

---


---

## ج) تقرير المرحلة الأولى (التحليل الشامل)


> كُتب هذا التقرير بعد قراءة فعلية للكود في الفرع `claude/one-time-payment-model-3ef83a`. كل حكم فيه مرتبط بملف وسطر. وما لم أجده في الكود أذكره صراحة بعبارة "لم أجده في الكود".
> الرموز: 🔴 حرج، 🟠 مرتفع، 🟡 متوسط، ⚪ منخفض.

### 0. الخلاصة التنفيذية

**الحكم العام: 3/10.** المشروع واسع لكنه سطحي: ميزات معلنة كثيرة، وجزء كبير منها غير موصول بأي صفحة، أو شكلي، أو معطّل. والأهم أنه مبني على أساس هش في المصادقة والعزل بين التجار.

**أخطر عشر نتائج (مرتبة حسب الخطورة):**

1. 🔴 **ملف الجلسات كله Server Actions.** السطر الأول في [src/server/auth.ts:1](src/server/auth.ts:1) هو `"use server"`، فكل دالة مُصدَّرة فيه (`loginMerchant` و`loginPlatform` و`attachStoreToMerchantSession` و`loginOrCreateMerchantByGoogle` و`issueCustomerMagicLink`...) تصبح نقطة استدعاء من المتصفح متى أشار إليها مكوّن عميل، والملف مستورد فعلاً من مكوّن عميل هو [AccountSignOutButton.tsx](src/components/storefront/AccountSignOutButton.tsx). دالة مثل `loginMerchant(merchantId, storeId)` في [auth.ts:360](src/server/auth.ts:360) تمنح جلسة على أي متجر بلا أي تحقق. الحماية الحالية مصدرها أن Next.js 15 يحذف الـ actions غير المستخدمة من حزمة العميل، وليست قراراً تصميمياً.
2. 🔴 **المتجر مربوط بصف الجلسة لا بالمالك.** `attachStoreToMerchantSession` في [auth.ts:332](src/server/auth.ts:332) تربط أي متجر بأي جلسة تاجر موجودة في المتصفح، و`getMerchantSession` في [auth.ts:410](src/server/auth.ts:410) لا تتحقق أن `store.merchantId === merchant.id`. تُستدعى من إرسال الاستمارة (واجهة API تعتمد على التوكن وحده) [submit.ts:270](src/onboarding/submit.ts:270)، ومن رابط التفعيل [admin/setup/page.tsx:80](src/app/s/[store]/admin/setup/page.tsx:80). **النتيجة: تاجر يرى داشبورد متجر تاجر آخر بمنتجاته وطلباته وعملائه. هذا سبب جذري مؤكد للمشكلة المعروفة.**
3. 🔴 **صف `intakes` واحد لكل محادثة، ويُستبدل.** عليه قيد فريد `intakes_conv_uq`، ويُكتب فوقه عند كل استمارة جديدة لنفس التاجر ([submit.ts:217](src/onboarding/submit.ts:217) و[release.ts](src/lifecycle/release.ts)). وخطوة `load` في الـ workflow تقرأ هذا الصف لحظة تنفيذها [build/route.ts:179](src/app/api/workflows/build/route.ts:179). **النتيجة: متجر يُبنى بمنتجات استمارة متجر آخر. سبب جذري مؤكد ثانٍ.**
4. 🔴 **إسناد جماعي (Mass Assignment) يكسر الدفع والعزل.** `setStoreOpsAction` في [blueprint.ts:156](src/server/actions/blueprint.ts:156) تمرر مدخلات العميل كما هي إلى `db.update(stores).set({...input})`، فيستطيع التاجر ضبط `status: "active"` ويتجاوز الدفع، أو تغيير `merchantId` و`subdomain`. والنمط نفسه في `updateOrderMetaAction` [orders.ts:176](src/server/actions/orders.ts:176) و`updateCustomerAction` [commerce.ts:25](src/server/actions/commerce.ts:25)، فيمكن نقل طلب أو عميل إلى `storeId` متجر آخر.
5. 🔴 **بيانات المنصة تظهر داخل المتاجر.** لا توجد `generateMetadata` في أي صفحة متجر، فكل صفحات المتاجر ترث العنوان "Colapia" وأيقونة المنصة من [layout.tsx:14](src/app/layout.tsx:14). والـ middleware يستثني `robots.txt` و`manifest.webmanifest` و`favicon.ico` من المعالجة [middleware.ts:108](src/middleware.ts:108)، فتُقدَّم على نطاق كل متجر ملفات المنصة نفسها. وحتى مسار الـ manifest الذي يقرأ هوية المتجر [manifest route:15](src/app/manifest.webmanifest/route.ts:15) لا يصله رأس المتجر أبداً.
6. 🟠 **المتاجر متاحة تحت نطاق المنصة.** المسار `colapia.com/s/<sub>` يعمل لأن الـ middleware لا يمنعه على النطاق الجذري، والداشبورد نفسه يربط بهذا الشكل. لذلك تشترك كل المتاجر في origin واحد، فيعرض قسم "شاهدت مؤخراً" منتجات متجر آخر، لأن مفتاحه `clp-recent` عام وغير مرتبط بالمتجر [RecentlyViewed.tsx:10](src/components/storefront/RecentlyViewed.tsx:10).
7. 🟠 **واجهات عامة تكتب عبر المتاجر.** `/api/track` يقبل `storeId` من جسم الطلب، ويحدّث `viewCount` لأي منتج بمعرّفه فقط [track/route.ts:83](src/app/api/track/route.ts:83). و`addManualReviewAction` تقبل `productId` من متجر آخر وتعدّل تقييمه [dashboard-extras.ts:145](src/server/actions/dashboard-extras.ts:145). و`submitPlatformPaymentAction` بلا مصادقة، وتعمل على أي متجر [platform.ts:13](src/server/actions/platform.ts:13). و`listSnapshots` [blueprint.ts:141](src/server/actions/blueprint.ts:141) و`ensureShippingZones` [commerce.ts:24](src/server/actions/commerce.ts:24) نقطتا Server Action بلا أي تحقق.
8. 🟠 **تسجيل الدخول يُضيّع المتجر.** جلسة Google تُنشأ دائماً بـ `storeId=null`، فيرى التاجر العائد "لا يوجد متجر" ويُوجَّه إلى استمارة جديدة تُنشئ متجراً مكرراً، لأن `RESUMABLE` لا تشمل الجلسة المُرسلة [sessions.ts:17](src/onboarding/sessions.ts:17). وهذا المسار نفسه هو ما يُفعّل النتيجة رقم 3.
9. 🟠 **كل شيء يعمل بمفاتيح المنصة.** [env.ts](src/lib/env.ts) يفرض أكثر من 25 سراً للمنصة، ولا يوجد أي أساس لمفاتيح التاجر، ولا لتصدير الكود أو البيانات. والمتغير `ENCRYPTION_KEY` مطلوب عند الإقلاع لكنه **غير مستخدم في أي مكان**.
10. 🟠 **SEO المتاجر شبه معدوم.** لا عناوين ولا أوصاف ولا Open Graph ولا JSON-LD للمنتجات. و`sitemap.xml` على نطاق المتجر يُعاد كتابته إلى `/s/<sub>/sitemap.xml` فيعيد 404. وحقلا `seoTitle` و`seoDescription` يولّدهما الـ AI ثم **لا يُستخدمان في أي صفحة**.

**نقاط إيجابية حقيقية:** فحص الأنواع `tsc --noEmit` يمر بصفر أخطاء مع `strict` و`noUncheckedIndexedAccess`. الأسعار تُحسب على الخادم من قاعدة البيانات، والمبالغ تُخزَّن أعداداً صحيحة بالقروش. وتوجد idempotency للطلبات وقيود CHECK على المخزون، وتطبيع ممتاز للبحث العربي والفرانكو مع `pg_trgm`، وسلة معزولة لكل متجر، ومفهوم Blueprint كبيانات (Config-as-Data) جيد، ومحرك ألوان، وسلسلة مزوّدي AI فيها قاطع دارة (circuit breaker) وتسجيل للتكلفة.

---

### 1. المعمارية الفعلية والتقنيات

| الطبقة | التقنية الفعلية |
|---|---|
| الإطار | Next.js 15 (App Router) مع React 19، وTypeScript strict |
| قاعدة البيانات | Neon Postgres عبر `drizzle-orm/neon-http`: لا معاملات تفاعلية، والتجميع الذري عبر `db.batch` فقط |
| الكاش وتحديد المعدل | Upstash Redis |
| المهام الخلفية | Upstash QStash للمهام المجدولة، وUpstash Workflow لخط بناء المتجر |
| الوقت الفعلي | Pusher |
| الملفات | UploadThing بحساب واحد للمنصة لكل التجار |
| البريد | Resend مع قوالب React |
| الذكاء الاصطناعي | Vercel AI SDK v5 بسلاسل Gemini ثم Groq ثم Morpheus (Claude)، كلها بمفاتيح المنصة |
| المصادقة | Google OAuth مكتوب يدوياً، وجلسات في جدول `sessions` بتوكن مُجزّأ |
| الواجهة | Tailwind v4 وshadcn وRadix و`@base-ui/react` معاً (مكتبتا primitives في مشروع واحد)، وmotion وrecharts وzustand |
| المراقبة | `@sentry/nextjs` وOpenTelemetry مثبتان في `package.json`، لكن **لم أجد أي تهيئة لهما في الكود** (لا `instrumentation.ts` ولا استيراد) |

**تعدد المستأجرين (Multi-tenancy):** تطبيق واحد، وقاعدة واحدة، ومخطط مشترك بعمود `store_id`. العزل كله يدوي في كود التطبيق، ولا يوجد Row Level Security. يستخرج [middleware.ts](src/middleware.ts) النطاق الفرعي ويعيد الكتابة إلى `/s/[store]`. والمنصة على النطاق الجذري: صفحة الهبوط، و`/login`، و`/dashboard` للتاجر، و`/admin` للمالك، و`/onboarding/[token]`.

**المتجر كبيانات:** كل متجر هو `StoreBlueprint`، أي JSON محقق بـ Zod في [blueprint/schema.ts](src/blueprint/schema.ts) (652 سطراً)، يُصيَّر عبر registry من 14 نوع قسم.

**رحلة التاجر الحالية:**
1. بوت Messenger/Instagram، أو تسجيل عبر Google.
2. استمارة من 5 خطوات.
3. الإرسال يُنشئ متجراً بحالة `building`.
4. Workflow البناء: architect ← نصوص المنتجات ← كتابة الكتالوج ← الثيم ← الرئيسية ← الصفحات ← فحص QA محلي.
5. حالة `review` ثم تسليم آلي، ثم `trial`.
6. دفع يدوي: صورة تحويل فودافون كاش أو إنستاباي، ثم فحص بـ Gemini Vision، ثم تأكيد بشري، ثم حالة `active`.
7. إن لم يدفع: `frozen`، ثم حذف بعد `GRACE_DAYS`.

**نظافة المستودع:**
- `bundle2.txt` (1 ميجابايت) نسخة نصية من الكود داخل git.
- `omar.md` ملاحظات محادثات.
- 8 ملفات فارغة شاردة داخل `src` و`tests`: `O` و`Omar` و`o`.
- 15 ملف توثيق، بعضها مكرر (`10-complete-platform-guide` و`10-master-runbook`، و`PRODUCTION-CHECKLIST` و`PRODUCTION-CHECKLIST2`)، وبعضها يصف ما لا يطابق الكود.
- 128 commit خلال 12 يوماً، أغلب رسائلها `fix22`.
- لا يوجد `.env.example` رغم أن التوثيق يشير إليه.
- لا يوجد `vercel.json`، فالـ cron الخاص بـ `ops/sweep` و`ops/tick` غير مضبوط في المستودع.

---

### 2. خريطة الميزات

#### ✅ تعمل (مع ملاحظات)
- **المتجر:** التصفح، وصفحات المنتج والقسم، والبحث العربي المتسامح، والسلة لكل متجر.
- **الشراء:** إتمام الطلب بالدفع عند الاستلام أو التحويل، مع حساب السعر على الخادم. وأكواد الخصم، والشحن لـ 27 محافظة، وتتبع الطلب بالكود والموبايل، وحساب العميل عبر Google.
- **الداشبورد:** المنتجات مع المتغيرات، والأقسام، والطلبات وتغيير حالتها مع إرجاع المخزون، والعملاء، والخصومات، والشحن، والتقييمات، ومحرر المحتوى، والإعدادات، وتحليلات أساسية، وفاتورة قابلة للطباعة من صفحة الطلب، ورمز QR في الإعدادات، وصفحة الدفع للمنصة.
- **أدمن المنصة:** المتاجر، والمدفوعات، وخط الإنتاج، والعملاء المحتملون، والمحادثات، والـ flags، والتكاليف، والفريق.

#### ⚠️ تعمل جزئياً أو معطلة
- **عرض الطقم (Bundle):** يضع السعر المخفّض في السلة [Bundle.tsx:149](src/components/blocks/Bundle.tsx:149)، ثم يعيد الـ checkout الحساب من قاعدة البيانات بلا خصم. يرى العميل سعراً ويدفع غيره.
- **روابط بريد مكسورة:** بريد الطلب الجديد للتاجر يشير إلى `/admin/orders` على نطاق المتجر [checkout.ts:664](src/server/actions/checkout.ts:664)، وهذه الصفحة غير موجودة.
- **روابط داشبورد إلى صفحات غير موجودة:** `/dashboard/design` و`/dashboard/orders/export` و`/dashboard/customers/export`.
- **أعضاء فريق لا يستطيعون الدخول:** من يُضاف عبر `addMemberAction` لا يستطيع الدخول بكلمة المرور، لأن الهاش هناك `sha256` من جزأين [platform-team.ts:10](src/server/actions/platform-team.ts:10)، بينما التحقق يتوقع `pbkdf2` من ثلاثة أجزاء.
- **ملفات المنصة على المتاجر:** sitemap المتجر يعيد 404، والـ robots والـ manifest والأيقونة كلها للمنصة.
- **شريط الانطباع الأول للمالك:** يفحص كوكي `httpOnly` عبر `document.cookie` [OwnerFirstImpressionBanner.tsx:20](src/components/storefront/OwnerFirstImpressionBanner.tsx:20)، والنتيجة دائماً false.
- **جدول بلا تعبئة:** `analytics_daily` لا يُعبَّأ في أي مكان.
- **إعادة البناء تكرر المنتجات:** خطوة `catalog_write` لا تحذف منتجات البناء السابق [build/route.ts:350](src/app/api/workflows/build/route.ts:350).
- **الشعار يضيع:** شعار الاستمارة لا يصل إلى `brand.logo` في `assemble`.
- **تعارض قنوات الوقت الفعلي:** قنوات Pusher للطلبات مفتاحها كود الطلب `CLP-XXXXX` وحده [events.ts:201](src/server/realtime/events.ts:201)، والكود فريد داخل المتجر فقط، فتتصادم القنوات بين المتاجر.

#### 💀 ميتة: مكتوبة لكنها غير مستخدمة في أي صفحة
- **مساعد التسوق والبحث:** `AIShoppingAssistant` و`VisualSearchDialog` و`VoiceSearchButton`، ونقاطها الخلفية تعيد "Service Disabled".
- **الدعم الفني:** نظام كامل في قاعدة البيانات والـ actions (`support_threads` و`SupportChat` و`UnifiedInbox` و`TicketDetailView`)، وبلا أي مسار واجهة.
- **التحليلات المتقدمة:** `CohortMatrix` و`ConversionFunnelV2` و`CustomerLtvCard` و`GeoHeatmap` و`LiveVisitorsMap`.
- **مكونات داشبورد ومتجر:** `AbandonedCartAutomationPanel` و`OverviewDashboard` و`OnboardingProgressCard` و`WelcomeTour` و`PagesEditor` و`ProductsList` و`HeroCarousel` و`HomeSections` و`AmbientMeshShader` و`AudioWaveformPlayer` و`Editable`.
- **مكررات صفحة الهبوط:** `FAQ` و`Showcase` و`AboutFounder`.
- **مسارات ونسخ مكررة:** `/api/render` يعيد عدد الأقسام فقط. ودالة `renderSection` مكررة في [blocks/index.tsx](src/components/blocks/index.tsx) وغير مستخدمة. و`src/app/(platform)/admin/layout.tsx` لا يغلّف أي صفحة.

#### 🎭 مضللة
- "AI Insights" في الداشبورد قواعد ثابتة في [lib/insights.ts](src/lib/insights.ts)، وليست ذكاءً اصطناعياً.
- "QA بالذكاء الاصطناعي" فحص محلي، و`applyFixes` لا تفعل شيئاً [composer.ts:712](src/ai/build/composer.ts:712).

---

### 3. التقييم الصريح لكل جانب

| الجانب | التقييم | السبب المختصر |
|---|---|---|
| الواجهة (UI) | **5/10** | طموحة بصرياً، لكن بلا نظام تصميم: الداشبورد داكن فقط مع 710 لون hex مكتوب يدوياً، ولغتا تصميم منفصلتان للداشبورد والمتجر، ومكتبتا primitives |
| تجربة المستخدم (UX) | **3/10** | ضياع المتجر بعد إعادة الدخول، وروابط مكسورة، ومدة تجربة متناقضة في الواجهة (8 ساعات، 180 دقيقة، 24 ساعة، 12 ساعة، 10 دقائق، 5 دقائق)، واستمارة طويلة يُهمَل أغلب حقولها، والتفعيل مشتت بين `/dashboard/billing` و`/admin/activate` |
| جودة الكود | **3/10** | `tsc` يمر، لكن: 41 `as any` و51 `as unknown as` و52 `: any`، و53 ابتلاعاً صامتاً للأخطاء، و79 `console.*`، وملفات عملاقة (`SettingsForm` 1572 سطراً، و`CommerceStep` 1135 سطراً)، ومنطق مكرر، وملفات مضغوطة في سطر واحد، وكود ميت كثير |
| الأداء | **4/10** | 8 عائلات خطوط عربية في الـ layout الجذري، وصفحة هبوط Client بالكامل، وكل المسارات ديناميكية بلا ISR، وN+1 في قسم الأقسام (استعلامان لكل قسم)، و31 وسم `<img>` خام |
| SEO | **2/10** | لا metadata للمتاجر، وملفات المنصة على نطاقات المتاجر، وsitemap مكسور، ولا JSON-LD للمنتجات، وحقول SEO لا تُستخدم |
| الذكاء الاصطناعي | **4/10** | أساس جيد (سلسلة مزوّدين، قاطع دارة، تسجيل)، لكنه بمفاتيح المنصة فقط، والـ architect لا يرى المنتجات، والـ QA وهمي، ولا مساعد للتاجر، وميزات المتجر معطلة |
| الأمان | **2/10** | ملف الجلسات Server Actions، وإسناد جماعي يتجاوز الدفع، وربط متجر بجلسة عشوائية، وactions بلا مصادقة، وثغرات في OAuth |
| العزل بين التجار | **2/10** | عزل يدوي بلا طبقة مستأجر ولا RLS، ومسارات تسريب قراءة وكتابة مؤكدة (القسم 4) |
| قاعدة البيانات | **4/10** | فهارس وقيود جيدة، لكن الـ migrations غير قابلة لإعادة الإنتاج، وجدول معرّف مرتين، وDDL أثناء التشغيل |
| التشغيل والتوثيق | **3/10** | لا `.env.example`، ولا إعداد cron، وتوثيق لا يطابق الكود، ومراقبة غير مهيأة |
| الاختبارات | **1/10** | ملفا اختبار وحدات فقط (تطبيع عربي وتسعير)، ولا اختبارات تكامل ولا عزل ولا e2e |
| **الإجمالي** | **3/10** | |

---

### 4. العزل بين التجار: الأسباب الجذرية المؤكدة

**الجذر المشترك:** لا توجد "طبقة سياق مستأجر" (tenant context) موحدة. هوية المتجر في الداشبورد تُشتق من صف جلسة قابل للتغيير، لا من قاعدة ملكية ثابتة. وكل استعلام يكتب `eq(storeId)` بيده، فأي شرط منسيّ يعني تسريباً.

| # | الآلية | الموضع | السيناريو والأثر |
|---|---|---|---|
| I1 | المتجر يُقرأ من `sessions.storeId` دون التحقق من المالك | [auth.ts:410](src/server/auth.ts:410) | أي ربط خاطئ يعرض كل بيانات متجر آخر في الداشبورد |
| I2 | ربط متجر بالجلسة الموجودة في المتصفح أياً كان صاحبها | [auth.ts:332](src/server/auth.ts:332) و[submit.ts:270](src/onboarding/submit.ts:270) و[setup/page.tsx:80](src/app/s/[store]/admin/setup/page.tsx:80) | المالك أو تاجر يفتح رابط استمارة أو تفعيل لتاجر آخر في نفس المتصفح، فيُربط متجر الآخر بجلسته |
| I3 | مسار Messenger يُنشئ تاجراً بمعرّف عشوائي، ثم يربط المتجر بجلسة Google لتاجر مختلف | [submit.ts:167](src/onboarding/submit.ts:167) | المتجر يملكه تاجر ويظهر في داشبورد تاجر آخر |
| I4 | صف `intakes` واحد لكل محادثة يُكتب فوقه | [submit.ts:217](src/onboarding/submit.ts:217) و[build/route.ts:179](src/app/api/workflows/build/route.ts:179) | متجر يُبنى بمنتجات متجر آخر |
| I5 | إسناد جماعي يسمح بتغيير `storeId` | [orders.ts:176](src/server/actions/orders.ts:176) و[commerce.ts:25](src/server/actions/commerce.ts:25) | نقل طلب أو عميل إلى متجر آخر |
| I6 | مفاتيح أجنبية عبر المتاجر لا يُتحقق منها | `categoryId` في [products.ts:168](src/server/actions/products.ts:168) والعملية الجماعية "category"، و`productId` في التقييم اليدوي، وعداد الأقسام بلا شرط متجر [catalog.ts:26](src/server/repos/catalog.ts:26) | منتج يشير إلى قسم متجر آخر، وأعداد خاطئة |
| I7 | بيانات المنصة على نطاقات المتاجر | [layout.tsx:14](src/app/layout.tsx:14) و[middleware.ts:108](src/middleware.ts:108) | عنوان التبويب "Colapia"، وأيقونة المنصة، و`robots` و`manifest` المنصة |
| I8 | المتاجر تحت `colapia.com/s/<sub>` بـ origin مشترك | [middleware.ts:75](src/middleware.ts:75) و[RecentlyViewed.tsx:10](src/components/storefront/RecentlyViewed.tsx:10) | "شاهدت مؤخراً" يعرض منتجات متجر آخر، والروابط الداخلية تنكسر |
| I9 | قنوات Pusher للطلبات مفتاحها كود غير فريد عالمياً | [events.ts:201](src/server/realtime/events.ts:201) | إشعارات طلب متجر تصل لعميل متجر آخر عند تطابق الكود |
| I10 | `/api/track` و`/api/live` و`/api/proof` تقبل أي `storeId` | [track/route.ts:83](src/app/api/track/route.ts:83) و[live/route.ts:4](src/app/api/live/route.ts:4) | تحليلات مزيفة لأي متجر، وتضخيم مشاهدات منتجات الغير، وكتابة مفاتيح Redis عشوائية، وكشف طلبات حديثة لمتاجر مجمدة |
| I11 | كوكي العميل على `.colapia.com` لكل المتاجر | [auth.ts](src/server/auth.ts) (`getCookieDomain`) | الدخول في متجر يُخرج العميل من متجر آخر (تجربة سيئة، دون تسريب) |
| I12 | لا RLS ولا طبقة وصول بيانات تفرض المستأجر | كل `src/server/**` | تسريب جديد مع كل استعلام يُنسى فيه شرط المتجر |

---

### 5. الأمان بالتفصيل

#### 🔴 حرج
- **S1:** `"use server"` على [src/server/auth.ts:1](src/server/auth.ts:1). كل دوال الجلسات قابلة للتحول إلى نقاط استدعاء عامة، ومنها `loginMerchant` و`loginPlatform` بلا أي تحقق.
- **S2:** الإسناد الجماعي في [blueprint.ts:156](src/server/actions/blueprint.ts:156). التاجر يضبط `status: "active"` ويتجاوز الدفع كلياً، أو يغيّر `merchantId` و`subdomain` و`deletedAt`.
- **S3:** ربط متجر بجلسة عشوائية (I1 وI2 وI3).
- **S4:** Server Actions بلا مصادقة:
  - `submitPlatformPaymentAction` لأي نطاق فرعي. المهاجم يرفع إيصالاً مزيفاً فيحجز الخانة الفريدة `under_review`، فيعود إرسال التاجر الحقيقي بـ `ok: true` صامتاً دون تسجيل، ويؤجّل التجميد والحذف بلا حد.
  - `listSnapshots` و`ensureShippingZones`.

#### 🟠 مرتفع
- **S5:** ثغرات OAuth:
  - الـ `state` غير مربوط بالمتصفح (لا nonce في كوكي)، فيمكن تنفيذ Login CSRF.
  - [oauth-state.ts:46](src/server/oauth-state.ts:46) يقبل JSON بصيغة base64 غير موقّع، و[oauth-state.ts:71](src/server/oauth-state.ts:71) يقبل أي نص ويعامله كتاجر.
  - سر احتياطي مكتوب في الكود [oauth-state.ts:5](src/server/oauth-state.ts:5).
  - لا فحص لـ `verified_email` من Google.
  - ربط الحسابات يتم بالبريد فقط.
- **S6:** كتابات عابرة للمتاجر: `viewCount` وتقييم المنتج، وتحديث `payments` بشرط `orderId` وحده [orders.ts:159](src/server/actions/orders.ts:159).
- **S7:** سر الـ cron مقبول في query string [ops/sweep:18](src/app/api/ops/sweep/route.ts:18)، فيُسجَّل في السجلات، ويُقارن بمقارنة غير ثابتة الزمن.
- **S8:** `/api/live` بلا مصادقة ولا حد معدل، ويكتب في Redis بمفاتيح يحددها المستخدم.
- **S9:** `transferScreenshotUrl` في الـ checkout يقبل أي رابط، بينما دفع المنصة يتحقق من المضيف.

#### 🟡 متوسط
- **S10:** CSP يسمح بـ `'unsafe-inline'` للسكربتات، ورأس `X-XSS-Protection` متقادم.
- **S11:** مستمع `postMessage` في المحرر [EditorProvider.tsx](src/editor/EditorProvider.tsx) لا يتحقق من `origin`، والإرسال يتم بـ `"*"`.
- **S12:** صيغتان مختلفتان لتجزئة كلمات المرور، إحداهما `sha256` ضعيفة.
- **S13:** حدود المعدل fail-open، ومفتاح حد التتبع هو `vid` الذي يرسله العميل [track/route.ts:42](src/app/api/track/route.ts:42).
- **S14:** DDL أثناء التشغيل: `ensureDbSchema` [client.ts:13](src/db/client.ts:13) تُنفّذ `ALTER TABLE` عند فتح صفحات الأدمن.
- **S15:** `magic_links` تخزن معرّف العميل في عمود اسمه `merchantId`.

---

### 6. قاعدة البيانات والمخططات

**جيد:**
- المبالغ بالقروش.
- فهارس مركبة على `(store_id, …)`.
- قيد فريد `(store_id, slug)`.
- قيود CHECK للمخزون والخصومات.
- فهرس `pg_trgm` للبحث.

**مشكلات:**
- **migrations غير قابلة لإعادة الإنتاج.** الملف `0000` فارغ (placeholder)، والجداول الأساسية أُنشئت تاريخياً بـ `db:push`. وتوجد ملفات SQL يدوية خارج الـ journal (`0001_search` و`0005_hardened_constraints_and_voice`) لن يشغّلها `drizzle-kit migrate`، ورقمان مكرران (0001 و0005). **لا يمكن بناء قاعدة جديدة من الصفر بشكل موثوق.** وهذا عائق مباشر أمام نموذج "قاعدة Neon لكل تاجر".
- **جدول `system_events` معرّف مرتين** بشكلين مختلفين: [system.ts:4](src/db/schema/system.ts:4) و[ops.ts:29](src/db/schema/ops.ts:29). حُسم التعارض بإعادة تصدير يدوية في [index.ts:15](src/db/schema/index.ts:15)، فصار الـ logger يكتب `scope` و`message` فقط ويضيّع المستوى والمتجر والتاجر و`reqId`.
- **لا RLS**، وجداول تشغيلية فيها `store_id` بلا مفتاح أجنبي (`system_events` و`ai_calls` و`platform_reviews`).
- **`analytics_events` بلا سياسة احتفاظ ولا تقسيم**، و`analytics_daily` لا يُعبَّأ.
- **حالات قديمة في الـ enums** (`intake` و`review`) بدلالات مربكة، وعمود `plan` افتراضيه `"launch"`، ومكافأة الإحالة `free_month` تناقض نموذج الدفع الواحد.

---

### 7. تكامل الذكاء الاصطناعي

**الموجود:** [providers.ts](src/ai/providers.ts) فيه سلاسل احتياط لكل مستوى، وقاطع دارة في Redis، وتعلّم حدود التوكنز، وإصلاح JSON، وتسجيل كل استدعاء في `ai_calls`. أساس صالح لإعادة الاستخدام.

**المشكلات:**
- **كل الاستدعاءات بمفاتيح المنصة.** لا يوجد تمرير لمفاتيح خاصة بالتاجر (BYOK).
- **الـ architect لا يرى المنتجات.** يُمرَّر له `brief` فقط [composer.ts:446](src/ai/build/composer.ts:446)، وحقول الجمهور والمنافسين تُستبدل بقيم ثابتة مثل "عام" و"غير محدد". فيصبح توزيع المنتجات على الأقسام تخميناً يسقط غالباً على أول قسم.
- **البرومبتات القابلة للتعديل يتجاهلها البناء.** الـ composer يستخدم `DEFAULT_PROMPTS` مباشرة، رغم وجود جدول `prompts` ودالة `getPrompt` يستخدمهما البوت فقط.
- **الـ QA وهمي**، و`applyFixes` لا تفعل شيئاً.
- **الـ Blueprint الناتج لا يُتحقق منه بـ Zod قبل الحفظ**، وأي انحراف يجعل المتجر 404 لأن `getBlueprintOrNull` تعيد `null` عند فشل التحليل.
- **`resolveVariationSeed` تستخدم `Date.now()` في كل استدعاء**، فالنتيجة غير حتمية بين الخطوات.
- **معرّفات نماذج قديمة** (`gemini-2.0-flash` و`gemini-1.5-flash-8b` و`llama-3.3-70b`).
- **لا يوجد مساعد ذكي للتاجر داخل الداشبورد.** لم أجده في الكود.

---

### 8. تجربة التسجيل والبناء (Onboarding)

**المسار الحالي:**
1. Google ثم `/dashboard/onboarding`.
2. إنشاء محادثة من نوع `messenger` بمعرّف خارجي مصطنع `merchant_<id>` لمستخدمي الويب (حيلة لإعادة استخدام مسار البوت).
3. رابط استمارة من 5 خطوات.
4. الإرسال يطلق البناء، ثم تظهر شاشة بناء حية.

**المشكلات:**
- الاستمارة طويلة جداً: `CommerceStep` 1135 سطراً و`ReviewStep` 818 سطراً. تطلب الجمهور والمنافسين وميزانية التسويق الشهرية والطلبات المتوقعة، **ولا يستخدم البناء أغلب ذلك**. احتكاك بلا قيمة.
- واجهات الاستمارة تعتمد على التوكن وحده، ومع ذلك تربط المتجر بجلسة المتصفح (I2).
- مدة التجربة متناقضة في الواجهة والبوت والتوثيق والإعدادات (`TRIAL_ACTIVE_MINUTES=480` و`TRIAL_HOURS=24` و"180 دقيقة" في التوثيق).
- مكتبة المنتجات الجاهزة تعرض صوراً بديلة من `picsum.photos`.
- لا شرح مرئي في أي خطوة. لم أجده في الكود.

---

### 9. الداشبورد

**الصفحات الموجودة:** نظرة عامة، المنتجات، تحرير منتج، الأقسام، الطلبات، تفاصيل الطلب مع فاتورة للطباعة، العملاء، الخصومات، الشحن، التقييمات، المحتوى، الإعدادات (`SettingsForm` 1572 سطراً)، التحليلات، الدفع، النمو، قائمة المتاجر وتفاصيلها.

**المشكلات:**
- وضع داكن فقط بألوان مكتوبة يدوياً بلا design tokens.
- روابط إلى صفحات غير موجودة.
- مركز إشعارات بعدّاد ثابت `0`.
- إشعار الطلبات الجديدة مزدوج: polling وPusher معاً.
- لا تصدير للطلبات أو العملاء رغم وجود الأزرار.
- لا إدارة للفواتير كوحدة مستقلة.
- لا لوحة مفاتيح ولا شرح مرئي ولا مساعد ذكي.
- الحفظ غير ذري في `saveShippingAction`: يحذف ثم يُدرج دون batch [commerce.ts:20](src/server/actions/commerce.ts:20)، فإن فشل الإدراج يفقد المتجر كل مناطق الشحن.

---

### 10. واجهة المتجر

**جيد:** نظام ثيمات من لوحة ألوان، وأقسام بمتغيرات متعددة، ودعم RTL، وحركات تحترم `prefers-reduced-motion`، وأدوات تحويل.

**المشكلات:**
- لا metadata ولا SEO (القسم 12).
- منطق جلب المنتجات مكرر بدلالتين مختلفتين لوسم `tag`: `@>` في [registry.tsx](src/blueprint/registry.tsx) و`?` في [catalog.ts](src/server/repos/catalog.ts).
- N+1 في قسم الأقسام.
- `GATED_STATUSES` مكررة بين الـ layout والصفحة الرئيسية.
- مكونات ثقيلة ميتة، و`<img>` خام بلا تحسين.
- عرض ثلاثي الأبعاد وAR بمكتبة `@google/model-viewer` لميزة لا يغذيها أي إدخال في الداشبورد.

---

### 11. الأداء

- 8 عائلات خطوط Google عربية تُعرَّف في [fonts.ts](src/lib/fonts.ts) وتُحقن متغيراتها في كل صفحة.
- صفحة الهبوط كلها مكوّن عميل (`LandingClient`)، فتتأثر سرعة أول رسم والـ SEO.
- كل صفحات المتجر ديناميكية بلا ISR ولا كاش صفحات. يخفف كاش Redis للمتجر والـ Blueprint جزئياً.
- استعلامات N+1، وحزم ثقيلة (`model-viewer` و`recharts` و`exceljs` و`motion`).
- لا قياس أداء ولا Web Vitals مهيأة. لم أجده في الكود.

---

### 12. SEO

- **المتاجر:**
  - لا `generateMetadata` في أي صفحة متجر، ولا canonical.
  - لا JSON-LD للمنتج أو المتجر أو مسار التنقل. يوجد فقط FAQ JSON-LD في قسم الأسئلة، ودوال [seo-helpers.ts](src/lib/seo-helpers.ts) غير مستخدمة.
  - `seoTitle` و`seoDescription` و`bp.seo` لا تُستخدم.
  - `sitemap.xml` يعيد 404، والـ robots للمنصة.
- **المنصة:** صفحة هبوط تُصيَّر في العميل، ولا صورة OG مخصصة لكل متجر.

---

### 13. جودة الكود والتنظيم

**إيجابي:** فحص الأنواع يمر بلا أخطاء.

**سلبي:**
- `next.config.ts` يُخفي أي أخطاء مستقبلية: `ignoreBuildErrors: true` [next.config.ts:84](next.config.ts:84) و`ignoreDuringBuilds: true` [next.config.ts:83](next.config.ts:83).
- 144 تحايلاً على الأنواع، و53 ابتلاعاً صامتاً للأخطاء (`.catch(() => {})` و`catch {}`).
- ملفات مضغوطة في سطر واحد يصعب قراءتها: `commerce.ts` و`proof/route.ts` و`platform-conv.ts` و`RecentlyViewed.tsx`.
- ملفات تبدأ بـ BOM، وتعليقات تسرد "التعديلات الجذرية" بدل شرح النية.
- أشكال نتائج متضاربة للـ actions: `{ok, error}` و`{error}` ورمي الاستثناء.
- كود ميت كثير (القسم 2).
- ملفا اختبار فقط.

---

### 14. البيئة والتشغيل

- [env.ts](src/lib/env.ts) يفرض عند الإقلاع أسرار كل المزوّدين، بما فيها أرقام فودافون كاش وإنستاباي ومفتاح Morpheus. التطبيق لا يقلع دون حسابات المنصة كلها.
- لا `.env.example`، ولا إعداد cron، والمراقبة (Sentry وOTel) مثبتة وغير مهيأة.
- التسعير له مصدران: `NEXT_PUBLIC_PLATFORM_PRICE` في الواجهة و`PLATFORM_PRICE_EGP` في الخادم.

---

### 15. الفجوات بين الوضع الحالي والنموذج الجديد

| متطلب النموذج الجديد | الوضع الحالي | الفجوة |
|---|---|---|
| لا اشتراكات ولا عمولة ولا رسوم خفية | الرسائل تقول "دفعة واحدة" | مكافأة `free_month` في الإحالات، وسعران من مصدرين، ولا صفحة شفافية تكاليف |
| تجربة مجانية كاملة 24 ساعة (متجر + داشبورد) | دلالات تجربة متضاربة، وتجميد ثم حذف | توحيد مصدر واحد للمدة، وتجربة متاحة فور التسجيل دون انتظار مراجعة |
| دفع مرة واحدة | صورة تحويل يدوية، وفحص Vision، وتأكيد بشري | لا بوابة دفع آلية، والتفعيل مشتت، ونقطة الدفع بلا مصادقة (S4) |
| لوحة إدخال مفاتيح التاجر بعد الدفع | **غير موجودة** | جدول بيانات اعتماد مشفّر (`ENCRYPTION_KEY` موجود وغير مستخدم)، واختبار اتصال لكل مزوّد، وحالة صحة كل مفتاح، وتدوير المفاتيح |
| قاعدة Neon للتاجر نفسه | قاعدة واحدة للمنصة | تحويل معماري: قاعدة تحكم للمنصة + قاعدة بيانات لكل تاجر، مع سجل اتصالات، وتشغيل migrations لكل قاعدة (والـ migrations الحالية غير قابلة لإعادة الإنتاج)، ونقل بيانات التجربة من قاعدة المنصة إلى قاعدة التاجر |
| ذكاء اصطناعي بحساب التاجر (Groq وغيره) | مفاتيح المنصة فقط | تمرير مفاتيح المستأجر إلى `providers.ts`، وإعادة تفعيل ميزات AI في المتجر لأن تكلفتها صارت على التاجر |
| UploadThing بحساب التاجر | حساب واحد للمنصة | الـ File Router الحالي مصمم لتوكن واحد، ويلزم مسار رفع يستخدم توكن التاجر، وترحيل الملفات |
| شرح مرئي داخل الداشبورد | **غير موجود** | نظام أدلة خطوة بخطوة لكل مزوّد، مع لقطات أو فيديو وتحقق حي |
| تحميل كود المشروع كاملاً | **غير موجود** | الكود متعدد المستأجرين ومربوط بخدمات المنصة (QStash وPusher وResend وRedis). يلزم وضع "مستأجر واحد"، وقالب env، وتصدير بيانات، وتوليد أرشيف |
| عزل تام | عزل يدوي مع 12 مسار تسريب | طبقة سياق مستأجر إلزامية، وملكية صريحة، وعزل مادي إذا اعتُمدت قاعدة لكل تاجر |
| بنية المنصة نفسها | Redis وQStash وPusher وResend على حساب المنصة | تقليص الاعتماد عليها أو جعلها اختيارية، حتى لا تتحول تكلفتها المتكررة إلى عبء على نموذج الدفعة الواحدة |

---

### 16. الحكم: ما يُحذف، وما يُعاد بناؤه، وما يُطوَّر

#### 🗑️ يُحذف
- **ملفات خارج الكود:** `bundle2.txt` و`omar.md` والملفات الفارغة الشاردة، ووثائق مكررة أو غير مطابقة.
- **مخطط مكرر:** [schema/ops.ts](src/db/schema/ops.ts) (تعريف `system_events` المكرر).
- **كود ميت:** [blocks/index.tsx](src/components/blocks/index.tsx) و`/api/render`، وكل المكونات الميتة في القسم 2. ما يستحق منها يُعاد بناؤه بشكل كامل لا يُحيا كما هو.
- **ممارسات خطرة:** `ensureDbSchema` (DDL وقت التشغيل)، ومسارات الاحتياط غير الموقعة في `oauth-state`، و`ignoreBuildErrors` و`ignoreDuringBuilds`.
- **بقايا النموذج القديم:** مكافأة `free_month`، والحالات القديمة في الـ enums.
- **بوت Messenger/Instagram:** خاضع لقرار (انظر الأسئلة المفتوحة).

#### 🏗️ يُعاد بناؤه من الصفر
- المصادقة والجلسات وطبقة سياق المستأجر وقاعدة الملكية.
- طبقة الوصول للبيانات مع فرض المستأجر إلزامياً، مع RLS أو قاعدة لكل تاجر.
- خط أساس للـ migrations قابل لإعادة الإنتاج.
- الاستمارة (أقصر وأذكى)، وحفظ خط البناء (intake لكل متجر، وكتابة كتالوج idempotent، والتحقق من الـ Blueprint).
- طبقة SEO للمتاجر، ونظام تصميم الداشبورد بـ tokens.
- مسار التفعيل والدفع، والتسجيل والمراقبة.

#### 🔧 يُطوَّر ويُحتفظ به
- مفهوم الـ Blueprint والـ registry، ومحرك الألوان والثيمات.
- منطق تسعير الـ checkout، وتطبيع البحث العربي، وسلة zustand.
- سلسلة مزوّدي AI (تُعاد هيكلتها لمفاتيح التاجر)، وقوالب البريد، وبيانات المحافظات.

---

### 17. الأسئلة المفتوحة: حُسمت كلها

الإجابات موثقة في "قرارات المالك" بالجزء (ب):
- **قاعدة لكل تاجر:** نعم، بعد الدفع. وأثناء التجربة تبقى البيانات في قاعدة المنصة.
- **الدفع:** تحويل يدوي بقبول فوري.
- **البوت:** يبقى.
- **السوق:** مصر أولاً.
- **النطاقات المخصصة:** تُحذف.
