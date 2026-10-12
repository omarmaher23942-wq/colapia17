CREATE TABLE "store_secrets" (
	"store_id" uuid PRIMARY KEY NOT NULL,
	"meta_capi_token" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "store_secrets" ADD CONSTRAINT "store_secrets_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;