CREATE TABLE "platform_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid,
	"store_id" uuid,
	"store_name" text NOT NULL,
	"author_name" text NOT NULL,
	"author_role" text DEFAULT 'صاحب المتجر',
	"avatar_url" text,
	"rating" smallint DEFAULT 5 NOT NULL,
	"content" text NOT NULL,
	"audio_url" text,
	"audio_duration_seconds" integer,
	"is_approved" boolean DEFAULT false NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "merchants_psid_idx";--> statement-breakpoint
DROP INDEX "merchants_igsid_idx";--> statement-breakpoint
DROP INDEX "snapshots_store_version_idx";--> statement-breakpoint
ALTER TABLE "reviews" ALTER COLUMN "rating" SET DEFAULT 5;--> statement-breakpoint
ALTER TABLE "reviews" ALTER COLUMN "is_approved" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "merchants" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "merchants" ADD COLUMN "google_id" text;--> statement-breakpoint
ALTER TABLE "merchants" ADD COLUMN "avatar_url" text;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "demo_started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "demo_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "abandoned_carts" ADD COLUMN "whatsapp_contacted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "google_id" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "customer_email" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "transfer_sender_phone" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "transfer_screenshot_url" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "idempotency_key" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "whatsapp_contacted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "customer_phone" text;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "audio_url" text;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "audio_duration_seconds" smallint;--> statement-breakpoint
ALTER TABLE "platform_reviews" ADD CONSTRAINT "platform_reviews_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "platform_reviews_approved_idx" ON "platform_reviews" USING btree ("is_approved");--> statement-breakpoint
CREATE INDEX "platform_reviews_featured_idx" ON "platform_reviews" USING btree ("is_featured");--> statement-breakpoint
CREATE UNIQUE INDEX "merchants_email_uq" ON "merchants" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "merchants_google_id_uq" ON "merchants" USING btree ("google_id");--> statement-breakpoint
CREATE INDEX "merchants_phone_idx" ON "merchants" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "sessions_store_idx" ON "sessions" USING btree ("store_id");--> statement-breakpoint
CREATE UNIQUE INDEX "snapshots_store_version_uq" ON "store_snapshots" USING btree ("store_id","version");--> statement-breakpoint
CREATE INDEX "snapshots_store_idx" ON "store_snapshots" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "stores_demo_expires_idx" ON "stores" USING btree ("demo_expires_at");--> statement-breakpoint
CREATE INDEX "customers_store_email_idx" ON "customers" USING btree ("store_id","email");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_store_idempotency_uq" ON "orders" USING btree ("store_id","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_order_under_review_uq" ON "payments" USING btree ("order_id") WHERE status = 'under_review';--> statement-breakpoint
CREATE UNIQUE INDEX "platform_payments_store_under_review_uq" ON "platform_payments" USING btree ("store_id") WHERE status = 'under_review';--> statement-breakpoint
CREATE INDEX "reviews_approved_idx" ON "reviews" USING btree ("store_id","is_approved");