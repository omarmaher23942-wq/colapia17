ALTER TABLE "stores" ADD COLUMN "custom_domain_status" text;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "custom_domain_checked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "custom_domain_verified_at" timestamp with time zone;