# دليل Colapia على Cloudflare (للمالك، خطوة بخطوة)

> **الخلاصة أولاً:** الكود صار يعمل على Cloudflare Workers وعلى Vercel معاً، فلا شيء يتوقف قبل أن تكمل الخطوات.
> **قياس فعلي (2026-10-13):** حزمة Colapia بعد الضغط **6.1 ميجابايت**. الخطة المجانية لـ Workers تقبل **3 ميجابايت** فقط
> (ووقت معالجة 10 مللي ثانية لكل طلب، وصفحات المتجر تحتاج أكثر)، فالتطبيق **لا يُنشر على الخطة المجانية**. الخطة
> المدفوعة **Workers Paid (5$ شهرياً)** تقبل 10 ميجابايت ووقتاً كافياً. التوصية: ابقَ على الاستضافة الحالية للتجربة،
> وانقل إلى Cloudflare مع الاشتراك بـ 5$ عند أول متجر حقيقي (أو قبله إن أردت). R2 (القسم 1) مجاني حتى 10 جيجابايت
> ويعمل الآن من أي استضافة.

> كل خطوة هنا تفعلها مرة واحدة. لا تضع أي مفتاح في المستودع: المفاتيح في لوحة Cloudflare فقط.

## 1) مساحة الصور (R2)

R2 هي مساحة الملفات الجديدة بدل UploadThing: الصور تُرفع من المتصفح مباشرة وتُعرض من نطاق Colapia بلا تكلفة تنزيل.
الكود يعمل الآن على الطريقتين: ما لم تكمل هذه الخطوات يبقى الرفع على UploadThing كما هو، وبمجرد ضبط المتغيرات أدناه
يتحول الرفع الجديد إلى R2. الصور القديمة على UploadThing تبقى ظاهرة.

1. **أنشئ الـ bucket:** لوحة Cloudflare ← R2 ← Create bucket ← الاسم `colapia-media` ← الموقع Automatic.
2. **اربط نطاقاً للعرض:** افتح الـ bucket ← Settings ← Custom Domains ← Connect Domain ← `media.colapia.com` (يتطلب أن
   يكون colapia.com على Cloudflare). هذا رابط الصور العام.
3. **اسمح بالرفع من المتصفح (CORS):** نفس الصفحة ← CORS Policy ← Add CORS policy، والصق:
   ```json
   [{ "AllowedOrigins": ["*"], "AllowedMethods": ["PUT"], "AllowedHeaders": ["content-type"], "MaxAgeSeconds": 3600 }]
   ```
   (`*` لأن المتاجر تعمل أيضاً على نطاقات عملائها الخاصة؛ الأمان من التوقيع: كل رابط رفع صالح 10 دقائق لملف واحد
   بنوعه وحجمه فقط.)
4. **احذف ملفات البحث بالصورة المؤقتة تلقائياً:** Settings ← Object lifecycle rules ← Add rule ← Prefix `tmp/` ← Delete
   objects after **1 day**.
5. **مفتاح الوصول:** R2 ← Manage R2 API Tokens ← Create API token ← الصلاحية **Object Read & Write** ← Apply to specific
   bucket only ← `colapia-media` ← Create. انسخ: Access Key ID وSecret Access Key، ورقم الحساب (Account ID) من نفس الصفحة.
6. **المتغيرات** (في إعدادات الاستضافة؛ على Vercel الآن، وعلى Cloudflare بعد النقل):
   - `R2_ACCOUNT_ID` = رقم الحساب
   - `R2_ACCESS_KEY_ID` و`R2_SECRET_ACCESS_KEY` = من الخطوة 5
   - `R2_BUCKET` = `colapia-media`
   - `NEXT_PUBLIC_MEDIA_BASE_URL` = `https://media.colapia.com`
   - `NEXT_PUBLIC_MEDIA_PROVIDER` = `r2`  ← هذا ما يحوّل الرفع إلى R2 (يتطلب إعادة نشر).
7. **جرّب:** ارفع صورة منتج من لوحة متجر تجريبي، وتأكد أن رابطها يبدأ بـ `https://media.colapia.com/`.

بعد التحويل يمكن ترك `UPLOADTHING_TOKEN` حتى تُحذف الصور القديمة مع متاجرها، أو إزالته إن لم تبقَ صور قديمة.

## 2) الحساب والنطاق

1. **أضف colapia.com إلى Cloudflare** (إن لم يكن): لوحة Cloudflare ← Add a domain ← `colapia.com` ← الخطة Free (خطة
   النطاق مجانية؛ المدفوع هو Workers فقط) ← سيعطيك Cloudflare عنواني Nameservers: ضعهما مكان الحاليين عند الشركة التي
   اشتريت منها النطاق. انتظر رسالة «Active» (دقائق إلى ساعات). **قبل تغيير الـ Nameservers** تأكد أن Cloudflare نسخ سجلات
   البريد (MX وسجلات Resend TXT) من صفحة DNS، وإلا يتوقف البريد.
2. **اشترك في Workers Paid:** Workers & Pages ← Plans ← Workers Paid (5$).

## 3) ربط المستودع والنشر التلقائي

1. Workers & Pages ← Create ← Import a repository ← اربط GitHub واختر `colapia17`.
2. الإعدادات:
   - Project name: `colapia` (لازم يطابق `name` في `wrangler.jsonc`).
   - Production branch: `main`.
   - Build command: `npx opennextjs-cloudflare build`
   - Deploy command: `npx opennextjs-cloudflare deploy`
3. **Build variables** (تدخل في الكود وقت البناء، وليست أسراراً):
   - `NEXT_PUBLIC_ROOT_DOMAIN` = `colapia.com`
   - `NEXT_PUBLIC_APP_URL` = `https://colapia.com`
   - `NEXT_PUBLIC_MEDIA_PROVIDER` = `r2` و`NEXT_PUBLIC_MEDIA_BASE_URL` = `https://media.colapia.com` (بعد القسم 1)
   - `NEXT_PUBLIC_PUSHER_KEY` و`NEXT_PUBLIC_PUSHER_CLUSTER` إن كانا مضبوطين على Vercel.
4. احفظ وانشر. أول نشر يعطيك رابطاً مثل `colapia.<حسابك>.workers.dev` (للفحص فقط؛ معاينة متجر عليه تحتاج
   `?store=<slug>&key=<STORE_PREVIEW_KEY>`).

## 4) المتغيرات والأسرار (وقت التشغيل)

مشروع `colapia` ← Settings ← Variables and Secrets ← Add، وانسخ **كل** المتغيرات الموجودة الآن في Vercel (Settings ←
Environment Variables) بنفس الأسماء والقيم، ونوعها **Secret** لكل مفتاح. الأهم: `DATABASE_URL`، `AUTH_SECRET`،
`UPSTASH_REDIS_REST_URL/TOKEN`، `QSTASH_*`، `RESEND_API_KEY`، `GOOGLE_CLIENT_ID/SECRET`، `GROQ_API_KEY`، `GEMINI_API_KEY`،
`META_*`، `R2_*`، `STORE_PREVIEW_KEY`، **و`CRON_SECRET` إلزامي** (المهام المجدولة تتوقف بدونه). المتغيرات غير السرية
(`ROOT_DOMAIN` و`TRUST_CF_CONNECTING_IP`) مكتوبة في `wrangler.jsonc` ولا تحتاج إدخالاً.

جديد على Cloudflare فقط:
- **تسليم الكود** («نزّل مشروع المتجر ZIP»): Cloudflare لا يحمل ملفات المشروع، فتُقرأ من GitHub بنفس الإصدار المنشور.
  أنشئ توكن: github.com ← Settings ← Developer settings ← Fine-grained tokens ← Repository access: `colapia17` وحده ←
  Permissions: Contents = **Read and write** (نفس توكن التجهيز الآلي `STORES_GITHUB_TOKEN` إن كان موجوداً)، وضع
  `STORES_GITHUB_TOKEN` و`STORES_GITHUB_REPO` = `omarmaher23942-wq/colapia17`.
- **النطاقات الخاصة للعملاء:** القسم 6.

## 5) توجيه colapia.com والمتاجر إلى Workers

1. **DNS** (colapia.com ← DNS ← Records): احذف سجلات Vercel القديمة لـ `@` و`*` و`www`، ثم أضف (كلها Proxied، السحابة
   البرتقالية):
   - `AAAA` الاسم `@` القيمة `100::`
   - `AAAA` الاسم `*` القيمة `100::`  (كل المتاجر `<slug>.colapia.com`)
   - `AAAA` الاسم `customers` القيمة `100::`  (نطاق استقبال النطاقات الخاصة، القسم 6)
   - `CNAME` الاسم `www` القيمة `colapia.com`
   (`100::` عنوان رمزي: الطلب لا يذهب لأي خادم، بل يلتقطه الـ Worker.)
2. **المسارات:** المسار `*/*` على colapia.com يُنشأ تلقائياً مع كل نشر (من `wrangler.jsonc`)، ويلتقط colapia.com والمتاجر
   ونطاقات العملاء. أضف أنت استثناء الصور مرة واحدة: colapia.com ← Workers Routes ← Add route ← Route:
   `media.colapia.com/*` ← Worker: **None** ← Save، حتى تبقى الصور تُخدم من R2 مباشرة.
   (لذلك يجب أن يكون colapia.com على Cloudflare قبل أول نشر: القسم 2 أولاً.)
3. **SSL/TLS** ← Overview ← Full (strict). وEdge Certificates ← Always Use HTTPS: On.

## 6) النطاقات الخاصة للعملاء (Cloudflare for SaaS، أول 100 نطاق مجاناً)

1. colapia.com ← SSL/TLS ← Custom Hostnames ← Enable (قد يطلب وسيلة دفع؛ أول 100 مجاناً).
2. Fallback Origin ← `customers.colapia.com` ← Add (انتظر Active).
3. توكن API: My Profile ← API Tokens ← Create Token ← Custom ← Permissions: Zone ← **SSL and Certificates** ← Edit ←
   Zone Resources: Include ← Specific zone ← colapia.com ← Create. ضعه في `CF_API_TOKEN`، وضع رقم المنطقة (Zone ID من صفحة
   Overview للنطاق، يمين الصفحة) في `CF_ZONE_ID`.
4. من الآن: حين يكتب التاجر نطاقه في لوحته تُضاف نطاقاته لـ Cloudflare تلقائياً، ويرى سجلاً واحداً: `CNAME` إلى
   `customers.colapia.com` (والجذري `CNAME @`، تسميه بعض الشركات ALIAS). متى أضافه تصدر الشهادة وحدها، والفحص الدوري
   (أو زر «افحص الآن») يفعّله. بدون التوكن يظهر للتاجر نفس السجل، وتضيفه أنت يدوياً: Custom Hostnames ← Add ← ثم «أكّد» في
   صفحة المتجر بلوحتك.
5. نطاقات عملاء مربوطة سابقاً على Vercel: احذفها وأعد إضافتها من لوحة التاجر بعد النقل (لا يوجد عملاء بها الآن).

## 7) المهام المجدولة

لا تحتاج شيئاً: `wrangler.jsonc` يشغّل `ops/sweep` كل 10 دقائق و`ops/tick` يومياً 04:00 UTC (06:00 القاهرة شتاءً)
بسر `CRON_SECRET`. بعد النقل احذف جدولي `ops/sweep` و`ops/tick` من Upstash QStash ← Schedules إن كنت أنشأتهما (حتى لا
تعمل المهمة مرتين). **لا تحذف حساب QStash نفسه:** رسائل التجربة والإيقاف والتذكير المؤجلة تستخدمه.

## 8) بعد النقل: افحص

1. `https://colapia.com/api/health` ← `"ok": true` (القاعدة وRedis).
2. الهبوط، و`/start` (أرسل طلباً تجريبياً)، ودخول لوحة الوكالة بـ Google (روابط Google لم تتغير لأن النطاق نفسه).
3. متجر تجريبي `<slug>.colapia.com`: صفحة منتج، سلة، طلب، ثم لوحة التاجر.
4. ارفع صورة منتج (R2)، وجرّب «دوّري بالصورة».
5. رسالة لصفحة فيسبوك/إنستجرام: الوكيل يرد (رابط Webhook في Meta لم يتغير).
6. في لوحة Cloudflare ← colapia ← Logs: لا أخطاء متكررة.

**الرجوع لو حدثت مشكلة:** أعد سجلات DNS في القسم 5 لقيم Vercel القديمة واجعلها DNS only (السحابة الرمادية)؛ Vercel يبقى منشوراً من `main`
طوال الوقت حتى تقرر إيقافه.

## 9) التكلفة الشهرية المتوقعة

- Workers Paid: **5$** (يشمل 10 ملايين طلب و30 مليون مللي ثانية معالجة؛ الزيادة بسنتات).
- R2: مجاني حتى 10 جيجابايت تخزين، والتنزيل مجاني دائماً.
- تحسين الصور (Images): أول 5,000 تحويل فريد شهرياً مجاناً.
- Custom Hostnames: أول 100 نطاق مجاناً، ثم 0.10$ للنطاق شهرياً.
- Neon وUpstash وResend وGroq كما هي الآن.

