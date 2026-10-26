CREATE TABLE "edit_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"request_id" uuid NOT NULL,
	"merchant_id" uuid,
	"client_email" text NOT NULL,
	"title" text NOT NULL,
	"details" text NOT NULL,
	"files" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"is_free" boolean DEFAULT false NOT NULL,
	"fee_piasters" integer DEFAULT 0 NOT NULL,
	"paid_at" timestamp with time zone,
	"team_note" text,
	"assigned_to" uuid,
	"done_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "edit_requests_status_chk" CHECK ("edit_requests"."status" IN ('new', 'awaiting_payment', 'in_progress', 'done', 'declined'))
);
--> statement-breakpoint
ALTER TABLE "store_request_assets" DROP CONSTRAINT "store_request_assets_kind_chk";--> statement-breakpoint
ALTER TABLE "store_request_events" DROP CONSTRAINT "store_request_events_type_chk";--> statement-breakpoint
ALTER TABLE "store_requests" DROP CONSTRAINT "store_requests_status_chk";--> statement-breakpoint
ALTER TABLE "platform_payments" ALTER COLUMN "store_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "platform_payments" ALTER COLUMN "kind" SET DEFAULT 'project';--> statement-breakpoint
ALTER TABLE "platform_payments" ADD COLUMN "request_id" uuid;--> statement-breakpoint
ALTER TABLE "platform_payments" ADD COLUMN "edit_request_id" uuid;--> statement-breakpoint
ALTER TABLE "store_requests" ADD COLUMN "offer" text;--> statement-breakpoint
ALTER TABLE "store_requests" ADD COLUMN "confirmed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "store_requests" ADD COLUMN "delivered_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "store_requests" ADD COLUMN "free_edit_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "store_requests" ADD COLUMN "repo_url" text;--> statement-breakpoint
ALTER TABLE "store_requests" ADD COLUMN "store_url" text;--> statement-breakpoint
ALTER TABLE "edit_requests" ADD CONSTRAINT "edit_requests_request_id_store_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."store_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edit_requests" ADD CONSTRAINT "edit_requests_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edit_requests" ADD CONSTRAINT "edit_requests_assigned_to_platform_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."platform_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "edit_requests_code_uq" ON "edit_requests" USING btree ("code");--> statement-breakpoint
CREATE INDEX "edit_requests_request_idx" ON "edit_requests" USING btree ("request_id","created_at");--> statement-breakpoint
CREATE INDEX "edit_requests_status_idx" ON "edit_requests" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "edit_requests_email_idx" ON "edit_requests" USING btree ("client_email");--> statement-breakpoint
CREATE UNIQUE INDEX "edit_requests_one_free_uq" ON "edit_requests" USING btree ("request_id") WHERE is_free AND status <> 'declined';--> statement-breakpoint
ALTER TABLE "platform_payments" ADD CONSTRAINT "platform_payments_request_id_store_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."store_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_payments" ADD CONSTRAINT "platform_payments_edit_request_id_edit_requests_id_fk" FOREIGN KEY ("edit_request_id") REFERENCES "public"."edit_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "platform_payments_request_idx" ON "platform_payments" USING btree ("request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "platform_payments_request_under_review_uq" ON "platform_payments" USING btree ("request_id") WHERE status = 'under_review' AND kind = 'project';--> statement-breakpoint
CREATE UNIQUE INDEX "platform_payments_edit_under_review_uq" ON "platform_payments" USING btree ("edit_request_id") WHERE status = 'under_review' AND kind = 'edit';--> statement-breakpoint
CREATE INDEX "store_requests_merchant_idx" ON "store_requests" USING btree ("merchant_id");--> statement-breakpoint
ALTER TABLE "store_request_assets" ADD CONSTRAINT "store_request_assets_kind_chk" CHECK ("store_request_assets"."kind" IN ('image', 'logo', 'voice', 'receipt'));--> statement-breakpoint
ALTER TABLE "store_request_events" ADD CONSTRAINT "store_request_events_type_chk" CHECK ("store_request_events"."type" IN ('submitted', 'stage', 'note', 'edited', 'spam', 'restored', 'email', 'link', 'production', 'assign', 'qa', 'slug', 'provision', 'delivered', 'payment'));--> statement-breakpoint
ALTER TABLE "store_requests" ADD CONSTRAINT "store_requests_offer_chk" CHECK ("store_requests"."offer" IS NULL OR "store_requests"."offer" IN ('golden', 'standard'));--> statement-breakpoint
ALTER TABLE "store_requests" ADD CONSTRAINT "store_requests_status_chk" CHECK ("store_requests"."status" IN ('draft', 'awaiting_payment', 'submitted', 'spam', 'withdrawn', 'converted'));