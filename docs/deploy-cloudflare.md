# دليل Colapia على Cloudflare (للمالك، خطوة بخطوة)

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
