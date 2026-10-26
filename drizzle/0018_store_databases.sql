CREATE TABLE "store_databases" (
	"store_id" uuid PRIMARY KEY NOT NULL,
	"url_enc" text NOT NULL,
	"host_hint" text DEFAULT '' NOT NULL,
	"switched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"platform_purge_at" timestamp with time zone NOT NULL,
	"platform_purged_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "store_db_transfers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"progress" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"target_url_enc" text,
	"error" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "store_databases" ADD CONSTRAINT "store_databases_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_db_transfers" ADD CONSTRAINT "store_db_transfers_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "store_db_transfers_store_idx" ON "store_db_transfers" USING btree ("store_id","created_at");