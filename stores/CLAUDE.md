# stores/ — المتاجر المخصصة (V5: تُبنى هنا بـ Claude لكل عميل)

بقرار المالك (V5، انظر `docs/V5-PLAN.md`) كل عميل يحصل على **متجر مخصص يُبنى من الصفر** في مجلد `stores/<slug>/` بخبرة المنصة، أفضل بكثير مما تنتجه المنصة آلياً. `<slug>` = النطاق الفرعي = اسم مجلد المتجر في المشروع المسلَّم.

## بنية المجلد
`store.json` · `blueprint.json` · `seed.json` · `theme.css` · `sections/<type>.tsx` (يستبدل قسم النواة) · `blocks/<name>.tsx` (قسم `store_block`) · `slots/Header|Footer|Home.tsx` · `pages/<name>.tsx` · `components/` (التفاعلي) · `setup-recipe.json` (اختياري: خطوات الإعداد المخصصة وإجاباتها المسبقة) · `DELIVERY.md`. مرجع مكتمل: `stores/demo` (ملابس حريمي)، وأمثلة أقدم: `nova`, `atelier`.

## قواعد البناء
- لا يستورد كود المتجر إلا من `@/stores-kit` وملفاته ومكتبات العرض المسموحة؛ الحارس `npm run stores:check` يفرض ذلك (ممنوع `process.env` و`"use server"` و`eval` و`dangerouslySetInnerHTML`).
- `sections|blocks|slots|pages` مكوّنات خادم؛ التفاعل في `components/` بـ `"use client"`.
- ثيم من `src/blueprint/themes.ts` ثم تخصيص بصري فوقه؛ الشكل لا يتغير بعد التسليم.
- جودة: عربية RTL، 375/768/1024، فاتح وداكن، LCP ≤ 2.0 ث، نص قليل، فيديو الواجهة بشروط الأداء (غلاف أولاً، تحميل متأخر، يحترم توفير البيانات).
- لغة تشمل الجميع، صدق كامل: لا أرقام ولا آراء ولا ضمانات مخترعة؛ لا خيار تغليف هدية أو إلغاء عميل إلا إن طلبهما التاجر.
- الفحص قبل الدفع: `npm run stores:check` + `tsc` + `vitest` + معاينة `bash scripts/dev/preview.sh store <slug>`.
- بعد البناء: يُولَّد مشروع التسليم بـ `npx tsx scripts/store-template.ts --folder <slug> --out <dir> --check` (وهو يضم هذا المجلد).
- أي تغيير في المنصة نفسها يُكتب في `CLAUDE.md` الجذر، لا هنا.
