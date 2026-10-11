---
name: qa
description: فحص جودة متجر عميل قبل التسليم - الفحوص الآلية ولقطات 375px وسطح المكتب لكل الصفحات وتقييم QUALITY.md بنداً بنداً. استخدمه قبل أي تسليم أو دمج، أو عند «افحص متجر <slug>».
---

# فحص الجودة

1. الفحوص الآلية (كلها يجب أن تنجح):
   ```bash
   npm run stores:check && npx tsc --noEmit && npx vitest run tests/unit/stores-isolation.test.ts
   ```
2. المعاينة: `bash scripts/dev/preview.sh store <slug>` والخادم يعمل (`preview.sh dev`).
3. لقطات (كل أمر يطبع التمرير الأفقي وأخطاء المتصفح؛ أي قيمة غير 0 أو أي خطأ = مانع):
   ```bash
   S=--store=<slug>
   bash scripts/dev/preview.sh shot / home both light --full $S
   bash scripts/dev/preview.sh shot /p/<slug-منتج> product both light --full $S
   bash scripts/dev/preview.sh shot /c/<slug-قسم> category mobile light --full $S
   bash scripts/dev/preview.sh shot /cart cart mobile light $S
   bash scripts/dev/preview.sh shot /checkout checkout mobile light --full $S
   ```
   ولكل صفحة في `pages/` لقطة أيضاً. افتح كل لقطة وانظر إليها فعلاً.
4. راجع الموانع في `stores/QUALITY.md` واحداً واحداً، ثم البنود التسعة بالدليل من اللقطات.
5. تحقق من الصدق: كل وعد في النصوص (شحن، استبدال، دفع عند الاستلام، مدة توصيل) موجود في `BRIEF.md`.
6. اكتب النتيجة في `DELIVERY.md` بالصيغة المذكورة في QUALITY.md. أقل من 91 أو أي مانع = ليس جاهزاً، واذكر الإصلاحات التالية.
