CREATE TABLE "data_plane_migrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"step" text DEFAULT 'verify' NOT NULL,
	"cursor_table" text,
	"cursor_id" text,
	"progress" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error" text,
	"started_by" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "store_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"ciphertext" text NOT NULL,
	"key_version" integer DEFAULT 1 NOT NULL,
	"hint" text NOT NULL,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'unverified' NOT NULL,
	"last_checked_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "store_credentials_provider_chk" CHECK ("store_credentials"."provider" IN ('neon', 'groq', 'uploadthing')),
	CONSTRAINT "store_credentials_status_chk" CHECK ("store_credentials"."status" IN ('unverified', 'ok', 'failed'))
);
--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "write_locked_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "data_plane_migrations" ADD CONSTRAINT "data_plane_migrations_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_credentials" ADD CONSTRAINT "store_credentials_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dpm_store_idx" ON "data_plane_migrations" USING btree ("store_id");--> statement-breakpoint
CREATE UNIQUE INDEX "dpm_store_running_uq" ON "data_plane_migrations" USING btree ("store_id") WHERE "data_plane_migrations"."status" = 'running';--> statement-breakpoint
CREATE UNIQUE INDEX "store_credentials_store_provider_uq" ON "store_credentials" USING btree ("store_id","provider");--> statement-breakpoint
CREATE INDEX "store_credentials_status_idx" ON "store_credentials" USING btree ("status");