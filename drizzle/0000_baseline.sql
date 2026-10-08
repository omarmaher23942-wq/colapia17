-- خط الأساس الكامل لمخطط Colapia: يبني قاعدة جديدة من الصفر (قاعدة المنصة أو قاعدة Neon الخاصة بالتاجر).
-- يُولَّد من src/db/schema عبر drizzle-kit، ثم أُضيف امتداد pg_trgm في أوله لأن فهرس البحث يعتمد عليه.
-- السلسلة القديمة محفوظة للمرجع فقط في drizzle/legacy ولا تُشغَّل.
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE TYPE "public"."discount_type" AS ENUM('percentage', 'fixed', 'free_shipping');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('new', 'confirmed', 'preparing', 'shipped', 'delivered', 'returned', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('cod', 'vodafone_cash', 'instapay');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'under_review', 'confirmed', 'rejected', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."platform_role" AS ENUM('owner', 'admin', 'reviewer');--> statement-breakpoint
CREATE TYPE "public"."product_status" AS ENUM('active', 'draft', 'hidden', 'archived');--> statement-breakpoint
CREATE TYPE "public"."store_status" AS ENUM('intake', 'pending_review', 'building', 'review', 'trial', 'frozen', 'active', 'suspended', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."channel" AS ENUM('messenger', 'instagram');--> statement-breakpoint
CREATE TYPE "public"."conv_stage" AS ENUM('greeting', 'discovery', 'persuasion', 'trial_offer', 'link_sent', 'form_submitted', 'brief', 'products', 'proof', 'policies', 'summary', 'handoff', 'building', 'delivered', 'trial', 'payment', 'activated', 'frozen', 'lost', 'human');--> statement-breakpoint
CREATE TYPE "public"."support_category" AS ENUM('shipping', 'return', 'payment', 'product', 'urgent', 'general');--> statement-breakpoint
CREATE TYPE "public"."support_priority" AS ENUM('low', 'normal', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."support_sender_role" AS ENUM('customer', 'merchant', 'ai', 'system');--> statement-breakpoint
CREATE TYPE "public"."support_sentiment" AS ENUM('positive', 'neutral', 'negative', 'angry');--> statement-breakpoint
CREATE TYPE "public"."support_thread_status" AS ENUM('open', 'pending', 'closed', 'escalated');--> statement-breakpoint
CREATE TABLE "merchants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"display_name" text NOT NULL,
	"email" text,
	"google_id" text,
	"avatar_url" text,
	"phone" text,
	"username" text,
	"password_hash" text,
	"is_activated" boolean DEFAULT false NOT NULL,
	"messenger_psid" text,
	"instagram_igsid" text,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
CREATE TABLE "platform_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "platform_role" DEFAULT 'admin' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" text NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" uuid NOT NULL,
	"store_id" uuid,
	"user_agent" text,
	"ip" text,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_blueprints" (
	"store_id" uuid PRIMARY KEY NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"data" jsonb NOT NULL,
	"updated_by" text DEFAULT 'system' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"data" jsonb NOT NULL,
	"label" text,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"subdomain" text NOT NULL,
	"custom_domain" text,
	"name" text NOT NULL,
	"status" "store_status" DEFAULT 'intake' NOT NULL,
	"plan" text DEFAULT 'launch' NOT NULL,
	"submitted_at" timestamp with time zone,
	"review_deadline_at" timestamp with time zone,
	"payment_invited_at" timestamp with time zone,
	"doom_at" timestamp with time zone,
	"build_started_at" timestamp with time zone,
	"deliver_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"demo_started_at" timestamp with time zone,
	"demo_expires_at" timestamp with time zone,
	"trial_ends_at" timestamp with time zone,
	"frozen_at" timestamp with time zone,
	"purge_at" timestamp with time zone,
	"activated_at" timestamp with time zone,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"review_notes" text,
	"accepting_orders" boolean DEFAULT true NOT NULL,
	"vacation_message" text,
	"showcase_opt_in" boolean DEFAULT true NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"parent_id" uuid,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"image_url" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_visible" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"option_values" jsonb NOT NULL,
	"price_piasters" integer,
	"compare_at_piasters" integer,
	"stock" integer,
	"sku" text,
	"image_url" text,
	"image_urls" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_available" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "variants_stock_nonnegative" CHECK ("product_variants"."stock" IS NULL OR "product_variants"."stock" >= 0)
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"category_id" uuid,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"short_description" text,
	"description" text,
	"price_piasters" integer NOT NULL,
	"compare_at_piasters" integer,
	"cost_piasters" integer,
	"sku" text,
	"stock" integer,
	"track_stock" boolean DEFAULT true NOT NULL,
	"images" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"model3d_url" text,
	"model_usdz_url" text,
	"is_ar_enabled" boolean DEFAULT false NOT NULL,
	"attributes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"option_names" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"option_meta" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"ai_draft" boolean DEFAULT false NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"badges" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"seo_title" text,
	"seo_description" text,
	"status" "product_status" DEFAULT 'active' NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"search_text" text,
	"view_count" integer DEFAULT 0 NOT NULL,
	"order_count" integer DEFAULT 0 NOT NULL,
	"rating_sum" integer DEFAULT 0 NOT NULL,
	"rating_count" integer DEFAULT 0 NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_stock_nonnegative" CHECK ("products"."stock" IS NULL OR "products"."stock" >= 0)
);
--> statement-breakpoint
CREATE TABLE "abandoned_carts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"visitor_id" text NOT NULL,
	"phone" text,
	"name" text,
	"items" jsonb NOT NULL,
	"subtotal_piasters" integer NOT NULL,
	"recovered_order_id" uuid,
	"whatsapp_contacted_at" timestamp with time zone,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"phone" text NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"google_id" text,
	"avatar_url" text,
	"alt_phone" text,
	"governorate" text,
	"city" text,
	"address" text,
	"notes" text,
	"orders_count" integer DEFAULT 0 NOT NULL,
	"total_spent_piasters" integer DEFAULT 0 NOT NULL,
	"last_order_at" timestamp with time zone,
	"is_blocked" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"code" text NOT NULL,
	"type" "discount_type" NOT NULL,
	"value" integer NOT NULL,
	"min_subtotal_piasters" integer,
	"max_uses" integer,
	"used_count" integer DEFAULT 0 NOT NULL,
	"per_customer_limit" integer,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_auto_apply" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "discounts_uses_nonnegative" CHECK ("discounts"."used_count" >= 0 AND ("discounts"."max_uses" IS NULL OR "discounts"."used_count" <= "discounts"."max_uses"))
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"store_id" uuid NOT NULL,
	"product_id" uuid,
	"variant_id" uuid,
	"name" text NOT NULL,
	"variant_label" text,
	"image_url" text,
	"unit_piasters" integer NOT NULL,
	"quantity" integer NOT NULL,
	"total_piasters" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"customer_id" uuid,
	"code" text NOT NULL,
	"status" "order_status" DEFAULT 'new' NOT NULL,
	"customer_name" text NOT NULL,
	"customer_phone" text NOT NULL,
	"customer_email" text,
	"customer_alt_phone" text,
	"governorate" text NOT NULL,
	"city" text,
	"address" text NOT NULL,
	"landmark" text,
	"customer_notes" text,
	"subtotal_piasters" integer NOT NULL,
	"shipping_piasters" integer NOT NULL,
	"cod_fee_piasters" integer DEFAULT 0 NOT NULL,
	"discount_piasters" integer DEFAULT 0 NOT NULL,
	"discount_code" text,
	"total_piasters" integer NOT NULL,
	"payment_method" "payment_method" NOT NULL,
	"payment_status" "payment_status" DEFAULT 'pending' NOT NULL,
	"transfer_sender_phone" text,
	"transfer_screenshot_url" text,
	"courier_name" text,
	"tracking_number" text,
	"shipped_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"internal_notes" text,
	"source" text DEFAULT 'storefront' NOT NULL,
	"is_test" boolean DEFAULT false NOT NULL,
	"status_history" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"visitor_id" text,
	"idempotency_key" text,
	"whatsapp_contacted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"method" "payment_method" NOT NULL,
	"amount_piasters" integer NOT NULL,
	"sender_phone" text,
	"screenshot_url" text,
	"screenshot_hash" text,
	"status" "payment_status" DEFAULT 'under_review' NOT NULL,
	"reviewed_at" timestamp with time zone,
	"review_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"method" "payment_method" NOT NULL,
	"amount_piasters" integer NOT NULL,
	"sender_phone" text,
	"screenshot_url" text,
	"screenshot_hash" text,
	"status" "payment_status" DEFAULT 'under_review' NOT NULL,
	"ai_verification" jsonb,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"review_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"order_id" uuid,
	"customer_name" text NOT NULL,
	"customer_phone" text,
	"rating" smallint DEFAULT 5 NOT NULL,
	"body" text,
	"audio_url" text,
	"audio_duration_seconds" smallint,
	"image_urls" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_approved" boolean DEFAULT false NOT NULL,
	"is_verified" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shipping_zones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"governorate" text NOT NULL,
	"fee_piasters" integer NOT NULL,
	"cod_extra_piasters" integer DEFAULT 0 NOT NULL,
	"eta_min_days" smallint DEFAULT 2 NOT NULL,
	"eta_max_days" smallint DEFAULT 5 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics_daily" (
	"store_id" uuid NOT NULL,
	"day" date NOT NULL,
	"page_views" integer DEFAULT 0 NOT NULL,
	"visitors" integer DEFAULT 0 NOT NULL,
	"product_views" integer DEFAULT 0 NOT NULL,
	"add_to_carts" integer DEFAULT 0 NOT NULL,
	"checkouts" integer DEFAULT 0 NOT NULL,
	"orders" integer DEFAULT 0 NOT NULL,
	"revenue_piasters" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "analytics_daily_store_id_day_pk" PRIMARY KEY("store_id","day")
);
--> statement-breakpoint
CREATE TABLE "analytics_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"visitor_id" text NOT NULL,
	"session_id" text NOT NULL,
	"name" text NOT NULL,
	"path" text,
	"product_id" uuid,
	"referrer" text,
	"utm_source" text,
	"device" text,
	"props" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feature_flags" (
	"key" text PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"description" text,
	"config" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "magic_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" text NOT NULL,
	"purpose" text NOT NULL,
	"merchant_id" uuid NOT NULL,
	"store_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"level" text DEFAULT 'info' NOT NULL,
	"scope" text NOT NULL,
	"store_id" uuid,
	"actor" text,
	"message" text NOT NULL,
	"data" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purpose" text NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"store_id" uuid,
	"conversation_id" uuid,
	"tokens_in" integer DEFAULT 0 NOT NULL,
	"tokens_out" integer DEFAULT 0 NOT NULL,
	"latency_ms" integer DEFAULT 0 NOT NULL,
	"ok" boolean DEFAULT true NOT NULL,
	"error" text,
	"fallback_from" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "build_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"intake_id" uuid NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"workflow_run_id" text,
	"plan" jsonb,
	"steps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"qa_report" jsonb,
	"error" text,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel" "channel" NOT NULL,
	"external_id" text NOT NULL,
	"merchant_id" uuid,
	"store_id" uuid,
	"stage" "conv_stage" DEFAULT 'greeting' NOT NULL,
	"memory" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"profile_name" text,
	"bot_paused" boolean DEFAULT false NOT NULL,
	"last_user_message_at" timestamp with time zone,
	"last_bot_message_at" timestamp with time zone,
	"unread_for_admin" integer DEFAULT 0 NOT NULL,
	"lead_score" integer DEFAULT 0 NOT NULL,
	"lost_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "intakes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"store_id" uuid,
	"brief" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"products" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"policies" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"assets" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"completeness" integer DEFAULT 0 NOT NULL,
	"finalized_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"role" text NOT NULL,
	"external_mid" text,
	"text" text,
	"attachments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"tool_calls" jsonb,
	"tokens_in" integer,
	"tokens_out" integer,
	"model" text,
	"latency_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prompts" (
	"key" text PRIMARY KEY NOT NULL,
	"content" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scheduled_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid,
	"kind" text NOT NULL,
	"qstash_message_id" text,
	"run_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"dedupe_key" text,
	"payload" jsonb,
	"attempts" integer DEFAULT 0 NOT NULL,
	"fired_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "onboarding_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"key" text NOT NULL,
	"url" text NOT NULL,
	"mime" text,
	"size_bytes" integer,
	"width" integer,
	"height" integer,
	"thumbhash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "onboarding_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"status" text DEFAULT 'issued' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"opened_at" timestamp with time zone,
	"last_seen_at" timestamp with time zone,
	"draft" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"draft_version" integer DEFAULT 0 NOT NULL,
	"last_step" text,
	"submission" jsonb,
	"submitted_at" timestamp with time zone,
	"store_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_directives" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"scope" text DEFAULT 'store' NOT NULL,
	"product_source_id" text,
	"instruction" text NOT NULL,
	"image_urls" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lifecycle_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid,
	"store_ref" text,
	"conversation_id" uuid,
	"type" text NOT NULL,
	"from_status" text,
	"to_status" text,
	"actor" text DEFAULT 'system' NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_templates" (
	"key" text PRIMARY KEY NOT NULL,
	"content" text NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
ALTER TABLE "platform_reviews" ADD CONSTRAINT "platform_reviews_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_blueprints" ADD CONSTRAINT "store_blueprints_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_snapshots" ADD CONSTRAINT "store_snapshots_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stores" ADD CONSTRAINT "stores_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stores" ADD CONSTRAINT "stores_reviewed_by_platform_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."platform_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "abandoned_carts" ADD CONSTRAINT "abandoned_carts_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discounts" ADD CONSTRAINT "discounts_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_payments" ADD CONSTRAINT "platform_payments_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipping_zones" ADD CONSTRAINT "shipping_zones_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_daily" ADD CONSTRAINT "analytics_daily_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "build_jobs" ADD CONSTRAINT "build_jobs_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "build_jobs" ADD CONSTRAINT "build_jobs_intake_id_intakes_id_fk" FOREIGN KEY ("intake_id") REFERENCES "public"."intakes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intakes" ADD CONSTRAINT "intakes_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intakes" ADD CONSTRAINT "intakes_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_jobs" ADD CONSTRAINT "scheduled_jobs_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_assets" ADD CONSTRAINT "onboarding_assets_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_sessions" ADD CONSTRAINT "onboarding_sessions_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_sessions" ADD CONSTRAINT "onboarding_sessions_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_directives" ADD CONSTRAINT "ai_directives_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_directives" ADD CONSTRAINT "ai_directives_created_by_platform_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."platform_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lifecycle_events" ADD CONSTRAINT "lifecycle_events_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lifecycle_events" ADD CONSTRAINT "lifecycle_events_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
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
CREATE UNIQUE INDEX "merchants_username_uq" ON "merchants" USING btree ("username");--> statement-breakpoint
CREATE UNIQUE INDEX "merchants_email_uq" ON "merchants" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "merchants_google_id_uq" ON "merchants" USING btree ("google_id");--> statement-breakpoint
CREATE INDEX "merchants_phone_idx" ON "merchants" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "platform_reviews_approved_idx" ON "platform_reviews" USING btree ("is_approved");--> statement-breakpoint
CREATE INDEX "platform_reviews_featured_idx" ON "platform_reviews" USING btree ("is_featured");--> statement-breakpoint
CREATE UNIQUE INDEX "platform_users_email_uq" ON "platform_users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_uq" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "sessions_subject_idx" ON "sessions" USING btree ("subject_type","subject_id");--> statement-breakpoint
CREATE INDEX "sessions_store_idx" ON "sessions" USING btree ("store_id");--> statement-breakpoint
CREATE UNIQUE INDEX "snapshots_store_version_uq" ON "store_snapshots" USING btree ("store_id","version");--> statement-breakpoint
CREATE INDEX "snapshots_store_idx" ON "store_snapshots" USING btree ("store_id");--> statement-breakpoint
CREATE UNIQUE INDEX "stores_subdomain_uq" ON "stores" USING btree ("subdomain");--> statement-breakpoint
CREATE UNIQUE INDEX "stores_custom_domain_uq" ON "stores" USING btree ("custom_domain");--> statement-breakpoint
CREATE INDEX "stores_merchant_idx" ON "stores" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "stores_status_idx" ON "stores" USING btree ("status");--> statement-breakpoint
CREATE INDEX "stores_trial_ends_idx" ON "stores" USING btree ("trial_ends_at");--> statement-breakpoint
CREATE INDEX "stores_demo_expires_idx" ON "stores" USING btree ("demo_expires_at");--> statement-breakpoint
CREATE INDEX "stores_review_deadline_idx" ON "stores" USING btree ("review_deadline_at");--> statement-breakpoint
CREATE INDEX "stores_doom_at_idx" ON "stores" USING btree ("doom_at");--> statement-breakpoint
CREATE UNIQUE INDEX "categories_store_slug_uq" ON "categories" USING btree ("store_id","slug");--> statement-breakpoint
CREATE INDEX "categories_store_idx" ON "categories" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "variants_product_idx" ON "product_variants" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "variants_store_idx" ON "product_variants" USING btree ("store_id");--> statement-breakpoint
CREATE UNIQUE INDEX "products_store_slug_uq" ON "products" USING btree ("store_id","slug");--> statement-breakpoint
CREATE INDEX "products_store_status_idx" ON "products" USING btree ("store_id","status");--> statement-breakpoint
CREATE INDEX "products_store_category_idx" ON "products" USING btree ("store_id","category_id");--> statement-breakpoint
CREATE INDEX "products_search_trgm_idx" ON "products" USING gin ("search_text" gin_trgm_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "abandoned_store_visitor_uq" ON "abandoned_carts" USING btree ("store_id","visitor_id");--> statement-breakpoint
CREATE UNIQUE INDEX "customers_store_phone_uq" ON "customers" USING btree ("store_id","phone");--> statement-breakpoint
CREATE INDEX "customers_store_email_idx" ON "customers" USING btree ("store_id","email");--> statement-breakpoint
CREATE UNIQUE INDEX "discounts_store_code_uq" ON "discounts" USING btree ("store_id","code");--> statement-breakpoint
CREATE INDEX "order_items_order_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_items_product_idx" ON "order_items" USING btree ("store_id","product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_store_code_uq" ON "orders" USING btree ("store_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_store_idempotency_uq" ON "orders" USING btree ("store_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "orders_store_status_idx" ON "orders" USING btree ("store_id","status");--> statement-breakpoint
CREATE INDEX "orders_store_created_idx" ON "orders" USING btree ("store_id","created_at");--> statement-breakpoint
CREATE INDEX "orders_phone_idx" ON "orders" USING btree ("store_id","customer_phone");--> statement-breakpoint
CREATE INDEX "payments_store_status_idx" ON "payments" USING btree ("store_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_order_under_review_uq" ON "payments" USING btree ("order_id") WHERE status = 'under_review';--> statement-breakpoint
CREATE INDEX "platform_payments_status_idx" ON "platform_payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "platform_payments_store_idx" ON "platform_payments" USING btree ("store_id");--> statement-breakpoint
CREATE UNIQUE INDEX "platform_payments_store_under_review_uq" ON "platform_payments" USING btree ("store_id") WHERE status = 'under_review';--> statement-breakpoint
CREATE INDEX "reviews_product_idx" ON "reviews" USING btree ("store_id","product_id");--> statement-breakpoint
CREATE INDEX "reviews_approved_idx" ON "reviews" USING btree ("store_id","is_approved");--> statement-breakpoint
CREATE UNIQUE INDEX "shipping_store_gov_uq" ON "shipping_zones" USING btree ("store_id","governorate");--> statement-breakpoint
CREATE INDEX "analytics_store_created_idx" ON "analytics_events" USING btree ("store_id","created_at");--> statement-breakpoint
CREATE INDEX "analytics_store_name_idx" ON "analytics_events" USING btree ("store_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "magic_links_token_uq" ON "magic_links" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "system_events_scope_idx" ON "system_events" USING btree ("scope","created_at");--> statement-breakpoint
CREATE INDEX "system_events_store_idx" ON "system_events" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "ai_calls_purpose_idx" ON "ai_calls" USING btree ("purpose","created_at");--> statement-breakpoint
CREATE INDEX "build_jobs_store_idx" ON "build_jobs" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "build_jobs_status_idx" ON "build_jobs" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "conv_channel_ext_uq" ON "conversations" USING btree ("channel","external_id");--> statement-breakpoint
CREATE INDEX "conv_stage_idx" ON "conversations" USING btree ("stage");--> statement-breakpoint
CREATE INDEX "conv_store_idx" ON "conversations" USING btree ("store_id");--> statement-breakpoint
CREATE UNIQUE INDEX "intakes_store_uq" ON "intakes" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "intakes_conv_idx" ON "intakes" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "messages_conv_idx" ON "messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "messages_mid_uq" ON "messages" USING btree ("external_mid");--> statement-breakpoint
CREATE INDEX "sched_store_kind_idx" ON "scheduled_jobs" USING btree ("store_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "sched_dedupe_uq" ON "scheduled_jobs" USING btree ("dedupe_key");--> statement-breakpoint
CREATE INDEX "sched_due_idx" ON "scheduled_jobs" USING btree ("status","run_at");--> statement-breakpoint
CREATE UNIQUE INDEX "onb_asset_key_uq" ON "onboarding_assets" USING btree ("key");--> statement-breakpoint
CREATE INDEX "onb_asset_conv_idx" ON "onboarding_assets" USING btree ("conversation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "onb_token_uq" ON "onboarding_sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "onb_active_conv_uq" ON "onboarding_sessions" USING btree ("conversation_id") WHERE "onboarding_sessions"."status" in ('issued','draft');--> statement-breakpoint
CREATE INDEX "onb_conv_idx" ON "onboarding_sessions" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "onb_store_idx" ON "onboarding_sessions" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "ai_directives_store_idx" ON "ai_directives" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "lifecycle_events_store_idx" ON "lifecycle_events" USING btree ("store_id","created_at");--> statement-breakpoint
CREATE INDEX "lifecycle_events_type_idx" ON "lifecycle_events" USING btree ("type","created_at");--> statement-breakpoint
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