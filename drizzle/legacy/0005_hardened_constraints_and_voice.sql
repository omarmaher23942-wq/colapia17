-- 1. منع بيع المخزون بالسالب نهائياً (Overselling Prevention)
ALTER TABLE "products" ADD CONSTRAINT "products_stock_nonnegative" CHECK ("stock" IS NULL OR "stock" >= 0);
ALTER TABLE "product_variants" ADD CONSTRAINT "variants_stock_nonnegative" CHECK ("stock" IS NULL OR "stock" >= 0);
ALTER TABLE "discounts" ADD CONSTRAINT "discounts_uses_nonnegative" CHECK ("used_count" >= 0 AND ("max_uses" IS NULL OR "used_count" <= "max_uses"));

-- 2. إضافة حقول عداد الـ 180 دقيقة وساعات التجربة
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "demo_started_at" timestamp with time zone;
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "demo_expires_at" timestamp with time zone;
CREATE INDEX IF NOT EXISTS "stores_demo_expires_idx" ON "stores" USING btree ("demo_expires_at");

-- 3. منع تكرار الـ Snapshots لنفس الإصدار
CREATE UNIQUE INDEX IF NOT EXISTS "snapshots_store_version_uq" ON "store_snapshots" USING btree ("store_id", "version");

-- 4. حظر الإيصالات المتزامنة تحت المراجعة لنفس الأوردر أو المتجر
CREATE UNIQUE INDEX IF NOT EXISTS "payments_order_under_review_uq" ON "payments" ("order_id") WHERE "status" = 'under_review';
CREATE UNIQUE INDEX IF NOT EXISTS "platform_payments_store_under_review_uq" ON "platform_payments" ("store_id") WHERE "status" = 'under_review';

-- 5. دعم التقييمات الصوتية وتاريخ تواصل الواتساب
ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "customer_phone" text;
ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "audio_url" text;
ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "audio_duration_seconds" smallint;
ALTER TABLE "reviews" ALTER COLUMN "is_approved" SET DEFAULT false;

ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "idempotency_key" text;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "whatsapp_contacted_at" timestamp with time zone;
CREATE UNIQUE INDEX IF NOT EXISTS "orders_store_idempotency_uq" ON "orders" ("store_id", "idempotency_key") WHERE "idempotency_key" IS NOT NULL;

ALTER TABLE "abandoned_carts" ADD COLUMN IF NOT EXISTS "whatsapp_contacted_at" timestamp with time zone;