CREATE TABLE "store_change_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"merchant_id" uuid,
	"area" text NOT NULL,
	"body" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"team_note" text,
	"assigned_to" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"done_at" timestamp with time zone,
	CONSTRAINT "store_change_requests_status_chk" CHECK ("store_change_requests"."status" IN ('open', 'in_progress', 'done', 'declined')),
	CONSTRAINT "store_change_requests_area_chk" CHECK ("store_change_requests"."area" IN ('design', 'products', 'content', 'other'))
);
--> statement-breakpoint
ALTER TABLE "store_change_requests" ADD CONSTRAINT "store_change_requests_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_change_requests" ADD CONSTRAINT "store_change_requests_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "store_change_requests_store_idx" ON "store_change_requests" USING btree ("store_id","created_at");--> statement-breakpoint
CREATE INDEX "store_change_requests_status_idx" ON "store_change_requests" USING btree ("status","created_at");