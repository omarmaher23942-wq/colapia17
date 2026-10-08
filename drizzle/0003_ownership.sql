CREATE TABLE "store_transfers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"status" text DEFAULT 'issued' NOT NULL,
	"site_url" text,
	"stats" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "store_transfers_status_chk" CHECK ("store_transfers"."status" IN ('issued', 'importing', 'completed', 'revoked'))
);
--> statement-breakpoint
ALTER TABLE "data_plane_migrations" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "store_credentials" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "data_plane_migrations" CASCADE;--> statement-breakpoint
DROP TABLE "store_credentials" CASCADE;--> statement-breakpoint
ALTER TABLE "stores" DROP CONSTRAINT "stores_data_plane_chk";--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "owned_url" text;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "owned_repo" text;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "owned_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "purge_after" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "purged_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "store_transfers" ADD CONSTRAINT "store_transfers_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "store_transfers_token_uq" ON "store_transfers" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "store_transfers_store_idx" ON "store_transfers" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "stores_purge_after_idx" ON "stores" USING btree ("purge_after");--> statement-breakpoint
ALTER TABLE "stores" DROP COLUMN "data_plane";--> statement-breakpoint
ALTER TABLE "stores" DROP COLUMN "write_locked_until";