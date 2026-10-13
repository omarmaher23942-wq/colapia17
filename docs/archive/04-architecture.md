
`docs/04-architecture.md`

```md
# المعمارية والقرارات

## تدفق الطلب
Middleware يستخرج الـ subdomain → rewrite إلى `/s/[store]` → `layout` يحل المتجر (Redis 60s) ويحقن CSS variables من الـ Blueprint → الصفحة تصيّر الأقسام من الـ Registry → البيانات من `server/repos`.

## الأموال
كل المبالغ بالقروش (integer). التحويل للعرض عبر `lib/money.ts` فقط.

## الأمان
- Env محقق بـ Zod عند الإقلاع. Rate limit على checkout/track/login/events/search.
- الأسعار تُحسب على الخادم من قاعدة البيانات فقط، لا من السلة.
- الجلسات: توكن عشوائي 32 بايت، يُخزن hash فقط، كوكي httpOnly على نطاق المتجر، وتُرفض جلسة متجر على متجر آخر.
- كلمات المرور: scrypt (مضمّن في Node).
- الـ Blueprint يُتحقق منه بالكامل قبل الحفظ؛ الروابط أهداف محكومة لا HTML حر.
- رؤوس أمان في `next.config.ts`، و`poweredByHeader` مغلق.

## الكاش
Redis: المتجر بالـ subdomain (60s)، الـ Blueprint (300s)، الإثبات الاجتماعي (120s)، "اشتُري معًا" (ZSET دائم)، المشاهدون الآن (ZSET 5 دقائق). `invalidateStoreCache` يُستدعى بعد كل حفظ.

## البحث
`search_text` مُطبّع (همزات، تاء مربوطة، فرانكو) + `pg_trgm` GIN index + `similarity()` للترتيب.

## التوسعة
قسم جديد = variant في `blueprint/schema.ts` + مكوّن في `components/blocks` + سطر في `registry.tsx` + قيم افتراضية في `DesignEditor`. يظهر لكل المتاجر فورًا.

## Zero-cost checklist
Neon Free · Upstash Free · Uploadthing Free · Vercel Hobby · Groq/Gemini Free · Morpheus حسب رصيدك · لا خدمات خارجية للتحليلات أو البريد.
