CREATE TYPE "public"."channel" AS ENUM('messenger', 'instagram');--> statement-breakpoint
CREATE TYPE "public"."conv_stage" AS ENUM('greeting', 'discovery', 'persuasion', 'trial_offer', 'brief', 'products', 'policies', 'summary', 'handoff', 'building', 'delivered', 'trial', 'payment', 'activated', 'frozen', 'lost', 'human');--> statement-breakpoint
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
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "build_jobs" ADD CONSTRAINT "build_jobs_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "build_jobs" ADD CONSTRAINT "build_jobs_intake_id_intakes_id_fk" FOREIGN KEY ("intake_id") REFERENCES "public"."intakes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intakes" ADD CONSTRAINT "intakes_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intakes" ADD CONSTRAINT "intakes_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_jobs" ADD CONSTRAINT "scheduled_jobs_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_calls_purpose_idx" ON "ai_calls" USING btree ("purpose","created_at");--> statement-breakpoint
CREATE INDEX "build_jobs_store_idx" ON "build_jobs" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "build_jobs_status_idx" ON "build_jobs" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "conv_channel_ext_uq" ON "conversations" USING btree ("channel","external_id");--> statement-breakpoint
CREATE INDEX "conv_stage_idx" ON "conversations" USING btree ("stage");--> statement-breakpoint
CREATE INDEX "conv_store_idx" ON "conversations" USING btree ("store_id");--> statement-breakpoint
CREATE UNIQUE INDEX "intakes_conv_uq" ON "intakes" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "messages_conv_idx" ON "messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "messages_mid_uq" ON "messages" USING btree ("external_mid");--> statement-breakpoint
CREATE INDEX "sched_store_kind_idx" ON "scheduled_jobs" USING btree ("store_id","kind");