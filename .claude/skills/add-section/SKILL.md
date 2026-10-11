---
name: add-section
description: إضافة قسم أو مكوّن لمتجر عميل (قسم نواة بإعداد في blueprint.json، أو مكوّن خاص blocks/<name>.tsx، أو استبدال قسم نواة sections/<type>.tsx، أو صفحة pages/<name>.tsx). استخدمه عند «أضف قسم/صفحة/مكوّن لمتجر <slug>».
---

# إضافة قسم أو مكوّن

1. اقرأ `stores/CLAUDE.md` (الأقسام 2 و4 و5 و8).
2. اختر الطريق الأبسط الذي يحقق المطلوب، بهذا الترتيب:
   1. **قسم نواة موجود** بإعداد في `blueprint.json` (`home`). الأنواع في `src/blueprint/schema.ts` (`sectionSchema`) والحقول التي يعرضها المتجر فعلاً في `src/editor/editable.ts` (`SECTION_FIELDS`). التاجر يستطيع تعديله لاحقاً.
   2. **تغليف قسم نواة** في `sections/<type>.tsx` (استخدم `core` وأضف حوله) إن كان الفرق في الشكل أو إضافة صغيرة.
   3. **مكوّن جديد** `blocks/<name>.tsx` + قسم `{ "type": "store_block", "id", "name", "title", "props" }` في `blueprint.json`.
   4. **صفحة** `pages/<name>.tsx` تصدّر `meta` و`default`، واربطها من الهيدر (`header.nav` في `blueprint.json`) أو الفوتر.
3. مكوّنات الخادم فقط في `sections|blocks|slots|pages`؛ التفاعل في `components/<X>.tsx` بـ `"use client"`.
4. البيانات من `kit.data` فقط. تعامل مع القوائم الفارغة و`core = null`.
5. `npm run stores:registry && npm run stores:check && npx tsc --noEmit`، ثم معاينة ولقطات (`qa`).
6. سجّل الإضافة في `DELIVERY.md`.
