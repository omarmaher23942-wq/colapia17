# دليل النشر: Railway وCloudflare (خطوة بخطوة، للمبتدئ)

> مكتوب لمن لم يستخدم Railway ولا Cloudflare من قبل. اتبع الترتيب كما هو، ولا تقفز خطوة. كل خطوة فيها «كيف أتأكد أنها نجحت» و«ماذا أفعل إن فشلت».
> **القاعدة الذهبية:** لا تغيّر شيئاً في Vercel ولا في الدومين قبل الجزء 4. كل ما قبله لا يوقف موقعك الحالي.
> علامة **[تحقق]** = معلومة تتغير في واجهات هذه المواقع؛ إن رأيت شيئاً مختلفاً عمّا هنا فاتبع ما تراه واكتب لي.

---

## 0) الصورة الكبيرة: ما الذي نفعله ولماذا

| الشيء | أين يعيش | ملاحظة |
|---|---|---|
| **التطبيق** (الموقع + اللوحة + كل المتاجر) | **Railway** | تطبيق واحد يخدم كل التجار. يعرف أي متجر المطلوب من اسم النطاق (`nova.colapia.com`). |
| **قاعدة البيانات** | Neon (كما هي) | لا تتغير، ولا تُنقل. |
| **صور المتاجر** | UploadThing (كما هي) | لا تتغير. |
| **Redis والمهام المجدولة** | Upstash (كما هي) | لا تتغير. |
| **الدومين** `colapia.com` وكل `*.colapia.com` | **Cloudflare** (يقف أمام Railway) | يحمي، ويعطي شهادة الأمان للنطاقات الفرعية، ويخفي عنوان Railway. |

لماذا Cloudflare؟ كل متجر يأخذ رابطاً مثل `nova.colapia.com`. نحتاج «نطاق نجمة» `*.colapia.com` يشير لتطبيقنا، وCloudflare يقدّمه مجاناً مع شهادة SSL، ويمكنك لاحقاً إضافة حماية من الهجمات.

**التكلفة المتوقعة** [تحقق من railway.com/pricing]: حساب Railway الجديد يعطي رصيد تجربة **5 دولار** لمرة واحدة. بعد انتهائه تحتاج خطة **Hobby (5 دولار شهرياً تتضمن 5 دولار استهلاك)**. Cloudflare وNeon وUpstash وUploadThing على خططها المجانية في البداية.

**حسابان على Railway (قرارك):**
- **الحساب أ (التجريبي):** نجرّب عليه ونربطه بـ `colapia.com` الآن. لا نشحنه حتى يأتي متجر فعلي.
- **الحساب ب (الإطلاق):** يوم إطلاق الإعلانات. الانتقال من أ إلى ب = **تغيير سجلات DNS في Cloudflare فقط** (الجزء 7)، لأن كل شيء آخر خارج Railway.

---

## 1) قبل أن تبدأ: ما تحتاجه (10 دقائق)

1. حساب **GitHub** (عندك) والمستودع `omarmaher23942-wq/colapia17` عليه آخر كود (فرع `main`).
2. كل **متغيرات البيئة** الحالية من مشروع Vercel: افتح Vercel ← المشروع ← Settings ← Environment Variables، وانسخها في ملف ملاحظات على جهازك (لا تلصقها في أي دردشة ولا في GitHub). ستحتاجها في الجزء 3.
3. وصول لحساب **Neon** (لتحديث قاعدة البيانات في الجزء 2).
4. وصول لمكان تسجيل الدومين: **أين اشتريت `colapia.com`؟** (Vercel، أو Namecheap، أو غيره). الجزء 4 يتفرع حسب الإجابة.

---

## 2) تحديث قاعدة البيانات (من جهازك) — مرة واحدة

> هذه الخطوة تُنفَّذ من **جهازك أنت**، لأن مفتاح القاعدة الحقيقي عندك فقط.

1. افتح الطرفية في مجلد المشروع وحدّث الكود: `git pull origin main`
2. تأكد أن ملف `.env.local` فيه `DATABASE_URL` الحقيقي (لا يُرفع إلى GitHub أبداً).
3. **خذ نسخة احتياطية أولاً:** في لوحة Neon ← Branches ← Create branch (من الفرع الرئيسي). هذا نسخة آمنة في ثوانٍ.
4. شغّل: `npm run db:migrate`
   - يطبّق الملفات `0003` و`0004` و`0005` (الأخيرة تضيف حقول الاشتراك: `hosting_expires_at` وأخواتها). **آمن:** يضيف فقط، لا يحذف.
5. **كيف أتأكد؟** يطبع `✓ القاعدة محدّثة بكل الـ migrations`.

### حذف المتاجر التجريبية الحالية (قبل الإطلاق وليس الآن)
بقرارك، كل المتاجر الحالية تُحذف قبل الإطلاق. الأداة تعرض أولاً ما سيُحذف دون أن تحذف:
```
npx tsx scripts/ops/wipe-stores.ts
```
راجع القائمة. وللحذف الفعلي (بعد النسخة الاحتياطية من Neon):
```
npx tsx scripts/ops/wipe-stores.ts --execute --confirm=DELETE-ALL-STORES
```
تحذف المتاجر وكل ما يتبعها، وتُبقي حسابات التجار وفريق المنصة وإعداداتها. الصور على UploadThing تُحذف يدوياً من uploadthing.com ← Files (اختياري).

---

## 3) نشر التطبيق على Railway (الحساب أ)

### 3.1 إنشاء الحساب والمشروع
1. ادخل **railway.com** ← **Login** ← **Login with GitHub** (الأسهل، ويربط المستودع).
2. اضغط **New Project** ← **Deploy from GitHub repo**.
3. أول مرة سيطلب منك تثبيت تطبيق Railway على GitHub: اضغط **Configure GitHub App**، واختر **Only select repositories**، وحدد `colapia17` فقط ← Install.
4. اختر المستودع `colapia17` ← اضغط **Deploy Now**.
5. سيبدأ بناء تلقائي ويفشل أو ينتظر لأنه ينقصه المتغيرات. **هذا طبيعي.** لا تقلق.

   الملف `railway.json` في المستودع يخبر Railway أن يبني عبر `Dockerfile` وأن يفحص `/api/health` قبل تحويل الزيارات.

### 3.2 إضافة المتغيرات
1. اضغط على الخدمة (المربع الذي اسمه `colapia17`) ← تبويب **Variables**.
2. اضغط **Raw Editor** (أسرع). الصق المتغيرات بصيغة `NAME=value` سطراً سطراً من ملاحظاتك.
3. **تغييرات ضرورية عن Vercel** (انتبه):

| المتغير | القيمة | ملاحظة |
|---|---|---|
| `NEXT_PUBLIC_ROOT_DOMAIN` | `colapia.com` | **يُثبَّت وقت البناء**: إن غيّرته لاحقاً أعد النشر. |
| `ROOT_DOMAIN` | `colapia.com` | |
| `NEXT_PUBLIC_APP_URL` | `https://colapia.com` | |
| `PLATFORM_PRICE_EGP` | `1999` | سعر الباقة (البناء + سنة). |
| `PLATFORM_BASE_PRICE_EGP` | `7999` | السعر المشطوب. |
| `PLATFORM_RENEWAL_EGP` | `1299` | التجديد السنوي. |
| `CRON_SECRET` | نص عشوائي طويل (16+ حرفاً) | يحمي مسارات المهام. تولّد واحداً: `openssl rand -hex 24` أو أي مولّد كلمات سر. |
| `NODE_ENV` | (لا تضفه) | الصورة تضبطه وحدها. |

   كل المتغيرات الأخرى (`DATABASE_URL`، `UPLOADTHING_TOKEN`، مفاتيح AI، `UPSTASH_*`، `QSTASH_*`، `RESEND_API_KEY`، `GOOGLE_*`، `AUTH_SECRET`، `MAGIC_LINK_SECRET`، `ENCRYPTION_KEY`، `BOOTSTRAP_OWNER_SECRET`، `VODAFONE_CASH_NUMBER`، `INSTAPAY_NUMBER`، `META_*`، `GITHUB_CLIENT_*`...) تُنسخ **كما هي** من Vercel. القائمة الكاملة مع الشرح في `.env.example`.
   - **لا تنسخ** أي متغير يبدأ بـ `VERCEL_` أو `NEXT_PUBLIC_VERCEL_`.
4. اضغط **Deploy** (أو سيعيد النشر وحده بعد الحفظ).

### 3.3 مراقبة البناء
1. تبويب **Deployments** ← اضغط على آخر عملية ← **Build Logs**. يستغرق 4–8 دقائق أول مرة.
2. **كيف أتأكد؟** يظهر في النهاية `Healthcheck succeeded` ثم الحالة **Active**.
3. **إن فشل:**
   - `✗ ضع NEXT_PUBLIC_ROOT_DOMAIN...` ← أضف المتغيرين العامين (الخطوة 3.2) وأعد النشر.
   - فشل جلب الخطوط (Google Fonts) ← أعد النشر مرة؛ هو عطل شبكة مؤقت.
   - `Healthcheck failed` ← افتح **Deploy Logs**؛ غالباً متغير ناقص أو خاطئ (مثل `DATABASE_URL`). الرسالة تذكر اسمه بالعربية.

### 3.4 رابط تجريبي مؤقت
1. الخدمة ← **Settings** ← **Networking** ← **Generate Domain**. يعطيك رابطاً مثل `colapia17-production.up.railway.app`.
2. افتحه: تظهر صفحة الهبوط. وافتح `/api/health` في المتصفح: يجب أن ترى `{"ok":true,...}`.
3. **هذا الرابط للاختبار فقط. لا تعطه لأي تاجر ولا تضعه في إعلان.** (المتاجر لا تعمل عليه لأنها تحتاج نطاقاً فرعياً.)

---

## 4) نقل الدومين إلى Cloudflare (بلا توقف)

> **المفهوم:** الدومين له «دليل عناوين» (سجلات DNS) موجود الآن عند Vercel. سننسخ هذا الدليل إلى Cloudflare **وهو ما يزال يشير لـ Vercel**، ثم نقول للعالم «اسأل Cloudflare بدل Vercel». لا يشعر الزوار بشيء لأن الدليل متطابق. بعدها فقط نعدّل العناوين لتشير إلى Railway.

### 4.1 أنشئ حساب Cloudflare وأضف الموقع
1. **cloudflare.com** ← Sign up (بريدك + كلمة سر قوية) ← فعّل التحقق بخطوتين من الإعدادات.
2. **Add a domain** ← اكتب `colapia.com` ← Continue ← اختر الخطة **Free** ← Continue.
3. سيفحص Cloudflare السجلات الحالية ويعرضها. **قارنها بصفحة Domains في Vercel** (Vercel ← الدومين ← DNS Records): يجب أن يكون كل سجل هناك موجوداً هنا.
   - تأكد خصوصاً من: سجلات **MX** و**TXT** الخاصة بالبريد (Resend: `send`, `resend._domainkey`...)، وSPF/DMARC. **سجل بريد ناقص = بريد التجار لا يصل.**
   - أي سجل ناقص: أضفه يدوياً (Add record) بنفس النوع والاسم والقيمة.
4. **مهم جداً:** سجلات `colapia.com` و`*.colapia.com` التي تشير لـ Vercel اجعلها **DNS only** (السحابة **رمادية**، لا برتقالية) في هذه المرحلة. (اضغط السحابة لتتحول رمادية.)
5. Continue ← سيعطيك **اسمي Nameservers** مثل `anna.ns.cloudflare.com` و`bob.ns.cloudflare.com`. **انسخهما.**

### 4.2 اخفض زمن الكاش قبل التبديل (اختياري لكنه يريح)
في Cloudflare اجعل TTL للسجلات `Auto`. (Vercel عادة 60 ثانية، وهذا جيد.)

### 4.3 غيّر الـ Nameservers عند مسجّل الدومين
**الحالة أ: اشتريت الدومين من Vercel**
1. Vercel ← **Domains** ← `colapia.com` ← **Nameservers** (أو Edit/Configure) ← اختر **Custom Nameservers**.
2. احذف نظيريّ Vercel والصق نظيريّ Cloudflare ← Save. [تحقق: قد تكون الأزرار بأسماء مختلفة قليلاً.]
3. **لا تنقل «التسجيل» نفسه** إلى Cloudflare الآن؛ تغيير الـ Nameservers وحده يكفي ويبقي الدومين مسجلاً عند Vercel.

**الحالة ب: اشتريت من Namecheap/GoDaddy/غيرهما**
1. لوحة المسجّل ← الدومين ← **Nameservers** ← Custom DNS ← الصق نظيريّ Cloudflare ← Save.

### 4.4 انتظر التفعيل
1. عد لـ Cloudflare واضغط **Check nameservers now**. قد يستغرق من دقائق إلى بضع ساعات (نادراً 24).
2. **كيف أتأكد؟** يصل بريد «colapia.com is now active on Cloudflare»، وتصبح الحالة **Active**.
3. **أثناء الانتظار** موقعك يعمل طبيعياً من Vercel (هذا هو المطلوب).
4. تحقق: افتح `colapia.com` و`nova.colapia.com` (أو أي متجر) وتأكد أنهما يعملان.

### 4.5 إعدادات SSL في Cloudflare
1. Cloudflare ← الدومين ← **SSL/TLS** ← **Overview** ← اختر **Full** [تحقق: وليس Full (strict) ولا Flexible]. (Flexible يسبب حلقة تحويل لا نهائية؛ وStrict يفشل أحياناً مع نطاقات Railway الجديدة.)
2. **SSL/TLS** ← **Edge Certificates** ← تأكد أن **Universal SSL** مفعّل، وفعّل **Always Use HTTPS**.

---

## 5) ربط الدومين بـ Railway (قبل التبديل الفعلي)

> نضيف الدومين لـ Railway ونجهز الشهادة أولاً، ثم نحوّل الزيارات. ولا يُلمس Vercel إلى أن ننتهي.

1. Railway ← الخدمة ← **Settings** ← **Networking** ← **Custom Domain**.
2. أضف نطاقين، واحداً واحداً:
   - `colapia.com`
   - `*.colapia.com` (النجمة تغطي كل المتاجر) [تحقق: النطاقات النجمية متاحة وفق وثائق Railway؛ إن لم تظهر لك لأي سبب اكتب لي].
3. بعد كل إضافة يعرض Railway **سجلات تضيفها في Cloudflare** (عادة: `CNAME` للنطاق، و`_acme-challenge` CNAME للشهادة، وسجل `TXT` لإثبات الملكية).
4. في Cloudflare ← **DNS** ← **Add record** لكل سجل **كما يعرضه Railway بالضبط**:
   - **سجلات `_acme-challenge` وأي سجل `railwaydns`: DNS only (سحابة رمادية). مهم.**
   - سجل `TXT` للتحقق: كما هو.
   - **لا تغيّر بعد سجلات `colapia.com` و`*` الحالية التي تشير لـ Vercel** (الجزء 6 يفعل ذلك). أضف فقط سجلات الشهادة والتحقق (`_acme-challenge` و`TXT`) الآن.
5. ارجع إلى Railway وانتظر حتى تصبح حالة النطاقين **Valid/Active** (من دقائق إلى 30 دقيقة).
   - إن علق على «Certificate Authority is validating challenges» أكثر من ساعة: احذف سجل `TXT` القديم إن وجد سجلان، وتأكد أن `_acme-challenge` رمادي، ثم اضغط إعادة التحقق في Railway.

---

## 6) التبديل الفعلي: الموقع ينتقل من Vercel إلى Railway

> أفضل وقت: وقت هدوء (مثلاً بعد منتصف الليل بتوقيت القاهرة). المدة الكلية 10–20 دقيقة، **ولن يتوقف الموقع** لأنك تغيّر سجلاً واحداً في كل مرة، وتعود بسهولة.

### 6.0 قائمة تأكد قبل البدء
- [ ] بناء Railway ناجح و`/api/health` على رابط `up.railway.app` يرد `ok:true`.
- [ ] النطاقان في Railway حالتهما Valid.
- [ ] سجلات البريد (MX/TXT) موجودة في Cloudflare.
- [ ] تسجيل الدخول بـ Google يعمل **على رابط Railway التجريبي**؟ لا (Google لا يقبله). هذا طبيعي: سنختبر بعد التبديل.
- [ ] **أضف رابط Redirect الجديد؟ لا حاجة:** الروابط تبقى `https://colapia.com/...` كما هي في Google وGitHub وUploadThing.

### 6.1 غيّر سجل الجذر
1. Cloudflare ← **DNS** ← سجل `colapia.com` (النوع A أو CNAME وقيمته Vercel) ← **Edit**.
2. حوّله إلى **CNAME** يشير إلى القيمة التي عرضها Railway (مثل `xxxx.up.railway.app`) [Cloudflare يسمح بـ CNAME على الجذر بتقنية CNAME flattening]. اجعل السحابة **برتقالية (Proxied)**. Save.
3. **انتظر دقيقتين** وافتح `https://colapia.com`. يجب أن تظهر الصفحة من Railway. **كيف أعرف؟** افتح `https://colapia.com/api/health`: يظهر `{"ok":true...}` (هذا المسار لم يكن موجوداً على Vercel، فظهوره دليل أنك على Railway).

### 6.2 غيّر سجل النجمة
1. سجل `*` (الاسم `*`) ← Edit ← CNAME إلى نفس قيمة Railway للنطاق النجمي ← **Proxied (برتقالية)** ← Save.
2. افتح متجراً (مثل `https://nova.colapia.com`): يجب أن يعمل.
3. إن ظهر **خطأ 525/526**: SSL/TLS ← تأكد أنه **Full**. إن استمر بعد 10 دقائق: في Railway احذف النطاق النجمي وأعد إضافته، ثم أعد تفعيل البرتقالية.

### 6.3 اختبر كل شيء (10 دقائق)
- [ ] صفحة الهبوط.
- [ ] تسجيل دخول Google.
- [ ] لوحة التاجر `colapia.com/dashboard`.
- [ ] متجر `nova.colapia.com` وصفحة منتج وسلة وطلب تجريبي.
- [ ] رفع صورة (UploadThing).
- [ ] وصل بريد (جرّب «نسيت كلمة المرور» أو طلباً).
- [ ] `/api/health` يرد `ok:true`.

### 6.4 المهام المجدولة (مهم، لا تنسها)
كانت على Vercel Cron (يومية). على Railway لا يوجد؛ نستخدم **QStash** الذي عندك:
1. console.upstash.com ← **QStash** ← **Schedules** ← **Create**:
   - Destination: `https://colapia.com/api/ops/sweep` — Method: **POST** — Cron: `*/10 * * * *` (كل 10 دقائق).
   - أضف Header: `Authorization: Bearer <قيمة CRON_SECRET>`.
2. جدول ثانٍ: `https://colapia.com/api/ops/tick` — POST — `0 * * * *` (كل ساعة) — نفس الـ Header.
3. **كيف أتأكد؟** اضغط Run now؛ يجب أن ترى Status 200 في سجل QStash.
   - هذه المهام تتابع الطلبات العالقة وتنبّه المالك بإيصال معلّق. `vercel.json` لم يعد مستخدماً.

### 6.5 رجوع سريع إن حدث خلل (Rollback)
أعد سجلي `colapia.com` و`*` في Cloudflare إلى قيمة Vercel القديمة (انسخها من ملاحظاتك أو من لوحة Vercel). خلال دقيقتين يعود كل شيء. **لا تحذف مشروع Vercel قبل أسبوع من الاستقرار.**

---

## 7) الانتقال للحساب ب (يوم الإطلاق)
لأن كل البيانات خارج Railway، هذا ما تفعله:
1. أنشئ حساب Railway الثاني (الخطوات 3.1 → 3.3 نفسها) والصق نفس المتغيرات. **اشحن الرصيد/خطة Hobby فقط الآن.**
2. أضف `colapia.com` و`*.colapia.com` في الحساب ب (الجزء 5) **بعد** حذفهما من الحساب أ. (دومين واحد لا يعيش على حسابين.) ستظهر سجلات `_acme-challenge` جديدة: حدّثها في Cloudflare.
3. حدّث سجلي `colapia.com` و`*` ليشيرا لقيمة الحساب ب. (الجزء 6.1–6.2)
4. اختبر (6.3) وحدّث جدولي QStash إن تغير شيء (لا يتغير: الرابط `colapia.com` نفسه).
5. أوقف خدمة الحساب أ (Settings ← Danger ← Remove service) بعد 48 ساعة استقرار.

> **النقل إلى Render أو خادم آخر لاحقاً:** نفس الخطوات: التطبيق يعمل من `Dockerfile`، وكل البيانات خارجه. تنشئ الخدمة هناك، تلصق المتغيرات، وتغيّر سجلات Cloudflare. لا أكواد تتغير.

---

## 8) ما بعد النشر: ضبط الخدمات الخارجية
لا شيء يتغير في Google وGitHub وUploadThing وResend لأن الدومين نفسه (`colapia.com`). تحقق فقط:
- **UploadThing:** Callback URL = `https://colapia.com/api/uploadthing`.
- **Meta (فيسبوك/إنستجرام):** Webhook = `https://colapia.com/api/webhooks/meta`.
- **QStash:** الرسائل تعود إلى `NEXT_PUBLIC_APP_URL` (تأكد أنه `https://colapia.com`).

## 9) المراقبة
- **التوقف:** سجّل في **UptimeRobot** (مجاني) مراقبة HTTP على `https://colapia.com/api/health` كل 5 دقائق مع تنبيه لبريدك/واتساب. الفحص يرد 503 إن توقفت قاعدة البيانات.
- **السجلات:** Railway ← الخدمة ← Deployments ← View Logs.
- **الاستهلاك:** Railway ← Usage، تحقق أسبوعياً في البداية.

## 10) استكشاف الأخطاء الشائعة

| العَرَض | السبب الغالب | الحل |
|---|---|---|
| حلقة تحويل لا تنتهي (ERR_TOO_MANY_REDIRECTS) | SSL في Cloudflare على Flexible | اجعله **Full** |
| 525 / 526 | الشهادة عند Railway لم تُصدر بعد، أو Strict | انتظر Valid في Railway، واجعل SSL = Full |
| متجر يظهر «Not found» | النجمة `*` لا تشير لـ Railway، أو اسم محجوز | افحص سجل `*` |
| لا يصل بريد | سجل MX/TXT ناقص بعد نقل DNS | قارن مع Vercel وأضف الناقص |
| تسجيل Google يفشل بعد التبديل | `NEXT_PUBLIC_APP_URL` خاطئ | صححه وأعد النشر |
| الموقع بطيء أول طلب | تشغيل بارد بعد الخمول | طبيعي نادراً؛ أخبرني إن تكرر |
| IP كل الزوار متطابق في الحدود | لا يحدث: الكود يقرأ `cf-connecting-ip` | — |

## 11) مراجع رسمية (للتحقق)
- Railway، النطاقات المخصصة والنجمية: https://docs.railway.com/networking/domains/working-with-domains
- Railway، الأسعار: https://docs.railway.com/reference/pricing/plans
- Cloudflare، إضافة موقع وتغيير الـ Nameservers: https://developers.cloudflare.com/dns/zone-setups/full-setup/
- Cloudflare، أوضاع SSL: https://developers.cloudflare.com/ssl/origin-configuration/ssl-modes/
