---
name: restyle
description: تغيير الهوية البصرية لمتجر عميل (الألوان، الخطوط، الأشكال، البطاقات، الحركة، الجلد) دون كسر شيء. استخدمه عند «غيّر شكل/ألوان/ستايل متجر <slug>».
---

# إعادة تصميم الشكل

1. اقرأ `stores/CLAUDE.md` (الأقسام 3 و7 و8) و`BRIEF.md`.
2. خذ لقطات «قبل»: `bash scripts/dev/preview.sh shot / before both light --full --store=<slug>`.
3. غيّر بالترتيب، وتوقف عند أول مستوى يكفي:
   1. `blueprint.json` ← `theme` (الألوان، `fonts.heading/body` من `AVAILABLE_FONTS`، `mode`).
   2. `blueprint.json` ← `design` (shape، card، button، surface، heading، motion). القيم المسموحة في `designSchema` بملف `src/blueprint/schema.ts`.
   3. `theme.css` لما لا يغطيه المخطط، على خطافات `.s-*` ومتغيرات الثيم، وكل قاعدة تبدأ بـ `.storefront`.
4. تحقق من التباين (4.5:1) خصوصاً العناوين داخل الأقسام الملونة والبطاقات الفاتحة في القسم الداكن.
5. `preview.sh store <slug>` ثم لقطات «بعد» لكل الصفحات، وقارن. لا تمرير أفقي.
6. سجّل في `DELIVERY.md` ما تغيّر ولماذا، مع النتيجة المحدّثة على QUALITY.md.
