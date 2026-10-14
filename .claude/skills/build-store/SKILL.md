---
name: build-store
description: بناء متجر عميل Colapia كامل من الـ brief داخل stores/<slug>/ حتى يتجاوز 90 على QUALITY.md. استخدمه عند «ابنِ متجر <slug>» أو عند بدء العمل على مجلد متجر جديد فيه BRIEF.md.
---

# بناء متجر عميل

1. اقرأ `stores/DESIGN-BRIEF.md` أولاً (مستوى الطموح وقراءة الطلب وقاعدة +50% والتصميم المتوازن والسرعة والفيديو واللوحة المخصصة)، ثم `stores/CLAUDE.md` كاملاً ثم `stores/QUALITY.md`. لا تبدأ قبلها. هذا أهم طلب عندنا: ابنِ بأفضل جودة ممكنة وبأحدث معايير وقت البناء.
2. حدد المجلد `stores/<slug>/`. إن لم يوجد: انسخ `stores/_template/` إليه وضع الـ slug في `store.json`.
3. اقرأ `BRIEF.md` وكل ملفات `brief/` (اعرض الصور فعلاً). اكتب قسم «الفهم» في `DELIVERY.md`.
4. نفّذ خطوات القسم 3 من `stores/CLAUDE.md` بالترتيب: الاتجاه البصري ← `blueprint.json` (theme + design + home + نصوص) ← `seed.json` ← `theme.css` ← مكوّنات خاصة عند الحاجة فقط.
   - ابدأ `blueprint.json` من Blueprint صالح: إن وُجدت مسودة آلية في المجلد عدّلها، وإلا ابنِ على شكل `src/blueprint/defaults.ts` (`defaultBlueprint`).
5. `npm run stores:registry && npm run stores:check && npx tsc --noEmit` حتى تنجح كلها.
6. `bash scripts/dev/preview.sh store <slug>` ثم (إن لم يكن الخادم يعمل) `bash scripts/dev/preview.sh dev` في الخلفية.
7. شغّل مهارة `qa`: لقطات كل الصفحات على 375px وسطح المكتب، وقيّم بـ QUALITY.md بصدق.
8. أصلح أضعف ثلاثة بنود وكرر 6–7 حتى تتجاوز 90 بلا موانع.
9. ابنِ لوحة التحكم المخصصة للمتجر (القاعدة + إضافات النشاط وطلب العميل) وفق `CLAUDE.md` القسم 5 البند 7، وتحقق منها بلقطات.
10. أكمل `DELIVERY.md`: ما تغيّر، النتيجة بنداً بنداً، الأسئلة للعميل، وأي تعديل نواة.
11. commit بأسماء الملفات داخل `stores/<slug>/` (و`src/stores/registry.generated.ts`) برسالة عربية واضحة.
