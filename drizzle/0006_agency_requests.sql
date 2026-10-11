CREATE TABLE "store_request_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"key" text NOT NULL,
	"url" text NOT NULL,
	"kind" text NOT NULL,
	"mime" text,
	"size_bytes" integer,
	"duration_ms" integer,
	"transcript" text,
	"transcript_status" text DEFAULT 'none' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "store_request_assets_kind_chk" CHECK ("store_request_assets"."kind" IN ('image', 'logo', 'voice')),
	CONSTRAINT "store_request_assets_transcript_chk" CHECK ("store_request_assets"."transcript_status" IN ('none', 'pending', 'done', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "store_request_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"type" text NOT NULL,
	"from_stage" text,
	"to_stage" text,
	"client_note" text,
	"internal_note" text,
	"actor" text NOT NULL,
	"client_notified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "store_request_events_type_chk" CHECK ("store_request_events"."type" IN ('submitted', 'stage', 'note', 'edited', 'spam', 'restored', 'email', 'link'))
);
--> statement-breakpoint
CREATE TABLE "store_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"stage" text,
	"stage_note" text,
	"stage_changed_at" timestamp with time zone,
	"draft_token_hash" text NOT NULL,
	"track_token_hash" text,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"draft_version" integer DEFAULT 0 NOT NULL,
	"store_name" text,
	"email" text,
	"email_confirmed_at" timestamp with time zone,
	"whatsapp" text,
	"source" text DEFAULT 'web' NOT NULL,
	"conversation_id" uuid,
	"utm" jsonb,
	"ip_hash" text,
	"user_agent" text,
	"eta_from" timestamp with time zone,
	"eta_to" timestamp with time zone,
	"seen_at" timestamp with time zone,
	"seen_by" uuid,
	"store_id" uuid,
	"merchant_id" uuid,
	"client_emailed_at" timestamp with time zone,
	"team_notified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"submitted_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone,
	CONSTRAINT "store_requests_status_chk" CHECK ("store_requests"."status" IN ('draft', 'submitted', 'spam', 'withdrawn', 'converted')),
	CONSTRAINT "store_requests_stage_chk" CHECK ("store_requests"."stage" IS NULL OR "store_requests"."stage" IN ('received', 'design', 'build', 'review', 'delivery')),
	CONSTRAINT "store_requests_source_chk" CHECK ("store_requests"."source" IN ('web', 'messenger', 'instagram', 'agent'))
);
--> statement-breakpoint
ALTER TABLE "store_request_assets" ADD CONSTRAINT "store_request_assets_request_id_store_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."store_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_request_events" ADD CONSTRAINT "store_request_events_request_id_store_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."store_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_requests" ADD CONSTRAINT "store_requests_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_requests" ADD CONSTRAINT "store_requests_seen_by_platform_users_id_fk" FOREIGN KEY ("seen_by") REFERENCES "public"."platform_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_requests" ADD CONSTRAINT "store_requests_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_requests" ADD CONSTRAINT "store_requests_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "store_request_assets_key_uq" ON "store_request_assets" USING btree ("key");--> statement-breakpoint
CREATE INDEX "store_request_assets_request_idx" ON "store_request_assets" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "store_request_events_request_idx" ON "store_request_events" USING btree ("request_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "store_requests_code_uq" ON "store_requests" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "store_requests_draft_token_uq" ON "store_requests" USING btree ("draft_token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "store_requests_track_token_uq" ON "store_requests" USING btree ("track_token_hash");--> statement-breakpoint
CREATE INDEX "store_requests_status_idx" ON "store_requests" USING btree ("status","submitted_at");--> statement-breakpoint
CREATE INDEX "store_requests_stage_idx" ON "store_requests" USING btree ("stage");--> statement-breakpoint
CREATE INDEX "store_requests_email_idx" ON "store_requests" USING btree ("email");--> statement-breakpoint
CREATE INDEX "store_requests_whatsapp_idx" ON "store_requests" USING btree ("whatsapp");--> statement-breakpoint
CREATE INDEX "store_requests_conversation_idx" ON "store_requests" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "store_requests_expires_idx" ON "store_requests" USING btree ("expires_at");