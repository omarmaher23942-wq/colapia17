CREATE TYPE "public"."support_category" AS ENUM('shipping', 'return', 'payment', 'product', 'urgent', 'general');--> statement-breakpoint
CREATE TYPE "public"."support_priority" AS ENUM('low', 'normal', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."support_sender_role" AS ENUM('customer', 'merchant', 'ai', 'system');--> statement-breakpoint
CREATE TYPE "public"."support_sentiment" AS ENUM('positive', 'neutral', 'negative', 'angry');--> statement-breakpoint
CREATE TYPE "public"."support_thread_status" AS ENUM('open', 'pending', 'closed', 'escalated');--> statement-breakpoint
CREATE TABLE "support_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thread_id" uuid NOT NULL,
	"store_id" uuid NOT NULL,
	"sender_role" "support_sender_role" NOT NULL,
	"sender_name" text,
	"text" text NOT NULL,
	"attachments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_internal" boolean DEFAULT false NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_threads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"customer_id" uuid,
	"assigned_to" uuid,
	"guest_name" text,
	"guest_phone" text,
	"guest_email" text,
	"guest_token_hash" text NOT NULL,
	"subject" text,
	"status" "support_thread_status" DEFAULT 'open' NOT NULL,
	"category" "support_category" DEFAULT 'general' NOT NULL,
	"priority" "support_priority" DEFAULT 'normal' NOT NULL,
	"sentiment" "support_sentiment" DEFAULT 'neutral' NOT NULL,
	"last_message_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_message_preview" text,
	"sla_expires_at" timestamp with time zone,
	"internal_notes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"unread_for_merchant" integer DEFAULT 0 NOT NULL,
	"unread_for_customer" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketing_campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"type" text NOT NULL,
	"target_id" text NOT NULL,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"scheduled_for" timestamp with time zone NOT NULL,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "merchant_referrals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"referrer_merchant_id" uuid NOT NULL,
	"referred_merchant_id" uuid NOT NULL,
	"referral_code_used" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"fraud_score" integer DEFAULT 0 NOT NULL,
	"ip_address" text,
	"device_fingerprint" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"activated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "referral_rewards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"referral_id" uuid NOT NULL,
	"reward_type" text NOT NULL,
	"amount_piasters" integer DEFAULT 0 NOT NULL,
	"is_claimed" boolean DEFAULT false NOT NULL,
	"claimed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "model3d_url" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "model_usdz_url" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "is_ar_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_thread_id_support_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."support_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_threads" ADD CONSTRAINT "support_threads_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_threads" ADD CONSTRAINT "support_threads_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_threads" ADD CONSTRAINT "support_threads_assigned_to_platform_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."platform_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_campaigns" ADD CONSTRAINT "marketing_campaigns_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_referrals" ADD CONSTRAINT "merchant_referrals_referrer_merchant_id_merchants_id_fk" FOREIGN KEY ("referrer_merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_referrals" ADD CONSTRAINT "merchant_referrals_referred_merchant_id_merchants_id_fk" FOREIGN KEY ("referred_merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_rewards" ADD CONSTRAINT "referral_rewards_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_rewards" ADD CONSTRAINT "referral_rewards_referral_id_merchant_referrals_id_fk" FOREIGN KEY ("referral_id") REFERENCES "public"."merchant_referrals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "support_messages_thread_idx" ON "support_messages" USING btree ("thread_id","created_at");--> statement-breakpoint
CREATE INDEX "support_messages_store_idx" ON "support_messages" USING btree ("store_id");--> statement-breakpoint
CREATE UNIQUE INDEX "support_threads_guest_token_uq" ON "support_threads" USING btree ("store_id","guest_token_hash");--> statement-breakpoint
CREATE INDEX "support_threads_store_status_idx" ON "support_threads" USING btree ("store_id","status","last_message_at");--> statement-breakpoint
CREATE INDEX "support_threads_sla_idx" ON "support_threads" USING btree ("store_id","sla_expires_at");--> statement-breakpoint
CREATE INDEX "marketing_campaigns_store_idx" ON "marketing_campaigns" USING btree ("store_id","type");--> statement-breakpoint
CREATE INDEX "marketing_campaigns_schedule_idx" ON "marketing_campaigns" USING btree ("status","scheduled_for");--> statement-breakpoint
CREATE UNIQUE INDEX "merchant_referrals_referred_uq" ON "merchant_referrals" USING btree ("referred_merchant_id");--> statement-breakpoint
CREATE INDEX "merchant_referrals_referrer_idx" ON "merchant_referrals" USING btree ("referrer_merchant_id","status");--> statement-breakpoint
CREATE INDEX "referral_rewards_merchant_idx" ON "referral_rewards" USING btree ("merchant_id","is_claimed");