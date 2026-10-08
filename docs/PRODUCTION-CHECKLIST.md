# 🚀 Colapia Production Launch Checklist

هذه القائمة النهائية يجب مراجعتها بدقة قبل تحويل الـ DNS وإطلاق الحملات الإعلانية.

## 1. البنية التحتية والبيئة (Infrastructure & Env)
- [ ] `NODE_ENV` مضبوط على `production`.
- [ ] `DATABASE_URL` يشير إلى قاعدة بيانات Neon الإنتاجية (Pooled Connection).
- [ ] `UPSTASH_REDIS_REST_URL` و `TOKEN` صحيحة وتعمل.
- [ ] `QSTASH_TOKEN` و `QSTASH_CURRENT_SIGNING_KEY` مضبوطة.
- [ ] `RESEND_API_KEY` مضبوط وتم توثيق الدومين (DKIM/SPF) لـ `*.colapia.com`.
- [ ] `UPLOADTHING_TOKEN` مضبوط.
- [ ] `GEMINI_API_KEY` و `GROQ_API_KEY` بها أرصدة كافية.

## 2. الأمان (Security)
- [ ] `AUTH_SECRET` و `MAGIC_LINK_SECRET` و `ENCRYPTION_KEY` مولدة عشوائياً (32 بايت).
- [ ] `BOOTSTRAP_OWNER_SECRET` معقد ومحفوظ في مكان آمن.
- [ ] `next.config.ts` يحتوي على CSP صارم يمنع الـ XSS.
- [ ] Rate Limiting مفعل في `src/lib/ratelimit.ts`.

## 3. الدفع والماليات (FinOps)
- [ ] `VODAFONE_CASH_NUMBER` و `INSTAPAY_NUMBER` صحيحة وتم اختبار التحويل إليها.
- [ ] `PLATFORM_PRICE_EGP` مضبوط على `899`.
- [ ] `PLATFORM_BASE_PRICE_EGP` مضبوط على `8999`.

## 4. النطاقات (Domains & DNS)
- [ ] الدومين الأساسي `colapia.com` مربوط بـ Vercel.
- [ ] Wildcard Domain `*.colapia.com` مفعل ومربوط بـ Vercel.
- [ ] شهادات SSL (Let's Encrypt) مفعلة للـ Wildcard.

## 5. الاختبارات النهائية (Final Tests)
- [ ] `npm run typecheck` يمر بدون أي أخطاء.
- [ ] `npm run build` يكتمل بنجاح.
- [ ] اختبار رحلة مستخدم كاملة: (تسجيل -> بناء بالـ AI -> تجربة -> دفع -> تفعيل -> شراء كعميل).
- [ ] اختبار الـ Webhooks الخاصة بـ Meta (Messenger/Instagram).

## 6. خطة الطوارئ (Disaster Recovery)
- [ ] سكربت `scripts/backup-db.ts` مجدول للعمل يومياً.
- [ ] الوصول إلى Vercel Logs متاح لمراقبة `system_events`.
- [ ] ميزة `bot.enabled` في الـ Feature Flags يمكن إطفاؤها بضغطة زر في حال جنون الـ AI.