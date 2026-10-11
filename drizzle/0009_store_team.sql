CREATE TABLE "store_activity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"merchant_id" uuid,
	"action" text NOT NULL,
	"target" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"email" text NOT NULL,
	"merchant_id" uuid,
	"name" text,
	"role" text NOT NULL,
	"perms" jsonb,
	"status" text DEFAULT 'active' NOT NULL,
	"invited_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_active_at" timestamp with time zone,
	CONSTRAINT "store_members_status_chk" CHECK ("store_members"."status" IN ('active', 'removed'))
);
--> statement-breakpoint
ALTER TABLE "store_activity" ADD CONSTRAINT "store_activity_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_activity" ADD CONSTRAINT "store_activity_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_members" ADD CONSTRAINT "store_members_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_members" ADD CONSTRAINT "store_members_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_members" ADD CONSTRAINT "store_members_invited_by_merchants_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."merchants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "store_activity_store_idx" ON "store_activity" USING btree ("store_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "store_members_store_email_uq" ON "store_members" USING btree ("store_id","email");--> statement-breakpoint
CREATE INDEX "store_members_merchant_idx" ON "store_members" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "store_members_email_idx" ON "store_members" USING btree ("email");