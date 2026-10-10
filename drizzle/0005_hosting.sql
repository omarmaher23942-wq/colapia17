ALTER TABLE "stores" ADD COLUMN "hosting_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "platform_offline_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "platform_payments" ADD COLUMN "kind" text DEFAULT 'setup' NOT NULL;--> statement-breakpoint
ALTER TABLE "platform_payments" ADD COLUMN "covers_until" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "stores_hosting_expires_idx" ON "stores" USING btree ("hosting_expires_at");--> statement-breakpoint
-- أي متجر مفعَّل قبل نموذج الاستضافة: سنة من تاريخ تفعيله (لا يتوقف متجر فجأة بعد الترقية).
UPDATE "stores" SET "hosting_expires_at" = "activated_at" + interval '1 year' WHERE "status" = 'active' AND "activated_at" IS NOT NULL AND "hosting_expires_at" IS NULL;
