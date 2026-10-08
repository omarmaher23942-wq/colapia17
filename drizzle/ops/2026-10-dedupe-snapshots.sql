-- تنظيف لمرة واحدة قبل اعتماد خط الأساس: نسخ مكررة من store_snapshots لنفس (store_id, version).
-- السبب: البناء يحفظ نسخة الإصدار الجديد، ثم أول تعديل يحفظ الإصدار نفسه مرة ثانية (أُصلح في الكود).
-- يُبقي أقدم نسخة لكل (store_id, version) ويحذف الباقي؛ المحتوى واحد لأن رقم النسخة يحدده.
DELETE FROM store_snapshots s
USING store_snapshots k
WHERE s.store_id = k.store_id
  AND s.version = k.version
  AND (s.created_at, s.id) > (k.created_at, k.id);
