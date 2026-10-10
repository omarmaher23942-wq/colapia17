ALTER TABLE "stores" ADD COLUMN "hosting_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "platform_offline_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "stores_hosting_expires_idx" ON "stores" USING btree ("hosting_expires_at");