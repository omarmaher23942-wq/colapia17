-- تفعيل إضافات البحث المتسامح داخل Neon (مجانية ومتاحة افتراضيًا)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- فهرس trigram على النص المُطبّع للمنتجات: بحث سريع متسامح مع الأخطاء الإملائية
CREATE INDEX IF NOT EXISTS products_search_trgm_idx
  ON products USING GIN (search_text gin_trgm_ops);
