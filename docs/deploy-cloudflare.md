# نقل Colapia من Vercel إلى Cloudflare — الدليل الكامل خطوة بخطوة

> **لمن هذا الدليل:** لك أنت (المالك)، بلا أي خبرة تقنية. كل خطوة مكتوب فيها: أين تضغط، وماذا تكتب، وكيف تعرف أنها نجحت.
> **المدة:** حوالي ساعتين على مهل، ويمكن تقسيمها على يومين. **الموقع لا يتوقف لحظة واحدة** خلال كل الخطوات.
> **القاعدة الذهبية:** لا تضع أي مفتاح في أي ملف داخل المشروع. المفاتيح مكانها لوحة Cloudflare فقط.

---

## 0) الصورة الكاملة قبل أن تبدأ (اقرأها مرة واحدة)

**الوضع الآن:** الموقع (colapia.com وكل المتاجر `اسم.colapia.com`) يعمل على Vercel، والصور على UploadThing.

**بعد هذا الدليل:** الموقع يعمل على Cloudflare Workers، والصور على Cloudflare R2، ونطاقات عملائك الخاصة (مثل `brand.com`)
تُربط تلقائياً. أما قاعدة البيانات (Neon) والبريد (Resend) وRedis وQStash (Upstash) والذكاء الاصطناعي (Groq/Gemini) فتبقى
كما هي تماماً، لا تلمسها.

**سر النقل بلا توقف:** سننقل «إدارة الدومين» إلى Cloudflare أولاً والموقع ما زال يعمل على Vercel. ثم نجهّز Cloudflare
بالكامل ونختبره. ثم **نحوّل بضغطة واحدة**: نجعل سجلات الدومين «برتقالية» (Proxied) فيبدأ Cloudflare في خدمة الموقع.
ولو حصلت أي مشكلة، **نرجع بضغطة واحدة**: نعيدها «رمادية» (DNS only) فيعود الموقع إلى Vercel فوراً.

**الترتيب:**

| # | الخطوة | الوقت | هل يتأثر الموقع؟ |
|---|---|---|---|
| 1 | حساب Cloudflare والدفع (5$) | 10 دقائق | لا |
| 2 | نقل إدارة الدومين إلى Cloudflare | 15 دقيقة + انتظار | لا |
| 3 | مساحة الصور R2 | 15 دقيقة | لا |
| 4 | ربط GitHub وأول نشر | 20 دقيقة | لا |
| 5 | نقل المفاتيح (الأسرار) | 15 دقيقة | لا |
| 6 | الاختبار قبل التحويل | 15 دقيقة | لا |
| 7 | **التحويل** (ضغطة واحدة) | دقيقتان | يبدأ العمل على Cloudflare |
| 8 | النطاقات الخاصة للعملاء | 10 دقائق | لا |
| 9 | التنظيف (Vercel وQStash) | 10 دقائق | لا |

**ما تحتاجه قبل البدء:**
- بريدك وكلمة سر جديدة لحساب Cloudflare.
- بطاقة بنكية تعمل أونلاين بالدولار (فيزا أو ماستركارد، ويصلح الكثير من بطاقات الخصم المصرية بعد تفعيل «الشراء من الإنترنت/الدولي» من تطبيق البنك)، أو حساب PayPal.
- الدخول لحساب Vercel وحساب GitHub.
- معرفة أين اشتريت `colapia.com` (Vercel أو Namecheap أو GoDaddy أو غيرها). لو لا تتذكر: ادخل Vercel ← Domains؛ إن وجدته
  هناك ومكتوب بجانبه «Registered with Vercel» فهو من Vercel.

---

## 1) حساب Cloudflare والاشتراك (5$ شهرياً)

### 1.1 إنشاء الحساب
1. افتح **dash.cloudflare.com/sign-up**.
2. اكتب بريدك وكلمة سر قوية ← **Sign up** ← افتح بريدك واضغط رابط التأكيد.
3. لو سألك عن «ماذا تريد أن تفعل» اضغط **Skip** أو أي خيار؛ لا يهم.

### 1.2 تفعيل التحقق بخطوتين (مهم لحماية الحساب)
1. أعلى اليمين: أيقونة الحساب ← **My Profile** ← **Authentication** ← **Two-Factor Authentication** ← **Set up**.
2. امسح الرمز بتطبيق Google Authenticator على موبايلك واكتب الرقم. **احفظ رموز الاسترجاع** في مكان آمن.

### 1.3 إضافة وسيلة الدفع
1. من القائمة اليسرى: **Manage Account** ← **Billing** ← **Payment info** (أو Payment methods) ← **Add payment method**.
2. اختر **Card** واكتب بيانات البطاقة، أو اختر **PayPal**.
3. لو رُفضت البطاقة: افتح تطبيق البنك وفعّل «المعاملات الدولية / الشراء عبر الإنترنت»، ثم أعد المحاولة. ويمكن استخدام PayPal بدلها.

### 1.4 الاشتراك في Workers Paid
1. القائمة اليسرى: **Workers & Pages** ← **Plans** (أو زر **Upgrade** أعلى الصفحة).
2. اختر **Workers Paid — $5/month** ← **Purchase / Upgrade** ← أكّد.
3. **تعرف أنها نجحت:** في Billing ← Subscriptions ستجد «Workers Paid» بحالة Active.

> **لماذا المدفوعة؟** قِسنا حجم المنصة فعلياً: 6.1 ميجابايت مضغوطة، والخطة المجانية لا تقبل أكثر من 3، وتسمح بوقت معالجة
> قصير جداً لكل زيارة. الـ 5$ تشمل 10 ملايين زيارة شهرياً، وهذا يكفي مئات المتاجر.

---

## 2) نقل إدارة الدومين إلى Cloudflare (الموقع يبقى على Vercel)

### 2.1 أضف colapia.com إلى Cloudflare
1. من الصفحة الرئيسية للحساب: **Add a domain** (أو Add site).
2. اكتب `colapia.com` ← اختر **Quick scan for DNS records** ← **Continue**.
3. اختر خطة **Free** (خطة الدومين مجانية؛ المدفوع هو Workers فقط) ← **Continue**.
4. ستظهر قائمة بسجلات DNS التي نسخها Cloudflare من الإعدادات الحالية. **لا تضغط Continue قبل الخطوة 2.2.**

### 2.2 راجع السجلات المنسوخة (أهم خطوة في هذا القسم)
افتح في تبويب آخر المكان الذي فيه سجلات الدومين الآن (Vercel ← Domains ← colapia.com ← DNS Records، أو لوحة شركة الدومين)،
وتأكد أن كل سجل هناك موجود أيضاً في Cloudflare. ركّز على:

| السجل | لماذا مهم | كيف يكون في Cloudflare |
|---|---|---|
| سجلات البريد من Resend (MX، وTXT فيه `v=spf1`، وسجلات `resend._domainkey` و`send`) | بدونها يتوقف إرسال كل البريد | **DNS only** (سحابة رمادية) |
| أي TXT للتحقق من Google أو Meta (`google-site-verification`، `facebook-domain-verification`) | إثبات ملكية الدومين | كما هي |
| `@` من نوع A بقيمة `76.76.21.21` (أو ALIAS إلى Vercel) | الموقع الرئيسي على Vercel الآن | **DNS only** (رمادية) — سنحوّلها لاحقاً |
| `*` من نوع CNAME بقيمة `cname.vercel-dns.com` | كل المتاجر `اسم.colapia.com` | **DNS only** (رمادية) |
| `www` من نوع CNAME بقيمة `cname.vercel-dns.com` | www.colapia.com | **DNS only** (رمادية) |

- لإضافة سجل ناقص: **Add record** ← اختر النوع والاسم والقيمة كما في المصدر ← اجعل السحابة **رمادية** ← Save.
- لجعل سجل رمادياً: اضغط **Edit** بجانبه ← انقر السحابة البرتقالية لتصبح رمادية (DNS only) ← Save.
- **لماذا رمادي الآن؟** حتى يبقى الموقع يعمل على Vercel كما هو تماماً بعد النقل.
- لو لم يكن عندك سجل `*` (المتاجر) في Vercel لأن Vercel كان يدير الدومين كاملاً: أضفه بنفسك: النوع `CNAME`، الاسم `*`، القيمة
  `cname.vercel-dns.com`، رمادي. وكذلك `@`: النوع `A`، الاسم `@`، القيمة `76.76.21.21`، رمادي.
- **قيم Vercel الجديدة:** قد تجد `*` و`www` تشير إلى قيمة خاصة بمشروعك مثل `6abcaf7cfacadf41.vercel-dns-017.com` بدل
  `cname.vercel-dns.com`: هذا صحيح، اتركها كما هي. وأدق مصدر للقيمة الصحيحة لأي سجل هو Vercel ← المشروع ← Settings ←
  **Domains**: بجانب كل نطاق مكتوب السجل الذي يريده بالضبط (وقد يقترح للجذري `A` بقيمة غير `76.76.21.21`؛ اكتب ما يقترحه).
- **تأكد من وجود سجل `@` (الجذري).** لو لم يُنسخ لن يفتح `colapia.com` نفسه بعد انتهاء ذاكرة الـ DNS القديمة ولو فتحت المتاجر.

ثم اضغط **Continue**. سيعطيك Cloudflare **اسمين (Nameservers)** مثل `anna.ns.cloudflare.com` و`bob.ns.cloudflare.com`.
**انسخهما.**

### 2.3 غيّر الـ Nameservers عند شركة الدومين
**إن كان الدومين مسجلاً في Vercel:**
1. Vercel ← **Domains** (من قائمة الحساب، لا المشروع) ← `colapia.com`.
2. ابحث عن **Nameservers** ← **Edit** ← اختر **Custom** ← احذف القديم والصق اسمي Cloudflare ← **Save**.
3. لا تنقل «تسجيل» الدومين نفسه من Vercel. تغيير الـ Nameservers وحده يكفي، ويبقى تجديد الدومين السنوي عند Vercel كما هو.

**إن كان في Namecheap:** Domain List ← Manage ← Nameservers ← **Custom DNS** ← الصق الاسمين ← علامة ✓.
**إن كان في GoDaddy:** My Products ← DNS ← Nameservers ← **Change** ← **Enter my own nameservers** ← الصق الاسمين ← Save.
**غير ذلك:** ابحث في لوحة الشركة عن كلمة **Nameservers** وضع الاسمين مكان الموجود.

### 2.4 انتظر التفعيل
1. ارجع لـ Cloudflare ← colapia.com ← **Check nameservers now**.
2. يستغرق من دقائق إلى ساعات (نادراً 24 ساعة). سيصلك بريد **«colapia.com is now active on Cloudflare»**.
3. **تعرف أنها نجحت:** صفحة Overview للدومين مكتوب فيها **Active**. وافتح colapia.com: يعمل كما كان (ما زال على Vercel).
4. افتح **SSL/TLS** ← **Overview** ← اختر **Full (strict)**. ثم **SSL/TLS** ← **Edge Certificates** ← **Always Use HTTPS** ← On.

> **احتياط البريد:** بعد التفعيل أرسل لنفسك بريد تجربة من المنصة (مثلاً «ادخل برمز على بريدك» في `/login`)، وافتح
> resend.com/domains وتأكد أن colapia.com ما زال **Verified**. لو لا، فسجلاً من سجلات Resend ناقص في Cloudflare: أضفه من
> صفحة Resend نفسها (تعرض لك السجلات المطلوبة) كـ **DNS only**.

---

## 3) مساحة الصور (R2)

R2 تخزن صور المنتجات والإيصالات وملفات الاستمارة، وتعرضها من نطاق Colapia بلا تكلفة تنزيل. أول 10 جيجابايت مجانية.

1. **فعّل R2:** القائمة اليسرى ← **R2 Object Storage** ← لو طلب **Purchase R2 / Subscribe**: وافق (الخطة مجانية ضمن الحدود،
   لكنه يطلب وسيلة الدفع التي أضفتها).
2. **أنشئ الـ bucket:** **Create bucket** ← الاسم: `colapia-media` ← Location: **Automatic** ← **Create bucket**.
3. **لا تربط نطاقاً ولا تضبط CORS:** الرفع يمر عبر موقعك نفسه (المتصفح لا يتصل بـ R2 أبداً)، والعرض من `media.colapia.com` يخدمه
   الـ Worker نفسه من الـ bucket (يكفي سجل DNS `*` البرتقالي الذي أضفته للمتاجر). لو ربطت نطاقاً مخصصاً على الـ bucket سابقاً
   فلا بأس، يبقى يعمل.
4. **احذف الملفات المؤقتة تلقائياً:** Settings ← **Object lifecycle rules** ← **Add rule** ← الاسم `tmp` ← Prefix: `tmp/` ←
   **Delete uploaded objects after 1 day** ← Save.
5. **مفتاح الوصول:** ارجع لصفحة R2 الرئيسية ← **Manage API tokens** (أو API ← Manage R2 API Tokens) ← **Create API token** ←
   - Token name: `colapia-app`
   - Permissions: **Object Read & Write**
   - Specify bucket: **Apply to specific buckets only** ← `colapia-media`
   - **Create API Token**.
   ستظهر قيم **مرة واحدة فقط**؛ انسخها في ملف ملاحظات مؤقت على جهازك (ليس في المشروع):
   - **Access Key ID** ← سيكون `R2_ACCESS_KEY_ID`
   - **Secret Access Key** ← سيكون `R2_SECRET_ACCESS_KEY`
   - **Account ID** (يظهر في صفحة R2 الرئيسية على اليمين، أو في رابط المتصفح بعد `dash.cloudflare.com/`) ← سيكون `R2_ACCOUNT_ID`

---

## 4) ربط المشروع من GitHub وأول نشر

1. القائمة اليسرى ← **Workers & Pages** ← **Create** ← تبويب **Workers** ← **Import a repository**.
2. **Connect GitHub** ← سجّل دخول GitHub ← اختر **Only select repositories** ← `colapia17` ← **Install & Authorize**.
3. اختر `omarmaher23942-wq/colapia17` ← **Next** واملأ:
   - **Project name:** `colapia` (حرفياً، يجب أن يطابق ما في ملف `wrangler.jsonc`)
   - **Production branch:** `main`
   - **Build command:** `npx opennextjs-cloudflare build`
   - **Deploy command:** `npx opennextjs-cloudflare deploy`
   - **Root directory:** اتركه فارغاً (`/`)
4. افتح **Advanced settings** ← **Build variables** وأضف (هذه ليست أسراراً؛ تدخل في الكود وقت البناء):

   | الاسم | القيمة |
   |---|---|
   | `NEXT_PUBLIC_ROOT_DOMAIN` | `colapia.com` |
   | `NEXT_PUBLIC_APP_URL` | `https://colapia.com` |
   | `NEXT_PUBLIC_PUSHER_KEY` | انسخها من Vercel إن وُجدت (وإلا لا تضفها) |
   | `NEXT_PUBLIC_PUSHER_CLUSTER` | انسخها من Vercel إن وُجدت |
   | `NODE_VERSION` | `22` |

5. **Create and deploy** (أو Save and Deploy). البناء يأخذ 5–10 دقائق. تابع السجل في صفحة **Deployments**.
6. **قد يفشل أول نشر** لأن المفاتيح لم تُضف بعد، أو يفشل البناء بخطأ عن `IMAGES`. هذا طبيعي:
   - خطأ `IMAGES` أو Images: القائمة اليسرى ← **Images** ← فعّل الخطة المجانية (Transformations ← Enable)، ثم من صفحة
     المشروع ← Deployments ← **Retry deployment**.
   - أكمل القسم 5 ثم أعد النشر.
7. **تعرف أنه نجح:** في صفحة المشروع ستجد رابطاً مثل `colapia.<اسمك>.workers.dev` وحالة آخر نشر **Success**.
8. **الصور:** لا شيء تفعله. الـ Worker يخدم `media.colapia.com` من R2 بنفسه. بعد النشر افتح `/admin/launch` ← **اختبر رفع الصور وعرضها**:
   يحفظ صورة حقيقية ويعرضها لك من رابطها العام، فتعرف فوراً إن كان الرفع والعرض سليمين.

> المشروع سيُعاد نشره تلقائياً مع كل تحديث يُرفع إلى `main` في GitHub. لا تحتاج تفعل شيئاً بعد اليوم.
> ملف `wrangler.jsonc` فيه مساران (`colapia.com/*` و`*.colapia.com/*`) يلتقطان colapia.com والمتاجر، لكنه **لا يعمل** إلا على السجلات البرتقالية، والسجلات الآن رمادية،
> فالموقع ما زال على Vercel.

---

## 5) نقل المفاتيح (الأسرار) من Vercel إلى Cloudflare

اختر طريقة واحدة:

### الطريقة (أ) الأسرع: أمر واحد من جهازك (موصى بها)
على جهازك في مجلد المشروع (`git pull origin main` أولاً)، افتح الطرفية (Terminal / PowerShell) واكتب الأوامر واحداً واحداً:
```bash
npx vercel login
npx vercel link
npx vercel env pull .env.cloudflare --environment=production
node scripts/ops/env-to-secrets.mjs .env.cloudflare > secrets.json
npx wrangler login
npx wrangler secret bulk secrets.json
```
- `vercel link`: اختر حسابك ثم مشروع colapia الحالي.
- `wrangler login`: يفتح المتصفح، اضغط **Allow**.
- السكربت يخبرك بعدد المفاتيح ويتخطى ما لا يلزم نقله، وينبهك إن كان `CRON_SECRET` ناقصاً.
- **بعد النجاح احذف الملفين فوراً:** على ويندوز `del .env.cloudflare secrets.json`، وعلى ماك `rm .env.cloudflare secrets.json`.
  (الملفان مستثنيان من git أصلاً، لكن لا تتركهما على جهازك.)

### الطريقة (ب) يدوياً من اللوحة
Workers & Pages ← `colapia` ← **Settings** ← **Variables and Secrets** ← **Add** ← النوع **Secret** ← الاسم والقيمة ← Save.
افتح Vercel ← المشروع ← Settings ← Environment Variables بجانبها، وانسخ **كل** المتغيرات بأسمائها وقيمها، **عدا**:
ما يبدأ بـ `NEXT_PUBLIC_` (أضفته في القسم 4)، و`ROOT_DOMAIN` و`TRUST_CF_CONNECTING_IP` (موجودان في الملف).

### المفاتيح الجديدة التي لم تكن في Vercel (أضفها بأي طريقة)
| الاسم | القيمة | لماذا |
|---|---|---|
| `CRON_SECRET` | أي نص عشوائي طويل (32 حرفاً فأكثر). إن كان موجوداً في Vercel انسخه كما هو | المهام المجدولة (التجارب، الحذف، التذكيرات) |
| `R2_ACCOUNT_ID` | من القسم 3 خطوة 5 | الصور |
| `R2_ACCESS_KEY_ID` | من القسم 3 خطوة 5 | الصور |
| `R2_SECRET_ACCESS_KEY` | من القسم 3 خطوة 5 | الصور |
| `R2_BUCKET` | `colapia-media` | الصور |
| `MEDIA_BASE_URL` (اختياري) | `https://media.colapia.com` | الرابط العام للصور؛ الافتراضي `media.<نطاقك>` |
| `STORES_GITHUB_TOKEN` | توكن GitHub (انظر تحت) إن لم يكن موجوداً | «نزّل مشروع المتجر» وتجهيز فروع المتاجر |
| `STORES_GITHUB_REPO` | `omarmaher23942-wq/colapia17` | نفس السبب |

**توكن GitHub:** github.com ← صورتك ← **Settings** ← **Developer settings** ← **Personal access tokens** ← **Fine-grained tokens**
← **Generate new token** ← الاسم `colapia-stores` ← Expiration: سنة ← Repository access: **Only select repositories** ←
`colapia17` ← Permissions ← Repository permissions ← **Contents: Read and write** ← **Generate token** ← انسخه.

بعد إضافة المفاتيح: Deployments ← آخر نشر ← **Retry deployment** (أو ارفع أي تحديث) حتى يعمل بالمفاتيح.

---

## 6) الاختبار قبل التحويل (الموقع ما زال على Vercel)

افتح رابط `colapia.<اسمك>.workers.dev` من القسم 4:
1. `…workers.dev/api/health` ← يجب أن ترى `"ok":true`. لو ظهر `"database":{"ok":false}` فـ `DATABASE_URL` ناقص أو خطأ؛ ولو
   `"redis":{"ok":false}` فمفاتيح `UPSTASH_REDIS_*`.
2. الصفحة الرئيسية `…workers.dev/` تظهر كاملة بالسعر الصحيح.
3. `…workers.dev/start` تفتح الاستمارة.
4. (اختياري) متجر: `…workers.dev/?store=اسم-المتجر&key=قيمة-STORE_PREVIEW_KEY`.
5. **لا تختبر الدخول بـ Google هنا** (Google يقبل colapia.com فقط)؛ يُختبر بعد التحويل.

لو كل شيء سليم، انتقل للتحويل. لو هناك خطأ: Workers & Pages ← colapia ← **Logs** ← **Begin log stream** وافتح الصفحة؛ سترى سبب الخطأ.

---

## 7) التحويل إلى Cloudflare (ضغطة واحدة) — والرجوع بضغطة واحدة

**الأفضل في وقت هادئ (بعد منتصف الليل مثلاً).**

1. colapia.com ← **DNS** ← **Records**.
2. لكل من السجلات `@` و`*` و`www`: **Edit** ← انقر السحابة الرمادية لتصبح **برتقالية (Proxied)** ← **Save**.
3. أضف سجلاً جديداً لنطاق استقبال نطاقات العملاء: **Add record** ← النوع `AAAA` ← الاسم `customers` ← القيمة `100::` ←
   **Proxied (برتقالي)** ← Save.
4. انتظر دقيقة، ثم افتح في نافذة متصفح خاصة (Incognito):
   - `https://colapia.com/api/health` ← `"ok":true` و`version` فيه رقم.
   - الصفحة الرئيسية، و`/start`، ودخول لوحة الوكالة بـ Google، ومتجر `اسم.colapia.com`، وصفحة منتج، وطلب تجريبي.
   - ارفع صورة منتج من لوحة متجر، وتأكد أن رابطها يبدأ بـ `https://media.colapia.com/`.
   - جرّب «البحث بالصورة» في متجر فيه منتجات بصور.

**الرجوع لو حدثت أي مشكلة:** DNS ← أعد السجلات `@` و`*` و`www` إلى **رمادي** ← Save. خلال دقيقة يعود الموقع إلى Vercel
كما كان. Vercel يبقى منشوراً وجاهزاً حتى تحذفه أنت في القسم 9.

---

## 8) النطاقات الخاصة لعملائك (مثل brand.com) — أول 100 نطاق مجاناً

1. colapia.com ← **SSL/TLS** ← **Custom Hostnames** ← **Enable Cloudflare for SaaS** (وافق؛ أول 100 مجاناً).
2. **Fallback Origin** ← اكتب `customers.colapia.com` ← **Add Fallback Origin** ← انتظر **Active**.
3. **توكن الربط الآلي:** أيقونة الحساب ← **My Profile** ← **API Tokens** ← **Create Token** ← **Create Custom Token** ←
   - Token name: `colapia-domains`
   - Permissions: `Zone` ← `SSL and Certificates` ← `Edit`
   - Zone Resources: `Include` ← `Specific zone` ← `colapia.com`
   - **Continue to summary** ← **Create Token** ← انسخه.
4. أضف سرّين في المشروع (القسم 5 طريقة ب): `CF_API_TOKEN` = التوكن، و`CF_ZONE_ID` = **Zone ID** (colapia.com ← **Overview** ←
   على اليمين تحت API). ثم أعد النشر.
5. **أضف المسار الشامل (مرة واحدة، من اللوحة):** colapia.com ← **Workers Routes** ← **Add route** ← Route: `*/*` ← Worker: `colapia`
   ← Save. (يرفضه Cloudflare قبل تفعيل Cloudflare for SaaS بخطأ 10022، ولذلك لا يوجد في `wrangler.jsonc`؛ بدونه تعمل
   colapia.com والمتاجر `<slug>.colapia.com` فقط، ولا تعمل نطاقات العملاء.)
6. **كيف يعمل بعدها:** التاجر يكتب نطاقه في لوحته ← يُضاف لـ Cloudflare تلقائياً ← يظهر له سجل واحد يضيفه عند شركة نطاقه
   (`CNAME` إلى `customers.colapia.com`) ← تصدر الشهادة الآمنة وحدها ← يعمل متجره على نطاقه. لا تفعل أنت شيئاً.

---

## 9) التنظيف بعد أسبوع من العمل المستقر

1. **أوقف مهام Vercel المجدولة** (حتى لا تعمل مرتين): Vercel ← المشروع ← **Settings** ← **Cron Jobs** ← **Disable**.
   افعلها **يوم التحويل نفسه**.
2. **احذف جداول QStash القديمة إن وُجدت:** console.upstash.com ← QStash ← **Schedules** ← احذف أي جدول يستدعي `/api/ops/sweep`
   أو `/api/ops/tick` (Cloudflare يشغّلهما الآن كل 10 دقائق ويومياً). **لا تحذف حساب QStash ولا مفاتيحه**: رسائل التجربة
   والتذكيرات المؤجلة تستخدمه.
3. **بعد أسبوع بلا مشاكل:** Vercel ← المشروع ← Settings ← Domains ← احذف colapia.com و`*.colapia.com` من المشروع، ثم
   Settings ← General ← **Pause Project** (أو Delete). **لا تحذف الدومين نفسه** من Vercel Domains إن كان مسجلاً هناك:
   التسجيل السنوي يبقى عند Vercel (أو انقله لاحقاً إلى Cloudflare Registrar بسعر أقل، خطوة اختيارية).
4. **UploadThing:** الصور القديمة تبقى ظاهرة من UploadThing. اترك `UPLOADTHING_TOKEN` حتى لا يبقى متجر بصور قديمة، ثم ألغِ
   اشتراك UploadThing إن كان مدفوعاً.

---

## 10) الدفع والتكلفة الشهرية

| البند | التكلفة |
|---|---|
| Workers Paid | **5$ شهرياً** (يشمل 10 ملايين زيارة و30 مليون مللي ثانية معالجة؛ الزيادة بسنتات) |
| R2 (الصور) | مجاني حتى 10 جيجابايت ومليون رفع شهرياً، والتنزيل مجاني دائماً |
| Images (تصغير الصور) | أول 5,000 تحويل فريد شهرياً مجاناً |
| Custom Hostnames (نطاقات العملاء) | أول 100 نطاق مجاناً، ثم 0.10$ للنطاق شهرياً |
| خطة الدومين في Cloudflare | مجانية |
| Neon وUpstash وResend وGroq | كما هي الآن |

- **الفاتورة:** تُخصم شهرياً من البطاقة أو PayPal. تراها في Manage Account ← **Billing** ← **Invoices**.
- **تنبيه قبل أي زيادة:** Billing ← **Billing notifications** (أو Notifications ← Add ← Usage Based Billing) ← ضع حداً مثل 10$
  ليصلك بريد لو اقتربت التكلفة منه.
- **تغيير البطاقة:** Billing ← Payment info ← Add ثم اجعلها Default واحذف القديمة.

---

## 11) مشاكل شائعة وحلها

| ما تراه | السبب | الحل |
|---|---|---|
| أثناء النشر: `You cannot use a wildcard host without Cloudflare for SaaS` [code: 10022] | مسار `*/*` يحتاج Cloudflare for SaaS | حُلّت في الكود (مساران صريحان). لو ظهرت بعد تعديل يدوي لـ `wrangler.jsonc` فأعد المسارين كما هما |
| تحذيرات `equals-negative-zero` أثناء النشر | تحذير من مكتبة داخل الحزمة | بلا أثر، تجاهلها: الفشل الحقيقي هو سطر `ERROR` الذي بعدها |
| البريد توقف بعد نقل الـ Nameservers | سجلات Resend لم تُنسخ | resend.com/domains ← colapia.com ← انسخ السجلات الناقصة إلى Cloudflare كـ DNS only |
| `/api/health` يقول `database: false` | `DATABASE_URL` ناقص أو خاطئ | انسخه من Vercel كما هو (يبدأ بـ `postgresql://`) |
| صفحة بيضاء أو «Internal Server Error» | مفتاح إلزامي ناقص | Workers ← colapia ← Logs ← Begin log stream؛ اسم المتغير الناقص يظهر في السجل |
| رفع الصور يفشل | مفاتيح R2 ناقصة أو خاطئة | `/admin/launch` ← فحص «مساحة الصور» يسمّي المتغير الناقص؛ المفاتيح الأربعة: `R2_ACCOUNT_ID` و`R2_ACCESS_KEY_ID` و`R2_SECRET_ACCESS_KEY` و`R2_BUCKET` ثم أعد النشر |
| صور المنتجات لا تظهر | `media.colapia.com` لا يصل إلى الـ Worker | DNS ← سجل `*` (أو `media`) موجود وبرتقالي، ومسار `*.colapia.com/*` يشير إلى Worker colapia؛ ثم `/admin/launch` ← «اختبر رفع الصور وعرضها» |
| المتاجر `اسم.colapia.com` لا تفتح | سجل `*` ناقص أو رمادي | DNS ← سجل `*` موجود وبرتقالي |
| نطاق عميل عالق «بانتظار السجلات» | سجله لم يُضف أو الجذري لا يقبل CNAME | لوحة التاجر ← نطاقك الخاص تشرح له؛ أو انقل DNS نطاقه إلى Cloudflare مجاناً |
| المهام المجدولة لا تعمل | `CRON_SECRET` ناقص | أضفه (القسم 5) وأعد النشر؛ تأكد من Workers ← colapia ← Settings ← Triggers فيها جدولان |

**لو احتجت مساعدة:** ابعت لي لقطة شاشة للصفحة ونص الخطأ من **Logs**، وأخبرني بالخطوة التي توقفت عندها.
