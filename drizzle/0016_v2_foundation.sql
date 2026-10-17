ALTER TYPE "public"."store_status" ADD VALUE 'setup';--> statement-breakpoint
CREATE TABLE "product_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"question" text NOT NULL,
	"answer" text,
	"asker_name" text,
	"asker_phone" text,
	"visitor_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"answered_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "return_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"reason" text,
	"photos" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"merchant_note" text,
	"visitor_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "store_transfers" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "store_transfers" CASCADE;--> statement-breakpoint
ALTER TABLE "merchants" ADD COLUMN "email_canonical" text;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "setup_started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "setup_completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "onboarding" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "source_conversation_id" uuid;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "plan_months" integer;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "order_seq" integer DEFAULT 1000 NOT NULL;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "prefs" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "videos" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "publish_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "preorder" jsonb;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "volume_tiers" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "tags" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "whatsapp_opt_in" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "discounts" ADD COLUMN "scope" jsonb;--> statement-breakpoint
ALTER TABLE "discounts" ADD COLUMN "rule" jsonb;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "discount_piasters" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "gift" jsonb;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "paid_piasters" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "cancel_requested_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "tags" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "platform_payments" ADD COLUMN "plan" text DEFAULT 'standard' NOT NULL;--> statement-breakpoint
ALTER TABLE "platform_payments" ADD COLUMN "months" integer;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "bot_paused_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "product_questions" ADD CONSTRAINT "product_questions_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_questions" ADD CONSTRAINT "product_questions_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "product_questions_store_status_idx" ON "product_questions" USING btree ("store_id","status");--> statement-breakpoint
CREATE INDEX "product_questions_product_idx" ON "product_questions" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "return_requests_store_status_idx" ON "return_requests" USING btree ("store_id","status");--> statement-breakpoint
CREATE INDEX "merchants_email_canonical_idx" ON "merchants" USING btree ("email_canonical");--> statement-breakpoint
CREATE UNIQUE INDEX "stores_source_conversation_uq" ON "stores" USING btree ("source_conversation_id");