# إعداد المشروع ونشره

> الترتيب مهم. كل خطوة قصيرة. الدليل التفصيلي مع الصور يقوده فريق التنفيذ في الميتنج.

1. **GitHub:** أنشئوا مستودعاً خاصاً وارفعوا هذا المجلد إليه (`git init && git add -A && git commit -m init && git remote add origin … && git push -u origin main`).
2. **Neon:** أنشئوا مشروعاً (neon.tech) ثم Dashboard ← Connect ← انسخوا رابط الاتصال الكامل. هذا هو `DATABASE_URL`.
3. **ImageKit:** من imagekit.io ← Developer options ← API keys: انسخوا المفتاح الخاص (`IMAGEKIT_PRIVATE_KEY`) ونقطة النهاية (`IMAGEKIT_URL_ENDPOINT`).
4. **Groq (اختياري):** console.groq.com/keys ← Create API key ← `GROQ_API_KEY`.
5. **R2 (للفيديو):** Cloudflare ← R2 ← Create bucket باسم `{{SLUG}}-media` (قبل أول نشر).
6. **Cloudflare:** Workers & Pages ← Create ← Import a repository ← اختاروا المستودع. أمر البناء `npm run cf:build` وأمر النشر `npx wrangler deploy`.
7. **المتغيرات:** Settings ← Variables and Secrets: `DATABASE_URL`، `IMAGEKIT_PRIVATE_KEY`، `IMAGEKIT_URL_ENDPOINT`، `APP_URL` (رابط الموقع بلا / في الآخر)، و`GROQ_API_KEY` إن وُجد. ثم أعيدوا النشر. (للحماية قبل إتمام الإعداد أضيفوا `SETUP_CODE` بقيمة سرية.)
8. **الإعداد الأول:** افتحوا `<رابط الموقع>/setup`: افحصوا الربط، اضغطوا «تجهيز قاعدة البيانات»، أنشئوا الحساب (البريد `{{OWNER_EMAIL}}`)، **واحفظوا رمز الاسترجاع**. ثم يفتح إعداد المتجر.
9. **النطاق:** Cloudflare ← الموقع ← Settings ← Domains & Routes ← Add custom domain. بعد الربط حدّثوا `APP_URL`.

## الفحص بعد الإعداد
الصفحة الرئيسية تفتح، رفع صورة منتج يعمل، طلب تجريبي يظهر في اللوحة، الدخول يعمل بكلمة المرور.

## أخطاء شائعة
- **«قاعدة البيانات غير مربوطة»:** `DATABASE_URL` ناقص أو غير كامل (يجب أن يبدأ بـ postgresql://). أعيدوا النشر بعد تعديل المتغيرات.
- **رفع الصور يفشل:** تأكدوا من `IMAGEKIT_PRIVATE_KEY` و`IMAGEKIT_URL_ENDPOINT` ثم «اختبار الاتصال» في لوحة التحكم ← الربط والمفاتيح.
- **رفع الفيديو يفشل:** الحاوية `{{SLUG}}-media` غير موجودة أو الربط `MEDIA` غير ظاهر في Settings ← Bindings.
- **فشل النشر `bucket not found`:** أنشئوا الحاوية ثم أعيدوا النشر.
- **`__name is not defined` في المتصفح:** لا تغيّروا `keep_names: false` في `wrangler.jsonc`.
