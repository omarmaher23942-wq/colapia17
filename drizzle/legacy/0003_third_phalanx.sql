ALTER TYPE "public"."store_status" ADD VALUE 'pending_review' BEFORE 'building';--> statement-breakpoint
ALTER TYPE "public"."conv_stage" ADD VALUE 'link_sent' BEFORE 'brief';--> statement-breakpoint
ALTER TYPE "public"."conv_stage" ADD VALUE 'form_submitted' BEFORE 'brief';--> statement-breakpoint
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
ALTER TABLE "stores" ADD COLUMN "submitted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "review_deadline_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "payment_invited_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "doom_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN "image_urls" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "option_meta" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "ai_draft" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "is_test" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "scheduled_jobs" ADD COLUMN "dedupe_key" text;--> statement-breakpoint
ALTER TABLE "scheduled_jobs" ADD COLUMN "payload" jsonb;--> statement-breakpoint
ALTER TABLE "scheduled_jobs" ADD COLUMN "attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "scheduled_jobs" ADD COLUMN "fired_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "scheduled_jobs" ADD COLUMN "last_error" text;--> statement-breakpoint
ALTER TABLE "onboarding_assets" ADD CONSTRAINT "onboarding_assets_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_sessions" ADD CONSTRAINT "onboarding_sessions_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_sessions" ADD CONSTRAINT "onboarding_sessions_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_directives" ADD CONSTRAINT "ai_directives_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_directives" ADD CONSTRAINT "ai_directives_created_by_platform_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."platform_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lifecycle_events" ADD CONSTRAINT "lifecycle_events_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lifecycle_events" ADD CONSTRAINT "lifecycle_events_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "onb_asset_key_uq" ON "onboarding_assets" USING btree ("key");--> statement-breakpoint
CREATE INDEX "onb_asset_conv_idx" ON "onboarding_assets" USING btree ("conversation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "onb_token_uq" ON "onboarding_sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "onb_active_conv_uq" ON "onboarding_sessions" USING btree ("conversation_id") WHERE "onboarding_sessions"."status" in ('issued','draft');--> statement-breakpoint
CREATE INDEX "onb_conv_idx" ON "onboarding_sessions" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "onb_store_idx" ON "onboarding_sessions" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "ai_directives_store_idx" ON "ai_directives" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "lifecycle_events_store_idx" ON "lifecycle_events" USING btree ("store_id","created_at");--> statement-breakpoint
CREATE INDEX "lifecycle_events_type_idx" ON "lifecycle_events" USING btree ("type","created_at");--> statement-breakpoint
CREATE INDEX "stores_review_deadline_idx" ON "stores" USING btree ("review_deadline_at");--> statement-breakpoint
CREATE INDEX "stores_doom_at_idx" ON "stores" USING btree ("doom_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sched_dedupe_uq" ON "scheduled_jobs" USING btree ("dedupe_key");--> statement-breakpoint
CREATE INDEX "sched_due_idx" ON "scheduled_jobs" USING btree ("status","run_at");
UPDATE scheduled_jobs SET status = 'done' WHERE status = 'scheduled' AND run_at < now();