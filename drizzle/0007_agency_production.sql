ALTER TYPE "public"."platform_role" ADD VALUE 'builder';--> statement-breakpoint
ALTER TYPE "public"."platform_role" ADD VALUE 'sales';--> statement-breakpoint
CREATE TABLE "platform_activity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"action" text NOT NULL,
	"target" text,
	"meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "store_request_events" DROP CONSTRAINT "store_request_events_type_chk";--> statement-breakpoint
ALTER TABLE "platform_users" ADD COLUMN "avatar_url" text;--> statement-breakpoint
ALTER TABLE "platform_users" ADD COLUMN "invited_by" uuid;--> statement-breakpoint
ALTER TABLE "store_requests" ADD COLUMN "production" text DEFAULT 'new' NOT NULL;--> statement-breakpoint
ALTER TABLE "store_requests" ADD COLUMN "production_changed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "store_requests" ADD COLUMN "builder_id" uuid;--> statement-breakpoint
ALTER TABLE "store_requests" ADD COLUMN "reviewer_id" uuid;--> statement-breakpoint
ALTER TABLE "store_requests" ADD COLUMN "slug" text;--> statement-breakpoint
ALTER TABLE "store_requests" ADD COLUMN "qa" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "store_requests" ADD COLUMN "approved_by" uuid;--> statement-breakpoint
ALTER TABLE "store_requests" ADD COLUMN "approved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "store_requests" ADD COLUMN "round" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "store_requests" ADD COLUMN "waiting_reason" text;--> statement-breakpoint
ALTER TABLE "store_requests" ADD COLUMN "waiting_since" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "store_requests" ADD COLUMN "client_data" jsonb;--> statement-breakpoint
ALTER TABLE "store_requests" ADD COLUMN "sla_alerted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "platform_activity" ADD CONSTRAINT "platform_activity_actor_id_platform_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."platform_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "platform_activity_created_idx" ON "platform_activity" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "platform_activity_actor_idx" ON "platform_activity" USING btree ("actor_id","created_at");--> statement-breakpoint
ALTER TABLE "store_requests" ADD CONSTRAINT "store_requests_builder_id_platform_users_id_fk" FOREIGN KEY ("builder_id") REFERENCES "public"."platform_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_requests" ADD CONSTRAINT "store_requests_reviewer_id_platform_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."platform_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_requests" ADD CONSTRAINT "store_requests_approved_by_platform_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."platform_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "store_requests_production_idx" ON "store_requests" USING btree ("production");--> statement-breakpoint
CREATE INDEX "store_requests_builder_idx" ON "store_requests" USING btree ("builder_id");--> statement-breakpoint
CREATE INDEX "store_requests_reviewer_idx" ON "store_requests" USING btree ("reviewer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "store_requests_slug_uq" ON "store_requests" USING btree ("slug");--> statement-breakpoint
ALTER TABLE "store_request_events" ADD CONSTRAINT "store_request_events_type_chk" CHECK ("store_request_events"."type" IN ('submitted', 'stage', 'note', 'edited', 'spam', 'restored', 'email', 'link', 'production', 'assign', 'qa', 'slug', 'provision', 'delivered'));--> statement-breakpoint
ALTER TABLE "store_requests" ADD CONSTRAINT "store_requests_production_chk" CHECK ("store_requests"."production" IN ('new', 'assigned', 'building', 'review', 'ready', 'delivered'));--> statement-breakpoint
UPDATE "store_requests" SET "production" = 'delivered' WHERE "stage" = 'delivery';--> statement-breakpoint
UPDATE "store_requests" SET "production_changed_at" = coalesce("stage_changed_at", "submitted_at", "created_at") WHERE "status" <> 'draft';
