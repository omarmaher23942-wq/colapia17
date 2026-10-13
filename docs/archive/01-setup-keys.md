# الحصول على كل مفتاح (كله مجاني)

## 1. Neon (قاعدة البيانات)
1. https://neon.tech → Sign up (GitHub) → **New Project**، الاسم `colapia`، Region: **Frankfurt (eu-central-1)**.
2. من Dashboard → **Connection string** → اختر **Pooled connection** → انسخه إلى `DATABASE_URL`.
3. الحدود المجانية: 0.5GB، 100 ساعة compute شهريًا (كافية لعشرات المتاجر).

## 2. Uploadthing (الصور)
1. https://uploadthing.com → Sign in → **Create a new app** → الاسم `colapia`.
2. **API Keys** → انسخ `UPLOADTHING_TOKEN` (الإصدار 7 يحتاج التوكن فقط).
3. الحد المجاني: 2GB. نضغط الصور في المتصفح قبل الرفع (~0.5MB للصورة).

## 3. Morpheus (Claude)
1. https://mor.org → API Keys → أنشئ مفتاحًا → `MORPHEUS_API_KEY`.
2. `MORPHEUS_BASE_URL=https://api.mor.org/api/v1` (متوافق مع OpenAI).
3. `CLAUDE_MODEL=claude-sonnet-4.5` للمحادثة والتأليف، `CLAUDE_OPUS_MODEL=claude-opus-4.1` للتحليل والمراجعة.

## 4. Groq
1. https://console.groq.com → **API Keys** → Create → `GROQ_API_KEY`.
2. `GROQ_MODEL=llama-3.3-70b-versatile`، `GROQ_WHISPER_MODEL=whisper-large-v3-turbo`.

## 5. Gemini
1. https://aistudio.google.com → **Get API key** → Create → `GEMINI_API_KEY`.
2. `GEMINI_MODEL=gemini-2.0-flash`.

## 6. Upstash (Redis + QStash)
1. https://console.upstash.com → **Redis** → Create Database → Regional → Frankfurt → من تبويب **REST API** انسخ `UPSTASH_REDIS_REST_URL` و`UPSTASH_REDIS_REST_TOKEN`.
2. **QStash** → من الصفحة الرئيسية انسخ `QSTASH_TOKEN`، `QSTASH_CURRENT_SIGNING_KEY`، `QSTASH_NEXT_SIGNING_KEY`. `QSTASH_URL=https://qstash-us-east-1.upstash.io`.
3. الحدود المجانية: Redis 500K أمر/شهر، QStash 500 رسالة/يوم.

## 7. Meta (الجزء 2، جهّزه الآن)
1. https://developers.facebook.com → **My Apps** → Create App → Use case: **Other** → Type: **Business**.
2. Settings → Basic: انسخ `META_APP_ID` و`META_APP_SECRET`.
3. Add Product → **Messenger** → Settings → اربط صفحة فيسبوك → **Generate Token** → `META_PAGE_ACCESS_TOKEN`. Page ID من إعدادات الصفحة → `META_PAGE_ID`.
4. Add Product → **Instagram** → اربط حساب Business/Creator المرتبط بالصفحة → `META_INSTAGRAM_ACCESS_TOKEN` و`META_IG_ID`.
5. `META_VERIFY_TOKEN`: ولّده بنفسك `openssl rand -hex 16`.
6. Webhooks تُضبط في الجزء 2 بعد النشر (تحتاج URL عام).
7. **مهم**: في وضع التطوير يعمل البوت مع الأدمن والـ Testers فقط. للجمهور: App Review لصلاحيات `pages_messaging` و`instagram_manage_messages` + Business Verification. دليل التقديم في الجزء 2.

## 8. الأسرار
```bash
openssl rand -base64 32   # AUTH_SECRET و MAGIC_LINK_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"     # ENCRYPTION_KEY
node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"  # BOOTSTRAP_OWNER_SECRET
node -e "console.log(require('crypto').randomBytes(28).toString('base64url'))"  # QSTASH_INTERNAL_SECRET
