# نقل قاعدة البيانات إلى حساب Neon آخر (خطوة بخطوة)

> السبب: الحساب الحالي قارب حد الاستهلاك الشهري المجاني (95%). الطريقة أدناه تنقل **كل البيانات كما هي** (المتاجر والطلبات والمنتجات وسجل الـ migrations) دون أي تعديل في الكود. الكود لا يعرف إلا متغيراً واحداً: `DATABASE_URL`.

## 1) إنشاء المشروع الجديد
1. سجّلوا الدخول إلى https://console.neon.tech بالحساب الثاني.
2. **New Project**:
   - Name: `colapia`
   - Postgres version: **17** (أو نفس إصدار القديم؛ تجدونه في المشروع القديم ← Settings ← General).
   - Region: **AWS Europe (Frankfurt) eu-central-1**، الأقرب لمصر ولمراكز Cloudflare.
3. بعد الإنشاء: **Connect** ← اختاروا `Pooled connection` ← انسخوا الرابط. يبدأ بـ `postgresql://` وينتهي بـ `?sslmode=require`. هذا هو `DATABASE_URL` الجديد.
4. انسخوا أيضاً رابط **Direct connection** (بدون `-pooler` في اسم المضيف). نحتاجه للنقل فقط.

## 2) نقل البيانات (من جهازكم، مرة واحدة)
تحتاجون `pg_dump` و`psql` بنفس إصدار Postgres أو أحدث:
- Windows: ثبّتوا PostgreSQL 17 من https://www.postgresql.org/download/windows/ (يكفي Command Line Tools).
- macOS: `brew install postgresql@17`

شغّلوا الأوامر التالية (ضعوا الروابط بين علامتي التنصيص، واستخدموا رابط **Direct** في الحالتين):
```bash
# 1) تصدير القاعدة القديمة كاملة (البيانات + المخطط + سجل الـ migrations)
pg_dump "OLD_DIRECT_URL" --no-owner --no-privileges --format=custom --file=colapia.dump

# 2) استيرادها في الجديدة
pg_restore --no-owner --no-privileges --dbname="NEW_DIRECT_URL" colapia.dump
```
تحذيرات مثل `extension "pg_trgm" already exists` أو `must be owner of extension` طبيعية ولا تضر.

**تحقق سريع:**
```bash
psql "NEW_DIRECT_URL" -c "select count(*) from stores;" -c "select count(*) from drizzle.__drizzle_migrations;"
```
يجب أن تطابق الأعداد القاعدة القديمة.

## 3) توجيه المنصة للقاعدة الجديدة
1. **Cloudflare** ← Workers & Pages ← `colapia` ← Settings ← Variables and Secrets ← عدّلوا `DATABASE_URL` إلى الرابط الجديد (**Pooled**) ← Save.
2. على جهازكم: عدّلوا `DATABASE_URL` في `.env.local` إلى الرابط الجديد.
3. أعيدوا النشر: `npm run cf:deploy`.
4. طبّقوا أي migration جديدة: `npm run db:migrate`.
5. افتحوا `https://colapia.com/admin/launch`: يجب أن يكون فحص «قاعدة البيانات» أخضر، ولا migrations معلّقة.

## 4) بعد التأكد (يوم أو يومين)
- في المشروع القديم: **Settings ← Delete project** (أو اتركوه موقوفاً). لا تحذفوه قبل التأكد أن الطلبات الجديدة تُكتب في الجديد.

## 5) لتقليل الاستهلاك في الحساب الجديد
- Settings ← Compute: اجعلوا **Scale to zero = 5 minutes** والحد الأقصى **0.25–1 CU**.
- المنصة تستخدم ذاكرة Redis لقراءات المتجر المتكررة، فلا تحتاج حجماً أكبر قبل عشرات المتاجر النشطة.
- عند أول متجر مدفوع: الخطة **Launch** في Neon، وتكلفتها محسوبة ضمن باقات الاستضافة.
